import { FiltrosExpedientes } from '@/components/expedientes/filtros-expedientes';
import { GraficoMultasPorSancionado } from '@/components/expedientes/grafico-multas';
import { TablaPivotMultas } from '@/components/expedientes/tabla-pivot';
import {
  getAniosExpedientes,
  getEstadosExpedientes,
  getMultasPorSancionado,
  getPivotMultas,
  getVariantesDeEscritura,
} from '@/lib/datos/expedientes';
import { seguro } from '@/lib/datos/dashboard';
import type { FiltrosExpediente } from '@/types/filtros-expedientes';
import { filtrosExpedienteFromSearch } from '@/types/filtros-expedientes';

/**
 * Vista de Expedientes: multas por expediente disciplinario.
 *
 * Server Component. Los filtros llegan por la query string y toda la lectura
 * ocurre aqui; los tres Client Components de abajo reciben datos ya resueltos
 * y solo se ocupan de la interaccion (plegar, filtrar, dibujar).
 */

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** `?anios=2024,2025` puede llegar como string o como string[]. */
function plano(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v) && v[0] != null) out[k] = String(v[0]);
  }
  return out;
}

export default async function PaginaExpedientes({ searchParams }: Props) {
  const sp = plano(await searchParams);
  const filtros: FiltrosExpediente = filtrosExpedienteFromSearch(sp);

  const [anios, estados, filas, barras, variantes] = await Promise.all([
    seguro(() => getAniosExpedientes(filtros), []),
    seguro(() => getEstadosExpedientes(), []),
    seguro(() => getPivotMultas(filtros), []),
    seguro(() => getMultasPorSancionado(filtros), []),
    seguro(() => getVariantesDeEscritura(filtros), {
      formas: 0,
      entidades: 0,
      variantes: 0,
      ejemplos: [],
    }),
  ]);

  // `seguro` devuelve `{datos, error}`: se muestra el fallo en pantalla en vez
  // de dejar la pagina en blanco si la base no esta arriba.
  const error = [filas.error, barras.error, anios.error].find(Boolean) ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-vin-900">Expedientes</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">
          Multas impuestas en expedientes disciplinarios, agrupadas por año, mes, fecha y número
          de auto. Clubs y personas aparecen juntos, tal como llegan de la hoja.
        </p>
      </header>

      {error && (
        <div className="card border-l-4 border-l-roja p-4 text-sm">
          <p className="font-semibold text-roja">No se pudo leer la base de datos.</p>
          <p className="mt-1 text-ink-soft">{error}</p>
          <p className="mt-1 text-ink-faint">
            Comprueba que PostgreSQL esté arrancado:{' '}
            <code>scripts\db\local-postgres.ps1 start</code>
          </p>
        </div>
      )}

      <FiltrosExpedientes
        anios={anios.datos}
        estados={estados.datos}
        filtros={filtros}
        total={filas.datos.length}
      />

      {/* Aviso honesto sobre el texto libre: informa, no corrige. */}
      {variantes.datos.variantes > 0 && (
        <aside className="card p-4 text-sm">
          <p className="font-medium text-vin-900">
            {variantes.datos.entidades} sancionados distintos, escritos de{' '}
            {variantes.datos.formas} formas en la hoja
          </p>
          <p className="mt-1 text-ink-soft">
            Solo se ignoran tildes y puntuación. <strong>No se unifican nombres</strong>: un
            club y una selección pueden llamarse casi igual y son entidades diferentes.
          </p>
          {variantes.datos.ejemplos.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-ink-faint">
              {variantes.datos.ejemplos.map((e) => (
                <li key={e.clave}>
                  <span className="font-mono">{e.clave}</span>: {e.formas.join(' · ')}
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      <TablaPivotMultas
        filas={filas.datos}
        compararAnios={filtros.compararAnios ?? false}
        compararMeses={filtros.compararMeses ?? false}
      />

      <GraficoMultasPorSancionado barras={barras.datos} />
    </div>
  );
}
