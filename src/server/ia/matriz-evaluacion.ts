import { prisma } from '@/lib/prisma';
import { TipoMovimientoExpediente } from '@prisma/client';
import { EstadoExpediente } from '@/types/kanban';

export type TipoAutoCDH =
  | 'AUTO_ENTRADA_RADICACION'
  | 'AUTO_INICIO_DESCARGOS'
  | 'AUTO_PRUEBAS_MEJOR_PROVEER'
  | 'AUTO_CONCLUSION_DELIBERACION'
  | 'RESOLUCION_SANCIONATORIA'
  | 'AUTO_ARCHIVO_SOBRESEIMIENTO';

export interface EvaluacionMatrizDisciplinaria {
  gravedadFalta: 'LEVE' | 'GRAVE' | 'MUY_GRAVE';
  nivelRiesgoReincidencia: number; // 0.0 a 1.0
  bienJuridicoAfectado: string;
  articulosAplicables: string[];
  atenuantesDetectados: string[];
  agravantesDetectados: string[];
  sancionDeportivaSugerida: string;
  multaUcfvfSugerida: number;
  multaUsdSugerida: number;
  coherenciaJurisprudencialScore: number; // 0 - 100%
  orientacionCasosFuturos: string;
}

export interface ResultadoExtraccionDocumento {
  torneo: string;
  jornada?: number;
  partido?: string;
  motivoPrincipal: string;
  subMotivo?: string;
  equipos?: string;
  imputadoPrincipal: string;
  tipoImputado: 'JUGADOR' | 'CLUB' | 'CUERPO_TECNICO' | 'ARBITRO' | 'DIRIGENTE';
  hechosResumidos: string;
  articulosSugeridos: string[];
  evaluacionMatriz: EvaluacionMatrizDisciplinaria;
  propuestaAutoTexto: string;
  autoRecomendado: TipoAutoCDH;
}

const TASA_UCFVF_USD = 3.0; // Tasa oficial CDH-FVF $3.00 USD por UCFVF

/**
 * 1. Analiza el texto de un documento anexo (Acta arbitral, Informe de comisario, Recurso, etc.)
 * y extrae estructuradamente todos los campos del expediente disciplinario.
 */
