import Link from 'next/link';
import { obtenerSesion } from '@/server/auth/sesion';

export const metadata = {
  title: 'Consejo de Honor FVF',
  description: 'Plataforma de Big Data Disciplinaria del Fútbol Venezolano',
};

export const dynamic = 'force-dynamic';

/**
 * Portada. Es la unica pagina publica de la aplicacion: muestra el estado de
 * la sesion y da paso a la pantalla de ingreso o al tablero.
 */
export default async function RootPage() {
  const sesion = await obtenerSesion();

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-2xl">
        <div className="card animate-fade-up p-10 text-center">
          <p className="font-display text-xs tracking-[0.3em] text-oro-600 uppercase">
            Federación Venezolana de Fútbol
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-vin-900">Consejo de Honor</h1>
          <p className="mt-4 text-ink-soft">
            Plataforma de Big Data Disciplinaria: sanciones, expedientes, actas y KPIs.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {sesion ? (
              <>
                <Link href="/dashboard" className="btn btn-primary">
                  Ir al tablero
                </Link>
                <Link href="/cambiar-password" className="btn btn-outline">
                  Cambiar contrasena
                </Link>
              </>
            ) : (
              <Link href="/ingresar" className="btn btn-primary">
                Ingresar
              </Link>
            )}
          </div>

          {sesion ? (
            <p className="mt-6 text-xs text-ink-faint">
              Sesion de {sesion.email}
              {sesion.debeCambiarPassword ? ' — debe cambiar su contrasena' : ''}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
