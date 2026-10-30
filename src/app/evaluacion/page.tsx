import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Evaluación de la plataforma' };
export const dynamic = 'force-dynamic';

/**
 * Pagina de evaluacion: que se puede recorrer hoy, con cuantos datos, y que
 * falta por incorporar. Es publica a proposito (no muestra datos personales)
 * para poder compartirla con quien tenga que aprobar el avance.
 */

const HOY = [
  {
    href: '/',
    titulo: 'Portada',
    detalle: 'Presentacion publica del Consejo de Honor.',
    requiereSesion: false,
  },
  {
    href: '/ingresar',
    titulo: 'Acceso',
    detalle: 'Formulario de ingreso con clave scrypt y sesion firmada.',
    requiereSesion: false,
  },
  {
    href: '/dashboard',
    titulo: 'Tablero general',
    detalle: 'KPIs, tipos de decision, ranking de clubes y evolucion mensual.',
    requiereSesion: true,
  },
  {
    href: '/expedientes',
    titulo: 'Expedientes',
    detalle: 'Tabla pivotable con filtros, multas y graficos.',
    requiereSesion: true,
  },
] as const;

const VIENE = [
  {
    modulo: 'Sanciones',
    ruta: '/sanciones',
    aporta: 'Detalle navegable de las 27.554 sanciones: por norma, articulo, persona y jornada.',
    estado: 'Siguiente',
  },
  {
    modulo: 'Usuarios y roles',
    ruta: '/usuarios',
    aporta: 'Alta, baja y cambio de rol sin tocar la base. Hoy solo los crea el seed.',
    estado: 'Siguiente',
  },
  {
    modulo: 'Incidencias',
    ruta: '/incidencias',
    aporta: 'Licencias de club: estado, vencimientos y sanciones asociadas.',
    estado: 'Planificado',
  },
  {
    modulo: 'Administracion y multas',
    ruta: '/administracion',
    aporta: 'Saldos por club, cobros y conciliacion con la tasa BCV.',
    estado: 'Planificado',
  },
  {
    modulo: 'Plan de accion',
    ruta: '/inspiracional',
    aporta: 'Objetivos, pilares y KPIs de gestion del Consejo.',
    estado: 'Planificado',
  },
  {
    modulo: 'Actas y OCR',
    ruta: '/ocr',
    aporta: 'Carga de actas en PDF/Word y extraccion asistida de sanciones.',
    estado: 'Planificado',
  },
  {
    modulo: 'Sincronizacion',
    ruta: '/ingesta',
    aporta: 'Disparar y auditar la ingesta desde la web, sin consola.',
    estado: 'Planificado',
  },
  {
    modulo: 'Auditoria',
    ruta: '/auditoria',
    aporta: 'Bitacora de quien cambio que, cuando y desde donde.',
    estado: 'Planificado',
  },
] as const;

const DEUDA = [
  ['Catalogo de las Normas Reguladoras', '2.868 citas de NR sin resolver; dim_articulo solo tiene el RD.'],
  ['Tasa BCV', '54 multas no cuadran con USD = UC x 3; falta dim_tasa_uc por fecha.'],
  ['Codigos basura en dim_articulo', '18 de 428 codigos no son articulos reales del RD.'],
  ['Texto de los articulos', 'dim_articulo.descripcion y .texto estan vacios.'],
  ['Vinculo expediente-persona', 'La hoja no trae cedula; personaId queda nula a proposito.'],
] as const;

type Conteos = {
  ok: boolean;
  sanciones: number;
  expedientes: number;
  personas: number;
  clubes: number;
};

async function contar(): Promise<Conteos> {
  try {
    const [sanciones, expedientes, personas, clubes] = await Promise.all([
      prisma.fact_sancion.count(),
      prisma.fact_expediente.count(),
      prisma.dim_persona.count(),
      prisma.dim_club.count(),
    ]);
    return { ok: true, sanciones, expedientes, personas, clubes };
  } catch {
    return { ok: false, sanciones: 0, expedientes: 0, personas: 0, clubes: 0 };
  }
}

