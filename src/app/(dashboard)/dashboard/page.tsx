import Link from 'next/link';
import { KpiCard } from '@/components/ui/kpi-card';
import { filtrosFromSearch } from '@/types/filtros';
import {
  getTotales,
  getDecisiones,
  getRankingClubes,
  getEvolucionMensual,
  getPorFuncion,
  seguro,
  type Totales,
  type FilaDecision,
  type FilaClub,
  type FilaMensual,
  type FilaFuncion,
} from '@/lib/datos/dashboard';

export const metadata = { title: 'Tablero general' };
export const dynamic = 'force-dynamic';

type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TOTALES_VACIOS: Totales | null = null;

export default async function DashboardPage({ searchParams }: Search) {
  const sp = await searchParams;
  const f = filtrosFromSearch(
    Object.fromEntries(
      Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? '') : (v ?? '')]),
    ),
  );

  const [t, dec, clubes, mensual, funcion] = await Promise.all([
    seguro(() => getTotales(f), TOTALES_VACIOS),
    seguro<FilaDecision[]>(() => getDecisiones(f), []),
    seguro<FilaClub[]>(() => getRankingClubes(f, 15), []),
    seguro<FilaMensual[]>(() => getEvolucionMensual(f), []),
    seguro<FilaFuncion[]>(() => getPorFuncion(f), []),
  ]);

  if (t.error) {
    return (
      <section className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-vin-900">Tablero general</h1>
        <div className="card mt-6 border-l-4 border-l-vene-rojo p-6">
          <h2 className="font-display text-base font-semibold text-vene-rojo">
            Base de datos no disponible
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            El tablero se habilita en cuanto se aplique la migracion y se siembren los
            catalogos.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md bg-surface-2 p-3 text-xs text-ink-soft">
            npm run db:deploy
            {'\n'}npm run db:seed:roles
            {'\n'}npm run db:seed:catalogos
            {'\n'}npm run db:seed:vistas
            {'\n'}npm run db:seed:indices
          </pre>
          {t.error && (
            <p className="mt-4 truncate font-mono text-xs text-ink-faint" title={t.error}>
              {t.error}
            </p>
          )}
        </div>
      </section>
    );
  }

  const k = t.datos;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-vin-900">Tablero general</h1>
          <p className="text-sm text-ink-soft">
            Big data disciplinaria: sanciones, expedientes e incidencias del fútbol venezolano.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/sanciones" className="btn btn-outline">
            Ver detalle
          </Link>
          <Link href="/inspiracional" className="btn btn-accent">
            Contenido inspiracional
          </Link>
        </div>
      </header>

      <section className="kpi-grid" aria-label="Indicadores generales">
        <KpiCard
          etiqueta="Sanciones"
          valor={Number(k?.total_sanciones ?? 0)}
          detalle={`${Number(k?.partidos_con_incidencia ?? 0)} partidos con incidencia`}
        />
        <KpiCard
          etiqueta="Clubes afectados"
          valor={Number(k?.clubes_afectados ?? 0)}
          detalle={`${Number(k?.sancionados_unicos ?? 0)} personas distintas`}
        />
        <KpiCard
          etiqueta="Amonestaciones"
          valor={Number(k?.amonestaciones ?? 0)}
          detalle="Tarjeta amarilla"
        />
        <KpiCard
          etiqueta="Tarjetas rojas"
          valor={Number(k?.tarjetas_rojas ?? 0)}
          detalle={`${Number(k?.tarjetas_rojas_indirectas ?? 0)} indirectas`}
        />
        <KpiCard
          etiqueta="Suspensiones"
          valor={Number(k?.suspensiones ?? 0)}
          detalle="Por partidos o dias"
        />
        <KpiCard
          etiqueta="Multas"
          valor={Number(k?.multas ?? 0)}
          unidad="U.C."
          detalle={`USD ${Number(k?.total_multa_usd ?? 0).toLocaleString('es-VE')}`}
        />
      </section>

      <div className="chart-grid">
        <section className="card p-5">
          <h2 className="font-display text-sm font-semibold tracking-wider text-ink-soft uppercase">
            Tipos de decision
          </h2>
          <table className="mt-4 table">
            <thead>
              <tr>
                <th>Decision</th>
                <th className="text-right">Total</th>
                <th className="text-right">Clubes</th>
                <th className="text-right">Personas</th>
              </tr>
            </thead>
            <tbody>
              {dec.datos.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-ink-faint">
                    Sin datos para los filtros seleccionados.
                  </td>
                </tr>
              )}
              {dec.datos.map((d) => (
                <tr key={d.tipo_decision ?? 'sin-clasificar'}>
                  <td className="font-medium">{d.tipo_decision ?? 'Sin clasificar'}</td>
                  <td className="text-right tabular-nums">
                    {Number(d.total).toLocaleString('es-VE')}
                  </td>
                  <td className="text-right text-ink-soft tabular-nums">{Number(d.clubes)}</td>
                  <td className="text-right text-ink-soft tabular-nums">
                    {Number(d.personas)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <h2 className="font-display text-sm font-semibold tracking-wider text-ink-soft uppercase">
            Clubes con mayor sancion
          </h2>
          <div className="table-wrap mt-4 max-h-96">
            <table className="table">
              <thead>
                <tr>
                  <th>Club</th>
                  <th className="text-right">Sanciones</th>
                  <th className="text-right">Rojas</th>
                  <th className="text-right">Multa USD</th>
                </tr>
              </thead>
              <tbody>
                {clubes.datos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-ink-faint">
                      Sin datos.
                    </td>
                  </tr>
                )}
                {clubes.datos.map((c) => (
                  <tr key={c.club_id}>
                    <td className="font-medium">{c.club}</td>
                    <td className="text-right tabular-nums">{Number(c.total_sanciones)}</td>
                    <td className="text-right tabular-nums">{Number(c.rojas)}</td>
                    <td className="text-right tabular-nums">
                      {Number(c.multa_usd ?? 0).toLocaleString('es-VE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-display text-sm font-semibold tracking-wider text-ink-soft uppercase">
            Evolucion mensual
          </h2>
          <table className="mt-4 table">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="text-right">Sanciones</th>
                <th className="text-right">Amarillas</th>
                <th className="text-right">Rojas</th>
                <th className="text-right">Suspensiones</th>
              </tr>
            </thead>
            <tbody>
              {mensual.datos.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-ink-faint">
                    Sin datos.
                  </td>
                </tr>
              )}
              {mensual.datos.map((m) => (
                <tr key={`${m.anio}-${m.mes}`}>
                  <td>
                    {m.nombre_mes} {m.anio}
                  </td>
                  <td className="text-right tabular-nums">{Number(m.sanciones)}</td>
                  <td className="text-right tabular-nums">{Number(m.amonestaciones)}</td>
                  <td className="text-right tabular-nums">{Number(m.rojas)}</td>
                  <td className="text-right tabular-nums">{Number(m.suspensiones)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <h2 className="font-display text-sm font-semibold tracking-wider text-ink-soft uppercase">
            Sancionados por funcion
          </h2>
          <ul className="mt-4 space-y-2">
            {funcion.datos.length === 0 && (
              <li className="py-6 text-center text-sm text-ink-faint">Sin datos.</li>
            )}
            {funcion.datos.slice(0, 12).map((r, i) => (
              <li
                key={`${r.tipo_sancionado}-${r.tipo_decision}-${i}`}
                className="flex justify-between gap-3 text-sm"
              >
                <span className="text-ink-soft">
                  {r.tipo_sancionado ?? 'Sin clasificar'}
                  {r.tipo_decision ? ` · ${r.tipo_decision}` : ''}
                </span>
                <span className="font-medium tabular-nums">{Number(r.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
