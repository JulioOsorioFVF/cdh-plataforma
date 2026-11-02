/**
 * Contratos de datos: la definicion formal de cada documento.
 *
 * Un contrato declara, columna por columna, que tipo tiene, si es obligatoria,
 * sus limites y que reglas de negocio se aplican a la fila completa. La ingesta
 * no sabe nada de columnas sueltas: solo recorre el contrato. Asi, agregar una
 * columna o cambiar un limite se hace en un solo sitio y la web, la CLI, el
 * perfilado y la validacion quedan alineados.
 *
 * Los indices son la posicion en el CSV. Se usa posicion y no nombre porque en
 * el CUADRO DE EXPEDIENTES los encabezados se repiten ("Año" en la columna 1 y
 * en la 18, "Decisión" en la 21 y en la 28).
 */
import { parseFecha } from './util';
import type { TipoDato } from './estandar';
import { partirLista } from './estandar';

export type Severidad = 'error' | 'aviso';

/** Un problema detectado en una fila. */
export type Hallazgo = {
  /** Codigo estable, en mayusculas: sirve para agrupar y para traducir. */
  codigo: string;
  /** Campo del contrato al que se refiere. */
  campo: string;
  /** Explicacion legible, en espanol. */
  mensaje: string;
  /** Valor original que disparo el hallazgo. */
  valor?: string;
};

export type CampoContrato = {
  /** Posicion en el CSV (0 = columna A). */
  indice: number;
  /** Nombre canonico, normalizado. */
  encabezado: string;
  /** Nombre logico que usan las reglas y el perfilado. */
  campo: string;
  tipo: TipoDato;
  obligatorio?: boolean;
  /** Longitud maxima recomendada para texto (por encima se avisa). */
  maxLongitud?: number;
  min?: number;
  max?: number;
  /** Campos que se muestran en la vista previa del lote. */
  muestra?: boolean;
};

export type FilaNormalizada = {
  valores: Record<string, string | number | boolean | null>;
  crudo: string[];
};

export type Contrato = {
  documento: 'COMPETENCIAS' | 'EXPEDIENTES';
  version: string;
  /**
   * Si la fila no aporta datos (artefacto de la hoja), devuelve el motivo.
   * Se cuenta como omitida y no se guarda en staging.
   */
  esArtefacto?: (fila: string[]) => string | null;
  campos: readonly CampoContrato[];
  /** Reglas de negocio de la fila completa. Nunca bloquean por si solas. */
  reglas?: (fila: FilaNormalizada) => Hallazgo[];
};

