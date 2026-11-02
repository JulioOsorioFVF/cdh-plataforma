/**
 * Utilidades compartidas por las dos ingestas.
 *
 * Todas las hojas traen el mismo estilo de "basura de hoja de calculo":
 * `#ERROR!`, `#N/A`, `#NAME?`, `N/A`, `NO`, guiones sueltos. Si eso se guarda
 * tal cual en una dimension, el tablero acaba mostrando "#NAME?" como si fuera
 * el nombre de un tipo de infraccion. Aqui se centraliza la limpieza.
 */

/** Valores que la hoja pone cuando no hay dato. */
const NULOS = new Set([
  '',
  '-',
  '--',
  '—',
  'n/a',
  'N/A',
  'na',
  'NA',
  'no',
  'NO',
  'No',
  '#error!',
  '#n/a',
  '#name?',
  '#ref!',
  '#value!',
  '#div/0!',
  '#null!',
  '#num!',
]);

/** Indica si la celda no contiene un dato utilizable. */
export function esNulo(v: string | null | undefined): boolean {
  if (v === null || v === undefined) return true;
  return NULOS.has(v.trim());
}

/**
 * Textos que en las columnas NORMA y ARTICULOS no son una cita sino la manera
 * que tiene la hoja de decir que no hay dato ("S/A"). Se comparan sin acentos,
 * espacios ni signos.
 *
 * Se mantiene aparte de `esNulo` a proposito: `esNulo` se aplica a nombres de
 * personas y clubes, y ahi "S/A" o "Na" podrian ser un nombre de verdad.
 */
const PLACEHOLDERS_CITA = new Set([
  'SA',
  'SN',
  'SININFORMACION',
  'SININFORMACIONS',
  'NINGUNO',
  'NINGUNA',
  'NOCITA',
  'NAN',
  'NONE',
  'X',
]);

/**
 * Indica si una celda de NORMA o ARTICULOS esta vacia en realidad.
 *
 * Sin esto, "S/A" se resolvia contra un articulo del catalogo que tiene ese
 * mismo codigo y la sancion quedaba con una cita que nadie escribio.
 */
export function esCitaVacia(v: string | null | undefined): boolean {
  if (v === null || v === undefined) return true;
  const t = v.trim();
  if (NULOS.has(t)) return true;
  return PLACEHOLDERS_CITA.has(compacta(t));
}

/** Devuelve el texto limpio, o `null` si la celda es de las que se descartan. */
export function textoONulo(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return NULOS.has(t) ? null : t;
}

/**
 * Quita acentos y pasa a mayusculas, para poder comparar nombres de clubes que
 * llegan escritos de varias formas ("Deportivo Táchira" / "DEPORTIVO TACHIRA").
 */
export function normalizar(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ºª]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Version sin separadores ni espacios, solo letras y digitos en mayusculas.
 *
 * Sirve para comparar codigos que la hoja y el catalogo escriben con
 * separadores distintos: "68 U.P", "68-U.P" y "68UP" son el mismo articulo,
 * mientras que `normalizar` los dejaria como tres textos diferentes.
 */
export function compacta(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .toUpperCase();
}

/** Convierte a un `codigo` estable: sin acentos, en mayusculas y con guiones bajos. */
export function aCodigo(v: string, prefijo = ''): string {
  const base = normalizar(v)
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return prefijo && base ? `${prefijo}_${base}` : base || prefijo || 'SIN_CODIGO';
}

// -----------------------------------------------------------------------------
// FECHAS
// -----------------------------------------------------------------------------

