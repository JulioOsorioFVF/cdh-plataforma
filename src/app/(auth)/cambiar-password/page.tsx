import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { obtenerSesion } from '@/server/auth/sesion';
import { FormularioCambiarContrasena, ReglasContrasena } from './formulario';

export const metadata: Metadata = { title: 'Cambiar contrasena' };

export const dynamic = 'force-dynamic';

/**
 * Cambio de contrasena.
 *
 * Es la pantalla a la que cae todo el mundo cuya clave sigue siendo la
 * estandar. Sin sesion no se llega aqui: se vuelve al ingreso.
 */
export default async function PaginaCambiarContrasena() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/ingresar?next=/cambiar-password');

  // Ya la cambio: no tiene sentido quedarse aqui.
  if (!sesion.debeCambiarPassword) redirect('/dashboard');

  const obligatorio = sesion.debeCambiarPassword;

  return (
    <>
      <h2 className="mb-2 text-center text-sm font-semibold tracking-wide text-white/80 uppercase">
        {obligatorio ? 'Debe cambiar su contrasena' : 'Cambiar contrasena'}
      </h2>

      {obligatorio ? (
        <p className="mb-4 rounded-md border border-oro-700/40 bg-oro-500/10 px-4 py-3 text-xs text-oro-200">
          Su cuenta esta usando la contrasena estandar. Elija una nueva para poder entrar a la
          plataforma.
        </p>
      ) : null}

      <p className="mb-4 text-center text-xs text-white/40">
        Sesion de <span className="text-white/70">{sesion.email}</span>
      </p>

      <FormularioCambiarContrasena />

      <ReglasContrasena />

      {obligatorio ? (
        <p className="mt-4 text-center text-xs text-white/35">
          No podra salir del sistema hasta cambiar la contrasena.{' '}
          <Link href="/cambiar-password" className="underline">
            Actualizar la pagina
          </Link>
        </p>
      ) : null}
    </>
  );
}