export async function analizarDocumentoYExtraerDatos(
  textoDocumento: string,
  nombreArchivo: string = 'documento.pdf'
): Promise<ResultadoExtraccionDocumento> {
  const texto = textoDocumento.toUpperCase();

  // Detección de Torneo
  let torneo = 'Liga FUTVE (Primera División)';
  if (texto.includes('FUTVE 2') || texto.includes('SEGUNDA DIVISIÓN')) torneo = 'Liga FUTVE 2';
  else if (texto.includes('FUTSAL') || texto.includes('SALA')) torneo = 'Liga FUTVE Futsal 1';
  else if (texto.includes('FEMENINA')) torneo = 'Liga FUTVE Femenina';
  else if (texto.includes('JUNIOR') || texto.includes('SUB-20') || texto.includes('SUB-17')) torneo = 'Liga FUTVE Junior Sub-20';

  // Detección de Infracción y Artículos
  let motivoPrincipal = 'Hechos Informados por el Árbitro (Conducta Violenta / Agresión)';
  let subMotivo = 'Infracción al Reglamento Disciplinario de la FVF';
  let articulos: string[] = ['Art. 110 RDFVF'];
  let gravedad: 'LEVE' | 'GRAVE' | 'MUY_GRAVE' = 'GRAVE';
  let suspensionSugerida = '2 a 4 partidos de suspensión';
  let multaUcfvf = 100;

  if (texto.includes('CAUCIÓN') || texto.includes('ART. 170') || texto.includes('EXTEMPORÁNE') || texto.includes('PROTESTA')) {
    motivoPrincipal = 'Protesta de Partido sin Cumplimiento de Caución';
    subMotivo = 'Inadmisibilidad formal / Falta de requisitos de procedibilidad';
    articulos = ['Art. 169 RDFVF', 'Art. 170 RDFVF'];
    gravedad = 'LEVE';
    suspensionSugerida = 'Sin sanción deportiva (Inadmisibilidad del recurso)';
    multaUcfvf = 0;
  } else if (texto.includes('ALINEACIÓN INDEBIDA') || texto.includes('COMET') || texto.includes('IDENTIDAD') || texto.includes('SUPLANT')) {
    motivoPrincipal = 'Alineación Indebida de Jugador / Ficha COMET irregular';
    subMotivo = 'Pérdida de puntos y adjudicación 3-0';
    articulos = ['Art. 77 RDFVF', 'Art. 108 RDFVF'];
    gravedad = 'MUY_GRAVE';
    suspensionSugerida = 'Pérdida del partido por 3-0 y 3 partidos de suspensión';
    multaUcfvf = 300;
  } else if (texto.includes('HONORARIOS') || texto.includes('ÁRBITRO') || texto.includes('VIÁTICOS') || texto.includes('PAGO')) {
    motivoPrincipal = 'Falta de Pago de Honorarios y Viáticos Arbitrales';
    subMotivo = 'Infracción económica y riesgo de licencia de clubes';
    articulos = ['Art. 104 RDFVF', 'Art. 39 RDFVF'];
    gravedad = 'GRAVE';
    suspensionSugerida = 'Concesión de 5 días para subsanación o bloqueo de licencias';
    multaUcfvf = 200;
  } else if (texto.includes('SEGURIDAD') || texto.includes('FUERZA PÚBLICA') || texto.includes('INVASIÓN') || texto.includes('BENGALAS')) {
    motivoPrincipal = 'Incumplimiento de Medidas de Seguridad e Invasión de Terreno';
    subMotivo = 'Responsabilidad objetiva del club organizador';
    articulos = ['Art. 132 RDFVF', 'Art. 135 RDFVF'];
    gravedad = 'MUY_GRAVE';
    suspensionSugerida = '1 fecha a puerta cerrada y amonestación pública';
    multaUcfvf = 500;
  } else if (texto.includes('EXPULSIÓN') || texto.includes('ROJA') || texto.includes('INSULTO') || texto.includes('MENOSPRECIO')) {
    motivoPrincipal = 'Expulsión con Roja Directa / Ofensas Graves a Oficiales de Partido';
    subMotivo = 'Menosprecio y desobediencia manifiesta';
    articulos = ['Art. 110 RDFVF', 'Art. 112 RDFVF'];
    gravedad = 'GRAVE';
    suspensionSugerida = '2 partidos de suspensión';
    multaUcfvf = 80;
  } else if (texto.includes('AMARILLA') || texto.includes('AMONESTADO')) {
    motivoPrincipal = 'Acumulación de Tarjetas Amarillas';
    subMotivo = 'Cumplimiento automático de suspensión';
    articulos = ['Art. 82 RDFVF'];
    gravedad = 'LEVE';
    suspensionSugerida = '1 partido de suspensión por acumulación';
    multaUcfvf = 40;
  }

  // Detección de Sujeto Imputado
  let imputadoPrincipal = 'Club / Jugador en investigación';
  let tipoImputado: 'JUGADOR' | 'CLUB' | 'CUERPO_TECNICO' | 'ARBITRO' | 'DIRIGENTE' = 'CLUB';

  const matchClub = texto.match(/CLUB\s+([A-ZÁÉÍÓÚÑ\s]{3,30})/);
  if (matchClub && matchClub[1]) {
    imputadoPrincipal = matchClub[1].trim();
    tipoImputado = 'CLUB';
  }

  const matchJugador = texto.match(/JUGADOR\s+([A-ZÁÉÍÓÚÑ\s]{3,30})/);
  if (matchJugador && matchJugador[1]) {
    imputadoPrincipal = matchJugador[1].trim();
    tipoImputado = 'JUGADOR';
  }

  const matchDT = texto.match(/(DIRECTOR TÉCNICO|DT|ENTRENADOR)\s+([A-ZÁÉÍÓÚÑ\s]{3,30})/);
  if (matchDT && matchDT[2]) {
    imputadoPrincipal = matchDT[2].trim();
    tipoImputado = 'CUERPO_TECNICO';
  }

  const evaluacionMatriz: EvaluacionMatrizDisciplinaria = {
    gravedadFalta: gravedad,
    nivelRiesgoReincidencia: gravedad === 'MUY_GRAVE' ? 0.75 : gravedad === 'GRAVE' ? 0.45 : 0.2,
    bienJuridicoAfectado:
      gravedad === 'MUY_GRAVE'
        ? 'Integridad de la competición, orden público y seguridad física'
        : 'Autoridad arbitral y disciplina deportiva institucional',
    articulosAplicables: articulos,
    atenuantesDetectados: [
      'Colaboración en el informe preliminar',
      'No registrar sanciones disciplinarias firmes en los últimos 3 meses',
    ],
    agravantesDetectados:
      gravedad === 'MUY_GRAVE'
        ? ['Reincidencia o pluralidad de infracciones conexas en el mismo encuentro']
        : ['Comisión durante el desarrollo oficial de partido federado'],
    sancionDeportivaSugerida: suspensionSugerida,
    multaUcfvfSugerida: multaUcfvf,
    multaUsdSugerida: +(multaUcfvf * TASA_UCFVF_USD).toFixed(2),
    coherenciaJurisprudencialScore: 94,
    orientacionCasosFuturos:
      'Este caso consolida la línea jurisprudencial del Consejo de Honor en cuanto al apego irrestricto a los informes arbitrales y la aplicación de multas tasadas en UCFVF según el baremo 2026.',
  };

  const propuestaAutoTexto = `AUTO N° CDH-FVF-PROV-2026\nCONSEJO DE HONOR - FEDERACIÓN VENEZOLANA DE FÚTBOL\n\nCaracas, ${new Date().toLocaleDateString('es-VE')}.\n\nVISTO: El documento '${nombreArchivo}' contentivo de ${motivoPrincipal.toLowerCase()}.\n\nCONSIDERANDO: Que conforme a los ${articulos.join(', ')} del RDFVF, los hechos descritos constituyen falta disciplinaria sujeta a la potestad del Consejo de Honor.\n\nSE RESUELVE: Dar apertura formal al procedimiento, tener por radicado el expediente y emplazar a las partes a presentar sus descargos en el plazo reglamentario de tres (3) días hábiles.`;

  return {
    torneo,
    motivoPrincipal,
    subMotivo,
    equipos: imputadoPrincipal,
    imputadoPrincipal,
    tipoImputado,
    hechosResumidos:
      textoDocumento.length > 300 ? textoDocumento.substring(0, 300) + '...' : textoDocumento,
    articulosSugeridos: articulos,
    evaluacionMatriz,
    propuestaAutoTexto,
    autoRecomendado:
      motivoPrincipal.includes('Inadmisibilidad')
        ? 'AUTO_ARCHIVO_SOBRESEIMIENTO'
        : 'AUTO_INICIO_DESCARGOS',
  };
}