const CAMPOS_COMPETENCIAS: readonly CampoContrato[] = [
  { indice: 0, encabezado: 'AÑO', campo: 'fecha', tipo: 'fecha', obligatorio: true, muestra: true },
  { indice: 1, encabezado: 'TORNEO', campo: 'torneo', tipo: 'texto', muestra: true },
  { indice: 2, encabezado: 'CATEGORÍA', campo: 'categoria', tipo: 'texto' },
  { indice: 3, encabezado: 'FASE', campo: 'fase', tipo: 'texto' },
  { indice: 4, encabezado: 'JORNADA', campo: 'jornada', tipo: 'texto' },
  { indice: 5, encabezado: 'ACTA', campo: 'acta', tipo: 'texto' },
  { indice: 6, encabezado: 'PROC.', campo: 'proc', tipo: 'texto' },
  { indice: 7, encabezado: 'TIPO DE SANCIONADO', campo: 'tipoSancionado', tipo: 'texto' },
  { indice: 8, encabezado: 'SANCIONADO', campo: 'cedula', tipo: 'cedula', muestra: true },
  { indice: 9, encabezado: 'TIPO', campo: 'tipo', tipo: 'texto', obligatorio: true, muestra: true },
  { indice: 10, encabezado: 'MOTIVO', campo: 'motivo', tipo: 'texto', muestra: true },
  { indice: 11, encabezado: 'OBSERVACIÓN', campo: 'observacion', tipo: 'texto', maxLongitud: 500 },
  { indice: 12, encabezado: 'NORMA', campo: 'norma', tipo: 'texto' },
  { indice: 13, encabezado: 'ARTÍCULOS', campo: 'articulos', tipo: 'texto' },
  { indice: 14, encabezado: 'SANCIÓN', campo: 'sancionJuegos', tipo: 'entero', min: 0, max: 365 },
  { indice: 15, encabezado: 'SANCIÓN TIEMPO', campo: 'sancionTiempo', tipo: 'texto' },
  { indice: 16, encabezado: 'U.C.', campo: 'uc', tipo: 'uc', min: 0, max: 1000000, muestra: true },
  { indice: 17, encabezado: 'CLUB', campo: 'club', tipo: 'texto', muestra: true },
  { indice: 18, encabezado: 'NOMBRE_COMPLETO_SANCIONADO', campo: 'nombre', tipo: 'texto', maxLongitud: 200 },
  { indice: 19, encabezado: 'INCIDENCIA_LICENCIA', campo: 'incidencia', tipo: 'texto' },
  { indice: 20, encabezado: 'DETALLE_INCIDENCIA', campo: 'detalleIncidencia', tipo: 'texto', maxLongitud: 500 },
  { indice: 21, encabezado: 'PARTIDO', campo: 'partido', tipo: 'texto' },
  { indice: 22, encabezado: 'ID_PARTIDO', campo: 'idPartido', tipo: 'texto' },
  { indice: 23, encabezado: 'FLAG_RD', campo: 'flagRD', tipo: 'booleano' },
  { indice: 24, encabezado: 'FLAG_NR', campo: 'flagNR', tipo: 'booleano' },
  { indice: 25, encabezado: 'FLAG_RGC', campo: 'flagRGC', tipo: 'booleano' },
  { indice: 26, encabezado: 'FLAG_E_FVF', campo: 'flagEFVF', tipo: 'booleano' },
  { indice: 27, encabezado: 'FLAG_CD_FIFA', campo: 'flagCDFIFA', tipo: 'booleano' },
  { indice: 28, encabezado: 'FLAG_LODAFEF', campo: 'flagLODAFEF', tipo: 'booleano' },
  { indice: 29, encabezado: 'FLAG_RP1_LOD', campo: 'flagRP1LOD', tipo: 'booleano' },
  { indice: 30, encabezado: 'FLAG_OFICIO_COMPETICIONES', campo: 'flagOficioCompetencias', tipo: 'booleano' },
  { indice: 31, encabezado: 'FLAG_OFICIO_LICENCIAS', campo: 'flagOficioLicencias', tipo: 'booleano' },
  { indice: 32, encabezado: 'FLAG_OFICIO_CNA', campo: 'flagOficioCNA', tipo: 'booleano' },
  { indice: 33, encabezado: 'FLAG_OFICIO_INTEGRIDAD', campo: 'flagOficioIntegridad', tipo: 'booleano' },
  { indice: 34, encabezado: '_REINTEGRO', campo: 'reintegro', tipo: 'booleano' },
  { indice: 35, encabezado: 'ALERTA_SUSPENSION_ACUMULACION', campo: 'alertaSuspension', tipo: 'booleano' },
  { indice: 36, encabezado: 'TIPO_DE_INFRACCIÓN', campo: 'tipoInfraccion', tipo: 'texto' },
  { indice: 37, encabezado: 'ID PARTIDO', campo: 'idPartidoAlt', tipo: 'texto' },
];

