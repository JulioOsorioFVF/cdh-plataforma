import { prisma } from '@/lib/prisma';
import type { EstadoExpediente } from '@prisma/client';

export interface PrecedenteJurisprudencial {
  id: number;
  numero: string;
  anio: number;
  motivo: string | null;
  ligaTorneo: string | null;
  equipos: string | null;
  numeroDecision: string | null;
  sancionRaw: string | null;
  sancionadoRaw: string | null;
  multaUc: number | null;
  multaUsd: number | null;
  estado: EstadoExpediente;
  fechaResolucion: Date | null;
  tramiteRaw: string | null;
}

export interface PasoProcesalGuia {
  paso: number;
  titulo: string;
  descripcion: string;
  articulosClave: string[];
  accionesRecomendadas: string[];
  plazosLegales: string;
}

export const PASOS_PROCESO_DISCIPLINARIO: PasoProcesalGuia[] = [
  {
    paso: 1,
    titulo: 'Recepción, Calificación y Examen de Admisibilidad',
    descripcion:
      'Recepción de informe arbitral, delegado o protesta de parte. Se verifica cumplimiento estricto de requisitos formales antes de cualquier providencia de fondo.',
    articulosClave: ['Art. 169 RDFVF (Indicación de normas violadas)', 'Art. 170 RDFVF (Caución económica)', 'Art. 77 RDFVF'],
    accionesRecomendadas: [
      'Verificar sello de recepción y lapso de presentación (dentro de las 48-72h del partido).',
      'Comprobar consignación bancaria de la caución establecida en Art. 170 para protestas de clubes.',
      'Si carece de caución o no cita las normas infringidas, redactar Auto de Inadmisibilidad In Limine (Desestimado).',
      'Si cumple requisitos, proceder a apertura de expediente disciplinario.',
    ],
    plazosLegales: '48 a 72 horas para interposición de protesta.',
  },
  {
    paso: 2,
    titulo: 'Apertura de Expediente y Auto de Entrada (A.E.)',
    descripcion:
      'Radicación oficial en el sistema, generación de nomenclatura (ej. Exp. 015/2026), fijación de Juez Instructor / Ponente y apertura formal de la instrucción.',
    articulosClave: ['Art. 172 RDFVF', 'Art. 173 RDFVF', 'Normas Reguladoras del Torneo'],
    accionesRecomendadas: [
      'Asignar número correlativo anual y radicación en el Libro de Expedientes.',
      'Dictar Auto de Entrada (A.E.) con designación de Juez Instructor.',
      'Notificar a los involucrados (club, jugador, oficial o árbitro) emplazándolos a presentar descargos y pruebas.',
      'Registrar tarjeta en el Tablero Kanban en estado "EN ESTUDIO".',
    ],
    plazosLegales: '3 a 5 días hábiles otorgados para la contestación y descargos.',
  },
  {
    paso: 3,
    titulo: 'Instrucción, Análisis Probatorio y Cotejo Jurisprudencial',
    descripcion:
      'Evaluación de actas COMET, informes complementarios, videos oficiales y contraste con precedentes del Consejo de Honor para garantizar igualdad y coherencia.',
    articulosClave: ['Art. 39 RDFVF (Visas/Permisos)', 'Art. 110 RDFVF (Conducta Violenta)', 'Código Disciplinario FIFA'],
    accionesRecomendadas: [
      'Cotejar informe arbitral (que goza de presunción de veracidad iuris tantum) frente a los descargos recibidos.',
      'Consultar la base de datos jurisprudencial de expedientes previos con motivos similares.',
      'Determinar si existen atenuantes (falta de antecedentes) o agravantes (reincidencia en la misma temporada).',
      'Verificar de oficio la solvencia de honorarios arbitrales o requisitos federativos conexos.',
    ],
    plazosLegales: 'Instrucción sumaria conforme al calendario de competencia.',
  },
  {
    paso: 4,
    titulo: 'Proyecto de Decisión y Cuantificación de la Sanción',
    descripcion:
      'Elaboración del fallo definitivo: tipificación exacta, imposición de sanciones deportivas (suspensión de partidos) y multas económicas en UCFVF convertibles a USD.',
    articulosClave: ['Art. 45 RDFVF', 'Art. 60 RDFVF', 'Art. 180 RDFVF (Estructura de la Resolución)'],
    accionesRecomendadas: [
      'Redactar la parte motiva (hechos, derecho y jurisprudencia aplicada) y la dispositiva.',
      'Liquidar la multa en Unidades Cambiarias FVF (UCFVF) a la tasa oficial del día.',
      'Establecer la sanción deportiva (suspensión por partidos o meses) según el baremo reglamentario.',
      'Fijar apercibimiento de cumplimiento y consecuencias de desacato (Art. 77.2 RDFVF).',
    ],
    plazosLegales: 'Emisión de la Resolución antes de la siguiente jornada deportiva.',
  },
  {
    paso: 5,
    titulo: 'Notificación, Ejecutoriedad y Recursos',
    descripcion:
      'Publicación y notificación formal de la decisión, asentamiento en el sistema COMET y gestión del Recurso de Reconsideración o remisión a Segunda Instancia.',
    articulosClave: ['Art. 182 RDFVF (Reconsideración)', 'Art. 185 RDFVF (Apelación)', 'Reglamento COMET'],
    accionesRecomendadas: [
      'Remitir oficio de notificación a las partes y a la Dirección de Competiciones / CNA / COMET.',
      'Mover expediente en Kanban a "NOTIFICADO" o "RESUELTO".',
      'Computar lapso de 3 días para posible Recurso de Reconsideración (si se ejerce, pasa a "EN RECURSO").',
      'Una vez precluidos los lapsos o resuelto el recurso, remitir al archivo definitivo.',
    ],
    plazosLegales: '3 días hábiles para interponer Reconsideración tras la notificación.',
  },
];

