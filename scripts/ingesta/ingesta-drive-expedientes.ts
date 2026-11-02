/**
 * Motor de Ingesta Multimodal desde Google Drive + Sembrador de Expedientes Reales y Reglamentos
 * Consejo de Honor de la Federación Venezolana de Fútbol (CDH-FVF)
 *
 * Ejecutar con: npx tsx scripts/ingesta/ingesta-drive-expedientes.ts
 */
import { config } from 'dotenv';
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';

config();

const prisma = new PrismaClient();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * 1. Siembra los 5 Playbooks Procedimentales Oficiales del Consejo de Honor FVF
 */
async function sembrarPlaybooksProcedimentales() {
  const playbooks = [
    {
      codigoTipologia: 'EJECUCION_CRD',
      nombreProcedimiento: 'Ejecución de Decisiones de la Cámara de Resolución de Disputas (CRD-FVF)',
      articulosBase: ['Art. 21 CDF FIFA', 'Art. 112 RD-FVF', 'Art. 6 RD-FVF', 'Art. 59 CDF FIFA', 'Art. 24 RETJ'],
      documentosRequeridos: [
        'Solicitud formal de aplicación de consecuencias tras vencer 45 días de la notificación CRD',
        'Decisión firme de la CRD-FVF (Verificar coincidencia exacta de nombres acreedor/deudor)',
        'Planilla de Registro de Cuenta Bancaria CRD-FVF firmada',
        'Carta Poder acreditando representación legal (ej. Inpreabogado)',
      ],
      lapsoDescargosDias: 5,
      tipoDiasDescargos: 'HABILES',
      lapsoCumplimientoDias: 30,
      requiereAudiencia: false,
      unidadesNotificarInicio: ['DIRECCION_COMPETICIONES', 'GERENCIA_REGISTROS_COMET', 'SECRETARIA_GENERAL'],
      unidadesNotificarDecision: ['DIRECCION_COMPETICIONES', 'GERENCIA_REGISTROS_COMET', 'SECRETARIA_GENERAL', 'CRD_FVF'],
      pasosJson: [
        '1. Filtro de Certidumbre Documental: Si la sentencia adjunta pertenece a otro ciudadano (ej. caso Exp. 002/26), emitir correo de subsanación antes de dar entrada.',
        '2. Emitir Referencia de Inicio de Procedimiento otorgando 5 días hábiles al club deudor para descargos.',
        '3. Recibir acuse de Gerencia de Registros sobre estatus de prohibiciones previas del club.',
        '4. Vencido el lapso sin pago, dictar Decisión otorgando plazo final de 30 días continuos y decretando prohibición automática de registro de nuevos jugadores al vencimiento.',
        '5. Recibida la notificación de cumplimiento del acreedor, emitir Referencia de Clausura conforme al Art. 6 RD-FVF y Art. 59 CDF.',
      ],
    },
    {
      codigoTipologia: 'INTEGRIDAD_AMANO',
      nombreProcedimiento: 'Procedimiento por Manipulación de Partidos u Omisión del Deber de Denuncia',
      articulosBase: [
        'Art. 20.3 CDF FIFA',
        'Art. 11.1 CDF FIFA',
        'Art. 12 y 34 CDF FIFA',
        'Art. 9, 10, 109, 178 y 204 RD-FVF',
        'Arts. 22, 23, 24 y 33 Código de Ética FVF (Ed. 2021 y Ed. 2026 - Lex Mitior)',
        'Laudo TAS 2021/A/8364 (Trovato c. FIFA) - Estándar de Satisfacción Cómoda',
      ],
      documentosRequeridos: [
        'Informe Final de Investigación de la Gerencia de Integridad y Cumplimiento',
        'Denuncia inicial y capturas de pantalla / audios con cadena de custodia',
        'Actas y grabaciones de entrevistas preliminares (imputado y testigos)',
        'Informe de Partido COMET, Informe de Asesor de Árbitros y análisis de rendimiento en cancha',
      ],
      lapsoDescargosDias: 5,
      tipoDiasDescargos: 'CONTINUOS',
      lapsoCumplimientoDias: 30,
      requiereAudiencia: true,
      unidadesNotificarInicio: ['GERENCIA_INTEGRIDAD', 'SECRETARIA_GENERAL', 'CLUB_INVOLUCRADO'],
      unidadesNotificarDecision: ['GERENCIA_INTEGRIDAD', 'ADMINISTRACION_FVF', 'UCA_FVF', 'SECRETARIA_GENERAL'],
      pasosJson: [
        '1. Emitir Referencia de Inicio con enlaces seguros a las pruebas, advirtiendo confidencialidad (Art. 34 CDF) y deber de colaborar (Art. 12 CDF / 178 RD-FVF).',
        '2. Recibir escrito de descargos y ponderar si hubo rechazo al soborno, alerta disuasoria a compañeros y cooperación incondicional.',
        '3. Aplicar Principio de Proporcionalidad y Lex Mitior: si solo hubo omisión formal de denuncia pero frustró el amaño y cooperó, imponer multa en UCFVF + Programa obligatorio de Formación en Integridad (carácter indivisible).',
        '4. Gestionar con Administración y UCA los 4 recaudos fiscales (RIF actualizado SENIAT, correo, contacto, teléfono) y verificar Factura Fiscal cancelada + constancia de curso de Integridad.',
        '5. Emitir Referencia de Clausura y Archivo Definitivo.',
      ],
    },
    {
      codigoTipologia: 'REDES_SOCIALES_ARBITROS',
      nombreProcedimiento: 'Declaraciones Desconsideradas u Ofensivas en Redes Sociales contra Oficiales de Partido',
      articulosBase: ['Arts. 9, 10 (b, c, e), 17, 23, 58, 164, 172, 173, 174, 175, 178 y 201 RD-FVF', 'Arts. 71, 72 y 77 Estatutos FVF'],
      documentosRequeridos: [
        'Informe de Integridad y Cumplimiento con capturas de historias/posts (Instagram, X, etc.)',
        'Informe Arbitral COMET e Informe del Asesor de Árbitros',
        'Planilla de Declaración de Integridad y Contrato COMET para validar correo oficial del jugador',
      ],
      lapsoDescargosDias: 5,
      tipoDiasDescargos: 'HABILES',
      lapsoCumplimientoDias: 5,
      requiereAudiencia: true,
      unidadesNotificarInicio: ['GERENCIA_INTEGRIDAD', 'CNA_ARBITROS', 'COMPETICIONES_LIGA_FUTVE', 'PRODUCCION_LIGA_FUTVE', 'SECRETARIA_GENERAL'],
      unidadesNotificarDecision: ['DIRECCION_LIGA_FUTVE', 'COMPETICIONES_LIGA_FUTVE', 'ADMINISTRACION_FVF', 'UCA_FVF', 'SECRETARIA_GENERAL'],
      pasosJson: [
        '1. Emitir Auto de Inicio otorgando 5 días hábiles para informe de defensa (Art. 172), citando a audiencia (Art. 173.5) y oficiando a Producción Liga FUTVE.',
        '2. Si hay pluralidad de jugadores, emitir Referencia de Separación de Expedientes en piezas individuales para garantizar defensa y graduación individual.',
        '3. Celebrar audiencia de declaración (presencial o Google Meet) con pliego de 17 a 19 preguntas bajo juramento.',
        '4. Graduar sanción según tenor objetivo: insulto directo/etiqueta al árbitro (3 partidos + 30 UCFVF) vs. cuestionamiento desconsiderado sin insulto grosero (1 partido + 10 UCFVF). Indicar irrecurribilidad en reconsideración (Art. 201 b y e RD-FVF).',
        '5. Instar al reporte del pago en el Formulario de UCA/Administración, recibir confirmación de Cuenta por Cobrar (CxC) cancelada y emitir Referencia de Clausura.',
      ],
    },
    {
      codigoTipologia: 'REMISION_JUEZ_UNICO',
      nombreProcedimiento: 'Sustanciación por Remisión de Juez Único e Inhabilitación Preventiva de Dirigentes/Oficiales',
      articulosBase: ['Arts. 3, 6, 30, 84.2, 85, 86, 87, 104, 133-136, 164, 176, 178 y 204 RD-FVF', 'Arts. 11.b, 14.8 y 43.1 CDC CONMEBOL', 'Arts. 12, 34 y 40 CDF FIFA'],
      documentosRequeridos: [
        'Acta Motivada de Remisión del Juez Único de la Competencia',
        'Extractos Certificados de las Actas de Comisión de Justicia (con acumulación si abarca Sub-15 y Sub-16)',
        'Informes COMET de Árbitros y Delegado de Partido',
      ],
      lapsoDescargosDias: 5,
      tipoDiasDescargos: 'HABILES',
      lapsoCumplimientoDias: 30,
      requiereAudiencia: true,
      unidadesNotificarInicio: ['CNA_ARBITROS', 'COMPETICIONES_FVF', 'SECRETARIA_GENERAL', 'ASOCIACION_ESTADAL'],
      unidadesNotificarDecision: ['CNA_ARBITROS', 'COMPETICIONES_FVF', 'ADMINISTRACION_FVF', 'UCA_FVF', 'ASOCIACION_ESTADAL'],
      pasosJson: [
        '1. Emitir Referencia de Inicio (Art. 55 a y f CDF) otorgando 5 días al investigado y 5 días al Club, citando a audiencia y activando el reloj de 30 días continuos de la medida provisional (Art. 30 RD-FVF).',
        '2. Celebrar interrogatorio exhaustivo (20 preguntas) contrastando la presunción de veracidad de los informes oficiales (Art. 43.1 CDC / Art. 40 CDF) con las pruebas audiovisuales y testimoniales promovidas.',
        '3. Resolver solicitudes de pruebas sobrevenidas (3 días) y dictar fallo definitivo antes del día 30 continuo de la medida cautelar, descontando el tiempo cumplido preventivamente.',
      ],
    },
    {
      codigoTipologia: 'VIOLENCIA_MENORES_LOPNNA',
      nombreProcedimiento: 'Protección de Niños, Niñas y Adolescentes (LOPNNA), Violencia en Gradas y Fallas de Seguridad',
      articulosBase: ['Arts. 4-A, 32, 63 y 65 LOPNNA', 'Art. 77 Estatutos FVF', 'Arts. 133, 134, 136 y 204 RD-FVF'],
      documentosRequeridos: [
        'Denuncia de representante legal del menor o remisión de Integridad / Canal Web FVF',
        'Acta de Instrucción de Secretaría Ejecutiva insertando extracción de oficio del Sistema COMET (Informe Arbitral e Informe de Delegado)',
      ],
      lapsoDescargosDias: 5,
      tipoDiasDescargos: 'HABILES',
      lapsoCumplimientoDias: 15,
      requiereAudiencia: true,
      unidadesNotificarInicio: ['GERENCIA_INTEGRIDAD', 'DIRECCION_DESARROLLO', 'COMISION_FUTBOL_SALA', 'CNA_ARBITROS', 'ASOCIACION_ESTADAL'],
      unidadesNotificarDecision: ['GERENCIA_INTEGRIDAD', 'DIRECCION_DESARROLLO', 'COMISION_FUTBOL_SALA', 'ASOCIACION_ESTADAL', 'SECRETARIA_GENERAL'],
      pasosJson: [
        '1. Si el club presentó escrito calificado erróneamente como "Protesta" sin supuestos reglamentarios, emitir oficio reconduciendo la vía y remitiendo a la Comisión técnica y CNA.',
        '2. Emitir Acta de Instrucción extrayendo de oficio desde COMET los informes del árbitro y delegado (verificando fuerza pública, camerinos, cercado, ambulancia y minutos de detención).',
        '3. Determinar competencia primaria (CDH de Asociación Regional vs. avocamiento/supervisión CDH Nacional) y aplicar reserva estricta de identidad de adolescentes (Art. 65 LOPNNA).',
      ],
    },
  ];

  for (const p of playbooks) {
    await prisma.plantillaProcedimientoCDH.upsert({
      where: { codigoTipologia: p.codigoTipologia },
      update: p,
      create: p,
    });
  }
  console.log(`[OK] ${playbooks.length} Playbooks Procedimentales sembrados en Supabase.`);
}

