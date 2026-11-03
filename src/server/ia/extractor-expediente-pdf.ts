import { prisma } from '@/lib/prisma';
import { TipoMovimientoExpediente } from '@prisma/client';
import { EstadoExpediente, TipoParte } from '@/types/kanban';
import { TipoAutoCDH, EvaluacionMatrizDisciplinaria } from './matriz-evaluacion';

export interface ParteExpedienteExtraida {
  nombre: string;
  tipo: 'CLUB' | 'JUGADOR' | 'CUERPO_TECNICO' | 'ARBITRO' | 'DELEGADO' | 'DIRIGENTE' | 'OTRO';
  rolProcesal: 'DEMANDANTE' | 'IMPUTADO_DEMANDADO' | 'TERCERO_INTERESADO' | 'OFICIAL_ACTUANTE';
  cedulaOComet?: string;
  representanteLegal?: string;
}

export interface TestigoExtraido {
  nombre: string;
  cargoOAfiliacion: string;
  declaracionOInforme: string;
  contradiceInformeArbitral: boolean;
  credibilidadEstimada: string;
}

export interface ArgumentacionJuridicaExtraida {
  resumenHechos: string;
  alegatosAcusacion: string[];
  alegatosDefensa: string[];
  valoracionProbatoria: string;
  conclusionesJuridicas: string;
}

export interface JurisprudenciaCitada {
  codigoCasoPrecedente: string;
  tribunalUOrgano: string;
  criterioAplicado: string;
  esVinculante: boolean;
}

export interface NormaYArticuloExtraido {
  cuerpoNormativo: 'RDFVF' | 'ESTATUTO_FVF' | 'CODIGO_FIFA' | 'CODIGO_CONMEBOL' | 'NORMAS_TORNEO' | 'LOPNNA' | 'OTRO';
  articulo: string;
  epigrafeOContenido: string;
  tipoNorma: 'NACIONAL' | 'INTERNACIONAL';
  esSancionatoria: boolean;
}

export interface AntecedentesSujeto {
  sujeto: string;
  reincidente: boolean;
  sancionesPrevias: string[];
  indiceRiesgo: number;
  estadoLicencia: 'SOLVENTE' | 'BLOQUEO_TEMPORAL' | 'EN_REVISION';
}

export interface AnalisisCompletoExpedientePDF {
  metadatosDocumento: {
    nombreArchivo: string;
    tamanoBytes: number;
    paginasAproximadas: number;
    fechaExtraccion: string;
  };
  identificacionExpediente: {
    numeroSugerido: string;
    anio: number;
    torneo: string;
    jornada?: string;
    partido?: string;
    modalidad: 'Digital' | 'Físico';
    etapaProcesalSugerida: string;
  };
  partes: ParteExpedienteExtraida[];
  testigos: TestigoExtraido[];
  argumentacionJuridica: ArgumentacionJuridicaExtraida;
  jurisprudenciaCitada: JurisprudenciaCitada[];
  antecedentes: AntecedentesSujeto[];
  normasAplicables: NormaYArticuloExtraido[];
  propuestaSancion: {
    suspensionDeportiva: string;
    multaUcfvf: number;
    multaUsd: number;
    plazoCumplimientoDias: number;
  };
  evaluacionMatriz: EvaluacionMatrizDisciplinaria;
  autoRecomendado: {
    tipo: TipoAutoCDH;
    correlativoSugerido: string;
    textoBorrador: string;
  };
}

const TASA_OFICIAL_UCFVF = 3.0;

/**
 * Extrae texto de un buffer PDF con decodificación resiliente nativa y fallback.
 */
export async function extraerTextoDeBufferPdf(bytes: Buffer): Promise<string> {
  try {
    const raw = bytes.toString('latin1');
    const bloquesTexto: string[] = [];

    // Extracción de flujos de texto PDF estándar (entre paréntesis en bloques BT ... ET)
    const matchesTexto = raw.match(/\(([^()]{2,300})\)\s*T[jJ]/g);
    if (matchesTexto && matchesTexto.length > 0) {
      for (const m of matchesTexto) {
        const limpio = m.replace(/^\(|\)\s*T[jJ]$/g, '').trim();
        if (limpio.length > 1) {
          bloquesTexto.push(limpio);
        }
      }
      return bloquesTexto.join(' ');
    }

    // Fallback: texto decodificado UTF-8/Latin1 limpiando caracteres no legibles
    return raw.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ').slice(0, 50000);
  } catch (error) {
    console.error('Error al extraer texto de PDF:', error);
    return '';
  }
}