export default async function EvaluacionPage() {
  const c = await contar();
  const hoy = new Date().toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-vin-900">Evaluacion de la plataforma</h1>
          <p className="text-sm text-ink-soft">
            Consejo de Honor FVF · estado al {hoy}
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-accent">
          Abrir el tablero
        </Link>
      </header>

      <section aria-label="Datos cargados">
        <h2 className="mb-3 font-display text-sm font-semibold tracking-wider text-ink-soft uppercase">
          Datos en la base
        </h2>
        {c.ok ? (
          <div className="kpi-grid">
            <div className="card p-5">
              <p className="text-xs tracking-wide text-ink-faint uppercase">Sanciones</p>
              <p className="mt-1 text-3xl font-semibold text-vin-900 tabular-nums">
                {c.sanciones.toLocaleString('es-VE')}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs tracking-wide text-ink-faint uppercase">Expedientes</p>
              <p className="mt-1 text-3xl font-semibold text-vin-900 tabular-nums">
                {c.expedientes.toLocaleString('es-VE')}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs tracking-wide text-ink-faint uppercase">Personas</p>
              <p className="mt-1 text-3xl font-semibold text-vin-900 tabular-nums">
                {c.personas.toLocaleString('es-VE')}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs tracking-wide text-ink-faint uppercase">Clubes</p>
              <p className="mt-1 text-3xl font-semibold text-vin-900 tabular-nums">
                {c.clubes.toLocaleString('es-VE')}
              </p>
            </div>
          </div>
        ) : (
          <div className="card border-l-4 border-l-vene-rojo p-5 text-sm text-ink-soft">
            No se pudo consultar la base en este momento. Las cifras se muestran en cuanto
            haya conexion.
          </div>
        )}
      </section>

      <section aria-label="Modulos disponibles">
        <h2 className="mb-3 font-display text-sm font-semibold tracking-wider text-ink-soft uppercase">
          Lo que ya se puede recorrer
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {HOY.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="card block p-5 transition hover:border-vene-rojo"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-vin-900">{m.titulo}</h3>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-soft">
                  {m.requiereSesion ? 'con sesion' : 'publico'}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{m.detalle}</p>
              <p className="mt-3 font-mono text-xs text-ink-faint">{m.href}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Proximos modulos">
        <h2 className="mb-3 font-display text-sm font-semibold tracking-wider text-ink-soft uppercase">
          Lo que falta por incorporar
        </h2>
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Modulo</th>
                <th>Ruta</th>
                <th>Que aporta</th>
                <th className="text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {VIENE.map((m) => (
                <tr key={m.ruta}>
                  <td className="font-medium whitespace-nowrap">{m.modulo}</td>
                  <td className="font-mono text-xs text-ink-faint">{m.ruta}</td>
                  <td className="text-sm text-ink-soft">{m.aporta}</td>
                  <td className="text-right">
                    <span
                      className={
                        m.estado === 'Siguiente'
                          ? 'rounded-full bg-vene-rojo/10 px-2 py-0.5 text-xs font-medium text-vene-rojo'
                          : 'rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-soft'
                      }
                    >
                      {m.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Deuda tecnica">
        <h2 className="mb-3 font-display text-sm font-semibold tracking-wider text-ink-soft uppercase">
          Deuda tecnica conocida
        </h2>
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tema</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {DEUDA.map(([tema, estado]) => (
                <tr key={tema}>
                  <td className="font-medium whitespace-nowrap">{tema}</td>
                  <td className="text-sm text-ink-soft">{estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="border-t border-ink-faint/25 pt-4 text-xs text-ink-faint">
        Pagina publica de evaluacion. No expone datos personales: solo conteos agregados.
        Detalle tecnico en <span className="font-mono">docs/SETUP.md</span>.
      </footer>
    </div>
  );
}