/** Hash estable por fila, para que reejecutar la ingesta no duplique nada. */
export function hashFila(documento: string, partes: (string | null | undefined)[]): string {
  // FNV-1a de 64 bits en hexadecimal. Es determinista y no depende de crypto,
  // con lo que el mismo contenido produce siempre el mismo hash.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const s = `${documento}|${partes.map((p) => p ?? '').join('|')}`;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c + i, 2654435761) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/**
 * Interpreta una fecha de la hoja y devuelve `YYYY-MM-DD`, o `null` si no hay
 * fecha o no se reconoce el formato.
 *
 * La hoja mezcla al menos seis formatos distintos, asi que se prueban en orden
 * de especificidad. Devolver una fecha inventada seria peor que devolver null:
 * el tablero contaria sanciones en el mes equivocado.
 */
export function parseFecha(v: string | null | undefined): string | null {
  if (esNulo(v)) return null;
  const t = v!.trim();

  // Serial de Excel (base 1899-12-30). Google Sheets lo exporta como numero
  // cuando la celda no tiene formato de fecha.
  if (/^\d{5}$/.test(t)) {
    const n = Number(t);
    if (n > 20000 && n < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return iso(d);
    }
  }

  // 2025-03-14, 2025/03/14
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return validar(+m[1]!, +m[2]!, +m[3]!);

  // 14/03/2025, 14-03-2025, 14/03/25
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    const [, d, mes, a] = m;
    return validar(+a!, +mes!, +d!);
  }

  // 14-mar-2025, 14 de marzo de 2025
  m = t.match(/^(\d{1,2})[-\s](?:de\s+)?([a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,10})[-\s](?:de\s+)?(\d{2,4})/);
  if (m) {
    const mes = mesDesdeNombre(m[2]!);
    if (mes) return validar(Number(m[3]), mes, Number(m[1]));
  }

  // 14 marzo 2025
  m = t.match(/^(\d{1,2})\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,10})\s+(?:de\s+)?(\d{2,4})/);
  if (m) {
    const mes = mesDesdeNombre(m[2]!);
    if (mes) return validar(Number(m[3]), mes, Number(m[1]));
  }

  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : iso(d);
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'setiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function mesDesdeNombre(nombre: string): number | null {
  const n = normalizar(nombre).slice(0, 3);
  if (n === 'ene') return 1;
  if (n === 'abr' || n === 'abp') return 4;
  if (n === 'ago') return 8;
  if (n === 'dic') return 12;
  const i = MESES.findIndex((m) => m.startsWith(n));
  return i === -1 ? null : i + 1;
}

function validar(anio: number, mes: number, dia: number): string | null {
  if (anio < 100) anio += anio < 70 ? 2000 : 1900;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  // Descarta 31/02 y similares: Date normaliza al mes siguiente.
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Saca el ano de un texto que puede ser "2025", "01/01/2025" o "2025-2026". */
export function parseAnio(v: string | null | undefined): number | null {
  if (esNulo(v)) return null;
  const m = v!.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

// -----------------------------------------------------------------------------
// NUMEROS
// -----------------------------------------------------------------------------

/**
 * Convierte a numero tolerando los formatos que usa la hoja:
 * "1.234,56" ( Venezuela ), "1,234.56" (USA), "1,67", "$0", "12 partidos".
 */
export function parseNumero(v: string | null | undefined): number | null {
  if (esNulo(v)) return null;
  let t = v!.trim().replace(/[$€]/g, '').trim();
  if (t === '') return null;

  const ultimaComa = t.lastIndexOf(',');
  const ultimoPunto = t.lastIndexOf('.');

  if (ultimaComa > -1 && ultimoPunto > -1) {
    // El separador decimal es el que aparece mas a la derecha.
    if (ultimaComa > ultimoPunto) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
  } else if (ultimaComa > -1) {
    // "1,67" es decimal; "1,234" tambien (y "1,234" con 3 digitos es miles, pero
    // en estas columnas los importes nunca llegan a miles con separador).
    const partes = t.split(',');
    t =
      partes.length === 2 && partes[1]!.length <= 2 ? t.replace(',', '.') : t.replace(/,/g, '');
  }

  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Primer entero que aparece en un texto libre, p.ej. "Auto N° 009/2022" -> 9. */
export function primerEntero(v: string | null | undefined): number | null {
  if (esNulo(v)) return null;
  const m = v!.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Trocea "JOSE PEREZ, JUAN CARLOS" en ["JUAN CARLOS", "JOSE PEREZ"]. */
export function separarNombre(v: string): { apellidos: string | null; nombres: string | null } {
  const t = v.trim();
  if (!t) return { apellidos: null, nombres: null };
  if (t.includes(',')) {
    const [ap, ...resto] = t.split(',');
    return {
      apellidos: ap!.trim() || null,
      nombres: resto.join(',').trim() || null,
    };
  }
  return { apellidos: null, nombres: t };
}