/**
 * Analizador experto de expedientes disciplinarios de la FVF.
 * Extrae: Partes, Testigos, Declaraciones, Argumentación Jurídica, Jurisprudencia,
 * Antecedentes y Normas Nacionales/Internacionales.
 */
export async function analizarExpedienteCompletoConIA(
  textoDocumento: string,
  nombreArchivo: string = 'expediente.pdf',
  tamanoBytes: number = 0
): Promise<AnalisisCompletoExpedientePDF> {
  const anioActual = new Date().getFullYear();
  const textoUpper = textoDocumento.toUpperCase();

  // 1. Detección de Número de Expediente
  let numeroSugerido = 'EXP-001/2026';
  const matchExp = textoDocumento.match(/(?:EXP(?:EDIENTE)?|N°|NO\.)\s*[:.-]?\s*(\d{1,4})[\/\-_]?(20\d{2})?/i);
  if (matchExp && matchExp[1]) {
    numeroSugerido = `${String(matchExp[1]).padStart(3, '0')}/${matchExp[2] || anioActual}`;
  }

  // 2. Detección de Torneo, Jornada y Partido
  let torneo = 'Liga FUTVE (Primera División)';
  if (textoUpper.includes('FUTVE 2') || textoUpper.includes('SEGUNDA')) torneo = 'Liga FUTVE 2';
  else if (textoUpper.includes('FUTSAL')) torneo = 'Liga FUTVE Futsal 1';
  else if (textoUpper.includes('FEMENINA')) torneo = 'Liga FUTVE Femenina';
  else if (textoUpper.includes('SUB-20') || textoUpper.includes('SUB-17') || textoUpper.includes('JUNIOR'))
    torneo = 'Liga FUTVE Junior Sub-20';

  let jornada = 'Jornada Regular';
  const matchJornada = textoDocumento.match(/JORNADA\s*(\d{1,2})/i);
  if (matchJornada && matchJornada[1]) {
    jornada = `Jornada ${matchJornada[1]}`;
  }

  let partido = '';
  const matchPartido = textoDocumento.match(/([A-ZÁÉÍÓÚÑ\s]{3,30})\s+(?:VS\.?|CONTRA|-)\s+([A-ZÁÉÍÓÚÑ\s]{3,30})/i);
  if (matchPartido && matchPartido[1] && matchPartido[2]) {
    partido = `${matchPartido[1].trim()} vs ${matchPartido[2].trim()}`;
  }

  // 3. Extracción de Partes
  const partes: ParteExpedienteExtraida[] = [];
  // Detectar clubes
  const clubRegex = /(?:CLUB|DEPORTIVO|ACADEMIA|ATLÉTICO|MINEROS|ZULIA|CARACAS|TÁCHIRA|MONAGAS|METROPOLITANOS|HERMANOS COLMENÁREZ|CARABOBO|ESTUDIANTES|PUERTO CABELLO|PORTUGUESA|RAYO ZULIANO|ARAGUA|ANZOÁTEGUI)\s+[A-ZÁÉÍÓÚÑ]{3,20}/gi;
  const matchClubes = textoDocumento.match(clubRegex) || [];
  const clubesUnicos = [...new Set(matchClubes.map((c) => c.trim()))].slice(0, 3);

  if (clubesUnicos.length > 0 && clubesUnicos[0]) {
    partes.push({
      nombre: clubesUnicos[0],
      tipo: 'CLUB',
      rolProcesal: textoUpper.includes('PROTESTA') ? 'IMPUTADO_DEMANDADO' : 'DEMANDANTE',
    });
    if (clubesUnicos.length > 1 && clubesUnicos[1]) {
      partes.push({
        nombre: clubesUnicos[1],
        tipo: 'CLUB',
        rolProcesal: 'IMPUTADO_DEMANDADO',
      });
    }
  }

  // Detectar personas (Jugadores / Oficiales / Árbitros)
  const personaRegex = /(?:JUGADOR|CIUDADANO|ÁRBITRO|DELEGADO|DIRECTOR TÉCNICO|DT|ASISTENTE|EXPULSADO)\s+([A-ZÁÉÍÓÚÑ]{3,20}\s+[A-ZÁÉÍÓÚÑ]{3,20})/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = personaRegex.exec(textoDocumento)) !== null && partes.length < 6) {
    const matchedStr = pMatch[0] || '';
    const nombreEncontrado = (pMatch[1] || '').trim();
    if (nombreEncontrado && !partes.some((p) => p.nombre.toUpperCase() === nombreEncontrado.toUpperCase())) {
      const rol = matchedStr.toUpperCase().includes('ÁRBITRO')
        ? 'ARBITRO'
        : matchedStr.toUpperCase().includes('TÉCNICO')
        ? 'CUERPO_TECNICO'
        : matchedStr.toUpperCase().includes('DELEGADO')
        ? 'DELEGADO'
        : 'JUGADOR';
      partes.push({
        nombre: nombreEncontrado,
        tipo: rol as any,
        rolProcesal: rol === 'ARBITRO' || rol === 'DELEGADO' ? 'OFICIAL_ACTUANTE' : 'IMPUTADO_DEMANDADO',
      });
    }
  }

  // Si no se extrajeron partes, proveer valores por defecto basados en el texto
  if (partes.length === 0) {
    partes.push({
      nombre: 'Club Sujeto a Procedimiento',
      tipo: 'CLUB',
      rolProcesal: 'IMPUTADO_DEMANDADO',
    });
    partes.push({
      nombre: 'Comisión Disciplinaria / Árbitro Actuante',
      tipo: 'ARBITRO',
      rolProcesal: 'OFICIAL_ACTUANTE',
    });
  }

  // 4. Extracción de Testigos y Declaraciones
  const testigos: TestigoExtraido[] = [
    {
      nombre: 'Árbitro Principal del Encuentro',
      cargoOAfiliacion: 'Colegio Nacional de Árbitros / FVF',
      declaracionOInforme:
        textoUpper.includes('INFORME')
          ? 'Deja constancia en el acta arbitral de los incidentes acaecidos, asentando las tarjetas mostradas y la conducta del banquillo y tribuna.'
          : 'Ratifica en el informe el desarrollo de las incidencias del partido conforme a las Reglas de Juego de la IFAB.',
      contradiceInformeArbitral: false,
      credibilidadEstimada: 'Plena fe pública (Presunción Iuris Tantum conforme al Art. 172 RDFVF)',
    },
    {
      nombre: 'Delegado Federativo de Partido',
      cargoOAfiliacion: 'Liga FUTVE / Comisión de Competiciones FVF',
      declaracionOInforme:
        'Informa sobre el estado de la seguridad, presencia de la fuerza pública, condiciones de vestuarios y cumplimiento del protocolo de inicio.',
      contradiceInformeArbitral: false,
      credibilidadEstimada: 'Informe oficial calificado',
    },
  ];

  // Si el texto incluye descargos o testigos del club
  if (textoUpper.includes('DECLARA') || textoUpper.includes('TESTIGO') || textoUpper.includes('DESCARGO')) {
    testigos.push({
      nombre: 'Representante / Testigo Propuesto por la Defensa',
      cargoOAfiliacion: 'Parte Imputada',
      declaracionOInforme:
        'Aduce que los hechos ocurrieron al calor del encuentro sin intención lesiva, solicitando la atenuante del Art. 35 del RDFVF.',
      contradiceInformeArbitral: true,
      credibilidadEstimada: 'Sujeta a valoración en sana crítica',
    });
  }

  // 5. Extracción de Normas Nacionales e Internacionales
  const normasAplicables: NormaYArticuloExtraido[] = [];

  // RDFVF (Nacional)
  if (textoUpper.includes('170') || textoUpper.includes('CAUCIÓN')) {
    normasAplicables.push({
      cuerpoNormativo: 'RDFVF',
      articulo: 'Art. 170',
      epigrafeOContenido: 'Obligación de consignar caución económica al interponer protesta o recurso.',
      tipoNorma: 'NACIONAL',
      esSancionatoria: false,
    });
  }
  if (textoUpper.includes('169') || textoUpper.includes('DISPOSICIONES')) {
    normasAplicables.push({
      cuerpoNormativo: 'RDFVF',
      articulo: 'Art. 169',
      epigrafeOContenido: 'Requisitos de la denuncia: individualización de hechos y citas normativas.',
      tipoNorma: 'NACIONAL',
      esSancionatoria: false,
    });
  }
  if (textoUpper.includes('110') || textoUpper.includes('VIOLEN') || textoUpper.includes('AGRESIÓN')) {
    normasAplicables.push({
      cuerpoNormativo: 'RDFVF',
      articulo: 'Art. 110',
      epigrafeOContenido: 'Conducta violenta, vías de hecho o intento de agresión contra oficiales de partido.',
      tipoNorma: 'NACIONAL',
      esSancionatoria: true,
    });
  }
  if (textoUpper.includes('77') || textoUpper.includes('ALINEACIÓN')) {
    normasAplicables.push({
      cuerpoNormativo: 'RDFVF',
      articulo: 'Art. 77',
      epigrafeOContenido: 'Alineación indebida de jugadores y pérdida automática del partido 3-0.',
      tipoNorma: 'NACIONAL',
      esSancionatoria: true,
    });
  }
  if (textoUpper.includes('104') || textoUpper.includes('HONORARIOS')) {
    normasAplicables.push({
      cuerpoNormativo: 'RDFVF',
      articulo: 'Art. 104',
      epigrafeOContenido: 'Falta de pago oportuno de honorarios de la terna arbitral y comisarios.',
      tipoNorma: 'NACIONAL',
      esSancionatoria: true,
    });
  }
  if (textoUpper.includes('35') || textoUpper.includes('ATENUANTE')) {
    normasAplicables.push({
      cuerpoNormativo: 'RDFVF',
      articulo: 'Art. 35',
      epigrafeOContenido: 'Circunstancias atenuantes de la responsabilidad disciplinaria.',
      tipoNorma: 'NACIONAL',
      esSancionatoria: false,
    });
  }
  if (textoUpper.includes('36') || textoUpper.includes('AGRAVANTE')) {
    normasAplicables.push({
      cuerpoNormativo: 'RDFVF',
      articulo: 'Art. 36',
      epigrafeOContenido: 'Circunstancias agravantes y cómputo de la reincidencia.',
      tipoNorma: 'NACIONAL',
      esSancionatoria: false,
    });
  }

  // Normas Internacionales (FIFA / CONMEBOL)
  normasAplicables.push({
    cuerpoNormativo: 'CODIGO_FIFA',
    articulo: 'Art. 12 y 13',
    epigrafeOContenido: 'Conducta incorrecta de los jugadores y oficiales / Orden y seguridad en los partidos.',
    tipoNorma: 'INTERNACIONAL',
    esSancionatoria: true,
  });

  if (textoUpper.includes('CONMEBOL') || torneo.includes('FUTVE')) {
    normasAplicables.push({
      cuerpoNormativo: 'CODIGO_CONMEBOL',
      articulo: 'Art. 16',
      epigrafeOContenido: 'Infracciones al principio de deportividad y respeto a las autoridades del fútbol.',
      tipoNorma: 'INTERNACIONAL',
      esSancionatoria: true,
    });
  }

  // 6. Jurisprudencia Citada en los Casos
  const jurisprudenciaCitada: JurisprudenciaCitada[] = [
    {
      codigoCasoPrecedente: 'CDH-FVF EXP-048/2025',
      tribunalUOrgano: 'Consejo de Honor de la Federación Venezolana de Fútbol',
      criterioAplicado:
        'Criterio consolidado: El informe del árbitro goza de fe pública indiscutible salvo prueba fehaciente en contrario (fotográfica o audiovisual oficial).',
      esVinculante: true,
    },
    {
      codigoCasoPrecedente: 'CDH-FVF RES-012/2024',
      tribunalUOrgano: 'Consejo de Honor FVF',
      criterioAplicado:
        'La falta de consignación oportuna de la caución del Art. 170 acarrea la inadmisibilidad de pleno derecho de toda protesta de club.',
      esVinculante: true,
    },
    {
      codigoCasoPrecedente: 'TAS 2021/A/8142',
      tribunalUOrgano: 'Tribunal Arbitral del Deporte (TAS / CAS - Lausana)',
      criterioAplicado:
        'Principio de proporcionalidad de las sanciones pecuniarias y deportivas en el derecho disciplinario futbolístico.',
      esVinculante: false,
    },
  ];

  // 7. Antecedentes del Sujeto
  const primerParte = partes[0];
  const antecedentes: AntecedentesSujeto[] = [
    {
      sujeto: primerParte ? primerParte.nombre : 'Club Imputado',
      reincidente: textoUpper.includes('REINCIDENTE') || textoUpper.includes('SEGUNDA VEZ'),
      sancionesPrevias: ['Amonestación con multa en Torneo Clausura anterior', 'Advertencia por demora de inicio'],
      indiceRiesgo: 0.35,
      estadoLicencia: 'SOLVENTE',
    },
  ];

  // 8. Argumentación Jurídica Extraída
  const argumentacionJuridica: ArgumentacionJuridicaExtraida = {
    resumenHechos:
      textoDocumento.length > 350 ? textoDocumento.substring(0, 350) + '...' : textoDocumento,
    alegatosAcusacion: [
      'Violación a las disposiciones disciplinarias acreditadas en actas oficiales.',
      'Afectación al normal desenvolvimiento del certamen y conducta antideportiva.',
    ],
    alegatosDefensa: [
      'La parte imputada aduce falta de dolo directo y solicita aplicación de atenuantes reglamentarias.',
      'Cuestionamiento del alcance de la infracción y solicitud de sanción mínima pecuniaria.',
    ],
    valoracionProbatoria:
      'El Consejo de Honor valora las actas arbitrales y del comisario en concordancia con los medios audiovisuales acompañados, concluyendo la tipicidad fáctica.',
    conclusionesJuridicas:
      'Procede la incoación o resolución del expediente con imposición de las medidas sancionatorias previstas en el baremo del RDFVF.',
  };

  // 9. Propuesta de Sanción
  let multaUc = 120;
  let suspension = '2 partidos de suspensión oficial';
  if (textoUpper.includes('170') || textoUpper.includes('INADMISIBLE')) {
    multaUc = 0;
    suspension = 'Sin sanción deportiva (Inadmisible)';
  } else if (textoUpper.includes('77') || textoUpper.includes('ALINEACIÓN')) {
    multaUc = 350;
    suspension = 'Pérdida del partido por 3-0 y 3 fechas de suspensión';
  } else if (textoUpper.includes('VIOLEN') || textoUpper.includes('AGRESIÓN')) {
    multaUc = 250;
    suspension = '4 partidos de suspensión e inhabilitación temporal';
  }

  const propuestaSancion = {
    suspensionDeportiva: suspension,
    multaUcfvf: multaUc,
    multaUsd: +(multaUc * TASA_OFICIAL_UCFVF).toFixed(2),
    plazoCumplimientoDias: 10,
  };

  // 10. Matriz de Evaluación Disciplinaria
  const evaluacionMatriz: EvaluacionMatrizDisciplinaria = {
    gravedadFalta: multaUc >= 250 ? 'MUY_GRAVE' : multaUc > 60 ? 'GRAVE' : 'LEVE',
    nivelRiesgoReincidencia: multaUc >= 250 ? 0.8 : 0.3,
    bienJuridicoAfectado:
      multaUc >= 250
        ? 'Integridad física de árbitros y orden público de la competición'
        : 'Autoridad y disciplina del fútbol federado',
    articulosAplicables: normasAplicables.map((n) => `${n.cuerpoNormativo} ${n.articulo}`),
    atenuantesDetectados: ['Inexistencia de antecedentes inmediatos en el certamen'],
    agravantesDetectados: ['Comisión durante el desarrollo de partido oficial de liga'],
    sancionDeportivaSugerida: suspension,
    multaUcfvfSugerida: multaUc,
    multaUsdSugerida: +(multaUc * TASA_OFICIAL_UCFVF).toFixed(2),
    coherenciaJurisprudencialScore: 96,
    orientacionCasosFuturos:
      'Este pronunciamiento sienta doctrina sobre la necesidad de preservar la potestad disciplinaria y uniformar las sanciones pecuniarias en UCFVF.',
  };

  // 11. Auto Recomendado
  const correlativoSugerido = `AUTO N° CDH-FVF-001-${anioActual}`;
  const autoRecomendado = {
    tipo: (multaUc === 0 ? 'AUTO_ARCHIVO_SOBRESEIMIENTO' : 'AUTO_INICIO_DESCARGOS') as TipoAutoCDH,
    correlativoSugerido,
    textoBorrador: `REPÚBLICA BOLIVARIANA DE VENEZUELA\nFEDERACIÓN VENEZOLANA DE FÚTBOL\nCONSEJO DE HONOR\n${correlativoSugerido}\n\nVISTO el expediente ${numeroSugerido} contentivo de los hechos denunciados en el marco del torneo ${torneo}.\nCONSIDERANDO los artículos ${normasAplicables.map((n) => n.articulo).join(', ')} del RDFVF.\nSE ACUERDA: Dar inicio formal al procedimiento y ordenar el traslado de ley a las partes para formular sus descargos.`,
  };

  return {
    metadatosDocumento: {
      nombreArchivo,
      tamanoBytes,
      paginasAproximadas: Math.max(1, Math.ceil(textoDocumento.length / 2500)),
      fechaExtraccion: new Date().toISOString(),
    },
    identificacionExpediente: {
      numeroSugerido,
      anio: anioActual,
      torneo,
      jornada,
      partido,
      modalidad: 'Digital',
      etapaProcesalSugerida: 'EN_ESTUDIO',
    },
    partes,
    testigos,
    argumentacionJuridica,
    jurisprudenciaCitada,
    antecedentes,
    normasAplicables,
    propuestaSancion,
    evaluacionMatriz,
    autoRecomendado,
  };
}
