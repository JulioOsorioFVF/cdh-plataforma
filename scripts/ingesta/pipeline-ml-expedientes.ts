/**
 * Indexación del corpus normativo público y autorizado (pgvector).
 * Los expedientes históricos solo se indexan desde la pantalla de revisión
 * después de anonimización y aprobación humana.
 *
 * Ejecutar con: npx tsx scripts/ingesta/pipeline-ml-expedientes.ts
 */
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';

config();

const prisma = new PrismaClient();
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error('Define GEMINI_API_KEY en tu archivo .env para vectorizar el corpus jurídico.');
}
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

/**
 * Genera el vector de 768 dimensiones con Gemini text-embedding-004
 */
async function generarEmbeddingJuridico(texto: string): Promise<number[]> {
  const limpio = texto.replace(/\s+/g, ' ').trim().slice(0, 8000);
  const res = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: limpio,
  });
  const valores = res.embeddings?.[0]?.values;
  if (!valores || valores.length === 0) {
    throw new Error('No se pudo generar el vector de embedding.');
  }
  return valores;
}

/**
 * Extrae artículos del RDFVF o Código FIFA mencionados en texto libre (Regex Jurídico)
 */
export function extraerArticulosNormativos(texto: string): string[] {
  if (!texto) return [];
  const regex = /(?:art(?:ículo|iculo|s|\.)?\s*)(\d+(?:\.\d+)?(?:\s*(?:y|,|al)\s*\d+)*)\s*(?:del\s*)?(RDFVF|CD-FIFA|Código\s*Disciplinario)?/gi;
  const encontrados = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(texto)) !== null) {
    const num = match[1];
    if (!num) continue;
    const cuerpo = (match[2] || 'RDFVF').toUpperCase();
    encontrados.add(`Art. ${num} ${cuerpo}`);
  }
  return Array.from(encontrados);
}

/**
 * 1. Indexa la base normativa estructural del Consejo de Honor en el Vector Store
 */