/**
 * 2. Siembra los 7 Expedientes Reales Analizados (001/26, 002/26, 003/26, 004/26, 005/26, 051/26 y 061/26)
 */
async function sembrarExpedientesReales2026() {
  const casosReales = [
    {
      codigoExpediente: 'EXP-001-2026',
      numeroCorrelativo: 1,
      anio: 2026,
      viaIngreso: 'REMISION_CRD',
      torneoCategoria: 'Liga FUTVE / Ejecución CRD',
      partido: 'Drago Jesús Mrsic Rodríguez vs. Deportivo Lara F.C.',
      motivoPrincipal: 'Incumplimiento de Decisión CRD-FVF N° 218-2025 (Exp. 204-2024)',
      asuntoDetallado:
        'Reclamación de incumplimiento de obligaciones contractuales ($1.500 USD + 5% interés anual desde 2022). Apertura Ref. 002/2026 (13/01/2026), Decisión condenatoria Ref. 010/2026 (22/01/2026) con plazo de 30 días continuos y prohibición de registro; cumplimiento reportado el 05/02/2026 y Clausura Ref. 021/2026 (10/02/2026).',
      parteDemandante: 'Drago Jesús Mrsic Rodríguez (Apoderados: Abg. Armando Colmenares / Darwin Romero)',
      parteDemandada: 'Deportivo Lara F.C.',
      etapaActual: 'ARCHIVADO' as const,
      estadoTramite: 'DECIDIDO' as const,
      juezUnicoAsignado: 'Pleno Consejo de Honor (5 Miembros Principales)',
      especialistaAsignado: 'Carlos E. García Linarez / Julio Osorio',
      fechaApertura: new Date('2026-01-12T14:27:00Z'),
      fechaCierreDecision: new Date('2026-02-10T14:52:00Z'),
    },
    {
      codigoExpediente: 'EXP-002-2026',
      numeroCorrelativo: 2,
      anio: 2026,
      viaIngreso: 'REMISION_CRD',
      torneoCategoria: 'Liga FUTVE / Ejecución CRD',
      partido: 'Daniel Enrique Torrealba Rivero vs. Deportivo Lara F.C.',
      motivoPrincipal: 'Incumplimiento de Decisión CRD-FVF N° 215-2025 (Exp. 187-2024)',
      asuntoDetallado:
        'Ejecución de sentencia CRD a favor del utilero Daniel Torrealba ($720 USD + 5% anual). Incluye despacho saneador del 13/01/2026 por error en adjunto, inicio Ref. 008/2026 (16/01/2026), oficio aclaratorio sobre improcedencia de levantamiento sin medida previa (30/01/2026) y Clausura Ref. 020/2026 (10/02/2026) por pago.',
      parteDemandante: 'Daniel Enrique Torrealba Rivero (Apoderado: Abg. Armando Colmenares)',
      parteDemandada: 'Deportivo Lara F.C.',
      etapaActual: 'ARCHIVADO' as const,
      estadoTramite: 'DECIDIDO' as const,
      juezUnicoAsignado: 'Pleno Consejo de Honor (5 Miembros Principales)',
      especialistaAsignado: 'Carlos E. García Linarez / Julio Osorio',
      fechaApertura: new Date('2026-01-13T12:08:00Z'),
      fechaCierreDecision: new Date('2026-02-10T09:52:00Z'),
    },
    {
      codigoExpediente: 'EXP-003-2026',
      numeroCorrelativo: 3,
      anio: 2026,
      viaIngreso: 'OFICIO_INTEGRIDAD',
      torneoCategoria: 'Liga FUTVE (1ra División)',
      jornada: 'Jornada 11 Clausura 2025',
      partido: 'Deportivo La Guaira F.C. vs. Yaracuyanos S.C.',
      motivoPrincipal: 'Incumplimiento del Deber de Denunciar Manipulación de Partidos (Art. 20.3 CDF / Art. 24 CE-FVF)',
      asuntoDetallado:
        'Remisión de Integridad y Cumplimiento contra Brayan Jesús Alcocer Narváez. El jugador rechazó oferta de $10.000 USD y alertó a sus excompañeros (Ojeda y Chacón), pero omitió denunciar por canales FVF. Por Lex Mitior y proporcionalidad (Decisión 046/2026 del 16/06/2026) se impuso multa de 700 UCFVF ($2.100 USD) + Curso de Integridad. Pagado (Factura A00000993) y clausurado en Ref. 098/2026 (31/08/2026).',
      parteDemandante: 'Gerencia de Integridad y Cumplimiento FVF / Yaracuyanos S.C.',
      parteDemandada: 'Brayan Jesús Alcocer Narváez (V-30.298.218)',
      etapaActual: 'ARCHIVADO' as const,
      estadoTramite: 'DECIDIDO' as const,
      juezUnicoAsignado: 'Pleno Consejo de Honor (Consuelo Vásquez, Luis Chourio, Karla Herrera)',
      especialistaAsignado: 'Julio Osorio / Carlos García',
      fechaApertura: new Date('2026-01-16T09:07:00Z'),
      fechaCierreDecision: new Date('2026-08-31T10:28:00Z'),
    },
    {
      codigoExpediente: 'EXP-004-2026',
      numeroCorrelativo: 4,
      anio: 2026,
      viaIngreso: 'OFICIO_INTEGRIDAD',
      torneoCategoria: 'Liga FUTVE (1ra División)',
      jornada: 'Gran Final Absoluta 2025 (Vuelta)',
      partido: 'Carabobo F.C. vs. UCV F.C.',
      motivoPrincipal: 'Publicaciones Ofensivas en Red Social Instagram contra Árbitro Principal (Arts. 10 y 58 RD-FVF)',
      asuntoDetallado:
        'Pieza separada (Ref. 014/2026) desglosada del Exp. 129/2025 contra Jean Franco Alexi Fuentes Velasco (@jeanfuentes4) por expresiones "das asco" y "nos robaste" contra el árbitro Rony Cueva. Declaración telemática de 19 preguntas (15/01/2026). Decisión N° 032/2026 (06/02/2026): 3 partidos de suspensión + 30 UCFVF ($90 USD). Cobrado en CxC A000000768 y cerrado en Ref. 035/2026 (27/02/2026).',
      parteDemandante: 'Oficial de Integridad y Cumplimiento FVF',
      parteDemandada: 'Jean Franco Alexi Fuentes Velasco (V-26.675.979 - Carabobo F.C.)',
      etapaActual: 'ARCHIVADO' as const,
      estadoTramite: 'DECIDIDO' as const,
      juezUnicoAsignado: 'Pleno Consejo de Honor (5 Miembros Principales)',
      especialistaAsignado: 'Julio Osorio / Carlos García',
      fechaApertura: new Date('2026-01-16T10:00:00Z'),
      fechaCierreDecision: new Date('2026-02-27T10:11:00Z'),
    },
    {
      codigoExpediente: 'EXP-005-2026',
      numeroCorrelativo: 5,
      anio: 2026,
      viaIngreso: 'OFICIO_INTEGRIDAD',
      torneoCategoria: 'Liga FUTVE (1ra División)',
      jornada: 'Gran Final Absoluta 2025 (Vuelta)',
      partido: 'Carabobo F.C. vs. UCV F.C.',
      motivoPrincipal: 'Publicaciones Desconsideradas en Instagram contra el Arbitraje (Arts. 10 y 58 RD-FVF)',
      asuntoDetallado:
        'Pieza separada (Ref. 015/2026) desglosada del Exp. 129/2025 contra Diego Javier Gil Malavé (@diegojgil1) por publicar "No puedo entender como dañan el trabajo de 2 años de mucha gente buena como si nada...". Declaración telemática de 17 preguntas (15/01/2026). Decisión N° 033/2026 (06/02/2026): 1 partido de suspensión + 10 UCFVF ($30 USD). Cobrado en CxC A000000769 y cerrado en Ref. 036/2026 (02/03/2026).',
      parteDemandante: 'Oficial de Integridad y Cumplimiento FVF',
      parteDemandada: 'Diego Javier Gil Malavé (V-28.211.746 - Carabobo F.C. / Marítimo La Guaira)',
      etapaActual: 'ARCHIVADO' as const,
      estadoTramite: 'DECIDIDO' as const,
      juezUnicoAsignado: 'Pleno Consejo de Honor (5 Miembros Principales)',
      especialistaAsignado: 'Julio Osorio / Carlos García',
      fechaApertura: new Date('2026-01-16T10:30:00Z'),
      fechaCierreDecision: new Date('2026-03-02T08:52:00Z'),
    },
    {
      codigoExpediente: 'EXP-051-2026',
      numeroCorrelativo: 51,
      anio: 2026,
      viaIngreso: 'REMISION_JUEZ_UNICO',
      torneoCategoria: 'Liga FUTVE Junior (Sub-15 y Sub-16)',
      jornada: 'Jornada 18 Segunda Vuelta',
      partido: 'Bolívar S.C. vs. Deportivo Miranda F.C.',
      motivoPrincipal: 'Remisión Juez Único por Presuntas Faltas de Dirigente / Oficial de Integridad e Incitación en Tribuna',
      asuntoDetallado:
        'Remisión del Juez Único Abg. Luis Alfonso Chourio (14/09/2026) con medida de inhabilitación preventiva contra Claudio Jean Pierre Zamora Fernández (Vicepresidente y Oficial de Integridad de Bolívar S.C.). Auto de Inicio Ref. 108/2026 (18/09/2026), escrito de descargos y pruebas (23/09/2026), audiencia de 20 preguntas (28/09/2026), promoción de testigos policiales y videos (29/09/2026) y solicitud del 13/10/2026 invocando vencimiento de 30 días continuos de suspensión provisional (Art. 30 RD-FVF).',
      parteDemandante: 'Remisión de Oficio Juez Único Liga FUTVE Junior',
      parteDemandada: 'Claudio Jean Pierre Zamora Fernández (V-14.876.936) y Bolívar S.C.',
      etapaActual: 'LAPSO_RESOLUCION' as const,
      estadoTramite: 'EN_INSTRUCCION' as const,
      juezUnicoAsignado: 'Pleno Consejo de Honor (Remitido por Juez Único Luis Alfonso Chourio)',
      especialistaAsignado: 'Julio Osorio / Carlos García / David Huerta',
      fechaApertura: new Date('2026-09-14T11:06:00Z'),
    },
    {
      codigoExpediente: 'EXP-061-2026',
      numeroCorrelativo: 61,
      anio: 2026,
      viaIngreso: 'DENUNCIA_PARTE',
      torneoCategoria: 'Liga de Desarrollo Sub-15 Masculina Fútbol Sala 2026',
      jornada: 'Jornada 1 Fase Interregional - Región Occidental II',
      partido: 'Academia de Fútbol Interclub (Yaracuy) vs. Atlético San Carlos S.C. (Cojedes)',
      motivoPrincipal: 'Hechos Violentos contra Adolescente (LOPNNA), Insuficiencia de Seguridad e Infraestructura',
      asuntoDetallado:
        'Desestimada inicialmente como Protesta formal (23/10/2026) y abierta como Denuncia disciplinaria tras requerimiento de la madre del menor Samuel Jesús Carballo Parra (#9) invocando LOPNNA (27/10/2026) y remisión de Integridad (28/10/2026). Acta de Instrucción del 02/11/2026 insertando informes COMET de árbitro (detención de 31 min por agresión de agente externo) y delegada (cancha Zumuco sin camerinos, solo 2 policías, 0 ambulancias y retiro temporal del visitante).',
      parteDemandante: 'Alba Parra (Madre del adolescente Samuel Carballo) / Atlético San Carlos S.C.',
      parteDemandada: 'Academia de Fútbol Interclub / Organización Local Yaracuy',
      etapaActual: 'AUTO_DE_INICIO' as const,
      estadoTramite: 'EN_INSTRUCCION' as const,
      juezUnicoAsignado: 'Pleno Consejo de Honor / Coordinación con Comisión de Futsal y CDH Regional',
      especialistaAsignado: 'Julio Osorio / Carlos García',
      fechaApertura: new Date('2026-10-28T09:13:00Z'),
    },
  ];

  for (const c of casosReales) {
    await prisma.expedienteDisciplinario.upsert({
      where: { codigoExpediente: c.codigoExpediente },
      update: c,
      create: c,
    });
  }
  console.log(`[OK] ${casosReales.length} Expedientes Reales 2026 sembrados en Supabase.`);
}