const CAMPOS_EXPEDIENTES: readonly CampoContrato[] = [
  { indice: 0, encabezado: 'N EXP', campo: 'numero', tipo: 'texto', obligatorio: true, muestra: true },
  { indice: 1, encabezado: 'AÑO', campo: 'anio', tipo: 'entero', obligatorio: true, min: 2000, max: 2100, muestra: true },
  { indice: 2, encabezado: 'AUTO DE ENTRADA (A.E.) O INICIO DE INVESTIGACIÓN', campo: 'autoEntrada', tipo: 'texto' },
  { indice: 3, encabezado: 'FECHA AUTO DE ENTRADA', campo: 'fechaAutoEntrada', tipo: 'fecha', muestra: true },
  { indice: 4, encabezado: 'MOTIVO', campo: 'motivo', tipo: 'texto', maxLongitud: 500, muestra: true },
  { indice: 5, encabezado: 'ASUNTO DE EXP', campo: 'asunto', tipo: 'texto', maxLongitud: 300 },
  { indice: 6, encabezado: 'PARTE DEMANDANTE', campo: 'demandante', tipo: 'texto', maxLongitud: 300 },
  { indice: 7, encabezado: 'PARTE DEMANDADA', campo: 'demandada', tipo: 'texto', maxLongitud: 300 },
  { indice: 8, encabezado: 'TORNEO O CATEGORIA', campo: 'torneo', tipo: 'texto' },
  { indice: 9, encabezado: 'EQUIPOS', campo: 'equipos', tipo: 'texto', maxLongitud: 300 },
  { indice: 10, encabezado: 'TRÁMITE', campo: 'tramite', tipo: 'texto' },
  { indice: 11, encabezado: 'MODALIDAD', campo: 'modalidad', tipo: 'texto' },
  { indice: 12, encabezado: 'ASIGNADO', campo: 'asignado', tipo: 'texto', maxLongitud: 300 },
  { indice: 13, encabezado: 'STATUS', campo: 'status', tipo: 'texto', maxLongitud: 300 },
  { indice: 14, encabezado: 'FECHA DE ASIGNACIÓN', campo: 'fechaAsignacion', tipo: 'fecha' },
  { indice: 15, encabezado: 'FECHA DE SEGUIMIENTO', campo: 'fechaSeguimiento', tipo: 'fecha' },
  { indice: 16, encabezado: 'ALERTA', campo: 'alerta', tipo: 'texto', maxLongitud: 300 },
  { indice: 17, encabezado: 'FECHA DE AUTO Y/O DECISIÓN', campo: 'fechaDecision', tipo: 'fecha', muestra: true },
  { indice: 18, encabezado: 'AÑO', campo: 'anioDecision', tipo: 'entero', min: 2000, max: 2100 },
  { indice: 19, encabezado: 'MES', campo: 'mes', tipo: 'texto' },
  { indice: 20, encabezado: 'N° AUTO Y/O DECISIÓN', campo: 'numeroDecision', tipo: 'texto' },
  { indice: 21, encabezado: 'DECISIÓN', campo: 'decision', tipo: 'texto', maxLongitud: 1000 },
  { indice: 22, encabezado: 'N° DE USURPACIÓN Y FECHA', campo: 'usurpacion', tipo: 'texto', maxLongitud: 300 },
  { indice: 23, encabezado: 'SEGUNDA DECISIÓN', campo: 'segundaDecision', tipo: 'texto', maxLongitud: 300 },
  { indice: 24, encabezado: 'EJERCIERON RECONSIDERACIÓN O APELACIÓN', campo: 'reconsideracion', tipo: 'texto', maxLongitud: 500 },
  { indice: 25, encabezado: 'FECHA R.R. O R.A.', campo: 'fechaRR', tipo: 'fecha' },
  { indice: 26, encabezado: 'NRO. DECISIÓN', campo: 'nroDecision2', tipo: 'texto' },
  { indice: 27, encabezado: 'FECHA DE EMISIÓN', campo: 'fechaEmision', tipo: 'fecha' },
  { indice: 28, encabezado: 'DECISIÓN', campo: 'decision2', tipo: 'texto', maxLongitud: 1000 },
  { indice: 29, encabezado: 'OBSERVACIONES', campo: 'observaciones', tipo: 'texto', maxLongitud: 1000 },
  { indice: 30, encabezado: 'SANCIÓN', campo: 'sancion', tipo: 'texto', maxLongitud: 1000, muestra: true },
  { indice: 31, encabezado: 'SANCIONADO', campo: 'sancionado', tipo: 'texto', maxLongitud: 300 },
  { indice: 32, encabezado: 'MULTA UCFVF', campo: 'multaUc', tipo: 'uc', min: 0, max: 1000000, muestra: true },
  { indice: 33, encabezado: 'MULTA $', campo: 'multaUsd', tipo: 'usd', min: 0, max: 10000000, muestra: true },
  { indice: 34, encabezado: 'CUMPLIMIENTO DE LA DECISIÓN', campo: 'cumplimiento', tipo: 'texto', maxLongitud: 300 },
  { indice: 35, encabezado: 'MOTIVO', campo: 'motivoCumplimiento', tipo: 'texto', maxLongitud: 300 },
];

