/**
 * Persistencia de la capa de staging.
 *
 * Un lote es una corrida completa: su cabecera (`stg_lote`) guarda el contrato,
 * el origen, el perfil de columnas y los contadores; sus filas (`stg_fila`)
 * guardan la huella de cada registro y, si hubo problemas, el contenido crudo.
 */
import { EstadoFila, EstadoIngesta, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type FilaParaGuardar = {
  numeroFila: number;
  hash: string;
  estado: EstadoFila;
  errores: Prisma.InputJsonValue | null;
  avisos: Prisma.InputJsonValue | null;
  crudo: Prisma.InputJsonValue | null;
};

export type NuevoLote = {
  documento: 'COMPETENCIAS' | 'EXPEDIENTES';
  fuente: 'GOOGLE_SHEETS' | 'ARCHIVO';
  url?: string | null;
  archivo?: string | null;
  huella: string;
  separador: string;
  encabezados: string[];
  esquemaOk: boolean;
  columnasFaltantes: string[];
  motorVersion: string;
  usuarioId?: number | null;
};

export async function crearLote(datos: NuevoLote): Promise<number> {
  const lote = await prisma.stg_lote.create({
    data: {
      documento: datos.documento,
      fuente: datos.fuente,
      url: datos.url ?? null,
      archivo: datos.archivo ?? null,
      huella: datos.huella,
      separador: datos.separador,
      encabezados: datos.encabezados,
      esquemaOk: datos.esquemaOk,
      columnasFaltantes: datos.columnasFaltantes,
      motorVersion: datos.motorVersion,
      usuarioId: datos.usuarioId ?? null,
      estado: EstadoIngesta.PROCESANDO,
      fase: 'RECIBIDO',
    },
    select: { id: true },
  });
  return lote.id;
}

const TANDA = 1000;

/** Inserta las filas en tandas: 27.000 inserts sueltos tardarian media hora. */
export async function guardarFilas(loteId: number, filas: FilaParaGuardar[]): Promise<void> {
  for (let i = 0; i < filas.length; i += TANDA) {
    const tanda = filas.slice(i, i + TANDA);
    await prisma.stg_fila.createMany({
      data: tanda.map((f) => ({
        loteId,
        numeroFila: f.numeroFila,
        hash: f.hash,
        estado: f.estado,
        errores: f.errores === null ? Prisma.JsonNull : f.errores,
        avisos: f.avisos === null ? Prisma.JsonNull : f.avisos,
        crudo: f.crudo === null ? Prisma.JsonNull : f.crudo,
      })),
    });
  }
}

export async function actualizarLote(
  loteId: number,
  datos: Prisma.stg_loteUpdateInput,
): Promise<void> {
  await prisma.stg_lote.update({ where: { id: loteId }, data: datos });
}

export async function marcarFilasCargadas(loteId: number): Promise<void> {
  await prisma.stg_fila.updateMany({
    where: { loteId, estado: { in: [EstadoFila.VALIDA, EstadoFila.ADVERTENCIA] } },
    data: { estado: EstadoFila.CARGADA },
  });
}

/** Lote en curso para un documento, si lo hay (evita dos corridas a la vez). */
export async function loteEnCurso(documento: string): Promise<{ id: number; iniciadaEn: Date } | null> {
  const lote = await prisma.stg_lote.findFirst({
    where: { documento, estado: EstadoIngesta.PROCESANDO },
    orderBy: { iniciadaEn: 'desc' },
    select: { id: true, iniciadaEn: true },
  });
  return lote;
}

/** Ultimos lotes de un documento, con sus contadores. */
export async function ultimosLotes(limite = 10) {
  const lotes = await prisma.stg_lote.findMany({
    orderBy: { iniciadaEn: 'desc' },
    take: limite,
    select: {
      id: true,
      documento: true,
      fuente: true,
      archivo: true,
      estado: true,
      fase: true,
      filasLeidas: true,
      filasValidas: true,
      filasAdvertencia: true,
      filasRechazadas: true,
      filasCargadas: true,
      filasOmitidas: true,
      esquemaOk: true,
      mensaje: true,
      duracionMs: true,
      iniciadaEn: true,
      finalizadaEn: true,
      usuario: { select: { nombre: true } },
    },
  });
  return lotes.map(aVista);
}

/**
 * Forma serializable de un lote.
 *
 * Las paginas y las rutas de la API devuelven exactamente esto, para que el
 * cliente no dependa de los nombres internos de Prisma ni de los tipos `Date`.
 */
export type LoteVista = {
  id: number;
  documento: string;
  fuente: string;
  archivo: string | null;
  estado: string;
  fase: string;
  filasLeidas: number;
  filasValidas: number;
  filasAdvertencia: number;
  filasRechazadas: number;
  filasCargadas: number;
  filasOmitidas: number;
  esquemaOk: boolean;
  mensaje: string | null;
  duracionMs: number | null;
  iniciadaEn: string;
  finalizadaEn: string | null;
  usuario: string | null;
};

type LoteCrudo = {
  id: number;
  documento: string;
  fuente: string;
  archivo: string | null;
  estado: string;
  fase: string;
  filasLeidas: number;
  filasValidas: number;
  filasAdvertencia: number;
  filasRechazadas: number;
  filasCargadas: number;
  filasOmitidas: number;
  esquemaOk: boolean;
  mensaje: string | null;
  duracionMs: number | null;
  iniciadaEn: Date;
  finalizadaEn: Date | null;
  usuario: { nombre: string } | null;
};

export function aVista(lote: LoteCrudo): LoteVista {
  return {
    id: lote.id,
    documento: lote.documento,
    fuente: lote.fuente,
    archivo: lote.archivo,
    estado: lote.estado,
    fase: lote.fase,
    filasLeidas: lote.filasLeidas,
    filasValidas: lote.filasValidas,
    filasAdvertencia: lote.filasAdvertencia,
    filasRechazadas: lote.filasRechazadas,
    filasCargadas: lote.filasCargadas,
    filasOmitidas: lote.filasOmitidas,
    esquemaOk: lote.esquemaOk,
    mensaje: lote.mensaje,
    duracionMs: lote.duracionMs,
    iniciadaEn: lote.iniciadaEn.toISOString(),
    finalizadaEn: lote.finalizadaEn ? lote.finalizadaEn.toISOString() : null,
    usuario: lote.usuario?.nombre ?? null,
  };
}

/** Cabecera completa de un lote, con el perfil de columnas ya calculado. */
export async function obtenerLote(id: number) {
  const lote = await prisma.stg_lote.findUnique({
    where: { id },
    include: { usuario: { select: { nombre: true } } },
  });
  if (!lote) return null;
  return {
    ...aVista(lote),
    huella: lote.huella,
    separador: lote.separador,
    encabezados: Array.isArray(lote.encabezados) ? (lote.encabezados as string[]) : [],
    columnasFaltantes: Array.isArray(lote.columnasFaltantes) ? (lote.columnasFaltantes as string[]) : [],
    perfil: Array.isArray(lote.perfil) ? (lote.perfil as unknown[]) : [],
    motorVersion: lote.motorVersion,
    url: lote.url,
    ingestaLogId: lote.ingestaLogId,
  };
}

/** Filas rechazadas de un lote, listas para volcar a CSV. */
export async function filasRechazadas(loteId: number) {
  return prisma.stg_fila.findMany({
    where: { loteId, estado: EstadoFila.RECHAZADA },
    orderBy: { numeroFila: 'asc' },
    select: { numeroFila: true, errores: true, crudo: true },
  });
}

/** Muestra de filas aceptadas con su estado, para la vista previa del lote. */
export async function muestraFilas(loteId: number, limite = 25) {
  return prisma.stg_fila.findMany({
    where: { loteId },
    orderBy: { numeroFila: 'asc' },
    take: limite,
    select: { numeroFila: true, estado: true, hash: true },
  });
}
