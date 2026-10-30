import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { COOKIE_SESION, verificarToken } from '@/lib/auth/token';

/**
 * Sesion del usuario.
 *
 * El token de la cookie es solo una afirmacion firmada: aqui se contrasta
 * contra la base (activo, version de la clave) para que revocar el acceso de
 * una persona sea inmediato y no dependa de que expire la cookie.
 */

export type Sesion = {
  id: number;
  email: string;
  nombre: string;
  debeCambiarPassword: boolean;
  cambiosPassword: number;
  /** Codigos de rol del usuario. */
  roles: string[];
  /** Permisos efectivos, resueltos a traves de los roles. */
  permisos: string[];
};

/** Version de la clave de un usuario: epoch en ms, o 0 si nunca se cambio. */
export function versionClave(passwordActualizadoEn: Date | null): number {
  return passwordActualizadoEn ? passwordActualizadoEn.getTime() : 0;
}

/**
 * Lee la sesion actual, o null si no hay cookie valida, si el usuario esta
 * inactivo, o si la clave cambio despues de emitir el token.
 *
 * Envuelto en `cache` de React: un mismo render no repite la consulta aunque
 * la pidan el layout y la pagina.
 */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  const carga = await verificarToken(token);
  if (!carga) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: carga.u },
    select: {
      id: true,
      email: true,
      nombre: true,
      activo: true,
      debeCambiarPassword: true,
      cambiosPassword: true,
      passwordActualizadoEn: true,
      roles: {
        select: {
          rol: {
            select: {
              codigo: true,
              permisos: { select: { permiso: { select: { codigo: true } } } },
            },
          },
        },
      },
    },
  });

  if (!usuario || !usuario.activo) return null;
  if (carga.v !== versionClave(usuario.passwordActualizadoEn)) return null;

  const roles: string[] = [];
  const permisos = new Set<string>();
  for (const { rol } of usuario.roles) {
    roles.push(rol.codigo);
    for (const p of rol.permisos) permisos.add(p.permiso.codigo);
  }

  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    debeCambiarPassword: usuario.debeCambiarPassword,
    cambiosPassword: usuario.cambiosPassword,
    roles,
    permisos: [...permisos],
  };
});

/**
 * Sesion obligatoria. Redirige a `/ingresar` conservando la ruta de destino,
 * y a `/cambiar-password` si la clave sigue siendo la estandar.
 *
 * Pensado para el layout de `(dashboard)` y para las acciones de escritura.
 */
export async function requiereSesion(): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect(`/ingresar?next=${encodeURIComponent(await rutaSolicitada())}`);
  return sesion;
}

/** Redirige a `/cambiar-password` mientras la clave siga siendo la estandar. */
export async function exigeCambioDeClave(sesion: Sesion): Promise<void> {
  if (sesion.debeCambiarPassword) redirect('/cambiar-password');
}

/** Sesion obligatoria, con cambio de clave hecho y con un permiso concreto. */
export async function requierePermiso(codigo: string): Promise<Sesion> {
  const sesion = await requiereSesion();
  await exigeCambioDeClave(sesion);
  if (!sesion.permisos.includes(codigo)) {
    redirect(`/dashboard?sinPermiso=${encodeURIComponent(codigo)}`);
  }
  return sesion;
}

/** Indica si la sesion actual tiene el permiso dado. */
export function tienePermiso(sesion: Sesion | null, codigo: string): boolean {
  return sesion?.permisos.includes(codigo) ?? false;
}

/** Indica si la sesion actual tiene alguno de los roles dados. */
export function tieneRol(sesion: Sesion | null, ...codigos: string[]): boolean {
  if (!sesion) return false;
  return sesion.roles.some((r) => codigos.includes(r));
}

/** Ruta que el visitante intento abrir, segun la deja el middleware. */
async function rutaSolicitada(): Promise<string> {
  const h = await headers();
  return h.get('x-ruta-solicitada') ?? '/dashboard';
}
