'use server';

import { prisma } from '@/lib/prisma';
import { obtenerSesion } from '@/server/auth/sesion';
import { EstadoExpediente, TipoMovimientoExpediente, TipoParte, EtapaProcesal, EstadoTramite } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { buscarJurisprudenciaExpedientes, type PrecedenteJurisprudencial } from '@/server/ia/agente-disciplinario';

const TASA_OFICIAL_UCFVF_USD = 3.0; // Según Memoria y Cuenta CDH-FVF ($3.00 por 1 UCFVF)

export interface ExpedienteTarjetaKanban {
  id: number;
  numero: string;
  anio: number;
  nombre: string | null;
  motivo: string | null;
  subMotivo: string | null;
  ligaTorneo: string | null;
  equipos: string | null;
  asignado: string | null;
  alerta: string | null;
  estatus: string;
  estado: EstadoExpediente;
  numeroDecision: string | null;
  sancionRaw: string | null;
  sancionadoRaw: string | null;
  multaUc: number | null;
  multaUsd: number | null;
  fechaRecepcion: Date | null;
  fechaResolucion: Date | null;
  fechaAutoEntrada: Date | null;
  modalidad: string | null;
  notas: string | null;
  totalMovimientos: number;
  totalPartes: number;
}

export interface ColumnaKanban {
  estado: EstadoExpediente;
  titulo: string;
  colorBorde: string;
  colorBadge: string;
  icono: string;
  descripcion: string;
  expedientes: ExpedienteTarjetaKanban[];
}

export const COLUMNAS_KANBAN_CONFIG: {
  estado: EstadoExpediente;
  titulo: string;
  colorBorde: string;
  colorBadge: string;
  icono: string;
  descripcion: string;
}[] = [
  {
    estado: EstadoExpediente.RECIBIDO,
    titulo: 'Recibidos / Por Iniciar',
    colorBorde: 'border-blue-500',
    colorBadge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    icono: '📥',
    descripcion: 'Informes de árbitros o protestas recién ingresadas, pendientes de admisibilidad.',
  },
  {
    estado: EstadoExpediente.EN_ESTUDIO,
    titulo: 'En Instrucción / Análisis',
    colorBorde: 'border-amber-500',
    colorBadge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    icono: '🔍',
    descripcion: 'Auto de Entrada emitido, fase probatoria y descargos en curso.',
  },
  {
    estado: EstadoExpediente.EN_RECURSO,
    titulo: 'En Reconsideración',
    colorBorde: 'border-purple-500',
    colorBadge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    icono: '⚖️',
    descripcion: 'Recurso de Reconsideración presentado dentro del lapso de 3 días.',
  },
  {
    estado: EstadoExpediente.RESUELTO,
    titulo: 'Resueltos / Con Decisión',
    colorBorde: 'border-emerald-600',
    colorBadge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    icono: '📜',
    descripcion: 'Resolución o decisión definitiva dictada por el Consejo de Honor.',
  },
  {
    estado: EstadoExpediente.NOTIFICADO,
    titulo: 'Notificados (COMET)',
    colorBorde: 'border-teal-600',
    colorBadge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
    icono: '📬',
    descripcion: 'Fallo formalmente notificado a las partes y registrado en el sistema COMET.',
  },
  {
    estado: EstadoExpediente.DESESTIMADO,
    titulo: 'Desestimados / Inadmisibles',
    colorBorde: 'border-rose-500',
    colorBadge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    icono: '❌',
    descripcion: 'Protestas inadmisibles (sin caución Art. 170 o extemporáneas).',
  },
  {
    estado: EstadoExpediente.ARCHIVADO,
    titulo: 'Archivados / Concluidos',
    colorBorde: 'border-slate-500',
    colorBadge: 'bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-300',
    icono: '📁',
    descripcion: 'Expedientes cerrados, firmes o con cumplimiento de sanción verificado.',
  },
];

/**
 * Obtiene los expedientes estructurados para el tablero Kanban tipo Trello.
 */
