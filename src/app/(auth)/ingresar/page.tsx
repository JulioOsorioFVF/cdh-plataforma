import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { obtenerSesion } from '@/server/auth/sesion';
import { FormularioIngresar } from './formulario';

export const metadata: Metadata = {
  title: 'Ingresar',
  description: 'Acceso a la plataforma de datos disciplinarios del Consejo de Honor FVF.',
};

export const dynamic = 'force-dynamic';

/**
 * Pantalla de ingreso.
 *
 * Si ya hay sesion, el middleware redirige; esta comprobacion cubre el caso de
 * llegar por un enlace directo con la cookie recien emitida.
 */
export default async function PaginaIngresar({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  const sesion = await obtenerSesion();
  if (sesion) {
    redirect(sesion.debeCambiarPassword ? '/cambiar-password' : '/dashboard');
  }

  return (
    <>
      <h2 className="mb-4 text-center text-sm font-semibold tracking-wide text-white/80 uppercase">
        Acceso restringido
      </h2>
      <FormularioIngresar next={next ?? '/dashboard'} />
    </>
  );
}
