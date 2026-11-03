'use server';

import { prisma } from '@/lib/prisma';
import { obtenerSesion } from '@/server/auth/sesion';
import { TipoMovimientoExpediente, TipoParte } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { buscarJurisprudenciaExpedientes, type PrecedenteJurisprudencial } from '@/server/ia/agente-disciplinario';

const TASA_OFICIAL_UCFVF_USD = 3.0; // Según Memoria y Cuenta CDH-FVF ($3.00 por 1 UCFVF)

import {
  type ExpedienteTarjetaKanban,
  type ColumnaKanban,
  type CrearExpedienteInput,
  EstadoExpediente,
  COLUMNAS_KANBAN_CONFIG,
} from '@/types/kanban';
import {
  analizarDocumentoYExtraerDatos,
  generarAutoOficialConCorrelativo,
  retroalimentarMatrizConExpediente,
  type TipoAutoCDH,
} from '@/server/ia/matriz-evaluacion';



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
 * 5. Analiza un documento o texto y extrae automáticamente los datos para el expediente.
 */
export async function analizarDocumentoConIAAction(texto: string, nombreArchivo?: string) {
  try {
    const resultado = await analizarDocumentoYExtraerDatos(texto, nombreArchivo);
    return { ok: true, data: resultado };
  } catch (error: any) {
    console.error('Error en análisis IA de documento:', error);
    return { ok: false, error: error.message || 'Error al procesar el documento' };
  }
}

/**
 * 6. Genera un Auto Oficial con asignación automática de correlativo oficial.
 */
export async function generarAutoConCorrelativoAction(params: {
  expedienteId: number;
  tipoAuto: TipoAutoCDH;
  juezPonente?: string;
  resumenHechos?: string;
  articulosAplicables?: string[];
  multaUcfvf?: number;
  suspensionDeportiva?: string;
  diasDescargos?: number;
}) {
  try {
    const resultado = await generarAutoOficialConCorrelativo(params);
    revalidatePath('/expedientes');
    revalidatePath('/tramite');
    return { ok: true, data: resultado };
  } catch (error: any) {
    console.error('Error al generar auto oficial:', error);
    return { ok: false, error: error.message || 'Error al generar auto oficial' };
  }
}

/**
 * 7. Adjunta un documento a un expediente persistido.
 */
export async function adjuntarDocumentoAExpedienteAction(params: {
  expedienteId: number;
  nombre: string;
  tipo: string;
  tamanoBytes: number;
  ruta?: string;
}) {
  try {
    const doc = await prisma.expediente_documento.create({
      data: {
        expedienteId: params.expedienteId,
        nombre: params.nombre,
        tipo: params.tipo,
        tamanoBytes: params.tamanoBytes,
        mimeType: 'application/pdf',
        ruta: params.ruta || `storage/expedientes/${Date.now()}_${params.nombre}`,
      },
    });
    revalidatePath('/expedientes');
    return { ok: true, documento: doc };
  } catch (error: any) {
    console.error('Error al adjuntar documento:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * 8. Retroalimenta el Cerebro IA / Matriz con un fallo firme.
 */
export async function retroalimentarMatrizDecisionAction(params: {
  expedienteId: number;
  criterioJuridico: string;
  motivoTipificado: string;
  articulosClave: string[];
  multaAplicadaUcfvf: number;
  sancionDeportiva?: string;
  extractoHechos: string;
}) {
  try {
    const res = await retroalimentarMatrizConExpediente(params);
    revalidatePath('/agente-ia');
    revalidatePath('/expedientes');
    return res;
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}
