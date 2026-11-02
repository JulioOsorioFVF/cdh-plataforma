/**
 * Estandarizacion de valores de entrada.
 *
 * Todo lo que llega por la web o por Google Sheets pasa por aqui antes de
 * tocar las tablas de hechos. Las funciones son PURAS (no consultan la base ni
 * el reloj) para poder probarlas y para que el mismo texto produzca siempre el
 * mismo resultado: eso es lo que hace que la ingesta sea idempotente.
 *
 * Regla de oro: ante un valor que no se entiende se devuelve `null` y un
 * motivo, nunca un valor inventado. Un cero o una fecha falsa es peor que un
 * nulo, porque entra al tablero como si fuera un dato.
 */
import { esNulo, parseFecha, parseNumero, textoONulo } from './util';

export type TipoDato =
  | 'texto'
  | 'fecha'
  | 'entero'
  | 'decimal'
  | 'uc'
  | 'usd'
  | 'booleano'
  | 'cedula';

/** Resultado de convertir una celda al tipo declarado por el contrato. */
export type Conversion =
  | { ok: true; valor: string | number | boolean | null }
  | { ok: false; valor: null; motivo: string };

/** Quita BOM, caracteres invisibles y espacios repetidos. */
export function limpiar(v: string | null | undefined): string {
  if (v === null || v === undefined) return '';
  return v
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Encabezado canonico: sin acentos, sin signos, en mayusculas y con un solo espacio. */
export function normalizarEncabezado(h: string): string {
  return limpiar(h)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** "V-12.345.678" / "12345678" / "E 81.234.567" -> "V12345678". */
export function normalizarCedula(v: string): string | null {
  const t = limpiar(v).toUpperCase();
  if (!t) return null;
  const m = t.match(/^([VEJPG])?[-\s]?([\d.]+)$/);
  if (!m) {
    const soloDigitos = t.replace(/\D/g, '');
    return soloDigitos.length >= 5 ? soloDigitos : null;
  }
  const numero = (m[2] ?? '').replace(/\D/g, '');
  if (numero.length < 5) return null;
  return `${m[1] ?? ''}${numero}`;
}

/** "SI", "Sí", "X", "1", "TRUE", "VERDADERO" -> true; "NO", "0", "FALSE" -> false. */
export function aBooleano(v: string): boolean | null {
  const t = normalizarEncabezado(v);
  if (!t) return null;
  if (['SI', 'S', 'X', '1', 'TRUE', 'VERDADERO', 'YES', 'Y'].includes(t)) return true;
  if (['NO', 'N', '0', 'FALSE', 'FALSO', 'NINGUNO', 'NINGUNA'].includes(t)) return false;
  return null;
}

/** Quita la unidad del texto antes de parsear: "1.234,50 UC" -> 1234.5. */
export function aUc(v: string): number | null {
  const t = limpiar(v)
    .replace(/\bU\.?\s?C\.?\b/gi, '')
    .replace(/\bUCFVF\b/gi, '')
    .replace(/\bUC\b/gi, '')
    .trim();
  if (!t) return null;
  return parseNumero(t);
}

/** "USD 1.200,50", "$ 350", "Bs. 8.000" -> numero. */
export function aUsd(v: string): number | null {
  const t = limpiar(v)
    .replace(/\bUSD\b/gi, '')
    .replace(/\bBS\.?\b/gi, '')
    .replace(/\bBOLIVARES\b/gi, '')
    .replace(/\$/g, '')
    .trim();
  if (!t) return null;
  return parseNumero(t);
}

/** Convierte una celda al tipo del contrato. */
export function convertir(tipo: TipoDato, crudo: string): Conversion {
  const v = limpiar(crudo);

  if (tipo === 'texto') return { ok: true, valor: textoONulo(v) };

  // Una celda vacia no es un error: es un nulo legitimo. La obligatoriedad la
  // decide la regla del contrato, no el conversor.
  if (esNulo(v)) return { ok: true, valor: null };

  if (tipo === 'fecha') {
    const f = parseFecha(v);
    return f ? { ok: true, valor: f } : { ok: false, valor: null, motivo: `fecha no reconocida: "${v}"` };
  }

  if (tipo === 'entero') {
    const n = parseNumero(v);
    return n !== null && Number.isFinite(n)
      ? { ok: true, valor: Math.trunc(n) }
      : { ok: false, valor: null, motivo: `numero entero no reconocido: "${v}"` };
  }

  if (tipo === 'decimal') {
    const n = parseNumero(v);
    return n !== null
      ? { ok: true, valor: n }
      : { ok: false, valor: null, motivo: `numero no reconocido: "${v}"` };
  }

  if (tipo === 'uc') {
    const n = aUc(v);
    return n !== null
      ? { ok: true, valor: n }
      : { ok: false, valor: null, motivo: `unidad de cuenta no reconocida: "${v}"` };
  }

  if (tipo === 'usd') {
    const n = aUsd(v);
    return n !== null
      ? { ok: true, valor: n }
      : { ok: false, valor: null, motivo: `monto en dolares no reconocido: "${v}"` };
  }

  if (tipo === 'booleano') {
    const b = aBooleano(v);
    return b !== null
      ? { ok: true, valor: b }
      : { ok: false, valor: null, motivo: `valor logico no reconocido: "${v}"` };
  }

  const cedula = normalizarCedula(v);
  return cedula
    ? { ok: true, valor: cedula }
    : { ok: false, valor: null, motivo: `cedula no reconocida: "${v}"` };
}

/**
 * Parte una celda multivalor ("NR, RD", "RD-67-6; RD-68") en elementos.
 *
 * `esCitaVacia` se aplica aparte para que "S/A" y "NINGUNO" no se conviertan
 * en citas de norma.
 */
export function partirLista(v: string | null, separadores = /[,;]/): string[] {
  if (!v) return [];
  return limpiar(v)
    .split(separadores)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