export async function obtenerTableroKanban(filtros?: {
  busqueda?: string;
  anio?: number;
  juez?: string;
}): Promise<ColumnaKanban[]> {
  const where: any = {};

  if (filtros?.anio) {
    where.anio = filtros.anio;
  }

  if (filtros?.juez) {
    where.asignado = { contains: filtros.juez, mode: 'insensitive' };
  }

  if (filtros?.busqueda?.trim()) {
    const q = filtros.busqueda.trim();
    where.OR = [
      { numero: { contains: q, mode: 'insensitive' } },
      { motivo: { contains: q, mode: 'insensitive' } },
      { subMotivo: { contains: q, mode: 'insensitive' } },
      { ligaTorneo: { contains: q, mode: 'insensitive' } },
      { equipos: { contains: q, mode: 'insensitive' } },
      { asignado: { contains: q, mode: 'insensitive' } },
      { sancionadoRaw: { contains: q, mode: 'insensitive' } },
    ];
  }

  const filas = await prisma.fact_expediente.findMany({
    where,
    select: {
      id: true,
      numero: true,
      anio: true,
      nombre: true,
      motivo: true,
      subMotivo: true,
      ligaTorneo: true,
      equipos: true,
      asignado: true,
      alerta: true,
      estatus: true,
      estado: true,
      numeroDecision: true,
      sancionRaw: true,
      sancionadoRaw: true,
      multaUc: true,
      multaUsd: true,
      fechaRecepcion: true,
      fechaResolucion: true,
      fechaAutoEntrada: true,
      modalidad: true,
      notas: true,
      _count: {
        select: {
          movimientos: true,
          partes: true,
        },
      },
    },
    orderBy: [{ fechaAutoEntrada: 'desc' }, { id: 'desc' }],
    take: 300,
  });

  const mapaExpedientes: Record<EstadoExpediente, ExpedienteTarjetaKanban[]> = {
    [EstadoExpediente.RECIBIDO]: [],
    [EstadoExpediente.EN_ESTUDIO]: [],
    [EstadoExpediente.EN_RECURSO]: [],
    [EstadoExpediente.RESUELTO]: [],
    [EstadoExpediente.NOTIFICADO]: [],
    [EstadoExpediente.DESESTIMADO]: [],
    [EstadoExpediente.ARCHIVADO]: [],
    [EstadoExpediente.REMITIDO]: [],
  };

  for (const fila of filas) {
    const tarjeta: ExpedienteTarjetaKanban = {
      id: fila.id,
      numero: fila.numero,
      anio: fila.anio,
      nombre: fila.nombre,
      motivo: fila.motivo,
      subMotivo: fila.subMotivo,
      ligaTorneo: fila.ligaTorneo,
      equipos: fila.equipos,
      asignado: fila.asignado,
      alerta: fila.alerta,
      estatus: fila.estatus,
      estado: fila.estado,
      numeroDecision: fila.numeroDecision,
      sancionRaw: fila.sancionRaw,
      sancionadoRaw: fila.sancionadoRaw,
      multaUc: fila.multaUc ? Number(fila.multaUc) : null,
      multaUsd: fila.multaUsd ? Number(fila.multaUsd) : null,
      fechaRecepcion: fila.fechaRecepcion,
      fechaResolucion: fila.fechaResolucion,
      fechaAutoEntrada: fila.fechaAutoEntrada,
      modalidad: fila.modalidad,
      notas: fila.notas,
      totalMovimientos: fila._count.movimientos,
      totalPartes: fila._count.partes,
    };

    if (mapaExpedientes[fila.estado]) {
      mapaExpedientes[fila.estado].push(tarjeta);
    } else {
      mapaExpedientes[EstadoExpediente.EN_ESTUDIO].push(tarjeta);
    }
  }

  return COLUMNAS_KANBAN_CONFIG.map((col) => ({
    ...col,
    expedientes: mapaExpedientes[col.estado] || [],
  }));
}

/**
 * Actualiza el estado de un expediente (mover tarjeta en el Kanban) y asienta el movimiento procesal.
 */
