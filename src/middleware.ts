import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_SESION, verificarToken } from '@/lib/auth/token';

/**
 * Puerta de entrada.
 *
 * El middleware no puede consultar la base (corre en el runtime Edge), asi que
 * comprueba solo lo que el token afirma: que la firma es valida y que no ha
 * expirado. La comprobacion autorizada —usuario activo, version de la clave,
 * clave estandar pendiente de cambio, permisos— la hace
 * `requiereSesion()` en el servidor, que es la unica fuente de verdad.
 *
 * Si el token falla aqui, tambien falla alla: nadie entra por aqui.
 */

const SIN_SESION = '/ingresar';
const CON_SESION_INCOMPLETA = '/cambiar-password';

/** Rutas que se pueden abrir sin haber iniciado sesion. */
const PUBLICAS = new Set(['/', SIN_SESION, CON_SESION_INCOMPLETA, '/evaluacion']);

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;

  const token = req.cookies.get(COOKIE_SESION)?.value;
  const carga = await verificarToken(token);

  // Ya tiene sesion: no tiene sentido mostrarle el formulario de ingreso.
  if (carga && (pathname === SIN_SESION || pathname === CON_SESION_INCOMPLETA)) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (carga && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (PUBLICAS.has(pathname)) return NextResponse.next();

  if (!carga) {
    const destino = new URL(SIN_SESION, req.url);
    destino.searchParams.set('next', pathname + search);
    const respuesta = NextResponse.redirect(destino);
    respuesta.cookies.delete(COOKIE_SESION);
    return respuesta;
  }

  // La ruta de destino viaja como encabezado para que `requiereSesion()`
  // pueda devolver al visitante exactamente donde se iba, sin duplicarla
  // en la URL.
  const cabeceras = new Headers(req.headers);
  cabeceras.set('x-ruta-solicitada', pathname + search);
  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  matcher: [
    /*
     * Todo menos los estaticos de Next y los archivos publicos.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)',
  ],
};