async function sembrarCorpusNormativoFVF() {
  const normasBase = [
    {
      codigoReferencia: 'RDFVF-ART-169',
      tipoDocumento: 'ARTICULO_RDFVF',
      anio: 2026,
      motivoTipificado: 'Requisitos formales del escrito de protesta o denuncia',
      articulosClave: ['Art. 169 RDFVF'],
      extractoHechos: 'Toda protesta o denuncia ante el Consejo de Honor debe señalar de manera expresa y clara las disposiciones normativas o estatutarias que se consideran infringidas.',
      criterioJuridico: 'La omisión de indicar las disposiciones violadas acarrea la declaratoria de INADMISIBILIDAD de entrada sin necesidad de abrir lapso probatorio.',
      multaAplicadaUcfvf: 0,
      sancionDeportiva: 'Inadmisibilidad de la protesta',
    },
    {
      codigoReferencia: 'RDFVF-ART-170',
      tipoDocumento: 'ARTICULO_RDFVF',
      anio: 2026,
      motivoTipificado: 'Caución reglamentaria obligatoria para protestas de partido',
      articulosClave: ['Art. 170 RDFVF'],
      extractoHechos: 'Para que una protesta de partido sea admitida a trámite, el club accionante debe consignar junto con el escrito el comprobante de pago de la caución establecida en las normas reguladoras del torneo.',
      criterioJuridico: 'La falta de consignación oportuna de la caución (Art. 170 RDFVF) produce la INADMISIBILIDAD inmediata del recurso.',
      multaAplicadaUcfvf: 0,
      sancionDeportiva: 'Inadmisibilidad por falta de caución',
    },
    {
      codigoReferencia: 'RDFVF-ALINEACION-USURPACION',
      tipoDocumento: 'ARTICULO_RDFVF',
      anio: 2026,
      motivoTipificado: 'Alineación Indebida y Usurpación de Identidad',
      articulosClave: ['Art. 77 RDFVF', 'Art. 108 RDFVF'],
      extractoHechos: 'Incluir en el acta de juego o hacer participar a un jugador suspendido, no inscrito en COMET, sin elegibilidad o suplantando la identidad de otro futbolista.',
      criterioJuridico: 'Se sanciona con la pérdida del partido por forfait (3-0), multa en UCFVF y suspensión severa al jugador e involucrados tras cotejo oficial con la Dirección de Registros (COMET).',
      multaAplicadaUcfvf: 150,
      sancionDeportiva: 'Pérdida de puntos (3-0) y suspensión',
    },
    {
      codigoReferencia: 'RDFVF-SEGURIDAD-FUERZA-PUBLICA',
      tipoDocumento: 'ARTICULO_RDFVF',
      anio: 2026,
      motivoTipificado: 'Fuerza Pública Insuficiente, Incidentes en Camerinos e Invasión de Cancha',
      articulosClave: ['Art. 77.2 RDFVF', 'Art. 112 RDFVF'],
      extractoHechos: 'Reporte del delegado de partido o árbitro sobre ausencia o insuficiencia de funcionarios policiales, fallas en camerinos de árbitros, lanzamiento de objetos o agresión del público.',
      criterioJuridico: 'Responsabilidad objetiva del club local organizador. Se impone multa pecuniaria en UCFVF y, en caso de reincidencia o gravedad, cierre parcial o total del estadio / jugar a puerta cerrada.',
      multaAplicadaUcfvf: 120,
      sancionDeportiva: 'Multa pecuniaria y apercibimiento/cierre de sede',
    },
    {
      codigoReferencia: 'CD-FIFA-ART-21-DEUDAS-CNA',
      tipoDocumento: 'CODIGO_FIFA',
      anio: 2026,
      motivoTipificado: 'Incumplimiento de decisiones financieras y falta de pago a árbitros (CNA)',
      articulosClave: ['Art. 21 CD-FIFA', 'Art. 104 RDFVF'],
      extractoHechos: 'Impago de sumas adeudadas a jugadores, cuerpo técnico o falta de pago de honorarios y viáticos arbitrales reportados por la Comisión Nacional de Árbitros (CNA).',
      criterioJuridico: 'Imposición de multa en UCFVF, orden de pago perentoria y bloqueo administrativo en coordinación con Licencia de Clubes y Registros hasta obtener solvencia verificada por Administración.',
      multaAplicadaUcfvf: 250,
      sancionDeportiva: 'Prohibición de inscribir jugadores / Bloqueo Licencia de Clubes',
    },
  ];

  for (const norma of normasBase) {
    const textoParaVector = `[${norma.tipoDocumento}] ${norma.codigoReferencia} - ${norma.motivoTipificado}. Artículos: ${norma.articulosClave.join(', ')}. Supuesto: ${norma.extractoHechos}. Criterio CDH: ${norma.criterioJuridico}`;
    const vector = await generarEmbeddingJuridico(textoParaVector);
    const vectorSql = `[${vector.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO memoria_juridica_vectorial (
        tipo_documento, codigo_referencia, anio, motivo_tipificado,
        articulos_clave, extracto_hechos, criterio_juridico,
        multa_aplicada_ucfvf, sancion_deportiva, metadatos_json, embedding
      ) VALUES (
        $1, $2, $3, $4, $5::text[], $6, $7, $8, $9, $10::jsonb, $11::vector
      )
      ON CONFLICT (codigo_referencia) DO UPDATE SET
        criterio_juridico = EXCLUDED.criterio_juridico,
        embedding = EXCLUDED.embedding;
      `,
      norma.tipoDocumento,
      norma.codigoReferencia,
      norma.anio,
      norma.motivoTipificado,
      norma.articulosClave,
      norma.extractoHechos,
      norma.criterioJuridico,
      norma.multaAplicadaUcfvf,
      norma.sancionDeportiva,
      JSON.stringify({ fuente: 'Corpus Oficial CDH-FVF' }),
      vectorSql,
    );
  }
  console.log(`[OK] ${normasBase.length} bloques normativos vectorizados en Supabase.`);
}

async function main() {
  await sembrarCorpusNormativoFVF();
}

main()
  .catch((err) => {
    console.error('Error en el pipeline ML/RAG:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());