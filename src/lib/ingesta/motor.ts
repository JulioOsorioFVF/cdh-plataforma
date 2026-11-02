/**
 * Motor de ingesta: la unica puerta de entrada de datos a la plataforma.
 *
 * El trabajo se parte en dos fases deliberadamente:
 *
 *   1. RECIBIR    descarga (o recibe el archivo), estandariza y valida. Es
 *                 rapida y deja todo en staging. Si algo esta mal, se ve aqui.
 *   2. CARGAR     promueve las filas aceptadas a las tablas de hechos, en
 *                 tandas, reportando progreso. Es la parte lenta.
 *
 * Separarlas permite que la web responda de inmediato (con el lote creado y su
 * diagnostico) y que la carga siga en segundo plano escribiendo el avance en
 * `stg_lote`. Si el proceso muere a la mitad, el lote queda en CARGANDO con su
 * contador: relanzar es seguro porque la carga es idempotente por hash.
 */
import { EstadoFila, EstadoIngesta, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Analizador, contarPorCodigo, type ResultadoFila } from './validar';
import { CONTRATOS, compararEsquema } from './contratos';
import { detectarSeparador, leerTabla } from './csv';
import { ingestaCompetencias } from './competencias';
import { ingestaExpedientes } from './expedientes';
import { buscarFuente, huella, type ClaveDocumento } from './fuentes';
import { actualizarLote, crearLote, guardarFilas, marcarFilasCargadas } from './lotes';

export type Entrada = {
  clave: ClaveDocumento;
  contenido: string;
  fuente: 'GOOGLE_SHEETS' | 'ARCHIVO';
  url?: string | null;
  archivo?: string | null;
  usuarioId?: number | null;
};

export type Recepcion = {
  loteId: number;
  documento: 'COMPETENCIAS' | 'EXPEDIENTES';
  filasLeidas: number;
  validas: number;
  advertencias: number;
  rechazadas: number;
  omitidas: number;
  esquema: { ok: boolean; faltantes: string[]; sobrantes: string[] };
  calidad: Record<string, number>;
  /** Filas aceptadas, en crudo, para la fase de carga. */
  aceptadas: string[][];
};

const TANDA_CARGA = 2000;

/** Fase 1: estandarizar, validar y dejar constancia en staging. */
export async function recibir(entrada: Entrada): Promise<Recepcion> {
  const contrato = CONTRATOS[entrada.clave];
  const separador = detectarSeparador(entrada.contenido);
  const { encabezados, filas } = leerTabla(entrada.contenido);

  if (filas.length === 0) {
    throw new Error('El archivo no tiene filas de datos (solo encabezados o vacío).');
  }

  const esquema = compararEsquema(contrato, encabezados);

  const loteId = await crearLote({
    documento: contrato.documento,
    fuente: entrada.fuente,
    url: entrada.url ?? null,
    archivo: entrada.archivo ?? null,
    huella: huella(entrada.contenido),
    separador,
    encabezados,
    esquemaOk: esquema.ok,
    columnasFaltantes: esquema.faltantes,
    motorVersion: contrato.version,
    usuarioId: entrada.usuarioId ?? null,
  });

  const analizador = new Analizador(contrato);
  const resultados: ResultadoFila[] = [];
  const aceptadas: string[][] = [];
  let omitidas = 0;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]!;
    const motivoArtefacto = contrato.esArtefacto?.(fila) ?? null;
    if (motivoArtefacto) {
      omitidas++;
      continue;
    }

    const r = analizador.analizar(fila, i + 1);
    resultados.push(r);
    if (r.estado !== 'RECHAZADA') aceptadas.push(fila);
  }

  await guardarFilas(
    loteId,
    resultados.map((r) => ({
      numeroFila: r.numeroFila,
      hash: r.hash,
      estado: r.estado as EstadoFila,
      errores: r.errores.length ? (r.errores as unknown as Prisma.InputJsonValue) : null,
      avisos: r.avisos.length ? (r.avisos as unknown as Prisma.InputJsonValue) : null,
      // Se conserva la fila completa para reconstruir las columnas posicionales
      // cuando un usuario confirme la carga desde la web.
      crudo: filas[r.numeroFila - 1] as unknown as Prisma.InputJsonValue,
    })),
  );

  const validas = resultados.filter((r) => r.estado === 'VALIDA').length;
  const advertencias = resultados.filter((r) => r.estado === 'ADVERTENCIA').length;
  const rechazadas = resultados.filter((r) => r.estado === 'RECHAZADA').length;
  const calidad = contarPorCodigo(resultados);

  await actualizarLote(loteId, {
    fase: 'ESTANDARIZADO',
    estado: EstadoIngesta.VALIDADO,
    filasLeidas: filas.length,
    filasValidas: validas,
    filasAdvertencia: advertencias,
    filasRechazadas: rechazadas,
    filasOmitidas: omitidas,
    perfil: analizador.perfilColumnas() as unknown as Prisma.InputJsonValue,
    mensaje: esquema.ok
      ? null
      : `El archivo no trae ${esquema.faltantes.length} columna(s) del contrato: ${esquema.faltantes
          .slice(0, 5)
          .join(', ')}`,
  });

  return {
    loteId,
    documento: contrato.documento,
    filasLeidas: filas.length,
    validas,
    advertencias,
    rechazadas,
    omitidas,
    esquema,
    calidad,
    aceptadas,
  };
}