export async function moverEstadoExpedienteKanban(params: {
  expedienteId: number;
  nuevoEstado: EstadoExpediente;
  descripcionMovimiento?: string;
}): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const sesion = await obtenerSesion();
    const usuarioNombre = sesion?.nombre ?? 'Sistema';

    const actual = await prisma.fact_expediente.findUnique({
      where: { id: params.expedienteId },
      select: { id: true, numero: true, anio: true, estado: true },
    });

    if (!actual) {
      return { ok: false, mensaje: 'Expediente no encontrado en base de datos.' };
    }

    if (actual.estado === params.nuevoEstado) {
      return { ok: true, mensaje: 'El expediente ya se encuentra en este estado.' };
    }

    // Tipo de movimiento según nuevo estado
    let tipoMovimiento: TipoMovimientoExpediente = TipoMovimientoExpediente.PROVIDENCIA;
    if (params.nuevoEstado === EstadoExpediente.EN_ESTUDIO) tipoMovimiento = TipoMovimientoExpediente.AUTO_ADMISORIO;
    else if (params.nuevoEstado === EstadoExpediente.RESUELTO) tipoMovimiento = TipoMovimientoExpediente.RESOLUCION;
    else if (params.nuevoEstado === EstadoExpediente.NOTIFICADO) tipoMovimiento = TipoMovimientoExpediente.NOTIFICACION;
    else if (params.nuevoEstado === EstadoExpediente.EN_RECURSO) tipoMovimiento = TipoMovimientoExpediente.RECONSIDERACION;
    else if (params.nuevoEstado === EstadoExpediente.DESESTIMADO) tipoMovimiento = TipoMovimientoExpediente.AUTO;

    const descripcion =
      params.descripcionMovimiento ||
      `Cambio de fase en tablero Kanban de ${actual.estado} a ${params.nuevoEstado} por ${usuarioNombre}.`;

    await prisma.$transaction([
      prisma.fact_expediente.update({
        where: { id: params.expedienteId },
        data: {
          estado: params.nuevoEstado,
          estatus: params.nuevoEstado,
          fechaResolucion:
            params.nuevoEstado === EstadoExpediente.RESUELTO ? new Date() : undefined,
        },
      }),
      prisma.fact_expediente_movimiento.create({
        data: {
          expedienteId: params.expedienteId,
          fecha: new Date(),
          tipo: tipoMovimiento,
          codigo: `MOV-${params.nuevoEstado}`,
          descripcion,
        },
      }),
    ]);

    revalidatePath('/expedientes');
    return { ok: true, mensaje: `Expediente ${actual.numero}/${actual.anio} movido a ${params.nuevoEstado}.` };
  } catch (error) {
    console.error('Error al mover estado en Kanban:', error);
    return { ok: false, mensaje: 'Error al actualizar el expediente en Supabase.' };
  }
}

export interface CrearExpedienteInput {
  numero?: string;
  anio: number;
  nombre?: string;
  motivo: string;
  subMotivo?: string;
  ligaTorneo: string;
  equipos?: string;
  asignado?: string;
  modalidad?: string;
  alerta?: string;
  estado?: EstadoExpediente;
  notas?: string;
  partes?: Array<{
    nombre: string;
    tipo: TipoParte;
    cedula?: string;
  }>;
}

/**
 * Crea un nuevo expediente disciplinario y lo almacena en la base de datos de PostgreSQL/Supabase.
 */
