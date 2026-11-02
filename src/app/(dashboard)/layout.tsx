import Link from 'next/link';
import { NAVEGACION } from '@/lib/nav';
import { exigeCambioDeClave, requiereSesion } from '@/server/auth/sesion';
import { BotonSalir } from './salir';

/**
 * Marco de la aplicacion.
 *
 * `requiereSesion()` corre en el servidor: si no hay cookie valida, redirige a
 * `/ingresar` antes de que se llegue a renderizar nada. `exigeCambioDeClave`
 * hace lo propio con quien todavia usa la contrasena estandar, de modo que
 * ninguna pantalla de la plataforma es accesible antes de sustituirla.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requiereSesion();
  await exigeCambioDeClave(sesion);

  const nombreCorto = sesion.nombre.split(' ')[0] ?? sesion.nombre;
  const esAdmin = sesion.roles.includes('ADMINISTRADOR');

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="border-b border-border px-5 py-5">
          <p className="font-display text-[0.65rem] tracking-[0.25em] text-oro-700 uppercase">
            FVF
          </p>
          <p className="font-display text-lg leading-tight font-semibold text-vin-950">
            Consejo de Honor
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAVEGACION.map((seccion) => (
            <div key={seccion.grupo} className="mb-5">
              <p className="px-3 pb-2 text-[0.65rem] font-semibold tracking-widest text-ink-faint uppercase">
                {seccion.grupo}
              </p>
              <ul className="space-y-0.5">
                {seccion.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-md px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-2 hover:text-vin-950"
                    >
                      {item.etiqueta}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-5 py-4">
          <p className="text-xs text-ink-faint">Sesion activa</p>
          <p className="text-sm font-medium text-ink" title={sesion.email}>
            {sesion.nombre}
          </p>
          <p className="mb-2 text-[0.7rem] text-ink-faint">
            {esAdmin ? 'Administrador' : sesion.roles.join(', ')}
          </p>
          <BotonSalir />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-6">
          <div className="lg:hidden">
            <p className="font-display text-sm font-semibold text-vin-900">Consejo de Honor</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/cambiar-password"
              className="hidden text-xs text-ink-soft underline-offset-2 hover:underline lg:block"
            >
              {nombreCorto}
            </Link>
            <span className="badge semaforo-neutro">Local</span>
          </div>
        </header>

        <main id="contenido" className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