/** Fase 2: promover a las tablas de hechos, en tandas y con progreso. */
export async function cargar(args: {
  loteId: number;
  clave: ClaveDocumento;
  filas: string[][];
  archivo: string;
  url?: string | null;
  fuente: 'GOOGLE_SHEETS' | 'ARCHIVO';
  usuarioId?: number | null;
}): Promise<void> {
  const fuente = buscarFuente(args.clave);
  const inicio = Date.now();

  const log = await prisma.ingesta_log.create({
    data: {
      fuente: args.fuente,
      documento: fuente.documento,
      url: args.url ?? null,
      hojaGid: args.fuente === 'GOOGLE_SHEETS' ? fuente.gid : null,
      estado: EstadoIngesta.PROCESANDO,
      usuarioId: args.usuarioId ?? null,
    },
    select: { id: true },
  });

  await actualizarLote(args.loteId, {
    fase: 'CARGANDO',
    estado: EstadoIngesta.PROCESANDO,
    ingestaLogId: log.id,
  });

  let insertadas = 0;
  let actualizadas = 0;
  let omitidasCarga = 0;
  const dimensiones: Record<string, number> = {};
  const motor = args.clave === 'competencias' ? ingestaCompetencias : ingestaExpedientes;

  try {
    for (let i = 0; i < args.filas.length; i += TANDA_CARGA) {
      const tanda = args.filas.slice(i, i + TANDA_CARGA);
      const r = await motor(prisma, tanda, args.archivo);

      insertadas += r.insertadas;
      actualizadas += r.actualizadas;
      omitidasCarga += r.omitidas;
      for (const [dim, n] of Object.entries(r.dimensiones)) {
        dimensiones[dim] = (dimensiones[dim] ?? 0) + n;
      }

      await actualizarLote(args.loteId, {
        filasCargadas: Math.min(i + tanda.length, args.filas.length),
      });
    }

    await marcarFilasCargadas(args.loteId);

    const duracion = Date.now() - inicio;
    await actualizarLote(args.loteId, {
      estado: EstadoIngesta.CARGADO,
      fase: 'TERMINADO',
      filasCargadas: args.filas.length,
      duracionMs: duracion,
      finalizadaEn: new Date(),
      mensaje: null,
    });

    await prisma.ingesta_log.update({
      where: { id: log.id },
      data: {
        estado: EstadoIngesta.CARGADO,
        filasLeidas: args.filas.length,
        filasInsertadas: insertadas,
        filasActualizadas: actualizadas,
        filasOmitidas: omitidasCarga,
        duracionMs: duracion,
        finalizadaEn: new Date(),
        detalle: {
          dimensiones,
          loteId: args.loteId,
          formato: 'estandarizado',
        } as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    const duracion = Date.now() - inicio;

    await actualizarLote(args.loteId, {
      estado: EstadoIngesta.CON_ERRORES,
      fase: 'ERROR',
      mensaje,
      duracionMs: duracion,
      finalizadaEn: new Date(),
    });

    await prisma.ingesta_log.update({
      where: { id: log.id },
      data: {
        estado: EstadoIngesta.CON_ERRORES,
        mensaje,
        duracionMs: duracion,
        finalizadaEn: new Date(),
        filasLeidas: args.filas.length,
        filasInsertadas: insertadas,
        filasActualizadas: actualizadas,
      },
    });

    throw e;
  }
}

/**
 * Registro de trabajos vivos en este proceso.
 *
 * Sirve para dos cosas: que el recolector de basura no se lleve la promesa que
 * esta cargando, y que la web pueda saber si ya hay una carga en marcha sin
 * preguntar a la base.
 */
const EN_CURSO = new Map<string, Promise<void>>();

export function lanzarCarga(args: Parameters<typeof cargar>[0]): void {
  const clave = `${args.loteId}`;
  if (EN_CURSO.has(clave)) return;

  const tarea = cargar(args)
    .catch(() => {
      // `cargar` ya dejo el error registrado en el lote y en la bitacora.
    })
    .finally(() => {
      EN_CURSO.delete(clave);
    });

  EN_CURSO.set(clave, tarea);
}

export function hayCargaEnMemoria(loteId: number): boolean {
  return EN_CURSO.has(`${loteId}`);
}

/** Flujo completo en un solo paso, para la CLI y para pruebas. */
export async function ingerirTodo(entrada: Entrada): Promise<Recepcion & { loteId: number }> {
  const r = await recibir(entrada);
  await cargar({
    loteId: r.loteId,
    clave: entrada.clave,
    filas: r.aceptadas,
    archivo: entrada.archivo ?? buscarFuente(entrada.clave).archivo,
    url: entrada.url ?? null,
    fuente: entrada.fuente,
    usuarioId: entrada.usuarioId ?? null,
  });
  return r;
}
