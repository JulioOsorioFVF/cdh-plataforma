/**
 * Token de sesion firmado.
 *
 * Formato: `v1.<carga-base64url>.<firma-base64url>`
 *
 * La carga es `{u, e, v}`:
 *   u -> id del usuario
 *   e -> instante de expiracion, en segundos epoch
 *   v -> version de la clave del usuario (`password_actualizado_en`)
 *
 * `v` es lo que permite cerrar todas las sesiones abiertas con solo cambiar la
 * contrasena: la comparacion contra la base invalida los tokens antiguos.
 *
 * Solo usa WebCrypto, que existe tanto en el runtime de Node como en el de
 * Edge, de modo que `middleware.ts` puede verificarlo sin `node:crypto`.
 */

const PREFIJO = 'v1';

export type CargaSesion = {
  /** Id del usuario. */
  u: number;
  /** Expiracion en segundos epoch. */
  e: number;
  /** Version de la clave: epoch en milisegundos, o 0 si nunca se ha cambiado. */
  v: number;
};

/** Nombre de la cookie de sesion. */
export const COOKIE_SESION = 'cdh_sesion';

/** Duracion de la sesion: 8 horas. */
export const DURACION_SESION_SEG = 8 * 60 * 60;

function aBase64Url(b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const base = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(base + '='.repeat((4 - (base.length % 4)) % 4));
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Copia a un buffer plano, que es lo que aceptan las APIs de WebCrypto. */
function aBuffer(b: Uint8Array): ArrayBuffer {
  const copia = new Uint8Array(b.length);
  copia.set(b);
  return copia.buffer;
}

let claveCache: Promise<CryptoKey> | null = null;

function claveFirma(): Promise<CryptoKey> {
  if (claveCache) return claveCache;

  const secreto = process.env.AUTH_SECRET;
  if (!secreto || secreto.length < 16) {
    return Promise.reject(
      new Error(
        'AUTH_SECRET ausente o demasiado corto. Definirlo en .env (openssl rand -base64 32).',
      ),
    );
  }

  claveCache = crypto.subtle
    .importKey(
      'raw',
      aBuffer(new TextEncoder().encode(secreto)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
    .catch((e: unknown) => {
      claveCache = null;
      throw e;
    });

  return claveCache;
}

/** Firma `datos` y devuelve la firma en base64url. */
async function firmar(datos: Uint8Array): Promise<string> {
  const clave = await claveFirma();
  const firma = await crypto.subtle.sign('HMAC', clave, aBuffer(datos));
  return aBase64Url(new Uint8Array(firma));
}

/**
 * Emite un token para `usuarioId` con la version de clave `versionClave`
 * (epoch en ms, o 0 si nunca se ha cambiado).
 */
export async function emitirToken(usuarioId: number, versionClave: number): Promise<string> {
  const carga: CargaSesion = {
    u: usuarioId,
    e: Math.floor(Date.now() / 1000) + DURACION_SESION_SEG,
    v: versionClave,
  };
  const cuerpo = aBase64Url(new TextEncoder().encode(JSON.stringify(carga)));
  return `${PREFIJO}.${cuerpo}.${await firmar(new TextEncoder().encode(cuerpo))}`;
}

/**
 * Verifica firma y expiracion. Devuelve la carga si el token es valido, o null
 * si esta mal formado, mal firmado, expirado o si el secreto no esta
 * configurado.
 */
export async function verificarToken(token: string | undefined): Promise<CargaSesion | null> {
  if (!token) return null;

  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [prefijo, cuerpo, firma] = partes as [string, string, string];
  if (prefijo !== PREFIJO || !cuerpo || !firma) return null;

  const datos = new TextEncoder().encode(cuerpo);
  let esperada: string;
  try {
    esperada = await firmar(datos);
  } catch {
    // AUTH_SECRET no configurado: se rechaza en vez de aceptar sin verificar.
    return null;
  }
  if (!comparacionSegura(firma, esperada)) return null;

  const bytes = deBase64Url(cuerpo);
  if (!bytes) return null;

  let carga: CargaSesion;
  try {
    carga = JSON.parse(new TextDecoder().decode(bytes)) as CargaSesion;
  } catch {
    return null;
  }

  if (
    typeof carga.u !== 'number' ||
    typeof carga.e !== 'number' ||
    typeof carga.v !== 'number'
  ) {
    return null;
  }
  if (carga.e * 1000 <= Date.now()) return null;

  return carga;
}

/** Compara dos firmas sin filtrar informacion por tiempo. */
function comparacionSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Opciones de la cookie de sesion. */
export function opcionesCookie(expiraEnSegundos: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: expiraEnSegundos,
  };
}
