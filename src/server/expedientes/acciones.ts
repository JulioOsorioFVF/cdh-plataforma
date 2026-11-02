'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { EtapaProcesal, EstadoTramite } from '@prisma/client';

const TASA_OFICIAL_UCFVF_USD = 3.0; // Según Memoria y Cuenta CDH-FVF ($3.00 por 1 UCFVF)

/**
 * 1. RADICAR NUEVO EXPEDIENTE (Sustituye insertar fila en Google Sheets y crear tarjeta en Trello)
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

  // Controles de Admisibilidad (Art. 169 y Art. 170 RDFVF)
  const requiereCaucion = formData.get('requiereCaucion') === 'true';
  const caucionVerificada = formData.get('caucionVerificada') === 'true';
  const articulosInvocados = formData.get('articulosInvocados') !== 'false';
  const enLapsoReglamentario = formData.get('enLapsoReglamentario') !== 'false';

  // Numeración correlativa automática por año
  const ultimo = await prisma.expedienteDisciplinario.findFirst({
    where: { anio },
    orderBy: { numeroCorrelativo: 'desc' },
    select: { numeroCorrelativo: true },
  });
  const siguienteNumero = (ultimo?.numeroCorrelativo ?? 0) + 1;
  const codigoExpediente = `EXP-${String(siguienteNumero).padStart(3, '0')}-${anio}`;

  // Evaluación automática de admisibilidad formal
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

  // Cálculo de Fecha Límite (SLA PMO)
  const ahora = new Date();
  const diasPlazo = prioridadSla === 'URGENTE_24H' ? 1 : prioridadSla === 'ALTA' ? 5 : 10;
  const fechaVencimientoSla = new Date(ahora.getTime() + diasPlazo * 24 * 60 * 60 * 1000);

  const nuevoExp = await prisma.expedienteDisciplinario.create({
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

  // Registro en la Bitácora de Auditoría existente en cdh-plataforma
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
 * 2. REGISTRAR ACTUACIÓN PROCESAL ("REFERENCIA", OFICIO O DECISIÓN) Y AVANZAR ETAPA KANBAN
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
    await tx.actuacionProcesal.create({
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

    await tx.expedienteDisciplinario.update({
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
        await tx.sancionExpediente.create({
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