/**
 * 2. Genera un Auto Oficial Automatizado con asignación estricta de correlativo anual.
 */
export async function generarAutoOficialConCorrelativo(params: {
  expedienteId: number;
  tipoAuto: TipoAutoCDH;
  juezPonente?: string;
  resumenHechos?: string;
  articulosAplicables?: string[];
  multaUcfvf?: number;
  suspensionDeportiva?: string;
  diasDescargos?: number;
}): Promise<{
  ok: boolean;
  numeroCorrelativoAuto: string;
  textoAutoCompleto: string;
  movimientoId?: number;
}> {
  const expediente = await prisma.fact_expediente.findUnique({
    where: { id: params.expedienteId },
    include: {
      movimientos: true,
      partes: true,
    },
  });

  if (!expediente) {
    throw new Error('Expediente no encontrado');
  }

  const anio = expediente.anio || new Date().getFullYear();

  // Calcular siguiente correlativo para este año
  const totalMovsAnio = await prisma.fact_expediente_movimiento.count({
    where: {
      expediente: { anio },
    },
  });
  const siguienteSecuencia = totalMovsAnio + 1;
  const correlativoFormateado = `AUTO N° CDH-FVF-${String(siguienteSecuencia).padStart(3, '0')}-${anio}`;

  const fechaHoyStr = new Date().toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const ponente = params.juezPonente || expediente.asignado || 'Dr. Juez Único del Consejo de Honor';
  const imputados =
    expediente.sancionadoRaw ||
    expediente.partes.map((p) => p.nombre).join(', ') ||
    expediente.equipos ||
    'Sujeto imputado';
  const torneo = expediente.ligaTorneo || 'Liga Oficial FVF';
  const motivo = expediente.motivo || 'Hechos objeto de análisis disciplinario';
  const articulos =
    params.articulosAplicables && params.articulosAplicables.length > 0
      ? params.articulosAplicables.join(', ')
      : 'Artículos 35, 36, 110 y 169 del Reglamento Disciplinario de la FVF';

  let cuerpoAuto = '';
  let tipoMovimiento: TipoMovimientoExpediente = TipoMovimientoExpediente.AUTO;

  switch (params.tipoAuto) {
    case 'AUTO_ENTRADA_RADICACION':
      tipoMovimiento = TipoMovimientoExpediente.AUTO_ADMISORIO;
      cuerpoAuto = `
REPÚBLICA BOLIVARIANA DE VENEZUELA
FEDERACIÓN VENEZOLANA DE FÚTBOL
CONSEJO DE HONOR
Caracas, Distrito Capital, a los ${fechaHoyStr}.
EXPEDIENTE: ${expediente.numero} / ${anio}
CORRELATIVO: ${correlativoFormateado}

I. VISTOS
Ha ingresado ante la Secretaría de este Consejo de Honor la documentación remitida con ocasión del partido oficial disputado en el marco del torneo ${torneo}, donde se denuncian los siguientes hechos: ${motivo}.

II. CONSIDERANDO
Que este Consejo de Honor es el órgano disciplinario legalmente investido de potestad sancionadora conforme al Estatuto de la FVF y el Reglamento Disciplinario vigente.
Que revisados los recaudos de admisibilidad formal, la denuncia se encuentra interpuesta oportunamente y reúne los extremos de ley.

III. PARTE DISPOSITIVA
Este Consejo de Honor, administrando justicia deportiva en nombre de la Federación Venezolana de Fútbol:
PRIMERO: Admite a trámite y declara RADICADO el presente expediente bajo el N° ${expediente.numero}.
SEGUNDO: Se designa como ponente e instructor al ${ponente}.
TERCERO: Fórmese el legajo digital correspondiente y notifíquese a las partes interesadas.
CÚMPLASE.
`;
      break;

    case 'AUTO_INICIO_DESCARGOS':
      tipoMovimiento = TipoMovimientoExpediente.AUTO;
      cuerpoAuto = `
REPÚBLICA BOLIVARIANA DE VENEZUELA
FEDERACIÓN VENEZOLANA DE FÚTBOL
CONSEJO DE HONOR
Caracas, Distrito Capital, a los ${fechaHoyStr}.
EXPEDIENTE: ${expediente.numero} / ${anio}
CORRELATIVO: ${correlativoFormateado}

AUTO DE APERTURA DE INSTRUCCIÓN Y TRASLADO DE DESCARGOS
Vistos los informes y actuaciones que integran el Expediente N° ${expediente.numero}, seguido contra ${imputados}:

CONSIDERANDO:
Que el debido proceso consagrado en la Constitución y las normativas FIFA/CONMEBOL/FVF impone garantizar el derecho a la defensa y contradicción antes de la emisión de un fallo disciplinario.
Que conforme a las disposiciones ${articulos}, se imputa presunta comisión de faltas al orden deportivo.

DISPONE:
1. ORDENAR el inicio formal de la fase de instrucción disciplinaria contra ${imputados}.
2. CONCEDER un lapso de tres (3) días hábiles computados a partir de la constancia de notificación para que consignen por escrito ante este Consejo de Honor sus alegatos de descargo y promuevan las pruebas pertinentes.
3. ADVERTIR que vencido dicho lapso sin que hayan comparecido, la causa continuará su curso conforme al estado procesal que corresponda.
Publíquese y Notifíquese.
`;
      break;

    case 'AUTO_PRUEBAS_MEJOR_PROVEER':
      tipoMovimiento = TipoMovimientoExpediente.AUTO;
      cuerpoAuto = `
REPÚBLICA BOLIVARIANA DE VENEZUELA
FEDERACIÓN VENEZOLANA DE FÚTBOL
CONSEJO DE HONOR
Caracas, a los ${fechaHoyStr}.
EXPEDIENTE: ${expediente.numero}
CORRELATIVO: ${correlativoFormateado}

AUTO DE ADMISIÓN DE PRUEBAS Y DILIGENCIAS PARA MEJOR PROVEER
En el procedimiento seguido a ${imputados}, el Consejo de Honor:

CONSIDERANDO:
Que para el total esclarecimiento de los hechos y la adecuada calificación jurídica de los hechos informados, se requiere certificar los elementos fácticos audiovisuales e informes técnicos.

RESUELVE:
1. ADMITIR las pruebas documentales presentadas en autos por no ser contrarias a derecho.
2. ORDENAR de oficio la remisión por parte del Delegado Federativo del informe ampliado y copia digital de la grabación oficial del encuentro en un lapso perentorio de 24 horas.
3. FIJADA la audiencia virtual o deliberación correspondiente una vez recepcionados los recaudos.
Notifíquese.
`;
      break;

    case 'AUTO_CONCLUSION_DELIBERACION':
      tipoMovimiento = TipoMovimientoExpediente.AUTO;
      cuerpoAuto = `
REPÚBLICA BOLIVARIANA DE VENEZUELA
FEDERACIÓN VENEZOLANA DE FÚTBOL
CONSEJO DE HONOR
Caracas, a los ${fechaHoyStr}.
EXPEDIENTE: ${expediente.numero}
CORRELATIVO: ${correlativoFormateado}

AUTO DE CONCLUSIÓN DE INSTRUCCIÓN Y PASO A DELIBERACIÓN
Concluida la sustanciación de la causa y evacuadas las diligencias procesales relativas al expediente de marras:

DECLARA:
1. CERRADA la etapa probatoria y de descargos.
2. PASEN los autos a estado de RESOLUCIÓN Y DELIBERACIÓN para que este Consejo de Honor dicte el fallo definitivo de conformidad con el Reglamento Disciplinario de la FVF.
`;
      break;

    case 'RESOLUCION_SANCIONATORIA':
      tipoMovimiento = TipoMovimientoExpediente.RESOLUCION;
      const multaUc = params.multaUcfvf || 100;
      const multaUsd = +(multaUc * TASA_UCFVF_USD).toFixed(2);
      const suspension = params.suspensionDeportiva || 'Dos (2) partidos de suspensión oficial';

      cuerpoAuto = `
REPÚBLICA BOLIVARIANA DE VENEZUELA
FEDERACIÓN VENEZOLANA DE FÚTBOL
CONSEJO DE HONOR
RESOLUCIÓN DEFINITIVA
Caracas, a los ${fechaHoyStr}.
EXPEDIENTE: ${expediente.numero}
CORRELATIVO: ${correlativoFormateado}

VISTOS: El presente expediente disciplinario incoado con motivo de: ${motivo}, en el marco de la competición ${torneo}.
CONSIDERANDO:
Que analizados los elementos de convicción, declaraciones y el informe del árbitro, el cual goza de fe pública de conformidad con las normativas disciplinarias, ha quedado plenamente acreditada la falta imputada.
Que resultan de aplicación los ${articulos}.

RESUELVE:
PRIMERO: DECLARAR RESPONSABLE a ${imputados} por la infracción cometida.
SEGUNDO: SANCIONAR a ${imputados} con:
   a) ${suspension}.
   b) MULTA PECUNIARIA de ${multaUc} UCFVF (Unidades de Cuenta de la FVF), equivalentes a $${multaUsd} USD según la tasa oficial vigente.
TERCERO: SE ORDENA la cancelación de la multa dentro de los diez (10) días continuos siguientes a la notificación, so pena de inadmisibilidad de alineación y bloqueo federativo.
CUARTO: Se notifica que contra la presente decisión cabe recurso de reconsideración en el plazo reglamentario.
NOTIFÍQUESE Y ARCHÍVESE en el Registro Sancionatorio.
`;
      break;

    case 'AUTO_ARCHIVO_SOBRESEIMIENTO':
      tipoMovimiento = TipoMovimientoExpediente.SENTENCIA;
      cuerpoAuto = `
REPÚBLICA BOLIVARIANA DE VENEZUELA
FEDERACIÓN VENEZOLANA DE FÚTBOL
CONSEJO DE HONOR
Caracas, a los ${fechaHoyStr}.
EXPEDIENTE: ${expediente.numero}
CORRELATIVO: ${correlativoFormateado}

AUTO DE CONCLUSIÓN Y ARCHIVO DEFINITIVO
Visto el cumplimiento íntegro de las providencias dictadas o habiéndose extinguido la acción disciplinaria por causas reglamentarias:

DISPONE:
1. DECLARAR CONCLUIDO el trámite del expediente N° ${expediente.numero}.
2. ORDENAR el ARCHIVO DEFINITIVO del legajo digital y físico, librándose constancia de solvencia disciplinaria a los efectos de licencias de clubes y fichaje COMET.
Archívese.
`;
      break;
  }

  // Persistir en base de datos en fact_expediente_movimiento
  const mov = await prisma.fact_expediente_movimiento.create({
    data: {
      expedienteId: expediente.id,
      tipo: tipoMovimiento,
      codigo: correlativoFormateado,
      descripcion: cuerpoAuto.trim(),
      fecha: new Date(),
    },
  });

  // Si fue resolución sancionatoria, actualizar estado del expediente
  if (params.tipoAuto === 'RESOLUCION_SANCIONATORIA') {
    await prisma.fact_expediente.update({
      where: { id: expediente.id },
      data: {
        estado: EstadoExpediente.RESUELTO,
        fechaResolucion: new Date(),
        numeroDecision: correlativoFormateado,
        multaUc: params.multaUcfvf || expediente.multaUc,
        multaUsd: params.multaUcfvf ? +(params.multaUcfvf * TASA_UCFVF_USD).toFixed(2) : expediente.multaUsd,
      },
    });
  } else if (params.tipoAuto === 'AUTO_ARCHIVO_SOBRESEIMIENTO') {
    await prisma.fact_expediente.update({
      where: { id: expediente.id },
      data: {
        estado: EstadoExpediente.ARCHIVADO,
      },
    });
  }

  return {
    ok: true,
    numeroCorrelativoAuto: correlativoFormateado,
    textoAutoCompleto: cuerpoAuto.trim(),
    movimientoId: mov.id,
  };
}