/** Fecha de referencia del expediente: decision > segunda instancia > entrada. */
function fechaRef(v: Record<string, unknown>): string | null {
  return (v['fechaDecision'] as string | null) ?? (v['fechaRR'] as string | null) ?? (v['fechaAutoEntrada'] as string | null);
}

export const CONTRATOS: Record<'competencias' | 'expedientes', Contrato> = {
  competencias: {
    documento: 'COMPETENCIAS',
    version: '1.0',
    campos: CAMPOS_COMPETENCIAS,
    reglas: ({ valores }) => {
      const h: Hallazgo[] = [];
      const fecha = valores['fecha'] as string | null;
      const tipo = String(valores['tipo'] ?? '').toUpperCase();

      // La columna TIPO_DE_INFRACCIÓN trae #NAME? en la mitad de las filas por
      // una BUSCARX rota. No invalida la fila: se anula y se avisa.
      if (String(valores['tipoInfraccion'] ?? '').startsWith('#')) {
        h.push({
          codigo: 'FORMULA_ROTA',
          campo: 'tipoInfraccion',
          mensaje: 'La hoja trae un error de formula en TIPO_DE_INFRACCIÓN; se guarda nulo y se deduce del catálogo.',
          valor: String(valores['tipoInfraccion']),
        });
        valores['tipoInfraccion'] = null;
      }

      if (!valores['cedula'] && !valores['club']) {
        h.push({
          codigo: 'SIN_SUJETO',
          campo: 'cedula',
          mensaje: 'La fila no identifica ni a una persona (cédula) ni a un club.',
        });
      }
      if (!valores['norma']) {
        h.push({ codigo: 'SIN_NORMA', campo: 'norma', mensaje: 'No cita norma.' });
      }
      if (tipo === 'MULTA' && valores['uc'] === null) {
        h.push({ codigo: 'MULTA_SIN_UC', campo: 'uc', mensaje: 'Es una multa pero no trae monto en U.C.' });
      }
      if (tipo === 'SUSPENSION' && valores['sancionJuegos'] === null && !valores['sancionTiempo']) {
        h.push({
          codigo: 'SUSPENSION_SIN_PLAZO',
          campo: 'sancionJuegos',
          mensaje: 'Suspensión sin partidos ni tiempo indicado.',
        });
      }
      if (fecha) {
        const anio = Number(fecha.slice(0, 4));
        const hoy = new Date().getUTCFullYear();
        if (anio < 2000) {
          h.push({ codigo: 'FECHA_ANTIGUA', campo: 'fecha', mensaje: `Fecha anterior al año 2000 (${fecha}).`, valor: fecha });
        } else if (anio > hoy + 1) {
          h.push({ codigo: 'FECHA_FUTURA', campo: 'fecha', mensaje: `Fecha futura (${fecha}).`, valor: fecha });
        }
      }
      const citas = partirLista(valores['articulos'] as string | null);
      if (citas.length > 20) {
        h.push({
          codigo: 'MUCHAS_CITAS',
          campo: 'articulos',
          mensaje: `La fila cita ${citas.length} artículos; revise si es un pegado accidental.`,
          valor: String(citas.length),
        });
      }
      return h;
    },
  },

  expedientes: {
    documento: 'EXPEDIENTES',
    version: '1.0',
    campos: CAMPOS_EXPEDIENTES,
    // Las 9.981 filas con solo "$0" en Multa $ son una formula arrastrada, no
    // expedientes. Se descartan antes de entrar a staging.
    esArtefacto: (fila) => {
      const numero = (fila[0] ?? '').trim();
      if (!numero || !/\d/.test(numero)) return 'SIN_NUMERO_EXPEDIENTE';
      return null;
    },
    reglas: ({ valores }) => {
      const h: Hallazgo[] = [];
      const uc = valores['multaUc'] as number | null;
      const usd = valores['multaUsd'] as number | null;

      if (uc !== null && uc > 0 && usd === null) {
        h.push({
          codigo: 'MULTA_SIN_USD',
          campo: 'multaUsd',
          mensaje: 'Hay U.C. pero no monto en dólares: no se puede conciliar hasta cargar la tasa BCV.',
          valor: String(uc),
        });
      }
      if (usd !== null && usd > 0 && (uc === null || uc === 0)) {
        h.push({
          codigo: 'USD_SIN_UC',
          campo: 'multaUc',
          mensaje: 'Hay monto en dólares pero no en U.C.',
          valor: String(usd),
        });
      }
      if (!valores['status'] && !valores['tramite']) {
        h.push({ codigo: 'SIN_ESTADO', campo: 'status', mensaje: 'Sin STATUS ni Trámite: queda como RECIBIDO.' });
      }
      const entrada = valores['fechaAutoEntrada'] as string | null;
      const resolucion = fechaRef(valores);
      if (entrada && resolucion && resolucion < entrada) {
        h.push({
          codigo: 'FECHAS_INVERTIDAS',
          campo: 'fechaDecision',
          mensaje: `La resolución (${resolucion}) es anterior a la entrada (${entrada}).`,
        });
      }
      if (valores['sancion'] && !valores['sancionado']) {
        h.push({
          codigo: 'SANCION_SIN_SANCIONADO',
          campo: 'sancionado',
          mensaje: 'Hay sanción escrita pero no dice a quién.',
        });
      }
      const anio = valores['anio'] as number | null;
      const anioRes = resolucion ? Number(resolucion.slice(0, 4)) : null;
      if (anio && anioRes && anioRes < anio) {
        h.push({
          codigo: 'ANIO_INCOHERENTE',
          campo: 'anio',
          mensaje: `Resolución de ${anioRes} para un expediente de ${anio}.`,
        });
      }
      return h;
    },
  },
};

/** Campos que se muestran en la vista previa de la web. */
export function camposDeMuestra(contrato: Contrato): CampoContrato[] {
  return contrato.campos.filter((c) => c.muestra);
}

/** Compara los encabezados del archivo con los del contrato (por posicion). */
export function compararEsquema(
  contrato: Contrato,
  encabezados: string[],
): { ok: boolean; faltantes: string[]; sobrantes: string[] } {
  const normalizados = encabezados.map((h) => h.trim().toUpperCase());
  const faltantes: string[] = [];
  const sobrantes: string[] = [];

  for (const c of contrato.campos) {
    const enArchivo = normalizados[c.indice];
    if (enArchivo === undefined || enArchivo === '') faltantes.push(`[${c.indice}] ${c.encabezado}`);
  }
  for (let i = contrato.campos.length; i < normalizados.length; i++) {
    const h = normalizados[i];
    if (h) sobrantes.push(`[${i}] ${h}`);
  }

  return { ok: faltantes.length === 0, faltantes, sobrantes };
}

/** Fecha de referencia de un expediente, exportada para el motor. */
export { fechaRef as fechaReferenciaExpediente };

/** Reexporta el parser de fechas para que las reglas y la UI usen el mismo. */
export { parseFecha as interpretarFecha };
