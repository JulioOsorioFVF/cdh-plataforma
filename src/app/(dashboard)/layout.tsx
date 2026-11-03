import Link from 'next/link';
import { exigeCambioDeClave, requiereSesion } from '@/server/auth/sesion';
import { BotonAsistenteIA } from '@/components/ia/boton-asistente-ia';
import { SidebarInteractivo } from '@/components/navegacion/sidebar-interactivo';

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
    <div className="flex min-h-dvh bg-slate-950 text-slate-100">
      {/* Barra Lateral Ocultable e Interactiva con Submenús */}
      <SidebarInteractivo
        usuario={{
          nombre: sesion.nombre,
          email: sesion.email,
          roles: sesion.roles,
          esAdmin,
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-vin-950/90 backdrop-blur-md px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Link
              href="/plataforma"
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-oro-500/10 hover:bg-oro-500/20 text-oro-400 border border-oro-500/30 transition flex items-center gap-1.5"
            >
              <span>🧭</span>
              <span className="hidden sm:inline">Suite de Funciones</span>
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <BotonAsistenteIA estilo="header" />
            <Link
              href="/cambiar-password"
              className="hidden text-xs text-slate-300 hover:text-white underline-offset-2 hover:underline lg:block"
            >
              {nombreCorto}
            </Link>
            <span className="badge semaforo-neutro">Local</span>
          </div>
        </header>

        <main id="contenido" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
          {children}
        </main>

        {/* Botón flotante del Asistente IA permanente en toda la plataforma */}
        <BotonAsistenteIA estilo="flotante" />
      </div>
    </div>
  );
}
