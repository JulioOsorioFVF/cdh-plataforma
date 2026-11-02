/**
 * Ingesta del CUADRO DE EXPEDIENTES.
 *
 * La hoja tiene 36 columnas y 10.549 filas, pero solo 563 son expedientes
 * reales: el resto son artefactos de Google Sheets (el numero sale como "$0",
 * que es la celda de error de una fila borrada). Descartarlos aqui evita meter
 * expedientes falsos con numero 0.
 *
 * La hoja esta partida en tres bloques:
 *   0-16   datos del expediente (numero, ano, motivo, estado...)
 *   17-25  resolucion (fecha, numero de auto, decision, reconsideracion)
 *   26-35  segunda decision, observacion, sancion, multas y cumplimiento
 *
 * El numero de expediente se REUTILIZA cada ano (001 existe en 2022 y en 2025),
 * asi que la clave natural es la pareja (ano, numero), que es la unica que
 * declara el esquema.
 */
import {
  PrismaClient,
  EstadoExpediente,
  TipoMovimientoExpediente,
  TipoParte,
} from '@prisma/client';
import { celda } from './csv';
import { Dimensiones } from './dimensiones';
import { esNulo, hashFila, parseFecha, parseNumero, textoONulo } from './util';
import type { ResultadoIngesta } from './competencias';

const DOCUMENTO = 'EXPEDIENTES';

const C = {
  numero: 0,
  anio: 1,
  autoEntrada: 2,
  fechaAutoEntrada: 3,
  motivo: 4,
  asunto: 5,
  demandante: 6,
  demandada: 7,
  torneo: 8,
  equipos: 9,
  tramite: 10,
  modalidad: 11,
  asignado: 12,
  status: 13,
  fechaAsignacion: 14,
  fechaSeguimiento: 15,
  alerta: 16,
  fechaDecision: 17,
  anioDecision: 18,
  mes: 19,
  numeroDecision: 20,
  decision: 21,
  usurpacion: 22,
  segundaDecision: 23,
  reconsideracion: 24,
  fechaRR: 25,
  nroDecision2: 26,
  fechaDecision2: 27,
  decision2: 28,
  observaciones: 29,
  sancion: 30,
  sancionado: 31,
  multaUc: 32,
  multaUsd: 33,
  cumplimiento: 34,
  motivoCumplimiento: 35,
} as const;

/**
 * Traduce el STATUS libre de la hoja a los estados cerrados del esquema.
 *
 * La hoja tiene 32 textos distintos, casi todos notas ("Revisar con Conuelo",
 * "Lapso vence el 01/10/2026"). Se busca primero un termino que describa una
 * situacion y, si no hay, se deja como EN_ESTUDIO, que es lo que de verdad son.
 * El texto original se conserva en `estatus`, asi que no se pierde nada.
 */
