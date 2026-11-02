/**
 * Servicio de IA Jurídico-Deportiva para el Consejo de Honor FVF.
 * Analiza informes de árbitros, delegados de partido y comisiones regionales.
 */
export interface ResultadoAnalisisDisciplinarioIA {
  clasificacionIncidencia:
    | 'DEPORTIVA_JUGADOR'
    | 'CUERPO_TECNICO'
    | 'INFRAESTRUCTURA_CAMERINOS'
    | 'FUERZA_PUBLICA_SEGURIDAD'
    | 'ALINEACION_INDEBIDA_USURPACION'
    | 'FALTA_PAGO_ARBITROS_DEUDA'
    | 'INTEGRIDAD_AMANO_PARTIDOS';
  articulosRdfvfDetectados: string[]; // ej. ["Art. 169 RDFVF", "Art. 170 RDFVF (Caución)", "Art. 77.2 RDFVF"]
  sujetosInvolucrados: Array<{
    nombre: string;
    rol: 'JUGADOR' | 'CUERPO_TECNICO' | 'CLUB' | 'OFICIAL_PARTIDO' | 'DIRIGENTE';
    sancionSugeridaPartidos: number;
    multaSugeridaUcfvf: number;
  }>;
  alertaInadmisibilidad: {
    esInadmisible: boolean;
    causa?: 'FALTA_CAUCION_ART_170' | 'FALTA_DISPOSICIONES_VIOLADAS_ART_169' | 'EXTEMPORANEO' | 'SIN_LEGITIMACION';
  };
  notificacionesAutomaticas: Array<'COMET_REGISTROS' | 'CNA_ARBITROS' | 'LICENCIA_CLUBES' | 'INTEGRIDAD_FVF' | 'ADMINISTRACION'>;
  resumenPedagogico: string;
}

export async function analizarInformeConIA(params: {
  origen: 'ARBITRO' | 'DELEGADO' | 'COMISION_REGIONAL' | 'PROTESTA_CLUB';
  torneo: string;
  partido: string;
  textoInforme: string;
}): Promise<ResultadoAnalisisDisciplinarioIA> {
  const promptSistema = `
Eres el Asistente Jurídico Senior del Consejo de Honor de la Federación Venezolana de Fútbol (FVF).
Analiza el siguiente informe (${params.origen}) del torneo "${params.torneo}" (Partido: ${params.partido}).
Extrae estrictamente en JSON:
1. Clasificación de la incidencia según el catálogo oficial CDH-FVF.
2. Artículos del Reglamento Disciplinario FVF (RDFVF) y Código Disciplinario FIFA aplicables.
3. Si es una protesta de partido, verifica requisitos de admisibilidad: Art. 169 (indicar disposiciones violadas) y Art. 170 (caución).
4. Órganos internos a oficiar automáticamente (COMET, CNA, Licencia de Clubes, Administración, Unidad de Integridad).
5. Un resumen ejecutivo y pedagógico de 3 líneas para el Juez Único y el Analista.
`;

  const respuesta = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + process.env.GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${promptSistema}\n\nINFORME:\n${params.textoInforme}` }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  const data = await respuesta.json();
  return JSON.parse(data.candidates[0].content.parts[0].text) as ResultadoAnalisisDisciplinarioIA;
}