export async function crearExpedienteEnSupabase(
  datos: CrearExpedienteInput,
): Promise<{ ok: boolean; expedienteId?: number; mensaje: string }> {
  try {
    const sesion = await obtenerSesion();

    const anio = datos.anio || new Date().getFullYear();
    let numero = datos.numero?.trim();

    // Si no se proporcionó número, calcular el próximo correlativo del año
    if (!numero) {
      const ultimo = await prisma.fact_expediente.findFirst({
        where: { anio },
        orderBy: { id: 'desc' },
        select: { numero: true },
      });

      const numParsed = ultimo?.numero ? parseInt(ultimo.numero, 10) : 0;
      const proximo = isNaN(numParsed) ? 1 : numParsed + 1;
      numero = proximo.toString().padStart(3, '0');
    }

    // Verificar si ya existe esa pareja (anio, numero)
    const existente = await prisma.fact_expediente.findUnique({
      where: {
        anio_numero: {
          anio,
          numero,
        },
      },
    });

    if (existente) {
      return {
        ok: false,
        mensaje: `Ya existe el expediente N° ${numero}/${anio} en la base de datos.`,
      };
    }

    const estadoInicial = datos.estado || EstadoExpediente.RECIBIDO;

    const creado = await prisma.fact_expediente.create({
      data: {
        numero,
        anio,
        nombre: datos.nombre || `Expediente ${numero}/${anio}`,
        motivo: datos.motivo,
        subMotivo: datos.subMotivo,
        ligaTorneo: datos.ligaTorneo,
        equipos: datos.equipos,
        asignado: datos.asignado,
        modalidad: datos.modalidad || 'Digital',
        alerta: datos.alerta,
        estatus: estadoInicial,
        estado: estadoInicial,
        fechaRecepcion: new Date(),
        fechaAutoEntrada: new Date(),
        notas: datos.notas,
        creadoPorId: sesion?.id,
        movimientos: {
          create: [
            {
              fecha: new Date(),
              tipo: TipoMovimientoExpediente.AUTO_ADMISORIO,
              codigo: `A.E. ${numero}/${anio}`,
              descripcion: `Apertura y radicación formal del expediente en estado ${estadoInicial}.`,
              orden: 1,
            },
          ],
        },
        partes: datos.partes && datos.partes.length > 0
          ? {
              create: datos.partes.map((p, idx) => ({
                orden: idx + 1,
                tipo: p.tipo,
                nombre: p.nombre,
                cedula: p.cedula,
              })),
            }
          : undefined,
      },
    });

    revalidatePath('/expedientes');
    return {
      ok: true,
      expedienteId: creado.id,
      mensaje: `Expediente N° ${numero}/${anio} creado y radicado exitosamente.`,
    };
  } catch (error) {
    console.error('Error al crear expediente en Supabase:', error);
    return {
      ok: false,
      mensaje: 'Ocurrió un error al persistir el expediente en la base de datos.',
    };
  }
}

/**
 * Obtiene el detalle completo de un expediente con sus partes, movimientos y jurisprudencia análoga.
 */
export async function obtenerDetalleExpedienteConJurisprudencia(id: number) {
  try {
    const expediente = await prisma.fact_expediente.findUnique({
      where: { id },
      include: {
        partes: true,
        movimientos: {
          orderBy: { orden: 'asc' },
        },
        documentos: true,
      },
    });

    if (!expediente) return null;

    // Búsqueda de jurisprudencia análoga para enriquecer la vista del expediente
    const precedentes: PrecedenteJurisprudencial[] = await buscarJurisprudenciaExpedientes({
      termino: expediente.motivo || expediente.subMotivo || expediente.equipos || '',
      limite: 4,
    });

    // Excluir el mismo expediente de los precedentes si aparece
    const precedentesFiltrados = precedentes.filter((p) => p.id !== expediente.id);

    return {
      expediente: {
        ...expediente,
        multaUc: expediente.multaUc ? Number(expediente.multaUc) : null,
        multaUsd: expediente.multaUsd ? Number(expediente.multaUsd) : null,
      },
      precedentesJurisprudenciales: precedentesFiltrados,
    };
  } catch (error) {
    console.error('Error al obtener detalle de expediente:', error);
    return null;
  }
}

/**
 * 1. RADICAR NUEVO EXPEDIENTE (Módulo de Trámite)
 */
