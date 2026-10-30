/**
 * Normalizacion de texto para claves de deduplicacion.
 * Remove acentos, mayusculas y caracteres no alfanumericos.
 */
export function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function slug(s: string): string {
  const base = sinAcentos(String(s))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'SIN_DEF';
}

/**
 * Normaliza codigos de articulo para deduplicar variantes de escritura.
 * "67 U.P" / "67 UP" / "67-UP"  ->  "67-UP"
 * "24 3"   / "24-3"              ->  "24-3"
 */
export function normalizarArticulo(codigo: string): string {
  let a = sinAcentos(codigo).toUpperCase().trim();
  a = a.replace(/\s*U\.?\s*P\.?\s*$/, '-UP');
  a = a.replace(/\s*-\s*/g, '-');
  a = a.replace(/\s+/g, ' ').trim();
  return a;
}

/** "APELACION DE SANCIÓN" -> "APELACION DE SANCION" */
export function normalizarClave(s: string): string {
  return sinAcentos(String(s))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** "1,67" | "1.67" | "1,67 U.C." -> 1.67 ; "N/A" -> null */
export function parseNumero(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || /^(n\/?a|s\/?a|nd|\-)$/i.test(s)) return null;
  const n = Number(s.replace(/,/g, '.').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Convierte "2025-01-01 00:00:00" o "01/01/2025" en Date UTC. */
export function parseFecha(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();

  // ISO: 2025-06-23 (el que emite el script de exportacion de la hoja).
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) {
    const [, a, m, d] = iso;
    if (a && m && d) return new Date(Date.UTC(+a, +m - 1, +d));
  }

  // Venezolano: dia/mes/anio. El caso "23-06-2025" confirma que el dia va
  // primero, porque 23 no puede ser un mes.
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
  if (dmy) {
    const [, d, m, a] = dmy;
    if (d && m && a) return new Date(Date.UTC(+a, +m - 1, +d));
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Marca de error de formula de la hoja (#NAME?, #N/A, #REF!, #VALUE!). */
export function esErrorFormula(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toUpperCase();
  return s.startsWith('#') || s.startsWith('=');
}
