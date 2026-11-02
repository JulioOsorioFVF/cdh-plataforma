'use server';

import { GoogleGenAI, Type, Schema } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const VALOR_UCFVF_USD = 3.0; // Paridad oficial CDH-FVF ($3.00 USD por cada 1 UCFVF)

function clienteGoogleGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Define GEMINI_API_KEY en tu archivo .env para usar el agente jurídico.');
  }
  return new GoogleGenAI({ apiKey });
}

export interface PrecedenteRecuperadoRAG {
  codigoReferencia: string;
  tipoDocumento: string;
  motivoTipificado: string;
  criterioJuridico: string;
  multaAplicadaUcfvf: number;
  similitud: number;
}

export interface DictamenEstructuradoAgenteIA {
  admisibilidadProcesal: {
    esAdmisible: boolean;
    cumpleArt169NormasVioladas: boolean;
    cumpleArt170Caucion: boolean;
    cumpleTempestividad: boolean;
    motivacionAdmisibilidad: string;
  };
  tipificacionJuridica: {
    categoriaIncidencia:
      | 'DEPORTIVA_JUGADOR'
      | 'CUERPO_TECNICO'
      | 'INFRAESTRUCTURA_CAMERINOS'
      | 'FUERZA_PUBLICA_SEGURIDAD'
      | 'PROTOCOLO_MATERIAL'
      | 'DOCUMENTACION_ALINEACION'
      | 'FINANCIERA_ARBITRAJE'
      | 'INTEGRIDAD_AMANO';
    motivoEstandarizado: string;
    articulosAplicables: string[];
    nivelSeveridad: 'LEVE' | 'MODERADA' | 'GRAVE' | 'CRITICA_TAS';
  };
  propuestaSancionatoria: Array<{
    sujetoSancionado: string;
    tipoSujeto: 'CLUB' | 'JUGADOR' | 'CUERPO_TECNICO' | 'DIRIGENTE' | 'OFICIAL_PARTIDO';
    clubInvolucrado: string;
    tipoSancion: 'ADVERTENCIA' | 'AMONESTACION' | 'SUSPENSION' | 'MULTA' | 'EXPULSION' | 'DEDUCCION_PUNTOS';
    partidosSuspension: number;
    multaSugeridaUcfvf: number;
    multaSugeridaUsd: number;
    agravaPorReincidencia: boolean;
    fundamentoCalculo: string;
  }>;
  oficiosYNotificaciones: Array<
    'REGISTROS_COMET' | 'LICENCIA_CLUBES' | 'CNA_ARBITROS' | 'ADMINISTRACION_FINANZAS' | 'DIRECCION_COMPETICIONES' | 'UNIDAD_INTEGRIDAD'
  >;
  borradorDocumentoOficial: {
    tipoPronunciamiento: 'REFERENCIA_INSTRUCCION' | 'DECISION_DEFINITIVA' | 'ACTA_DISCIPLINARIA_JORNADA';
    encabezadoSugerido: string;
    vistosYConsiderandos: string;
    dispositivaOficial: string;
  };
  recomendacionEstrategicaCSO: string;
}

/**
 * 1. Búsqueda Semántica Vectorial en Supabase (pgvector)
 */
export async function buscarPrecedentesSimilaresRAG(
  textoConsulta: string,
  topK = 5,
): Promise<PrecedenteRecuperadoRAG[]> {
  const embRes = await clienteGoogleGenAI().models.embedContent({
    model: 'text-embedding-004',
    contents: textoConsulta.slice(0, 6000),
  });
  const vector = embRes.embeddings?.[0]?.values;
  if (!vector) return [];

  const vectorSql = `[${vector.join(',')}]`;
  const filas = await prisma.$queryRawUnsafe<
    Array<{
      codigo_referencia: string;
      tipo_documento: string;
      motivo_tipificado: string;
      criterio_juridico: string;
      multa_aplicada_ucfvf: number;
      similitud: number;
    }>
  >(
    `
    SELECT
      codigo_referencia,
      tipo_documento,
      motivo_tipificado,
      criterio_juridico,
      CAST(multa_aplicada_ucfvf AS FLOAT) AS multa_aplicada_ucfvf,
      1 - (embedding <=> $1::vector) AS similitud
    FROM memoria_juridica_vectorial
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $2;
    `,
    vectorSql,
    topK,
  );

  return filas.map((f) => ({
    codigoReferencia: f.codigo_referencia,
    tipoDocumento: f.tipo_documento,
    motivoTipificado: f.motivo_tipificado,
    criterioJuridico: f.criterio_juridico,
    multaAplicadaUcfvf: Number(f.multa_aplicada_ucfvf || 0),
    similitud: Number((f.similitud || 0).toFixed(4)),
  }));
}

