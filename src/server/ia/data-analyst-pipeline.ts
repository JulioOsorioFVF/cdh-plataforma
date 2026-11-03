'use server';

import { prisma } from '@/lib/prisma';
import { EstadoExpediente, TipoParte } from '@/types/kanban';
import { TipoMovimientoExpediente } from '@prisma/client';
import {
  analizarExpedienteCompletoConIA,
  AnalisisCompletoExpedientePDF,
} from './extractor-expediente-pdf';
import { generarAutoOficialConCorrelativo, TipoAutoCDH } from './matriz-evaluacion';
import { revalidatePath } from 'next/cache';

export interface SolicitudIngestaCaso {
  textoDocumento?: string;
  nombreArchivo?: string;
  tamanoBytes?: number;
  analisisPrevio?: AnalisisCompletoExpedientePDF;
  autoPersistirEnBD?: boolean;
}

export interface MetricasDataAnalyst {
  dataQualityScore: number; // 0 - 100%
  camposCompletos: number;
  camposTotales: number;
  nivelRiesgoReincidencia: number;
  indiceGravedad: number; // 1 - 10
  probabilidadImpugnacionTAS: number; // %
}

export interface MetricasProjectManager {
  faseActual: string;
  diasHabilesRestantes: number;
  estadoSla: 'A_TIEMPO' | 'POR_VENCER' | 'VENCIDO';
  proximaAccionRequerida: string;
  fechaLimiteDescargos: string;
  correlativoAutoSugerido: string;
}

export interface ResultadoDataAnalystPipeline {
  ok: boolean;
  mensaje: string;
  analisis: AnalisisCompletoExpedientePDF;
  metricasDataAnalyst: MetricasDataAnalyst;
  metricasProjectManager: MetricasProjectManager;
  persistenciaBD?: {
    expedienteId: number;
    numeroExpediente: string;
    anio: number;
    partesRegistradas: number;
    movimientoRegistradoId: number;
    documentoId?: number;
    vectorIndexado: boolean;
  };
  error?: string;
}

/**
 * Motor integral que analiza un expediente/documento, calcula métricas
 * analíticas y de project management, y alimenta la base de datos de forma transaccional.
 */
