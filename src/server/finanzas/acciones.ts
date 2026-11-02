'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

/**
 * 1. REGISTRO DE PAGO DIRECTO POR ADMINISTRACIÓN
 */
export async function registrarPagoAdministracionAction(formData: FormData) {
  const expedienteId = Number(formData.get('expedienteId'));
  const sancionId = Number(formData.get('sancionId'));
  const referenciaBancaria = String(formData.get('referenciaBancaria'));
  const montoUsd = Number(formData.get('montoUsd'));
  const observacion = String(formData.get('observacion') || 'Conciliado por Departamento de Administración');

  await prisma.$transaction(async (tx) => {
    // Actualizar estatus de la sanción a pagada/cumplida
    await tx.sancionExpediente.update({
      where: { id: sancionId },
      data: {
        estadoCumplimiento: 'PAGADO_CUMPLIDO',
        referenciaPago: referenciaBancaria,
        fechaCumplimiento: new Date(),
        observacionEjecucion: observacion,
      },
    });

    // Registrar en el historial de reportes / conciliaciones
    await tx.reportePagoAfectado.create({
      data: {
        expedienteId,
        sancionId,
        entidadEmisor: 'BANCO_NACIONAL_ADMINISTRACION',
        referenciaBancaria,
        montoPagadoUsd: montoUsd,
        montoPagadoUcfvf: +(montoUsd / 3.0).toFixed(2),
        fechaPago: new Date(),
        comprobanteUrl: 'ADMIN_DIRECTO',
        estado: 'VERIFICADO_CONCILIADO',
        conciliadoPor: 'Departamento de Administración FVF',
        fechaConciliacion: new Date(),
        notificadoLicencias: true,
        notificadoCdh: true,
      },
    });

    // Auditoría interna
    await tx.bitacora_auditoria.create({
      data: {
        entidad: 'sancion_expediente',
        entidadId: String(sancionId),
        operacion: 'CONCILIAR_PAGO_ADMINISTRACION',
        cambios: { referenciaBancaria, montoUsd },
        usuarioNombre: 'Administración FVF',
      },
    });
  });

  revalidatePath('/finanzas');
  revalidatePath('/tramite');
  return { ok: true };
}

/**
 * 2. AUTO-REPORTE DE PAGO POR EL AFECTADO (Portal Externo Público)
 */
export async function reportarPagoPorAfectadoAction(formData: FormData) {
  const codigoExpediente = String(formData.get('codigoExpediente')).trim();
  const entidadEmisor = String(formData.get('entidadEmisor'));
  const referenciaBancaria = String(formData.get('referenciaBancaria'));
  const montoPagadoUsd = Number(formData.get('montoPagadoUsd'));
  const observacionesAfectado = String(formData.get('observacionesAfectado') || '');

  const expediente = await prisma.expedienteDisciplinario.findUnique({
    where: { codigoExpediente },
    include: { sanciones: true },
  });

  if (!expediente) {
    throw new Error(`No se encontró el expediente con código ${codigoExpediente}`);
  }

  const sancionPendiente = expediente.sanciones.find((s) => s.estadoCumplimiento === 'PENDIENTE');

  await prisma.reportePagoAfectado.create({
    data: {
      expedienteId: expediente.id,
      sancionId: sancionPendiente?.id,
      entidadEmisor,
      referenciaBancaria,
      montoPagadoUsd,
      montoPagadoUcfvf: +(montoPagadoUsd / 3.0).toFixed(2),
      fechaPago: new Date(),
      comprobanteUrl: 'STORAGE_SUPABASE_BUCKET_PAGOS/comprobante_cargado.pdf',
      observacionesAfectado,
      estado: 'PENDIENTE_VERIFICACION',
      notificadoAdmin: true,
      notificadoCdh: true,
      notificadoLicencias: false, // Se activa al verificar Administración
    },
  });

  revalidatePath('/finanzas');
  return { ok: true, mensaje: 'Reporte de pago enviado con éxito. En proceso de validación por Administración.' };
}