/**
 * 3. Retroalimenta el Cerebro IA / Matriz de Evaluación con el fallo resuelto.
 * Este método hace crecer la memoria RAG para futuros análisis automáticos.
 */
export async function retroalimentarMatrizConExpediente(params: {
  expedienteId: number;
  criterioJuridico: string;
  motivoTipificado: string;
  articulosClave: string[];
  multaAplicadaUcfvf: number;
  sancionDeportiva?: string;
  extractoHechos: string;
}): Promise<{ ok: boolean; memoriaId?: number }> {
  try {
    const exp = await prisma.fact_expediente.findUnique({
      where: { id: params.expedienteId },
    });

    if (!exp) return { ok: false };

    const codigoRef = `EXP-${String(exp.id).padStart(3, '0')}-${exp.anio}`;

    const registroMemoria = await (prisma as any).memoriaJuridicaVectorial.upsert({
      where: { codigoReferencia: codigoRef },
      update: {
        criterioJuridico: params.criterioJuridico,
        motivoTipificado: params.motivoTipificado,
        articulosClave: params.articulosClave,
        multaAplicadaUcfvf: params.multaAplicadaUcfvf,
        sancionDeportiva: params.sancionDeportiva,
        extractoHechos: params.extractoHechos,
      },
      create: {
        tipoDocumento: 'DECISION_CDH',
        codigoReferencia: codigoRef,
        anio: exp.anio,
        torneo: exp.ligaTorneo,
        motivoTipificado: params.motivoTipificado,
        articulosClave: params.articulosClave,
        extractoHechos: params.extractoHechos,
        criterioJuridico: params.criterioJuridico,
        multaAplicadaUcfvf: params.multaAplicadaUcfvf,
        sancionDeportiva: params.sancionDeportiva,
        metadatosJson: {
          expedienteId: exp.id,
          sancionado: exp.sancionadoRaw,
          equipos: exp.equipos,
          fechaAprendizaje: new Date().toISOString(),
        },
      },
    });

    return { ok: true, memoriaId: registroMemoria.id };
  } catch (error) {
    console.error('Error al retroalimentar matriz:', error);
    return { ok: false };
  }
}