export async function radicarExpedienteAction(formData: FormData) {
  const anio = Number(formData.get('anio') || new Date().getFullYear());
  const viaIngreso = String(formData.get('viaIngreso') || 'DENUNCIA');
  const torneoCategoria = String(formData.get('torneoCategoria') || 'Liga FUTVE');
  const jornada = String(formData.get('jornada') || '');
  const partido = String(formData.get('partido') || '');
  const motivoPrincipal = String(formData.get('motivoPrincipal') || '');
  const asuntoDetallado = String(formData.get('asuntoDetallado') || '');
  const parteDemandante = String(formData.get('parteDemandante') || 'De Oficio');
  const parteDemandada = String(formData.get('parteDemandada') || '');
  const juezUnicoAsignado = String(formData.get('juezUnicoAsignado') || '');
  const especialistaAsignado = String(formData.get('especialistaAsignado') || '');
  const analistaSeguimiento = String(formData.get('analistaSeguimiento') || '');
  const prioridadSla = String(formData.get('prioridadSla') || 'NORMAL');

  const requiereCaucion = formData.get('requiereCaucion') === 'true';
  const caucionVerificada = formData.get('caucionVerificada') === 'true';
  const articulosInvocados = formData.get('articulosInvocados') !== 'false';
  const enLapsoReglamentario = formData.get('enLapsoReglamentario') !== 'false';

  const ultimo = await (prisma as any).expedienteDisciplinario.findFirst({
    where: { anio },
    orderBy: { numeroCorrelativo: 'desc' },
    select: { numeroCorrelativo: true },
  });
  const siguienteNumero = (ultimo?.numeroCorrelativo ?? 0) + 1;
  const codigoExpediente = `EXP-${String(siguienteNumero).padStart(3, '0')}-${anio}`;

  let estadoInicial: EstadoTramite = 'EN_INSTRUCCION';
  let etapaInicial: EtapaProcesal = 'ENTRADA';
  let causaInadmisibilidad: string | null = null;

  if (requiereCaucion && !caucionVerificada) {
    estadoInicial = 'INADMISIBLE';
    etapaInicial = 'PUBLICACION_NOTIFICACION';
    causaInadmisibilidad = 'Inobservancia del Art. 170 RDFVF (Falta de consignación de caución reglamentaria).';
  } else if (!articulosInvocados) {
    estadoInicial = 'INADMISIBLE';
    etapaInicial = 'PUBLICACION_NOTIFICACION';
    causaInadmisibilidad = 'Inobservancia del Art. 169 RDFVF (No se indicaron las disposiciones normativas violadas).';
  } else if (!enLapsoReglamentario) {
    estadoInicial = 'INADMISIBLE';
    etapaInicial = 'PUBLICACION_NOTIFICACION';
    causaInadmisibilidad = 'Recurso o protesta interpuesta de forma extemporánea.';
  }

  const ahora = new Date();
  const diasPlazo = prioridadSla === 'URGENTE_24H' ? 1 : prioridadSla === 'ALTA' ? 5 : 10;
  const fechaVencimientoSla = new Date(ahora.getTime() + diasPlazo * 24 * 60 * 60 * 1000);

  const nuevoExp = await (prisma as any).expedienteDisciplinario.create({
    data: {
      codigoExpediente,
      numeroCorrelativo: siguienteNumero,
      anio,
      viaIngreso,
      torneoCategoria,
      jornada,
      partido,
      motivoPrincipal,
      asuntoDetallado,
      parteDemandante,
      parteDemandada,
      requiereCaucion,
      caucionVerificada,
      articulosInvocados,
      enLapsoReglamentario,
      causaInadmisibilidad,
      etapaActual: etapaInicial,
      estadoTramite: estadoInicial,
      juezUnicoAsignado,
      especialistaAsignado,
      analistaSeguimiento,
      prioridadSla,
      fechaAsignacion: especialistaAsignado ? ahora : null,
      fechaVencimientoSla,
      fechaCierreDecision: estadoInicial === 'INADMISIBLE' ? ahora : null,
      actuaciones: {
        create: {
          tipoActuacion: estadoInicial === 'INADMISIBLE' ? 'DECISION_1RA_INSTANCIA' : 'AUTO_INICIO',
          numeroActuacion: `A.E. ${String(siguienteNumero).padStart(3, '0')}/${anio}`,
          etapaDestino: etapaInicial,
          resumenDispositivo:
            estadoInicial === 'INADMISIBLE'
              ? `Se declara INADMISIBLE de entrada: ${causaInadmisibilidad}`
              : `Recepción y radicación digital del expediente ${codigoExpediente}. Asignado a ${especialistaAsignado || 'Secretaría'}.`,
          organosNotificados: ['SECRETARIA_EJECUTIVA'],
          creadoPor: 'julio.osorio@fvf.com.ve',
        },
      },
    },
  });

  await prisma.bitacora_auditoria.create({
    data: {
      entidad: 'expediente_disciplinario',
      entidadId: String(nuevoExp.id),
      operacion: 'RADICAR_EXPEDIENTE',
      cambios: { codigoExpediente, torneoCategoria, estadoInicial, especialistaAsignado },
      usuarioNombre: 'Julio César Osorio',
    },
  });

  revalidatePath('/tramite');
  revalidatePath('/expedientes');
  revalidatePath('/dashboard');
  return { ok: true, codigoExpediente };
}