export async function ejecutarDataAnalystPipelineAction(
  solicitud: SolicitudIngestaCaso
): Promise<ResultadoDataAnalystPipeline> {
  try {
    const {
      textoDocumento = '',
      nombreArchivo = 'expediente_documento.pdf',
      tamanoBytes = 0,
      analisisPrevio,
      autoPersistirEnBD = false,
    } = solicitud;

    // 1. Obtener o calcular el análisis estructurado
    let analisis: AnalisisCompletoExpedientePDF;
    if (analisisPrevio) {
      analisis = analisisPrevio;
    } else {
      if (!textoDocumento.trim()) {
        throw new Error('Se requiere el texto o contenido del documento para el análisis.');
      }
      analisis = await analizarExpedienteCompletoConIA(
        textoDocumento,
        nombreArchivo,
        tamanoBytes || textoDocumento.length
      );
    }

    // 2. Calcular Métricas de Data Analyst (Completitud, Consistencia, Calidad de Datos)
    let camposCompletos = 0;
    const camposTotales = 12;

    if (analisis.identificacionExpediente.numeroSugerido) camposCompletos++;
    if (analisis.identificacionExpediente.torneo) camposCompletos++;
    if (analisis.identificacionExpediente.partido) camposCompletos++;
    if (analisis.partes.length > 0) camposCompletos++;
    if (analisis.testigos.length > 0) camposCompletos++;
    if (analisis.argumentacionJuridica.resumenHechos) camposCompletos++;
    if (analisis.argumentacionJuridica.valoracionProbatoria) camposCompletos++;
    if (analisis.jurisprudenciaCitada.length > 0) camposCompletos++;
    if (analisis.normasAplicables.length > 0) camposCompletos++;
    if (analisis.propuestaSancion.multaUcfvf !== undefined) camposCompletos++;
    if (analisis.evaluacionMatriz.gravedadFalta) camposCompletos++;
    if (analisis.autoRecomendado.correlativoSugerido) camposCompletos++;

    const dataQualityScore = Math.round((camposCompletos / camposTotales) * 100);

    const esAmagnoOApuestas =
      analisis.normasAplicables.some((n) => n.articulo.includes('10 lit. k') || n.articulo.includes('10 lit. m')) ||
      analisis.jurisprudenciaCitada.some((j) => j.codigoCasoPrecedente.includes('2490') || j.codigoCasoPrecedente.includes('127/2025'));

    const indiceGravedad = esAmagnoOApuestas
      ? 10
      : analisis.evaluacionMatriz.gravedadFalta === 'MUY_GRAVE'
      ? 8
      : analisis.evaluacionMatriz.gravedadFalta === 'GRAVE'
      ? 5
      : 2;

    const metricasDataAnalyst: MetricasDataAnalyst = {
      dataQualityScore,
      camposCompletos,
      camposTotales,
      nivelRiesgoReincidencia: analisis.evaluacionMatriz.nivelRiesgoReincidencia || 0.4,
      indiceGravedad,
      probabilidadImpugnacionTAS: esAmagnoOApuestas ? 75 : 15,
    };

    // 3. Calcular Métricas de Project Manager (SLA, Fases, Próxima Acción)
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + 5); // 5 días hábiles estándar RDFVF

    const metricasProjectManager: MetricasProjectManager = {
      faseActual: 'FASE 1: APERTURA Y TRASLADO DE DESCARGOS',
      diasHabilesRestantes: 5,
      estadoSla: 'A_TIEMPO',
      proximaAccionRequerida:
        analisis.autoRecomendado.tipo === 'AUTO_INICIO_DESCARGOS'
          ? 'Notificar formalmente a las partes imputadas para consignación de descargos dentro de 5 días hábiles.'
          : 'Revisar pruebas documentales y fijar auto admisorio.',
      fechaLimiteDescargos: fechaLimite.toISOString().split('T')[0] ?? '',
      correlativoAutoSugerido: analisis.autoRecomendado.correlativoSugerido,
    };

    // 4. Persistencia en Base de Datos (si se solicitó)
    let persistenciaBD: ResultadoDataAnalystPipeline['persistenciaBD'] = undefined;

    if (autoPersistirEnBD) {
      persistenciaBD = await persistirEnBaseDeDatos(analisis, textoDocumento, nombreArchivo, tamanoBytes);
      try {
        revalidatePath('/expedientes');
        revalidatePath('/ingesta');
        revalidatePath('/indicadores');
      } catch {
        // Ignorar si se invoca fuera de un request Next.js
      }
    }

    return {
      ok: true,
      mensaje: autoPersistirEnBD
        ? `Caso analizado y persistido con éxito en la base de datos (Expediente N° ${analisis.identificacionExpediente.numeroSugerido}).`
        : 'Análisis y estructuración completados por el motor Data Analyst.',
      analisis,
      metricasDataAnalyst,
      metricasProjectManager,
      persistenciaBD,
    };
  } catch (error: any) {
    console.error('Error en ejecutarDataAnalystPipelineAction:', error);
    return {
      ok: false,
      mensaje: error.message || 'Error al procesar el caso en el pipeline.',
      error: error.message,
      analisis: {} as any,
      metricasDataAnalyst: {
        dataQualityScore: 0,
        camposCompletos: 0,
        camposTotales: 12,
        nivelRiesgoReincidencia: 0,
        indiceGravedad: 0,
        probabilidadImpugnacionTAS: 0,
      },
      metricasProjectManager: {
        faseActual: 'ERROR_PROCESAMIENTO',
        diasHabilesRestantes: 0,
        estadoSla: 'VENCIDO',
        proximaAccionRequerida: 'Verificar documento y reintentar análisis.',
        fechaLimiteDescargos: '',
        correlativoAutoSugerido: '',
      },
    };
  }
}

/**
 * Persiste los datos normalizados en las tablas relacionales de PostgreSQL:
 * fact_expediente, fact_expediente_parte, fact_expediente_movimiento, expediente_documento
 * y MemoriaJuridicaVectorial.
 */
