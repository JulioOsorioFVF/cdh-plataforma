import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hash y verificacion de contrasenias. SOLO SERVIDOR.
 *
 * Usa scrypt de node:crypto (no hace falta instalar bcrypt ni argon2). El
 * formato guardado es:
 *
 *   scrypt$N$r$p$<sal-hex>$<hash-hex>
 *
 * Los parametros viajan en el propio hash, de modo que endurecerlos en el
 * futuro no invalida las contrasenas ya guardadas: cada verificacion usa los
 * valores con los que fue creada su clave.
 *
 * Las reglas de composicion viven en `reglas.ts`, que es puro y si puede
 * importarse desde el navegador.
 */

// scrypt: N=16384 r=8 p=1 -> ~16 MB de memoria por hash. Es el valor por
// defecto de Node y el recomendado por OWASP para ingresos interactivos.
const N = 16384;
const R = 8;
const P = 1;
const LONGITUD_CLAVE = 64;

/** Parametros de derivacion leidos del hash, con validacion. */
type Parametros = { n: number; r: number; p: number; sal: Buffer; esperado: Buffer };

function leerParametros(hashAlmacenado: string): Parametros | null {
  const partes = hashAlmacenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return null;

  const n = Number(partes[1]);
  const r = Number(partes[2]);
  const p = Number(partes[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (n < 2 || (n & (n - 1)) !== 0) return null; // N debe ser potencia de dos
  if (r < 1 || p < 1) return null;

  const salHex = partes[4];
  const hashHex = partes[5];
  if (!salHex || !hashHex) return null;
  if (!/^[0-9a-f]*$/i.test(salHex) || !/^[0-9a-f]*$/i.test(hashHex)) return null;

  const esperado = Buffer.from(hashHex, 'hex');
  if (esperado.length !== LONGITUD_CLAVE) return null;

  return { n, r, p, sal: Buffer.from(salHex, 'hex'), esperado };
}

/** Calcula el hash scrypt de `clave` con la sal y los parametros dados. */
function derivar(clave: string, sal: Buffer, n: number, r: number, p: number): Buffer {
  return scryptSync(Buffer.from(clave.normalize('NFKC'), 'utf8'), sal, LONGITUD_CLAVE, {
    N: n,
    r,
    p,
    maxmem: 256 * 1024 * 1024,
  });
}

/**
 * Devuelve el hash almacenable de `clave`. Dos llamadas con la misma clave dan
 * sal distinta, por lo que el hash nunca es reversible por comparacion.
 */
export function hashearContrasena(clave: string): string {
  const sal = randomBytes(16);
  const hash = derivar(clave, sal, N, R, P);
  return ['scrypt', N, R, P, sal.toString('hex'), hash.toString('hex')].join('$');
}

/**
 * Comprueba `clave` contra `hashAlmacenado` en tiempo constante.
 * Devuelve false ante cualquier hash corrupto o de otro formato, para que un
 * registro danado no provoque una excepcion en medio de un ingreso.
 */
export function verificarContrasena(clave: string, hashAlmacenado: string): boolean {
  const prm = leerParametros(hashAlmacenado);
  if (!prm) return false;

  let calculado: Buffer;
  try {
    calculado = derivar(clave, prm.sal, prm.n, prm.r, prm.p);
  } catch {
    return false;
  }

  return timingSafeEqual(calculado, prm.esperado);
}