/**
 * 2. REGISTRAR ACTUACIÓN PROCESAL Y AVANZAR ETAPA (Módulo de Trámite)
 */
export async function registrarActuacionYAvanzarAction(datos: {
  expedienteId: number;
  tipoActuacion: 'REFERENCIA' | 'OFICIO_COMET' | 'DECISION_1RA_INSTANCIA' | 'CIERRE_CUMPLIMIENTO';
  numeroActuacion: string;
  etapaDestino: EtapaProcesal;
  resumenDispositivo: string;
  organosNotificados: string[];
  sanciones?: Array<{
    sujetoSancionado: string;
    tipoSujeto: string;
    articulosAplicados: string;
    tipoSancionDeportiva?: string;
    cantidadPartidosMeses?: string;
    multaUcfvf: number;
  }>;
}) {
  const esDecisionFinal = datos.tipoActuacion === 'DECISION_1RA_INSTANCIA';

  await prisma.$transaction(async (tx) => {
    await (tx as any).actuacionProcesal.create({
      data: {
        expedienteId: datos.expedienteId,
        tipoActuacion: datos.tipoActuacion,
        numeroActuacion: datos.numeroActuacion,
        etapaDestino: datos.etapaDestino,
        resumenDispositivo: datos.resumenDispositivo,
        organosNotificados: datos.organosNotificados,
        creadoPor: 'julio.osorio@fvf.com.ve',
      },
    });

    await (tx as any).expedienteDisciplinario.update({
      where: { id: datos.expedienteId },
      data: {
        etapaActual: datos.etapaDestino,
        estadoTramite: esDecisionFinal ? 'DECIDIDO' : undefined,
        fechaCierreDecision: esDecisionFinal ? new Date() : undefined,
      },
    });

    if (datos.sanciones && datos.sanciones.length > 0) {
      for (const s of datos.sanciones) {
        const multaUsd = +(s.multaUcfvf * TASA_OFICIAL_UCFVF_USD).toFixed(2);
        await (tx as any).sancionExpediente.create({
          data: {
            expedienteId: datos.expedienteId,
            sujetoSancionado: s.sujetoSancionado,
            tipoSujeto: s.tipoSujeto,
            articulosAplicados: s.articulosAplicados,
            tipoSancionDeportiva: s.tipoSancionDeportiva,
            cantidadPartidosMeses: s.cantidadPartidosMeses,
            multaUcfvf: s.multaUcfvf,
            tasaUcfvfUsd: TASA_OFICIAL_UCFVF_USD,
            multaUsd,
            estadoCumplimiento: s.multaUcfvf > 0 ? 'PENDIENTE' : 'PAGADO_CUMPLIDO',
          },
        });
      }
    }
  });

  revalidatePath('/tramite');
  revalidatePath('/dashboard');
  return { ok: true };
}