/**
 * 2. Consulta el Feature Store de Reincidencia y Solvencia en Supabase
 */
async function obtenerContextoReincidenciaSujetos(texto: string) {
  const sujetosRegistrados = await prisma.historialDisciplinarioSujeto.findMany({
    take: 25,
    orderBy: { sancionesHistoricas: 'desc' },
  });

  const textoUpper = texto.toUpperCase();
  return sujetosRegistrados.filter(
    (s) =>
      textoUpper.includes(s.nombreCompleto.toUpperCase()) ||
      (s.clubActual && textoUpper.includes(s.clubActual.toUpperCase())),
  );
}

/**
 * 3. Esquema JSON Estricto (Structured Output) para garantizar respuesta determinista del LLM
 */
const ESQUEMA_DICTAMEN_JURIDICO: Schema = {
  type: Type.OBJECT,
  properties: {
    admisibilidadProcesal: {
      type: Type.OBJECT,
      properties: {
        esAdmisible: { type: Type.BOOLEAN },
        cumpleArt169NormasVioladas: { type: Type.BOOLEAN },
        cumpleArt170Caucion: { type: Type.BOOLEAN },
        cumpleTempestividad: { type: Type.BOOLEAN },
        motivacionAdmisibilidad: { type: Type.STRING },
      },
      required: [
        'esAdmisible',
        'cumpleArt169NormasVioladas',
        'cumpleArt170Caucion',
        'cumpleTempestividad',
        'motivacionAdmisibilidad',
      ],
    },
    tipificacionJuridica: {
      type: Type.OBJECT,
      properties: {
        categoriaIncidencia: {
          type: Type.STRING,
          enum: [
            'DEPORTIVA_JUGADOR',
            'CUERPO_TECNICO',
            'INFRAESTRUCTURA_CAMERINOS',
            'FUERZA_PUBLICA_SEGURIDAD',
            'PROTOCOLO_MATERIAL',
            'DOCUMENTACION_ALINEACION',
            'FINANCIERA_ARBITRAJE',
            'INTEGRIDAD_AMANO',
          ],
        },
        motivoEstandarizado: { type: Type.STRING },
        articulosAplicables: { type: Type.ARRAY, items: { type: Type.STRING } },
        nivelSeveridad: { type: Type.STRING, enum: ['LEVE', 'MODERADA', 'GRAVE', 'CRITICA_TAS'] },
      },
      required: ['categoriaIncidencia', 'motivoEstandarizado', 'articulosAplicables', 'nivelSeveridad'],
    },
    propuestaSancionatoria: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sujetoSancionado: { type: Type.STRING },
          tipoSujeto: {
            type: Type.STRING,
            enum: ['CLUB', 'JUGADOR', 'CUERPO_TECNICO', 'DIRIGENTE', 'OFICIAL_PARTIDO'],
          },
          clubInvolucrado: { type: Type.STRING },
          tipoSancion: {
            type: Type.STRING,
            enum: ['ADVERTENCIA', 'AMONESTACION', 'SUSPENSION', 'MULTA', 'EXPULSION', 'DEDUCCION_PUNTOS'],
          },
          partidosSuspension: { type: Type.INTEGER },
          multaSugeridaUcfvf: { type: Type.NUMBER },
          multaSugeridaUsd: { type: Type.NUMBER },
          agravaPorReincidencia: { type: Type.BOOLEAN },
          fundamentoCalculo: { type: Type.STRING },
        },
        required: [
          'sujetoSancionado',
          'tipoSujeto',
          'clubInvolucrado',
          'tipoSancion',
          'partidosSuspension',
          'multaSugeridaUcfvf',
          'multaSugeridaUsd',
          'agravaPorReincidencia',
          'fundamentoCalculo',
        ],
      },
    },
    oficiosYNotificaciones: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: [
          'REGISTROS_COMET',
          'LICENCIA_CLUBES',
          'CNA_ARBITROS',
          'ADMINISTRACION_FINANZAS',
          'DIRECCION_COMPETICIONES',
          'UNIDAD_INTEGRIDAD',
        ],
      },
    },
    borradorDocumentoOficial: {
      type: Type.OBJECT,
      properties: {
        tipoPronunciamiento: {
          type: Type.STRING,
          enum: ['REFERENCIA_INSTRUCCION', 'DECISION_DEFINITIVA', 'ACTA_DISCIPLINARIA_JORNADA'],
        },
        encabezadoSugerido: { type: Type.STRING },
        vistosYConsiderandos: { type: Type.STRING },
        dispositivaOficial: { type: Type.STRING },
      },
      required: ['tipoPronunciamiento', 'encabezadoSugerido', 'vistosYConsiderandos', 'dispositivaOficial'],
    },
    recomendacionEstrategicaCSO: { type: Type.STRING },
  },
  required: [
    'admisibilidadProcesal',
    'tipificacionJuridica',
    'propuestaSancionatoria',
    'oficiosYNotificaciones',
    'borradorDocumentoOficial',
    'recomendacionEstrategicaCSO',
  ],
};