function traducirEstado(status: string, tramite: string): EstadoExpediente {
  const s = `${status} ${tramite}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (/INADMIS/.test(s)) return EstadoExpediente.DESESTIMADO;
  if (/ARCHIVAD|CERRADO|CIERRE/.test(s)) return EstadoExpediente.ARCHIVADO;
  if (/REMISI/.test(s)) return EstadoExpediente.REMITIDO;
  if (/RECONSIDER|APELACION|RECURSO/.test(s)) return EstadoExpediente.EN_RECURSO;
  if (/NOTIFICAD/.test(s)) return EstadoExpediente.NOTIFICADO;
  if (/PARALIZAD|SIN DECISION/.test(s)) return EstadoExpediente.EN_ESTUDIO;
  if (/DECIDIDO TOTALMENTE/.test(s)) return EstadoExpediente.RESUELTO;
  if (/DECIDIDO/.test(s)) return EstadoExpediente.RESUELTO;
  if (/EN PROYECTO|EN INSTRUCCION|PENDIENTE|EN TRAMITE|TRAMITE/.test(s)) {
    return EstadoExpediente.EN_ESTUDIO;
  }
  return EstadoExpediente.RECIBIDO;
}

/** "01/01/2025", "2025-01-01" o un serial de Excel -> ISO, o null. */
function fecha(fila: string[], idx: number): string | null {
  return parseFecha(celda(fila, idx));
}

/** "Trámite" o "N° de usurpación y Fecha" pueden traer la referencia cruzada. */
function referenciaAcumulacion(texto: string): string | null {
  const m = texto.match(/(\d{3})\s*\/\s*(\d{4})/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Clasifica a la parte del expediente.
 *
 * La hoja no dice si el demandante es una persona o un club, y `TipoParte` es
 * obligatorio. Un nombre con cedula es una persona; con sufijo de club
 * ("F.C.", "S.C.", "C.A.") es un club; si no, COMISION, que es lo que son las
 * mayorias (la propia Comision de Disciplina demanda).
 */
function tipoDeParte(nombre: string): TipoParte {
  const n = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (/\b(F\.?C\.?|S\.?C\.?|C\.?A\.?|DEPORTIV[OA]|CLUB|UNIVERSITARI[OA]|U\.?T\.?)\b/.test(n)) {
    return TipoParte.CLUB;
  }
  if (/\b(ORGANIZADOR|COMISION|COMISION DE HONOR|DELTA|COCHEVA|FVF)\b/.test(n)) {
    return TipoParte.ORGANIZADOR;
  }
  if (/\bLIGA\b/.test(n)) return TipoParte.LIGA;
  if (
    /\b(ENTRENADOR|DIRECTOR TECNICO|DT|DELEGADO|MEDICO|ASISTENTE|PREPARADOR|MASADOR|UTILLERO|FISIOTERAPEUTA)\b/.test(
      n,
    )
  ) {
    return TipoParte.CUERPO_TECNICO;
  }
  if (/\b(ARBITRO|JUEZ|CRONOMETRADOR|DELEGADO DE JUEGO)\b/.test(n))
    return TipoParte.ORGANIZADOR;
  if (/\b(JUGADOR|JUGADORA)\b/.test(n)) return TipoParte.JUGADOR;
  // Un nombre con cedula pegada ("CARLOS PEREZ 12345678") es una persona.
  if (/\d{5,}/.test(n)) return TipoParte.JUGADOR;
  return TipoParte.OTRO;
}

export async function ingestaExpedientes(
  prisma: PrismaClient,
  filas: string[][],
  archivoOrigen: string,
): Promise<ResultadoIngesta> {
  const dim = new Dimensiones(prisma);
  let descartadas = 0;

  interface Preparado {
    hash: string;
    filaOrigen: number;
    numero: string;
    anio: number;
    nombre: string | null;
    motivo: string | null;
    ligaTorneo: string | null;
    nombreTorneo: string | null;
    autoEntrada: string | null;
    fechaAutoEntrada: string | null;
    equipos: string | null;
    tramiteRaw: string | null;
    modalidad: string | null;
    asignado: string | null;
    fechaAsignacion: string | null;
    fechaSeguimiento: string | null;
    alerta: string | null;
    estatus: string;
    estado: EstadoExpediente;
    fecha: string | null;
    tipo: string | null;
    notas: string | null;
    numeroDecision: string | null;
    sancionRaw: string | null;
    sancionadoRaw: string | null;
    multaUc: number | null;
    multaUsd: number | null;
    cumplimientoDecision: string | null;
    motivoCumplimiento: string | null;
    torneo: string | null;
    categoria: string | null;
    fechaClave: string | null;
    movimientos: {
      tipo: TipoMovimientoExpediente;
      fecha: string | null;
      codigo: string | null;
      descripcion: string | null;
      orden: number;
    }[];
    partes: { orden: number; nombre: string }[];
  }

  const preparados: Preparado[] = [];

  for (let i = 0; i < filas.length; i++) {
    const f = filas[i]!;

    // Filtro de filas reales. Un expediente tiene numero con digitos; el
    // artefacto de Google Sheets trae "$0" o la celda vacia.
    const numero = celda(f, C.numero);
    if (esNulo(numero) || !/\d/.test(numero)) {
      descartadas++;
      continue;
    }

    const anio = parseNumero(celda(f, C.anio));
    if (!anio || anio < 2000 || anio > 2100) {
      descartadas++;
      continue;
    }

    const num = numero.replace(/\D/g, '').padStart(3, '0');
    const status = celda(f, C.status);
    const tramite = celda(f, C.tramite);

    // Fecha de referencia: se prefiere la del auto o decision; si no hay, la de
    // entrada. Es la que alimenta la dimension temporal del tablero.
    const fDecision = fecha(f, C.fechaDecision);
    const fEntrada = fecha(f, C.fechaAutoEntrada);
    const fResolucion = fecha(f, C.fechaDecision2);
    const fechaRef = fDecision ?? fResolucion ?? fEntrada;

    const hash = hashFila(DOCUMENTO, [
      num,
      String(anio),
      celda(f, C.motivo),
      status,
      celda(f, C.sancion),
    ]);

    // Movimientos del expediente, en orden cronologico.
    const movimientos: Preparado['movimientos'] = [];
    if (fEntrada) {
      movimientos.push({
        tipo: TipoMovimientoExpediente.AUTO,
        fecha: fEntrada,
        codigo: textoONulo(celda(f, C.autoEntrada)),
        descripcion: 'Auto de entrada / inicio de investigacion',
        orden: 1,
      });
    }
    if (fDecision) {
      movimientos.push({
        tipo: TipoMovimientoExpediente.RESOLUCION,
        fecha: fDecision,
        codigo: textoONulo(celda(f, C.numeroDecision)),
        descripcion: textoONulo(celda(f, C.decision)),
        orden: 2,
      });
    }
    const recons = celda(f, C.reconsideracion);
    if (!esNulo(recons)) {
      movimientos.push({
        tipo: TipoMovimientoExpediente.RECONSIDERACION,
        fecha: fecha(f, C.fechaRR),
        codigo: null,
        descripcion: recons,
        orden: 3,
      });
    }
    if (fResolucion) {
      movimientos.push({
        tipo: TipoMovimientoExpediente.SEGUNDA_INSTANCIA,
        fecha: fResolucion,
        codigo: textoONulo(celda(f, C.nroDecision2)),
        descripcion: textoONulo(celda(f, C.decision2)),
        orden: 4,
      });
    }

    // Partes del expediente: demandante y demandada.
    const partes: { orden: number; nombre: string }[] = [];
    const d1 = textoONulo(celda(f, C.demandante));
    const d2 = textoONulo(celda(f, C.demandada));
    if (d1) partes.push({ orden: 1, nombre: d1 });
    if (d2) partes.push({ orden: 2, nombre: d2 });

    preparados.push({
      hash,
      filaOrigen: i + 2,
      numero: num,
      anio,
      nombre: textoONulo(celda(f, C.asunto)),
      motivo: textoONulo(celda(f, C.motivo)),
      ligaTorneo: textoONulo(celda(f, C.torneo)),
      nombreTorneo: textoONulo(celda(f, C.equipos)),
      autoEntrada: textoONulo(celda(f, C.autoEntrada)),
      fechaAutoEntrada: fEntrada,
      equipos: textoONulo(celda(f, C.equipos)),
      tramiteRaw: textoONulo(tramite),
      modalidad: textoONulo(celda(f, C.modalidad)),
      asignado: textoONulo(celda(f, C.asignado)),
      fechaAsignacion: fecha(f, C.fechaAsignacion),
      fechaSeguimiento: fecha(f, C.fechaSeguimiento),
      alerta: textoONulo(celda(f, C.alerta)),
      estatus: status || 'SIN STATUS',
      estado: traducirEstado(status, tramite),
      fecha: fechaRef,
      tipo: textoONulo(tramite),
      notas:
        [
          textoONulo(celda(f, C.observaciones)),
          textoONulo(celda(f, C.usurpacion)),
          referenciaAcumulacion(tramite)
            ? `Acumulado a ${referenciaAcumulacion(tramite)}`
            : null,
        ]
          .filter(Boolean)
          .join(' | ') || null,
      numeroDecision: textoONulo(celda(f, C.numeroDecision)),
      sancionRaw: textoONulo(celda(f, C.sancion)),
      sancionadoRaw: textoONulo(celda(f, C.sancionado)),
      multaUc: parseNumero(celda(f, C.multaUc)),
      multaUsd: parseNumero(celda(f, C.multaUsd)),
      cumplimientoDecision: textoONulo(celda(f, C.cumplimiento)),
      motivoCumplimiento: textoONulo(celda(f, C.motivoCumplimiento)),
      torneo: dim.torneo(celda(f, C.torneo), anio),
      categoria: dim.categoria(celda(f, C.torneo)),
      // La fecha se registra aqui, en la pasada 1, y no durante la escritura.
      // `dim.volcar()` ya se ha ejecutado cuando se escriben los hechos, asi que
      // registrar la fecha mas tarde la dejaria en la cola sin volcar y la FK
      // `fechaId` saldria nula.
      fechaClave: fechaRef ? dim.fecha(fechaRef) : null,
      movimientos,
      partes,
    });
  }

  const dimensiones = await dim.volcar();

  // Deduplicar por clave natural (anio, numero). El esquema declara
  // `@@unique([anio, numero])` y el hash no cubre todos los campos de la fila, asi
  // que dos filas distintas de la hoja pueden compartir el mismo expediente. Se
  // conserva la primera y se avisa, en lugar de reventar la insercion.
  const porNatural = new Map<string, number>();
  const duplicados: string[] = [];
  const unicos: Preparado[] = [];
  for (const p of preparados) {
    const k = `${p.anio}/${p.numero}`;
    if (porNatural.has(k)) {
      duplicados.push(k);
      continue;
    }
    porNatural.set(k, unicos.length);
    unicos.push(p);
  }
  if (duplicados.length) {
    console.warn(
      `  [aviso] ${duplicados.length} filas comparten (anio, numero) con otra fila;` +
        ` se conserva la primera. ${[...new Set(duplicados)].slice(0, 10).join(', ')}`,
    );
  }

  // --- Escritura de hechos --------------------------------------------------
  const existentes = await prisma.fact_expediente.findMany({
    where: { hashOrigen: { in: unicos.map((p) => p.hash) } },
    select: { id: true, hashOrigen: true },
  });
  const idPorHash = new Map(existentes.map((e) => [e.hashOrigen!, e.id]));

  let insertadas = 0;
  let actualizadas = 0;

  for (let i = 0; i < unicos.length; i += 500) {
    const lote = unicos.slice(i, i + 500);

    for (const p of lote) {
      const datos = {
        numero: p.numero,
        anio: p.anio,
        nombre: p.nombre,
        motivo: p.motivo,
        ligaTorneo: p.ligaTorneo,
        nombreTorneo: p.nombreTorneo,
        autoEntrada: p.autoEntrada,
        fechaAutoEntrada: p.fechaAutoEntrada ? new Date(p.fechaAutoEntrada) : null,
        equipos: p.equipos,
        tramiteRaw: p.tramiteRaw,
        modalidad: p.modalidad,
        asignado: p.asignado,
        fechaAsignacion: p.fechaAsignacion ? new Date(p.fechaAsignacion) : null,
        fechaSeguimiento: p.fechaSeguimiento ? new Date(p.fechaSeguimiento) : null,
        alerta: p.alerta,
        estatus: p.estatus,
        estado: p.estado,
        fechaRecepcion: p.fechaAutoEntrada ? new Date(p.fechaAutoEntrada) : null,
        fechaResolucion: p.fecha
          ? new Date(
              p.movimientos.find((m) => m.tipo === TipoMovimientoExpediente.RESOLUCION)
                ?.fecha ?? p.fecha,
            )
          : null,
        diasTramitacion: null,
        tipo: p.tipo,
        notas: p.notas,
        numeroDecision: p.numeroDecision,
        sancionRaw: p.sancionRaw,
        sancionadoRaw: p.sancionadoRaw,
        multaUc: p.multaUc,
        multaUsd: p.multaUsd,
        cumplimientoDecision: p.cumplimientoDecision,
        motivoCumplimiento: p.motivoCumplimiento,
        archivoOrigen,
        filaOrigen: p.filaOrigen,
        fechaId: dim.idDe(p.fechaClave),
        torneoId: dim.idDe(p.torneo),
        categoriaId: dim.idDe(p.categoria),
      };

      const idPrevio = idPorHash.get(p.hash);
      let expedienteId: number;
      if (idPrevio !== undefined) {
        await prisma.fact_expediente.update({ where: { id: idPrevio }, data: datos });
        expedienteId = idPrevio;
        actualizadas++;
      } else {
        const creado = await prisma.fact_expediente.create({
          data: { ...datos, hashOrigen: p.hash },
        });
        expedienteId = creado.id;
        idPorHash.set(p.hash, expedienteId);
        insertadas++;
      }

      // Movimientos y partes se reescriben: son hijos, y la hoja es la fuente
      // de verdad, asi que lo que no venga en la hoja debe desaparecer.
      await prisma.fact_expediente_movimiento.deleteMany({ where: { expedienteId } });
      if (p.movimientos.length) {
        await prisma.fact_expediente_movimiento.createMany({
          data: p.movimientos.map((m) => ({
            expedienteId,
            fecha: m.fecha ? new Date(m.fecha) : null,
            tipo: m.tipo,
            codigo: m.codigo,
            descripcion: m.descripcion,
            orden: m.orden,
          })),
        });
      }

      await prisma.fact_expediente_parte.deleteMany({ where: { expedienteId } });
      if (p.partes.length) {
        await prisma.fact_expediente_parte.createMany({
          data: p.partes.map((parte) => ({
            expedienteId,
            orden: parte.orden,
            tipo: tipoDeParte(parte.nombre),
            nombre: parte.nombre,
          })),
        });
      }
    }

    process.stdout.write(
      `\r  ${Math.min(i + 500, unicos.length)}/${unicos.length} expedientes`,
    );
  }
  process.stdout.write('\n');

  return {
    documento: DOCUMENTO,
    leidas: filas.length,
    insertadas,
    actualizadas,
    omitidas: descartadas,
    dimensiones,
  };
}
