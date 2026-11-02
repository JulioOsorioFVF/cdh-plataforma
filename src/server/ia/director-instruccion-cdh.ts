'use server';

import { GoogleGenAI, Type, Schema } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { anonimizarIdentificadoresDirectos } from '@/lib/privacidad/anonimizacion';
import { requierePermiso } from '@/server/auth/sesion';
import { buscarPrecedentesSimilaresRAG } from './agente-jurisdiccional';

function clienteGoogleGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Define GEMINI_API_KEY para usar la guía procesal.');
  return new GoogleGenAI({ apiKey });
}

export interface GuiaInstruccionProcesalIA {
  tipologiaDetectada:
    | 'EJECUCION_CRD'
    | 'INTEGRIDAD_AMANO'
    | 'REDES_SOCIALES_ARBITROS'
    | 'REMISION_JUEZ_UNICO'
    | 'VIOLENCIA_MENORES_LOPNNA';
  controlCertidumbreYAdmisibilidad: {
    pasaFiltroInicial: boolean;
    requiereDespachoSaneador: boolean;
    requiereSeparacionPiezas: boolean;
    requiereAcumulacion: boolean;
    observacionProcesal: string;
    borradorOficioSubsanacionOInicio: string;
  };
  hojaDeRutaPasoAPaso: Array<{
    pasoNumero: number;
    fase: string;
    accionRequerida: string;
    fundamentoNormativo: string;
    plazoLegal: string;
    unidadesAFVFInvolucradas: string[];
  }>;
  pliegoInterrogatorioSugerido: Array<{
    destinatario:
      | 'IMPUTADO'
      | 'VICTIMA'
      | 'TESTIGO_PRESENCIAL'
      | 'OFICIAL_PARTIDO'
      | 'FUNCIONARIO_POLICIAL';
    nombreSugerido: string;
    advertenciaJuramento: string;
    preguntasEstrategicas: string[];
  }>;
  alertasCriticasSLA: {
    tieneMedidaCautelarActiva: boolean;
    alertaArt30Rdfvf30Dias: string;
    alertaLOPNNAArt65Reserva: boolean;
    requisitosFacturacionAdminUCA: string[];
  };
}

const ESQUEMA_GUIA_INSTRUCCION: Schema = {
  type: Type.OBJECT,
  properties: {
    tipologiaDetectada: {
      type: Type.STRING,
      enum: [
        'EJECUCION_CRD',
        'INTEGRIDAD_AMANO',
        'REDES_SOCIALES_ARBITROS',
        'REMISION_JUEZ_UNICO',
        'VIOLENCIA_MENORES_LOPNNA',
      ],
    },
    controlCertidumbreYAdmisibilidad: {
      type: Type.OBJECT,
      properties: {
        pasaFiltroInicial: { type: Type.BOOLEAN },
        requiereDespachoSaneador: { type: Type.BOOLEAN },
        requiereSeparacionPiezas: { type: Type.BOOLEAN },
        requiereAcumulacion: { type: Type.BOOLEAN },
        observacionProcesal: { type: Type.STRING },
        borradorOficioSubsanacionOInicio: { type: Type.STRING },
      },
      required: [
        'pasaFiltroInicial',
        'requiereDespachoSaneador',
        'requiereSeparacionPiezas',
        'requiereAcumulacion',
        'observacionProcesal',
        'borradorOficioSubsanacionOInicio',
      ],
    },
    hojaDeRutaPasoAPaso: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pasoNumero: { type: Type.INTEGER },
          fase: { type: Type.STRING },
          accionRequerida: { type: Type.STRING },
          fundamentoNormativo: { type: Type.STRING },
          plazoLegal: { type: Type.STRING },
          unidadesAFVFInvolucradas: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'pasoNumero',
          'fase',
          'accionRequerida',
          'fundamentoNormativo',
          'plazoLegal',
          'unidadesAFVFInvolucradas',
        ],
      },
    },
    pliegoInterrogatorioSugerido: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          destinatario: {
            type: Type.STRING,
            enum: [
              'IMPUTADO',
              'VICTIMA',
              'TESTIGO_PRESENCIAL',
              'OFICIAL_PARTIDO',
              'FUNCIONARIO_POLICIAL',
            ],
          },
          nombreSugerido: { type: Type.STRING },
          advertenciaJuramento: { type: Type.STRING },
          preguntasEstrategicas: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'destinatario',
          'nombreSugerido',
          'advertenciaJuramento',
          'preguntasEstrategicas',
        ],
      },
    },
    alertasCriticasSLA: {
      type: Type.OBJECT,
      properties: {
        tieneMedidaCautelarActiva: { type: Type.BOOLEAN },
        alertaArt30Rdfvf30Dias: { type: Type.STRING },
        alertaLOPNNAArt65Reserva: { type: Type.BOOLEAN },
        requisitosFacturacionAdminUCA: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        'tieneMedidaCautelarActiva',
        'alertaArt30Rdfvf30Dias',
        'alertaLOPNNAArt65Reserva',
        'requisitosFacturacionAdminUCA',
      ],
    },
  },
  required: [
    'tipologiaDetectada',
    'controlCertidumbreYAdmisibilidad',
    'hojaDeRutaPasoAPaso',
    'pliegoInterrogatorioSugerido',
    'alertasCriticasSLA',
  ],
};

