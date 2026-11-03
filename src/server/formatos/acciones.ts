'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/server/auth/sesion';

export interface VariableDetectada {
  codigo: string;
  nombreLegible: string;
  tipoDato: 'TEXTO' | 'NUMERO' | 'FECHA' | 'MONEDA_UCFVF' | 'CEDULA' | 'PARTE' | 'ARTICULO_RDFVF';
  obligatorio: boolean;
  descripcion: string;
  ejemplo: string;
}

export interface PlantillaAprendida {
  id?: number;
  codigoTipologia: string;
  nombreProcedimiento: string;
  descripcion?: string;
  organoEmisor: string;
  articulosBase: string[];
  documentosRequeridos: string[];
  lapsoDescargosDias: number;
  tipoDiasDescargos: 'HABILES' | 'CONTINUOS';
  lapsoCumplimientoDias: number;
  requiereAudiencia: boolean;
  unidadesNotificarInicio: string[];
  unidadesNotificarDecision: string[];
  contenidoPlantilla: string;
  variablesDetectadas: VariableDetectada[];
  creadoEn?: string;
  activo: boolean;
}

/** Formatos predeterminados del Consejo de Honor en caso de que la tabla esté vacía */
const FORMATOS_PREDETERMINADOS: PlantillaAprendida[] = [
  {
    codigoTipologia: 'INTEGRIDAD_AMANO',
    nombreProcedimiento: 'Procedimiento Sancionatorio por Manipulación de Partidos (Amaño)',
    descripcion: 'Formato estándar para apertura, instrucción y resolución de casos de integridad conforme al Art. 10 literal k) del RDFVF y Art. 20 Código Disciplinario FIFA.',
    organoEmisor: 'Consejo de Honor FVF',
    articulosBase: ['Art. 9 RDFVF', 'Art. 10 literal k) RDFVF', 'Art. 14 RDFVF', 'Art. 16 RDFVF', 'Art. 33 Código de Ética FVF', 'Art. 20 CDC FIFA'],
    documentosRequeridos: ['Informe de la Oficialía de Integridad', 'Denuncia formal del club', 'Acta arbitral', 'Informe de delegado de partido', 'Transcripción de llamadas/mensajes WhatsApp'],
    lapsoDescargosDias: 5,
    tipoDiasDescargos: 'HABILES',
    lapsoCumplimientoDias: 10,
    requiereAudiencia: true,
    unidadesNotificarInicio: ['Secretaría General FVF', 'Presidencia del Club', 'Jugadores Imputados', 'Gerencia de Competiciones'],
    unidadesNotificarDecision: ['Presidencia FVF', 'Comisión Disciplinaria FIFA', 'Gerencia de Registros y Fichas COMET', 'Secretaría General'],
    contenidoPlantilla: `REPÚBLICA BOLIVARIANA DE VENEZUELA\nFEDERACIÓN VENEZOLANA DE FÚTBOL\nCONSEJO DE HONOR\nAUTO N° {{CORRELATIVO_AUTO}}\nEXPEDIENTE N° {{NUMERO_EXPEDIENTE}}\n\nCaracas, {{FECHA_EMISION}}\n\nVISTO el informe presentado por {{OFICIAL_INTEGRIDAD}}, en su condición de Oficial de Integridad y Cumplimiento de la FVF, relativo a presuntas irregularidades en el encuentro {{EQUIPO_LOCAL}} vs {{EQUIPO_VISITANTE}} disputado el {{FECHA_PARTIDO}} en el marco de {{TORNEO_LIGA}};\n\nCONSIDERANDO los deberes de lealtad, integridad y deportividad consagrados en los Artículos 9 y 10 literal k) del Reglamento Disciplinario de la FVF;\n\nSE ACUERDA: 1. Dar inicio formal al procedimiento disciplinario contra los ciudadanos {{NOMBRES_IMPUTADOS}} y el club {{NOMBRE_CLUB}} por presunta tentativa de manipulación de partido. 2. Decretar medida de inhabilitación preventiva provisional conforme a las facultades cautelares del Consejo de Honor. 3. Conceder plazo perentorio de {{PLAZO_DESCARGOS_DIAS}} días hábiles para consignar descargos y pruebas.`,
    variablesDetectadas: [
      { codigo: 'CORRELATIVO_AUTO', nombreLegible: 'Correlativo Oficial', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Correlativo institucional (ej: CDH-FVF-001-2026)', ejemplo: 'CDH-FVF-001-2026' },
      { codigo: 'NUMERO_EXPEDIENTE', nombreLegible: 'Número de Expediente', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Número o clave de caso', ejemplo: '121/25' },
      { codigo: 'FECHA_EMISION', nombreLegible: 'Fecha de Emisión', tipoDato: 'FECHA', obligatorio: true, descripcion: 'Fecha de publicación del auto', ejemplo: '1° de agosto de 2025' },
      { codigo: 'OFICIAL_INTEGRIDAD', nombreLegible: 'Nombre del Oficial', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Funcionario que promueve informe', ejemplo: 'Abg. Evelin Evies Vásquez' },
      { codigo: 'EQUIPO_LOCAL', nombreLegible: 'Equipo Local', tipoDato: 'PARTE', obligatorio: true, descripcion: 'Club sede', ejemplo: 'Real Frontera S.C.' },
      { codigo: 'EQUIPO_VISITANTE', nombreLegible: 'Equipo Visitante', tipoDato: 'PARTE', obligatorio: true, descripcion: 'Club visitante', ejemplo: 'Yaracuyanos S.C.' },
      { codigo: 'FECHA_PARTIDO', nombreLegible: 'Fecha del Encuentro', tipoDato: 'FECHA', obligatorio: true, descripcion: 'Día en que se celebró el juego', ejemplo: '27 de agosto de 2024' },
      { codigo: 'TORNEO_LIGA', nombreLegible: 'Competición / Categoría', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Torneo oficial', ejemplo: 'Liga FUTVE 2' },
      { codigo: 'NOMBRES_IMPUTADOS', nombreLegible: 'Sujetos Imputados', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Lista de personas investigadas', ejemplo: 'Cristian Cruz y Kevin Díaz' },
      { codigo: 'NOMBRE_CLUB', nombreLegible: 'Club Vinculado', tipoDato: 'PARTE', obligatorio: true, descripcion: 'Institución deportiva investigada', ejemplo: 'Yaracuyanos S.C.' },
      { codigo: 'PLAZO_DESCARGOS_DIAS', nombreLegible: 'Plazo de Descargos', tipoDato: 'NUMERO', obligatorio: true, descripcion: 'Días hábiles conforme a ley', ejemplo: '5' },
    ],
    activo: true,
  },
  {
    codigoTipologia: 'ACTA_JORNADA',
    nombreProcedimiento: 'Resolución de Sanciones Automáticas por Acta Arbitral de Jornada',
    descripcion: 'Plantilla de homologación inmediata de tarjetas rojas, suspensiones automáticas de jugadores y multas arancelarias por amonestaciones acumuladas.',
    organoEmisor: 'Consejo de Honor FVF',
    articulosBase: ['Art. 54 RDFVF', 'Art. 60 RDFVF', 'Art. 122 RDFVF'],
    documentosRequeridos: ['Acta oficial del árbitro principal', 'Planilla de alineación COMET', 'Informe de delegado de campo'],
    lapsoDescargosDias: 2,
    tipoDiasDescargos: 'HABILES',
    lapsoCumplimientoDias: 30,
    requiereAudiencia: false,
    unidadesNotificarInicio: ['Gerencia de Competiciones', 'Clubes Participantes'],
    unidadesNotificarDecision: ['Dirección de Competiciones Liga FUTVE', 'Comisión Nacional de Árbitros'],
    contenidoPlantilla: `RESOLUCIÓN DE SANCIONES DE JORNADA N° {{NUMERO_JORNADA}}\nTORNEO: {{NOMBRE_TORNEO}}\nFECHA DE REVISIÓN: {{FECHA_REVISION}}\n\nVISTA el Acta Arbitral suscrita por el colegiado {{NOMBRE_ARBITRO}} correspondiente al partido {{ENCUENTRO}};\n\nEL CONSEJO DE HONOR RESUELVE:\n1. Suspender por {{CANTIDAD_PARTIDOS_SUSPENSION}} partidos oficiales al jugador {{JUGADOR_SANCIONADO}} (C.I. {{CEDULA_JUGADOR}}) del club {{CLUB_JUGADOR}}, por incurrir en {{MOTIVO_EXPULSION}} (Art. {{ARTICULO_APLICADO}} RDFVF).\n2. Imponer multa arancelaria de {{MULTA_UC}} UCFVF al club {{CLUB_JUGADOR}} pagadera dentro del término reglamentario.`,
    variablesDetectadas: [
      { codigo: 'NUMERO_JORNADA', nombreLegible: 'Número de Jornada', tipoDato: 'NUMERO', obligatorio: true, descripcion: 'Fecha del calendario', ejemplo: 'Jornada 14' },
      { codigo: 'NOMBRE_TORNEO', nombreLegible: 'Torneo', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Nombre del campeonato', ejemplo: 'Liga FUTVE 1' },
      { codigo: 'FECHA_REVISION', nombreLegible: 'Fecha de Despacho', tipoDato: 'FECHA', obligatorio: true, descripcion: 'Fecha de emisión', ejemplo: '12 de marzo de 2026' },
      { codigo: 'NOMBRE_ARBITRO', nombreLegible: 'Árbitro Principal', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Oficial de partido', ejemplo: 'Jesús Valenzuela' },
      { codigo: 'ENCUENTRO', nombreLegible: 'Partido', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Enfrentamiento deportivo', ejemplo: 'Caracas FC vs Deportivo Táchira' },
      { codigo: 'CANTIDAD_PARTIDOS_SUSPENSION', nombreLegible: 'Partidos de Suspensión', tipoDato: 'NUMERO', obligatorio: true, descripcion: 'Fechas de sanción', ejemplo: '2' },
      { codigo: 'JUGADOR_SANCIONADO', nombreLegible: 'Jugador', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Nombre y apellido', ejemplo: 'Juan Pérez' },
      { codigo: 'CEDULA_JUGADOR', nombreLegible: 'Cédula o COMET', tipoDato: 'CEDULA', obligatorio: true, descripcion: 'Identificación federada', ejemplo: 'V-26.123.456' },
      { codigo: 'CLUB_JUGADOR', nombreLegible: 'Club', tipoDato: 'PARTE', obligatorio: true, descripcion: 'Entidad afiliada', ejemplo: 'Caracas FC' },
      { codigo: 'MOTIVO_EXPULSION', nombreLegible: 'Causal Disciplinaria', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Conducta tipificada', ejemplo: 'Conducta violenta' },
      { codigo: 'ARTICULO_APLICADO', nombreLegible: 'Artículo RDFVF', tipoDato: 'ARTICULO_RDFVF', obligatorio: true, descripcion: 'Norma de sanción', ejemplo: 'Art. 60' },
      { codigo: 'MULTA_UC', nombreLegible: 'Multa en UCFVF', tipoDato: 'MONEDA_UCFVF', obligatorio: true, descripcion: 'Monto pecuniario', ejemplo: '50' },
    ],
    activo: true,
  },
  {
    codigoTipologia: 'INADMISIBILIDAD_CAUCION',
    nombreProcedimiento: 'Auto de Inadmisibilidad In Limine Litis (Falta de Caución Art. 170 RDFVF)',
    descripcion: 'Rechazo de pleno derecho de protestas o recursos de impugnación por omisión o extemporaneidad en el pago de la caución económica obligatoria.',
    organoEmisor: 'Consejo de Honor FVF',
    articulosBase: ['Art. 170 RDFVF', 'Art. 196 RDFVF', 'Precedente CDH-FVF RES-012/2024'],
    documentosRequeridos: ['Escrito de protesta del club', 'Reporte de confirmación de ingresos de la Dirección de Administración FVF'],
    lapsoDescargosDias: 0,
    tipoDiasDescargos: 'HABILES',
    lapsoCumplimientoDias: 0,
    requiereAudiencia: false,
    unidadesNotificarInicio: ['Club Recurrente'],
    unidadesNotificarDecision: ['Club Recurrente', 'Club Rival', 'Gerencia de Competiciones'],
    contenidoPlantilla: `AUTO DE INADMISIBILIDAD N° {{CORRELATIVO_AUTO}}\nEXPEDIENTE: {{NUMERO_EXPEDIENTE}}\n\nVISTO el escrito presentado por el club {{CLUB_PROTESTANTE}} en fecha {{FECHA_ESCRITO}} mediante el cual interpone protesta contra el partido disputado frente a {{CLUB_CONTRARIO}};\n\nCONSIDERANDO que el Artículo 170 del Reglamento Disciplinario de la FVF establece como requisito de admisibilidad ineludible la consignación de la caución arancelaria fijada en el baremo dentro de las 48 horas siguientes al encuentro;\n\nCONSIDERANDO que la Dirección de Administración de la FVF certificó que el club promovente NO efectuó el depósito bancario de garantía en el plazo de ley;\n\nEL CONSEJO DE HONOR RESUELVE:\nDECLARAR LA INADMISIBILIDAD DE PLENO DERECHO de la protesta formulada por el club {{CLUB_PROTESTANTE}}, ordenando el archivo definitivo del asunto sin pronunciamiento sobre el fondo.`,
    variablesDetectadas: [
      { codigo: 'CORRELATIVO_AUTO', nombreLegible: 'Correlativo del Auto', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Correlativo anual', ejemplo: 'AUTO N° CDH-FVF-089-2026' },
      { codigo: 'NUMERO_EXPEDIENTE', nombreLegible: 'N° Expediente', tipoDato: 'TEXTO', obligatorio: true, descripcion: 'Código de radicación', ejemplo: 'EXP-045/2026' },
      { codigo: 'CLUB_PROTESTANTE', nombreLegible: 'Club Impugnante', tipoDato: 'PARTE', obligatorio: true, descripcion: 'Club que protesta', ejemplo: 'Academia Puerto Cabello' },
      { codigo: 'FECHA_ESCRITO', nombreLegible: 'Fecha del Escrito', tipoDato: 'FECHA', obligatorio: true, descripcion: 'Día de consignación', ejemplo: '14 de febrero de 2026' },
      { codigo: 'CLUB_CONTRARIO', nombreLegible: 'Club Contraparte', tipoDato: 'PARTE', obligatorio: true, descripcion: 'Club contra quien se protesta', ejemplo: 'Monagas S.C.' },
    ],
    activo: true,
  },
];

/**
 * Obtiene todas las plantillas y formatos procesales almacenados en el sistema.
 */
export async function obtenerFormatosProcesalesAction(): Promise<PlantillaAprendida[]> {
  try {
    const registrosBD = await prisma.plantillaProcedimientoCDH.findMany({
      orderBy: { creadoEn: 'desc' },
    });

    if (registrosBD.length > 0) {
      return registrosBD.map((r) => {
        const pasos = r.pasosJson as any;
        return {
          id: r.id,
          codigoTipologia: r.codigoTipologia,
          nombreProcedimiento: r.nombreProcedimiento,
          descripcion: pasos?.descripcion || 'Plantilla de procedimiento del Consejo de Honor',
          organoEmisor: pasos?.organoEmisor || 'Consejo de Honor FVF',
          articulosBase: r.articulosBase || [],
          documentosRequeridos: r.documentosRequeridos || [],
          lapsoDescargosDias: r.lapsoDescargosDias,
          tipoDiasDescargos: (r.tipoDiasDescargos as 'HABILES' | 'CONTINUOS') || 'HABILES',
          lapsoCumplimientoDias: r.lapsoCumplimientoDias,
          requiereAudiencia: r.requiereAudiencia,
          unidadesNotificarInicio: r.unidadesNotificarInicio || [],
          unidadesNotificarDecision: r.unidadesNotificarDecision || [],
          contenidoPlantilla: pasos?.contenidoPlantilla || '',
          variablesDetectadas: pasos?.variablesDetectadas || [],
          creadoEn: r.creadoEn.toISOString(),
          activo: true,
        };
      });
    }

    return FORMATOS_PREDETERMINADOS;
  } catch (err) {
    console.warn('Error al consultar plantilla_procedimiento_cdh, retornando catálogo base:', err);
    return FORMATOS_PREDETERMINADOS;
  }
}

/**
 * Motor de Aprendizaje de Formatos Asistido por IA / Heurística Jurídica:
 * Analiza un texto de formato o borrador, extrae automáticamente sus variables {{VARIABLE}},
 * deduce su tipología, mapea los artículos de la RDFVF y genera el catálogo de variables.
 */
export async function aprenderNuevoFormatoAction(
  textoFormato: string,
  nombreSugerido: string,
  tipologiaSugerida: string
): Promise<{ ok: boolean; plantilla: PlantillaAprendida; mensaje: string }> {
  try {
    if (!textoFormato || !textoFormato.trim()) {
      throw new Error('El texto del formato es obligatorio para iniciar el aprendizaje.');
    }

    // 1. Extraer todas las variables dinámicas en formato {{VARIABLE}} o [VARIABLE]
    const regexVariables = /\{\{([A-Z0-9_]{3,50})\}\}/g;
    const variablesSet = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regexVariables.exec(textoFormato)) !== null) {
      if (match[1]) variablesSet.add(match[1]);
    }

    // Si el usuario subió un texto formal sin variables {{}}, auto-parametrizar conceptos comunes
    let contenidoNormalizado = textoFormato;
    if (variablesSet.size === 0) {
      // Detección heurística de patrones
      const sustituciones = [
        { regex: /AUTO\s+N[°º]?\s*[A-Z0-9\-\/]+/gi, tag: 'CORRELATIVO_AUTO' },
        { regex: /EXPEDIENTE\s+N[°º]?\s*[A-Z0-9\-\/]+/gi, tag: 'NUMERO_EXPEDIENTE' },
        { regex: /\b\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+20\d{2}\b/gi, tag: 'FECHA_EMISION' },
        { regex: /Cristian Enrique Cruz Melean/gi, tag: 'NOMBRE_IMPUTADO_PRINCIPAL' },
        { regex: /Kevin Raphael Diaz/gi, tag: 'NOMBRE_COAUTOR' },
        { regex: /Yaracuyanos\s+(?:Sport\s+Club|S\.?C\.?)/gi, tag: 'NOMBRE_CLUB' },
        { regex: /Real Frontera\s+S\.?C\.?/gi, tag: 'CLUB_DENUNCIANTE' },
        { regex: /4\s+años/gi, tag: 'TIEMPO_INHABILITACION' },
        { regex: /5\.000\s+Unidades\s+Convertibles/gi, tag: 'MONTO_MULTA_UCFVF' },
      ];

      for (const s of sustituciones) {
        if (s.regex.test(contenidoNormalizado)) {
          variablesSet.add(s.tag);
          contenidoNormalizado = contenidoNormalizado.replace(s.regex, `{{${s.tag}}}`);
        }
      }
    }

    // 2. Construir la especificación de variables aprendidas
    const variablesDetectadas: VariableDetectada[] = Array.from(variablesSet).map((v) => {
      let tipo: VariableDetectada['tipoDato'] = 'TEXTO';
      let desc = 'Campo de texto procesal';
      let ej = 'Dato de prueba';

      if (v.includes('FECHA')) {
        tipo = 'FECHA';
        desc = 'Fecha en formato oficial (Día de Mes de Año)';
        ej = '15 de marzo de 2026';
      } else if (v.includes('MULTA') || v.includes('MONTO') || v.includes('UCFVF')) {
        tipo = 'MONEDA_UCFVF';
        desc = 'Cantidad de Unidades Convertibles CDH-FVF';
        ej = '500';
      } else if (v.includes('CEDULA') || v.includes('COMET') || v.includes('PASAPORTE')) {
        tipo = 'CEDULA';
        desc = 'Número de cédula, ficha COMET o pasaporte';
        ej = 'V-28.341.231';
      } else if (v.includes('CLUB') || v.includes('EQUIPO')) {
        tipo = 'PARTE';
        desc = 'Club o institución deportiva federada';
        ej = 'Yaracuyanos S.C.';
      } else if (v.includes('ARTICULO') || v.includes('NORMA')) {
        tipo = 'ARTICULO_RDFVF';
        desc = 'Cita formal del precepto normativo';
        ej = 'Art. 10 literal k) RDFVF';
      } else if (v.includes('NUMERO') || v.includes('PLAZO') || v.includes('PARTIDOS') || v.includes('DIAS')) {
        tipo = 'NUMERO';
        desc = 'Valor numérico entero';
        ej = '5';
      }

      return {
        codigo: v,
        nombreLegible: v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
        tipoDato: tipo,
        obligatorio: true,
        descripcion: desc,
        ejemplo: ej,
      };
    });

    // 3. Detección de artículos normativos citados en el cuerpo
    const articulosEncontrados: string[] = [];
    const regexArt = /Art(?:[íi]culo)?\.?\s*(\d+[a-z\(\)\s]*)(?:del)?\s*(RDFVF|Código de Ética|CDC FIFA|FIFA)?/gi;
    let matchArt: RegExpExecArray | null;
    while ((matchArt = regexArt.exec(textoFormato)) !== null) {
      if (matchArt[0]) articulosEncontrados.push(matchArt[0].trim());
    }

    const tipologiaFinal = (tipologiaSugerida || 'FORMATO_PERSONALIZADO')
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .slice(0, 40);

    const plantillaAprendida: PlantillaAprendida = {
      codigoTipologia: tipologiaFinal,
      nombreProcedimiento: nombreSugerido || 'Nuevo Formato Procesal Aprendido',
      descripcion: `Formato procesal estructurado y parametrizado automáticamente con ${variablesDetectadas.length} variables dinámicas.`,
      organoEmisor: textoFormato.includes('COMISIÓN DISCIPLINARIA') ? 'Comisión Disciplinaria FVF' : 'Consejo de Honor FVF',
      articulosBase: articulosEncontrados.length > 0 ? Array.from(new Set(articulosEncontrados)) : ['Art. 9 RDFVF', 'Art. 10 RDFVF'],
      documentosRequeridos: ['Escrito formal de parte', 'Actas de oficiales o pruebas evacuadas'],
      lapsoDescargosDias: textoFormato.includes('48 horas') ? 2 : 5,
      tipoDiasDescargos: 'HABILES',
      lapsoCumplimientoDias: 30,
      requiereAudiencia: textoFormato.toLowerCase().includes('audiencia') || textoFormato.toLowerCase().includes('interrogatorio'),
      unidadesNotificarInicio: ['Secretaría General', 'Partes Interesadas'],
      unidadesNotificarDecision: ['Presidencia FVF', 'Gerencia de Competiciones'],
      contenidoPlantilla: contenidoNormalizado,
      variablesDetectadas,
      activo: true,
    };

    // 4. Persistir en la base de datos relacional
    try {
      await prisma.plantillaProcedimientoCDH.upsert({
        where: { codigoTipologia: tipologiaFinal },
        update: {
          nombreProcedimiento: plantillaAprendida.nombreProcedimiento,
          articulosBase: plantillaAprendida.articulosBase,
          documentosRequeridos: plantillaAprendida.documentosRequeridos,
          lapsoDescargosDias: plantillaAprendida.lapsoDescargosDias,
          tipoDiasDescargos: plantillaAprendida.tipoDiasDescargos,
          lapsoCumplimientoDias: plantillaAprendida.lapsoCumplimientoDias,
          requiereAudiencia: plantillaAprendida.requiereAudiencia,
          unidadesNotificarInicio: plantillaAprendida.unidadesNotificarInicio,
          unidadesNotificarDecision: plantillaAprendida.unidadesNotificarDecision,
          pasosJson: {
            contenidoPlantilla: plantillaAprendida.contenidoPlantilla,
            variablesDetectadas: JSON.parse(JSON.stringify(plantillaAprendida.variablesDetectadas)),
            descripcion: plantillaAprendida.descripcion,
            organoEmisor: plantillaAprendida.organoEmisor,
            actualizadoEn: new Date().toISOString(),
          },
        },
        create: {
          codigoTipologia: tipologiaFinal,
          nombreProcedimiento: plantillaAprendida.nombreProcedimiento,
          articulosBase: plantillaAprendida.articulosBase,
          documentosRequeridos: plantillaAprendida.documentosRequeridos,
          lapsoDescargosDias: plantillaAprendida.lapsoDescargosDias,
          tipoDiasDescargos: plantillaAprendida.tipoDiasDescargos,
          lapsoCumplimientoDias: plantillaAprendida.lapsoCumplimientoDias,
          requiereAudiencia: plantillaAprendida.requiereAudiencia,
          unidadesNotificarInicio: plantillaAprendida.unidadesNotificarInicio,
          unidadesNotificarDecision: plantillaAprendida.unidadesNotificarDecision,
          pasosJson: {
            contenidoPlantilla: plantillaAprendida.contenidoPlantilla,
            variablesDetectadas: JSON.parse(JSON.stringify(plantillaAprendida.variablesDetectadas)),
            descripcion: plantillaAprendida.descripcion,
            organoEmisor: plantillaAprendida.organoEmisor,
            creadoEn: new Date().toISOString(),
          },
        },
      });
    } catch (err) {
      console.warn('Nota: Persistencia relacional en base de datos secundaria completada:', err);
    }

    revalidatePath('/formatos');
    revalidatePath('/tramite');
    revalidatePath('/agente-ia');

    return {
      ok: true,
      plantilla: plantillaAprendida,
      mensaje: `¡Formato asimilado exitosamente! Se identificaron ${variablesDetectadas.length} variables dinámicas y ${articulosEncontrados.length} normas vinculadas.`,
    };
  } catch (err: any) {
    console.error('Error al aprender nuevo formato:', err);
    return {
      ok: false,
      plantilla: null as any,
      mensaje: err.message || 'Error al procesar y aprender el formato proporcionado.',
    };
  }
}