/**
 * Busca antecedentes jurisprudenciales en la base de datos de expedientes de Supabase / PostgreSQL.
 */
export async function buscarJurisprudenciaExpedientes(params: {
  termino?: string;
  motivo?: string;
  limite?: number;
}): Promise<PrecedenteJurisprudencial[]> {
  const limite = params.limite ?? 5;
  const termino = (params.termino || params.motivo || '').trim();

  try {
    const whereClause = termino
      ? {
          OR: [
            { motivo: { contains: termino, mode: 'insensitive' as const } },
            { subMotivo: { contains: termino, mode: 'insensitive' as const } },
            { sancionRaw: { contains: termino, mode: 'insensitive' as const } },
            { sancionadoRaw: { contains: termino, mode: 'insensitive' as const } },
            { ligaTorneo: { contains: termino, mode: 'insensitive' as const } },
            { equipos: { contains: termino, mode: 'insensitive' as const } },
            { numeroDecision: { contains: termino, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const expedientes = await prisma.fact_expediente.findMany({
      where: whereClause,
      select: {
        id: true,
        numero: true,
        anio: true,
        motivo: true,
        ligaTorneo: true,
        equipos: true,
        numeroDecision: true,
        sancionRaw: true,
        sancionadoRaw: true,
        multaUc: true,
        multaUsd: true,
        estado: true,
        fechaResolucion: true,
        tramiteRaw: true,
      },
      orderBy: [{ fechaResolucion: 'desc' }, { anio: 'desc' }, { id: 'desc' }],
      take: limite,
    });

    return expedientes.map((e) => ({
      ...e,
      multaUc: e.multaUc ? Number(e.multaUc) : null,
      multaUsd: e.multaUsd ? Number(e.multaUsd) : null,
    }));
  } catch (error) {
    console.error('Error al consultar jurisprudencia en PostgreSQL/Supabase:', error);
    return [];
  }
}

export interface MensajeChat {
  rol: 'usuario' | 'asistente' | 'sistema';
  contenido: string;
  fecha?: string;
}

export interface ConsultaAgenteIA {
  mensaje: string;
  historial?: MensajeChat[];
  expedienteContexto?: {
    numero?: string;
    anio?: number;
    motivo?: string;
    torneo?: string;
    equipos?: string;
    estado?: string;
    alerta?: string;
  };
  pasoFoco?: number;
}

export interface RespuestaAgenteIA {
  respuesta: string;
  pasoActualSugerido: number;
  articulosCitados: string[];
  alertasProcesales: string[];
  precedentesRelevantes: PrecedenteJurisprudencial[];
  proximasAcciones: string[];
}

/**
 * Motor experto de Inteligencia Artificial para el Consejo de Honor FVF.
 * Si cuenta con GEMINI_API_KEY o ANTHROPIC_API_KEY, invoca el LLM con RAG jurisprudencial.
 * Si no cuenta con API key o falla la red, opera de forma autosuficiente con el
 * Motor Experto Jurídico-Deportivo del RDFVF y la base de datos de PostgreSQL/Supabase.
 */
export async function consultarAgenteDisciplinario(
  consulta: ConsultaAgenteIA,
): Promise<RespuestaAgenteIA> {
  const texto = consulta.mensaje.toLowerCase();

  // 1. Detección del paso procesal sugerido según la consulta y contexto
  let pasoSugerido = consulta.pasoFoco ?? 1;
  if (texto.includes('recurso') || texto.includes('reconsideracion') || texto.includes('apela') || texto.includes('notific')) {
    pasoSugerido = 5;
  } else if (texto.includes('sancion') || texto.includes('multa') || texto.includes('partidos') || texto.includes('decision') || texto.includes('resolucion')) {
    pasoSugerido = 4;
  } else if (texto.includes('prueba') || texto.includes('descargo') || texto.includes('jurisprudencia') || texto.includes('precedente') || texto.includes('arbitro')) {
    pasoSugerido = 3;
  } else if (texto.includes('auto de entrada') || texto.includes('inicio') || texto.includes('apertura') || texto.includes('radica')) {
    pasoSugerido = 2;
  } else if (texto.includes('admisib') || texto.includes('caucion') || texto.includes('170') || texto.includes('169') || texto.includes('protesta') || texto.includes('recib')) {
    pasoSugerido = 1;
  }

  // 2. Búsqueda de precedentes jurisprudenciales en base de datos
  const terminoBusqueda = consulta.expedienteContexto?.motivo || consulta.mensaje;
  const precedentes = await buscarJurisprudenciaExpedientes({
    termino: terminoBusqueda.slice(0, 80),
    limite: 4,
  });

  // 3. Evaluar si disponemos de Gemini API Key para modo generativo
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const contextoPrecedentes = precedentes
        .map(
          (p) =>
            `- Exp. ${p.numero}/${p.anio}: Motivo "${p.motivo || 'N/A'}" | Torneo: "${p.ligaTorneo || 'N/A'}" | Decisión: "${p.numeroDecision || 'N/A'}" | Sanción: "${p.sancionRaw || 'Sin sanción expresa'}" | Multa: ${p.multaUc || 0} UCFVF`,
        )
        .join('\n');

      const promptSistema = `Eres el Asistente Experto en Derecho Deportivo del Consejo de Honor de la Federación Venezolana de Fútbol (FVF).
Tu misión es asesorar y orientar con máximo rigor jurídico a los Jueces y Analistas en todas las etapas del proceso disciplinario.
Te fundamentas en:
1. Reglamento Disciplinario de la FVF (RDFVF).
2. Código Disciplinario de la FIFA.
3. Normas Reguladoras de las Competiciones Oficiales (Liga FUTVE, Liga FUTVE 2, Torneos Juveniles y Femeninos).
4. La base jurisprudencial histórica de expedientes del Consejo de Honor.

Contexto del caso en consulta:
${consulta.expedienteContexto ? JSON.stringify(consulta.expedienteContexto, null, 2) : 'Consulta general del usuario'}

Precedentes jurisprudenciales análogos encontrados en la base de datos de Supabase/PostgreSQL:
${contextoPrecedentes || 'No se hallaron coincidencias exactas en la búsqueda inicial.'}

Estructura de respuesta:
1. Diagnóstico Jurídico y Etapa Procesal Actual (Paso del Proceso).
2. Requisitos de Admisibilidad y Advertencias Legales (Enfasis en Arts. 169 y 170 RDFVF si hay protesta).
3. Fundamentación y Artículos Aplicables (RDFVF / FIFA).
4. Análisis de Precedentes Jurisprudenciales (cómo resolvió el Consejo de Honor casos similares).
5. Plan de Acción Recomendado (Siguientes pasos procesales a asentar en el expediente).
Responde con tono institucional, profesional y con claridad resolutiva.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${promptSistema}\n\nPregunta / Situación planteada por el usuario:\n${consulta.mensaje}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
            },
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const textoRespuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textoRespuesta) {
          return {
            respuesta: textoRespuesta,
            pasoActualSugerido: pasoSugerido,
            articulosCitados: extraerArticulos(textoRespuesta),
            alertasProcesales: extraerAlertas(consulta.mensaje, textoRespuesta),
            precedentesRelevantes: precedentes,
            proximasAcciones: extraerAcciones(pasoSugerido),
          };
        }
      }
    } catch (llmError) {
      console.warn('Fallo en invocación a API de Gemini, recurriendo al motor normativo experto:', llmError);
    }
  }

  // 4. Motor Experto Local Integrado (Offline-first & Zero external dependency failure)
  const respuestaGenerada = construirRespuestaExpertaLocal({
    mensaje: consulta.mensaje,
    pasoSugerido,
    precedentes,
    expedienteContexto: consulta.expedienteContexto,
  });

  return respuestaGenerada;
}

function extraerArticulos(texto: string): string[] {
  const regex = /art[íi]culo\s+\d+(\.\d+)?(\s+rdfvf|\s+fifa)?/gi;
  const matches = texto.match(regex) || [];
  const articulos = Array.from(new Set(matches.map((m) => m.trim().toUpperCase())));
  return articulos.length > 0 ? articulos : ['Art. 169 RDFVF', 'Art. 170 RDFVF', 'Art. 77 RDFVF'];
}

function extraerAlertas(mensaje: string, respuesta: string): string[] {
  const alertas: string[] = [];
  const lower = (mensaje + ' ' + respuesta).toLowerCase();

  if (lower.includes('protesta') && !lower.includes('caucion')) {
    alertas.push('⚠️ ALERTA ART. 170 RDFVF: Toda protesta de partido requiere constancia de consignación de la caución económica para ser admisible.');
  }
  if (lower.includes('alineacion') || lower.includes('usurpacion')) {
    alertas.push('⚖️ PRECEDENTE: La alineación indebida acarrea pérdida de puntos (marcador de 3-0) y sanción económica conforme al histórico disciplinario.');
  }
  if (lower.includes('arbitro') || lower.includes('honorarios')) {
    alertas.push('📌 DEUDA ARBITRAL: El incumplimiento de honorarios arbitrales activa apercibimiento y retención de derechos de competición.');
  }
  if (lower.includes('extemporaneo') || lower.includes('lapso')) {
    alertas.push('⏳ CADUCIDAD: Verificar que la impugnación fue consignada dentro del término perentorio de 48-72h tras el pitazo final.');
  }

  return alertas;
}

function extraerAcciones(paso: number): string[] {
  const pasoInfo = PASOS_PROCESO_DISCIPLINARIO.find((p) => p.paso === paso);
  return pasoInfo ? pasoInfo.accionesRecomendadas : ['Verificar expediente en el Tablero Kanban', 'Registrar providencia en movimientos'];
}

function construirRespuestaExpertaLocal(params: {
  mensaje: string;
  pasoSugerido: number;
  precedentes: PrecedenteJurisprudencial[];
  expedienteContexto?: ConsultaAgenteIA['expedienteContexto'];
}): RespuestaAgenteIA {
  const { mensaje, pasoSugerido, precedentes, expedienteContexto } = params;
  const msgLower = mensaje.toLowerCase();
  const infoPaso = PASOS_PROCESO_DISCIPLINARIO.find((p) => p.paso === pasoSugerido)!;

  let cuerpoAnalisis = '';
  const articulosCitados: string[] = [...infoPaso.articulosClave];
  const alertasProcesales: string[] = [];
  const proximasAcciones: string[] = [...infoPaso.accionesRecomendadas];

  // Caso A: Protestas por alineación indebida / usurpación
  if (msgLower.includes('alineacion') || msgLower.includes('alineación') || msgLower.includes('usurpacion') || msgLower.includes('usurpación')) {
    cuerpoAnalisis = `### 1. Diagnóstico de Alineación Indebida / Usurpación
- **Calificación**: Infracción tipificada en el Reglamento Disciplinario FVF (RDFVF) y Normas Reguladoras de Torneo.
- **Examen de Admisibilidad Preliminar**:
  * **Art. 169 RDFVF**: La protesta debe puntualizar con exactitud el jugador u oficial señalado y la disposición federativa violada.
  * **Art. 170 RDFVF**: Depósito de la caución en la cuenta FVF. Sin este requisito la protesta es **INADMISIBLE DE PLANO**.
  * **Cómputo de Plazos**: Debe interponerse dentro de las 48 horas siguientes a la culminación del encuentro.
- **Consecuencias Jurídicas si se declara Con Lugar**:
  * Adjudicación de los 3 puntos al equipo reclamante con marcador de tres goles por cero (3-0).
  * Multa económica tasada en Unidades Cambiarias FVF (UCFVF) contra el club infractor.
  * Apertura de averiguación contra el delegado o dirigente firmante de la planilla COMET por presunta falsedad o usurpación.`;
    articulosCitados.push('Art. 77.2 RDFVF', 'Art. 169 RDFVF', 'Art. 170 RDFVF');
    alertasProcesales.push('Exigir voucher de caución Art. 170 RDFVF antes de dictar Auto de Entrada.');
  }
  // Caso B: Falta de pago a árbitros u oficiales
  else if (msgLower.includes('pago') || msgLower.includes('arbitro') || msgLower.includes('árbitro') || msgLower.includes('honorarios')) {
    cuerpoAnalisis = `### 1. Régimen de Incumplimiento de Honorarios Arbitrales y Delegados
- **Naturaleza**: Infracción administrativa y disciplinaria de orden público deportivo.
- **Procedimiento del Consejo de Honor**:
  * Solicitud de certificación de deuda a la Comisión Nacional de Árbitros (CNA) o Tesorería de la FVF.
  * Emisión de Auto de Requerimiento de Pago otorgando un lapso perentorio (usualmente 48 a 72 horas).
  * Apercibimiento formal de suspensión de programación o pérdida de puntos si no se acredita el comprobante de cancelación oportuna.`;
    articulosCitados.push('Art. 41 RDFVF', 'Estatutos FVF', 'Código de Ética y Cumplimiento');
    alertasProcesales.push('Solicitar comprobante de liquidación bancaria ante la Dirección Financiera FVF.');
  }
  // Caso C: Conducta violenta, agresiones o hechos en tribuna
  else if (msgLower.includes('agresion') || msgLower.includes('agresión') || msgLower.includes('violencia') || msgLower.includes('roja') || msgLower.includes('pelea') || msgLower.includes('tribuna')) {
    cuerpoAnalisis = `### 1. Calificación de Conducta Violenta e Incidentes de Seguridad
- **Valor Probatorio del Acta Arbitral**: El informe del árbitro principal goza de presunción de certeza (*iuris tantum*). Toda prueba en contrario (video oficial, informe de seguridad) debe ser fehaciente.
- **Tipificación y Baremos**:
  * Conducta antideportiva o insultos a autoridades: Suspensión de 2 a 4 partidos + multa en UCFVF.
  * Intento de agresión o agresión consumada a oficiales de partido: Suspensión mínima de 6 meses a 1 año, con remisión a la Unidad de Integridad FVF.
  * Responsabilidad Objetiva del Club Local: Obligación de garantizar la fuerza pública y perímetro de camerinos (Normas de Licenciamiento e Infraestructura).`;
    articulosCitados.push('Art. 110 RDFVF', 'Art. 125 RDFVF', 'Código Disciplinario FIFA');
    alertasProcesales.push('Notificar de oficio a la Comisión Nacional de Árbitros (CNA) y a Licencia de Clubes.');
  }
  // Caso D: Recursos (Reconsideración / Apelación)
  else if (msgLower.includes('recurso') || msgLower.includes('reconsideracion') || msgLower.includes('reconsideración') || msgLower.includes('apelar')) {
    cuerpoAnalisis = `### 1. Procedimiento de Recursos ante Decisiones Sancionatorias
- **Recurso de Reconsideración (Art. 182 RDFVF)**:
  * Debe interponerse ante este mismo Consejo de Honor dentro del lapso de 3 días de despacho siguientes a la notificación formal.
  * No tiene efectos suspensivos respecto a la sanción deportiva a menos que el Consejo dicte expresamente una medida cautelar excepcional.
- **Segunda Instancia (Comisión de Apelaciones)**:
  * Procedente una vez agotada la reconsideración o conforme a los Estatutos FVF.`;
    articulosCitados.push('Art. 182 RDFVF', 'Art. 185 RDFVF');
    alertasProcesales.push('Verificar cómputo de 3 días continuos/hábiles desde la notificación por correo oficial COMET.');
  }
  // Caso General
  else {
    cuerpoAnalisis = `### 1. Análisis de la Consulta Disciplinaria
- Se ha analizado su requerimiento en el marco de la normativa vigente del Consejo de Honor FVF.
- **Orientación del Paso Actual (${infoPaso.titulo})**:
  ${infoPaso.descripcion}
- **Aspectos Legales Clave**:
  Para sustentar válidamente este trámite, el expediente debe contener:
  1. Identificación plena de las partes y legitimación procesal.
  2. Cumplimiento de los lapsos perentorios fijados por el calendario de competición.
  3. Soporte documental digitalizado en el expediente.`;
  }

  // Precedentes textuales
  let bloquePrecedentes = '';
  if (precedentes.length > 0) {
    bloquePrecedentes = `\n\n### 2. Precedentes Jurisprudenciales del Consejo de Honor en Base de Datos:\n` +
      precedentes
        .map(
          (p, i) =>
            `**${i + 1}. Exp. N° ${p.numero}/${p.anio}** (${p.estado})\n` +
            `- **Motivo**: ${p.motivo || 'Sin motivo registrado'}\n` +
            `- **Torneo / Partes**: ${p.ligaTorneo || 'General'} | ${p.equipos || 'N/A'}\n` +
            `- **Decisión Histórica**: ${p.numeroDecision || 'Auto emitido'} — *${p.sancionRaw || p.tramiteRaw || 'Resuelto conforme a derecho'}*` +
            (p.multaUc ? `\n- **Multa impuesta**: ${p.multaUc} UCFVF` : ''),
        )
        .join('\n\n');
  } else {
    bloquePrecedentes = `\n\n### 2. Precedentes Jurisprudenciales:\nNo se registraron antecedentes idénticos recientes; se sugiere aplicar la doctrina consolidada de casos análogos del archivo general.`;
  }

  const respuestaTexto = `## Guía Procesal Disciplinaria — Consejo de Honor FVF
**Etapa sugerida: Paso ${pasoSugerido} — ${infoPaso.titulo}**

${cuerpoAnalisis}
${bloquePrecedentes}

### 3. Recomendación Inmediata para el Analista / Juez Instructor:
- **Plazo reglamentario**: ${infoPaso.plazosLegales}
${proximasAcciones.map((a) => `- ${a}`).join('\n')}

${expedienteContexto ? `> 📁 *Consulta contextualizada para el Expediente ${expedienteContexto.numero || ''}/${expedienteContexto.anio || ''} — Torneo: ${expedienteContexto.torneo || 'General'}*` : ''}`;

  return {
    respuesta: respuestaTexto,
    pasoActualSugerido: pasoSugerido,
    articulosCitados,
    alertasProcesales,
    precedentesRelevantes: precedentes,
    proximasAcciones,
  };
}