/**
 * 3. Lector Multimodal de la Carpeta de Google Drive (PDFs de Expedientes, Anexos y Reglamentos)
 */
export async function sincronizarCarpetaDriveExpedientes() {
  const folderId = process.env.GOOGLE_DRIVE_EXPEDIENTES_FOLDER_ID;
  if (!folderId || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(
      '[Aviso Drive]: Define GOOGLE_DRIVE_EXPEDIENTES_FOLDER_ID y GOOGLE_APPLICATION_CREDENTIALS en .env para descarga automática desde Drive.',
    );
    return;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const lista = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
    fields: 'files(id, name, modifiedTime)',
    pageSize: 100,
  });

  for (const archivo of lista.data.files ?? []) {
    if (!archivo.id || !archivo.name) continue;
    console.log(`Procesando PDF desde Drive: ${archivo.name}...`);

    const binario = await drive.files.get(
      { fileId: archivo.id, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    const base64Pdf = Buffer.from(binario.data as ArrayBuffer).toString('base64');

    const extraccion = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
            {
              text: `Extrae en JSON la ficha completa de este documento del Consejo de Honor FVF (Expediente o Reglamento):
              codigoExpediente, anio, torneoCategoria, partido, motivoPrincipal, parteDemandante, parteDemandada,
              articulosInvocados, cronologiaActuaciones, interrogatoriosRealizados, multasUcfvf, estadoFinal.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            codigoExpediente: { type: Type.STRING },
            anio: { type: Type.INTEGER },
            torneoCategoria: { type: Type.STRING },
            partido: { type: Type.STRING },
            motivoPrincipal: { type: Type.STRING },
            parteDemandante: { type: Type.STRING },
            parteDemandada: { type: Type.STRING },
            resumenEjecutivo: { type: Type.STRING },
          },
          required: ['codigoExpediente', 'anio', 'motivoPrincipal', 'resumenEjecutivo'],
        },
      },
    });

    console.log(`[Extraído con IA]: ${archivo.name} -> ${extraccion.text}`);
  }
}

async function main() {
  await sembrarPlaybooksProcedimentales();
  await sembrarExpedientesReales2026();
  await sincronizarCarpetaDriveExpedientes();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());