/**
 * 4. Server Action Principal: Analiza un Informe Arbitral, de Delegado o Expediente
 *    cruzando RAG Vectorial + Feature Store de Reincidencia.
 */
export async function ejecutarAgenteJuridicoCDHAction(params: {
  torneo: string;
  jornada: number;
  origen: 'INFORME_ARBITRAL' | 'INFORME_DELEGADO' | 'PROTESTA_CLUB' | 'CONSULTA_REGIONAL';
  textoInforme: string;
  guardarEnActaSupabase?: boolean;
}): Promise<{
  dictamen: DictamenEstructuradoAgenteIA;
  precedentesRAG: PrecedenteRecuperadoRAG[];
  reincidentesDetectados: number;
  actaGuardadaCodigo?: string;
}> {
  // Paso A: Recuperar Jurisprudencia y Normas del Vector Store (RAG)
  const precedentesRAG = await buscarPrecedentesSimilaresRAG(
    `${params.torneo} ${params.origen} ${params.textoInforme}`,
    4,
  );

  // Paso B: Consultar Feature Store de Reincidencia y Deudas Pendientes
  const antecedentesSujetos = await obtenerContextoReincidenciaSujetos(params.textoInforme);

  const promptContextualizado = `
Eres el Agente Jurídico Senior y Cientista de Datos del Consejo de Honor de la Federación Venezolana de Fútbol (FVF).
Analiza el siguiente documento de origen "${params.origen}" correspondiente al torneo "${params.torneo}" (Jornada ${params.jornada}).

REGLAS ESTRICTAS DE DERECHO DEPORTIVO FVF Y ARITMÉTICA SANCIONATORIA:
1. Paridad cambiaria oficial: 1 UCFVF = $${VALOR_UCFVF_USD.toFixed(2)} USD. Siempre asegura que multaSugeridaUsd = multaSugeridaUcfvf * 3.
2. Si el origen es "PROTESTA_CLUB", verifica rigurosamente el Art. 169 RDFVF (indicación expresa de normas violadas) y el Art. 170 RDFVF (consignación de caución). Si falta cualquiera, declara esAdmisible = false.
3. Si el origen es "INFORME_ARBITRAL" o "INFORME_DELEGADO", extrae todas las incidencias (acumulación de 4 amarillas, expulsiones, insultos de cuerpo técnico, fallas de fuerza pública, camerinos de árbitros, retrasos de protocolo) y genera las sanciones individuales para el Acta Disciplinaria.

PRECEDENTES Y NORMAS RECUPERADAS DE SUPABASE (RAG VECTORIAL):
${JSON.stringify(precedentesRAG, null, 2)}

ANTECEDENTES DE REINCIDENCIA Y SOLVENCIA EN FEATURE STORE SUPABASE:
${JSON.stringify(antecedentesSujetos, null, 2)}

TEXTO ÍNTEGRO DEL INFORME / DENUNCIA A PROCESAR:
"""
${params.textoInforme}
"""
`;

  const respuesta = await clienteGoogleGenAI().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: promptContextualizado }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: ESQUEMA_DICTAMEN_JURIDICO,
      temperature: 0.1, // Temperatura mínima para máxima precisión jurídica
    },
  });

  if (!respuesta.text) {
    throw new Error('El agente de IA no devolvió un dictamen.');
  }
  const dictamen = JSON.parse(respuesta.text) as DictamenEstructuradoAgenteIA;

  // Normalización determinista post-LLM: Garantizar que USD === UCFVF * 3.00
  dictamen.propuestaSancionatoria = dictamen.propuestaSancionatoria.map((s) => ({
    ...s,
    multaSugeridaUsd: +(s.multaSugeridaUcfvf * VALOR_UCFVF_USD).toFixed(2),
  }));

  // Paso C: Si el usuario indicó guardar las incidencias directamente en el Acta Disciplinaria de la Jornada
  let actaGuardadaCodigo: string | undefined;
  if (params.guardarEnActaSupabase && dictamen.propuestaSancionatoria.length > 0) {
    const anioActual = new Date().getFullYear();
    const slugTorneo = params.torneo.toUpperCase().replace(/[^A-Z0-9]+/g, '');
    actaGuardadaCodigo = `ACTA-${slugTorneo}-${anioActual}-J${params.jornada}`;

    const sumaUcfvf = dictamen.propuestaSancionatoria.reduce((acc, s) => acc + s.multaSugeridaUcfvf, 0);
    const sumaUsd = +(sumaUcfvf * VALOR_UCFVF_USD).toFixed(2);

    const acta = await prisma.actaDisciplinariaJornada.upsert({
      where: { codigoActa: actaGuardadaCodigo },
      update: {
        partidosAnalizados: { increment: 1 },
        totalMultasUcfvf: { increment: sumaUcfvf },
        totalMultasUsd: { increment: sumaUsd },
      },
      create: {
        codigoActa: actaGuardadaCodigo,
        anio: anioActual,
        semestre: `${anioActual}-${new Date().getMonth() < 6 ? 1 : 2}`,
        torneo: params.torneo,
        jornadaNumero: params.jornada,
        partidosAnalizados: 1,
        juezUnicoPonente: 'Juez Único de Competencia',
        especialistaLegal: 'Coordinación Consejo de Honor',
        analistaAsignado: 'Analista de Seguimiento CDH',
        totalMultasUcfvf: sumaUcfvf,
        totalMultasUsd: sumaUsd,
      },
    });

    for (const s of dictamen.propuestaSancionatoria) {
      await prisma.incidenciaActaPartido.create({
        data: {
          actaId: acta.id,
          partido: `${s.clubInvolucrado}`,
          origen:
            params.origen === 'INFORME_DELEGADO'
              ? 'INFORME_DELEGADO'
              : params.origen === 'PROTESTA_CLUB'
                ? 'DENUNCIA_CLUB'
                : params.origen === 'CONSULTA_REGIONAL'
                  ? 'OFICIO_COMPETICIONES'
                  : 'INFORME_ARBITRAL',
          categoria: dictamen.tipificacionJuridica.categoriaIncidencia,
          motivoEstandarizado: dictamen.tipificacionJuridica.motivoEstandarizado,
          clubInvolucrado: s.clubInvolucrado,
          sujetoSancionado: s.sujetoSancionado,
          tipoSujeto: s.tipoSujeto,
          extractoInformeBruto: params.textoInforme.slice(0, 500),
          articulosRdfvf: dictamen.tipificacionJuridica.articulosAplicables,
          tipoSancion: s.tipoSancion,
          partidosSuspension: s.partidosSuspension,
          multaUcfvf: s.multaSugeridaUcfvf,
          multaUsd: s.multaSugeridaUsd,
          esReincidente: s.agravaPorReincidencia,
        },
      });
    }

    revalidatePath('/agente-ia');
    revalidatePath('/expedientes');
    revalidatePath('/dashboard');
  }

  return {
    dictamen,
    precedentesRAG,
    reincidentesDetectados: antecedentesSujetos.length,
    actaGuardadaCodigo,
  };
}