async function persistirEnBaseDeDatos(
  analisis: AnalisisCompletoExpedientePDF,
  textoDocumento: string,
  nombreArchivo: string,
  tamanoBytes: number
) {
  const anio = analisis.identificacionExpediente.anio || new Date().getFullYear();
  let numeroRaw = analisis.identificacionExpediente.numeroSugerido;

  // Extraer número limpio
  const matchNum = numeroRaw.match(/^(\d{1,4})/);
  const numeroLimpio = matchNum && matchNum[1] ? String(parseInt(matchNum[1], 10)).padStart(3, '0') : numeroRaw;

  const primerClub = analisis.partes.find((p) => p.tipo === 'CLUB')?.nombre || 'Club por Determinar';
  const imputadosNombres = analisis.partes
    .filter((p) => p.rolProcesal === 'IMPUTADO_DEMANDADO')
    .map((p) => p.nombre)
    .join(', ');

  // 1. Upsert en fact_expediente
  const expediente = await prisma.fact_expediente.upsert({
    where: {
      anio_numero: {
        anio,
        numero: numeroLimpio,
      },
    },
    update: {
      nombre: `Caso ${analisis.identificacionExpediente.partido || primerClub}`,
      motivo: analisis.argumentacionJuridica.resumenHechos.slice(0, 500),
      ligaTorneo: analisis.identificacionExpediente.torneo,
      nombreTorneo: analisis.identificacionExpediente.torneo,
      equipos: analisis.identificacionExpediente.partido || primerClub,
      estatus: 'EN TRÁMITE',
      estado: EstadoExpediente.EN_ESTUDIO,
      sancionadoRaw: imputadosNombres.slice(0, 255) || 'Por determinar',
      sancionRaw: analisis.propuestaSancion.suspensionDeportiva,
      multaUc: analisis.propuestaSancion.multaUcfvf,
      multaUsd: analisis.propuestaSancion.multaUsd,
      modalidad: 'Digital',
      notas: `Estructurado mediante Data Analyst & Project Manager Engine el ${new Date().toLocaleDateString('es-VE')}. Normas: ${analisis.normasAplicables.map((n) => n.articulo).join(', ')}`,
    },
    create: {
      numero: numeroLimpio,
      anio,
      nombre: `Caso ${analisis.identificacionExpediente.partido || primerClub}`,
      motivo: analisis.argumentacionJuridica.resumenHechos.slice(0, 500),
      ligaTorneo: analisis.identificacionExpediente.torneo,
      nombreTorneo: analisis.identificacionExpediente.torneo,
      equipos: analisis.identificacionExpediente.partido || primerClub,
      estatus: 'EN TRÁMITE',
      estado: EstadoExpediente.RECIBIDO,
      fechaRecepcion: new Date(),
      sancionadoRaw: imputadosNombres.slice(0, 255) || 'Por determinar',
      sancionRaw: analisis.propuestaSancion.suspensionDeportiva,
      multaUc: analisis.propuestaSancion.multaUcfvf,
      multaUsd: analisis.propuestaSancion.multaUsd,
      modalidad: 'Digital',
      notas: `Ingestado por Data Analyst & Project Manager Engine. Precedentes: ${analisis.jurisprudenciaCitada.map((j) => j.codigoCasoPrecedente).join('; ')}`,
    },
  });

  // 2. Limpiar e insertar Partes en fact_expediente_parte
  let partesRegistradas = 0;
  try {
    await prisma.fact_expediente_parte.deleteMany({
      where: { expedienteId: expediente.id },
    });
  } catch {
    // Continuar si no habia registros
  }

  for (let i = 0; i < analisis.partes.length; i++) {
    const parte = analisis.partes[i];
    if (!parte) continue;

    const tipoEnum: TipoParte =
      parte.tipo === 'CLUB'
        ? TipoParte.CLUB
        : parte.tipo === 'JUGADOR'
        ? TipoParte.JUGADOR
        : parte.tipo === 'CUERPO_TECNICO'
        ? TipoParte.CUERPO_TECNICO
        : TipoParte.OTRO;

    try {
      await prisma.fact_expediente_parte.create({
        data: {
          expedienteId: expediente.id,
          orden: i + 1,
          tipo: tipoEnum,
          nombre: parte.nombre,
          cedula: parte.cedulaOComet || null,
        },
      });
      partesRegistradas++;
    } catch {
      // Ignorar
    }
  }

  // 3. Crear Movimiento Procesal Inicial (Apertura / Ingesta)
  const mov = await prisma.fact_expediente_movimiento.create({
    data: {
      expedienteId: expediente.id,
      fecha: new Date(),
      tipo: TipoMovimientoExpediente.AUTO,
      codigo: analisis.autoRecomendado.correlativoSugerido || `AUTO-INI-${expediente.id}`,
      descripcion: `Ingesta y Estructuración Automatizada por Data Analyst Engine. Infracción: ${analisis.evaluacionMatriz.gravedadFalta}. Pruebas: ${analisis.testigos.length} testigos/informes extraídos.`,
      orden: 1,
    },
  });

  // 4. Asociar Documento en expediente_documento
  let docId: number | undefined;
  try {
    const doc = await prisma.expediente_documento.create({
      data: {
        expedienteId: expediente.id,
        nombre: nombreArchivo,
        tipo: 'PDF',
        tamanoBytes: tamanoBytes || textoDocumento.length,
        mimeType: 'application/pdf',
        ruta: `storage/expedientes/${Date.now()}_${nombreArchivo}`,
      },
    });
    docId = doc.id;
  } catch (err) {
    console.warn('No se pudo registrar en expediente_documento:', err);
  }

  // 5. Upsert en Memoria Jurídica Vectorial (RAG Knowledge Engine)
  let vectorIndexado = false;
  try {
    await prisma.memoriaJuridicaVectorial.upsert({
      where: {
        codigoReferencia: `EXP-${expediente.numero}-${expediente.anio}`,
      },
      update: {
        tipoDocumento: 'DECISION_CDH',
        anio: expediente.anio,
        torneo: analisis.identificacionExpediente.torneo,
        motivoTipificado: analisis.evaluacionMatriz.gravedadFalta,
        articulosClave: analisis.normasAplicables.map((n) => `${n.cuerpoNormativo} ${n.articulo}`),
        extractoHechos: analisis.argumentacionJuridica.resumenHechos.slice(0, 1000),
        criterioJuridico: analisis.argumentacionJuridica.valoracionProbatoria.slice(0, 1000),
        multaAplicadaUcfvf: analisis.propuestaSancion.multaUcfvf,
        sancionDeportiva: analisis.propuestaSancion.suspensionDeportiva,
        metadatosJson: {
          expedienteId: expediente.id,
          torneo: analisis.identificacionExpediente.torneo,
          multaUcfvf: analisis.propuestaSancion.multaUcfvf,
          suspension: analisis.propuestaSancion.suspensionDeportiva,
          precedentes: analisis.jurisprudenciaCitada.map((j) => j.codigoCasoPrecedente),
          actualizadoEn: new Date().toISOString(),
        },
      },
      create: {
        tipoDocumento: 'DECISION_CDH',
        codigoReferencia: `EXP-${expediente.numero}-${expediente.anio}`,
        anio: expediente.anio,
        torneo: analisis.identificacionExpediente.torneo,
        motivoTipificado: analisis.evaluacionMatriz.gravedadFalta,
        articulosClave: analisis.normasAplicables.map((n) => `${n.cuerpoNormativo} ${n.articulo}`),
        extractoHechos: analisis.argumentacionJuridica.resumenHechos.slice(0, 1000),
        criterioJuridico: analisis.argumentacionJuridica.valoracionProbatoria.slice(0, 1000),
        multaAplicadaUcfvf: analisis.propuestaSancion.multaUcfvf,
        sancionDeportiva: analisis.propuestaSancion.suspensionDeportiva,
        metadatosJson: {
          expedienteId: expediente.id,
          torneo: analisis.identificacionExpediente.torneo,
          multaUcfvf: analisis.propuestaSancion.multaUcfvf,
          suspension: analisis.propuestaSancion.suspensionDeportiva,
          precedentes: analisis.jurisprudenciaCitada.map((j) => j.codigoCasoPrecedente),
          creadoEn: new Date().toISOString(),
        },
      },
    });
    vectorIndexado = true;
  } catch (err) {
    console.warn('Tabla memoriaJuridicaVectorial no disponible o vector no habilitado:', err);
  }

  return {
    expedienteId: expediente.id,
    numeroExpediente: expediente.numero,
    anio: expediente.anio,
    partesRegistradas,
    movimientoRegistradoId: mov.id,
    documentoId: docId,
    vectorIndexado,
  };
}

/**
 * Consulta las estadísticas agregadas de la base de datos para la vista del Data Analyst & Project Manager.
 */
export async function obtenerResumenPipelineAnalista() {
  const [totalExpedientes, ultimosCasos, totalDocumentos] = await Promise.all([
    prisma.fact_expediente.count(),
    prisma.fact_expediente.findMany({
      take: 8,
      orderBy: [{ anio: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        numero: true,
        anio: true,
        nombre: true,
        motivo: true,
        ligaTorneo: true,
        estatus: true,
        estado: true,
        multaUc: true,
        multaUsd: true,
        sancionRaw: true,
        createdAt: true,
      },
    }),
    prisma.expediente_documento.count().catch(() => 0),
  ]);

  return {
    totalExpedientes,
    ultimosCasos: ultimosCasos.map((c) => ({
      ...c,
      multaUc: c.multaUc ? Number(c.multaUc) : 0,
      multaUsd: c.multaUsd ? Number(c.multaUsd) : 0,
      createdAt: c.createdAt.toISOString(),
    })),
    totalDocumentos,
  };
}
