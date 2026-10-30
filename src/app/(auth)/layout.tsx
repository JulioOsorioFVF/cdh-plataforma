import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ingresar',
  robots: { index: false, follow: false },
};

/**
 * Marco de las pantallas de acceso: sin barra lateral, centrado, con la
 * identidad del Consejo.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-vin-950">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="font-display text-[0.65rem] tracking-[0.3em] text-oro-500 uppercase">
              Federacion Venezolana de Futbol
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-white">
              Consejo de Honor
            </h1>
            <p className="mt-1 text-sm text-white/50">Plataforma de datos disciplinarios</p>
          </div>

          {children}

          <p className="mt-8 text-center text-xs text-white/35">
            Si no puede ingresar, solicite el alta al administrador del Consejo de Honor.{' '}
            <Link href="/" className="underline hover:text-white/60">
              Volver al inicio
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