export async function orientarInstruccionExpedienteAction(params: {
  descripcionCasoNuevosRecaudos: string;
  datosAnonimizadosConfirmados: boolean;
}): Promise<GuiaInstruccionProcesalIA> {
  await requierePermiso('ingesta:run');
  if (!params.datosAnonimizadosConfirmados) {
    throw new Error('Revisa y anonimiza los datos identificables antes de consultar la guía.');
  }
  const textoSeguro = anonimizarIdentificadoresDirectos(
    params.descripcionCasoNuevosRecaudos.trim(),
  );
  if (textoSeguro.length < 20 || textoSeguro.length > 100_000) {
    throw new Error('La descripción debe tener entre 20 y 100.000 caracteres.');
  }
  const [playbooks, precedentes] = await Promise.all([
    prisma.plantillaProcedimientoCDH.findMany(),
    buscarPrecedentesSimilaresRAG(textoSeguro, 5),
  ]);

  const prompt = `
Eres el Agente IA Director de Instrucción Procesal del Consejo de Honor de la Federación Venezolana de Fútbol (FVF).
Tu misión es guiar paso a paso al Especialista Legal, Analista y Secretario Ejecutivo sobre cómo proceder ante el siguiente caso o escrito recibido, aplicando estrictamente la doctrina y praxis real del CDH-FVF:

REGLAS DE ORO DE LA PRAXIS CDH-FVF (EXTRAÍDAS DE LOS EXPEDIENTES REALES 2026):
1. Certidumbre Documental (Regla Exp. 002/26): Si solicitan ejecutar una decisión de la CRD pero el PDF adjunto corresponde a otro demandante o faltan anexos anunciados (Regla Exp. 061/26), activa requiereDespachoSaneador = true y redacta el correo exigiendo la documental correcta antes de abrir procedimiento.
2. Pluralidad de Imputados vs. Conexidad: Si un informe denuncia a varios jugadores por publicaciones individuales en redes sociales (Regla Exp. 129/25 -> Exp. 004/26 y 005/26), ordena separar en piezas individuales (requiereSeparacionPiezas = true). Si en cambio un mismo directivo comete hechos continuados entre Sub-15 y Sub-16 el mismo día (Regla Exp. 051/26), ordena acumular (requiereAcumulacion = true).
3. Pliegos de Interrogatorio: Diseña cuestionarios profundos de 15 a 20 preguntas con juramento de ley (Art. 84.2 y 178 RD-FVF, Art. 12 y 34 CDF), confrontando la presunción de veracidad de los informes arbitrales y de delegados (Art. 43.1 CDC / Art. 40 CDF) con las circunstancias de modo, tiempo, lugar, distancia acústica, titularidad de cuentas y deberes de Oficial de Integridad.
4. Control de Medidas Cautelares (Regla Art. 30 RD-FVF - Exp. 051/26): Toda inhabilitación o suspensión provisional caduca a los 30 días continuos. Advierte la fecha fatal para dictar decisión definitiva.
5. Protección de Adolescentes (Regla Art. 65 LOPNNA - Exp. 051/26 y 061/26): Si involucra categorías menores (Sub-13 a Sub-20), activa alertaLOPNNAArt65Reserva = true prohibiendo divulgar públicamente datos identificativos del menor.

PLAYBOOKS OFICIALES EN BASE DE DATOS:
${JSON.stringify(playbooks, null, 2)}

PRECEDENTES HISTÓRICOS ANONIMIZADOS Y APROBADOS:
${JSON.stringify(precedentes, null, 2)}

CASO / DOCUMENTACIÓN RECIBIDA A ORIENTAR:
"""
${textoSeguro}
"""
Usa los precedentes solo como orientación, cita el código cuando sea pertinente y distingue
siempre el antecedente de la norma vigente. Señala la norma que el especialista debe verificar.
`;

  const res = await clienteGoogleGenAI().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: ESQUEMA_GUIA_INSTRUCCION,
      temperature: 0.1,
    },
  });

  return JSON.parse(res.text || '{}') as GuiaInstruccionProcesalIA;
}
