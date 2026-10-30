'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { OpcionAnio } from '@/lib/datos/expedientes';
import {
  ETIQUETA_ANIO_BASE,
  ETIQUETA_SEMESTRE,
  NOMBRES_MES,
  componerPeriodo,
  filtrosExpedienteToParams,
} from '@/types/filtros-expedientes';
import type { FiltrosExpediente, Semestre } from '@/types/filtros-expedientes';

/**
 * Panel de filtros de Expedientes.
 *
 * Los filtros viajan por la URL y el formulario se manda por GET, de modo que
 * el estado vive en el Server Component: recargar, compartir el enlace o
 * pulsar "atras" del navegador reproduce exactamente la misma tabla. Es el
 * criterio que ya usa el resto del proyecto (`filtrosToParams`).
 *
 * La multiseleccion se resuelve con casillas, no con un `<select multiple>`:
 * un select multiple es casi imposible de usar sinTeclear Ctrl y ademas es
 * pobre en moviles.
 */

type Props = {
  anios: OpcionAnio[];
  estados: string[];
  filtros: FiltrosExpediente;
  total: number;
};

function alterna<T>(lista: T[] | undefined, v: T): T[] {
  const base = lista ?? [];
  return base.includes(v) ? base.filter((x) => x !== v) : [...base, v];
}

export function FiltrosExpedientes({ anios, estados, filtros, total }: Props) {
  const router = useRouter();

  // El estado local existe solo para la caja de texto: un control de busqueda
  // que se reescribiera en cada tecla perderia el foco.
  const [buscaAnio, setBuscaAnio] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      document.getElementById('generar-reporte')?.scrollIntoView({ block: 'nearest' });
    }, 0);
    return () => clearTimeout(t);
  }, [filtros]);

  // Se usa el helper del servidor en vez de repetir el mapeo a mano: cuando
  // el parametro vivia en dos sitios, uno se quedó atrás en silencio y el
  // filtro no hacia nada. Una sola fuente de verdad para la URL.
  const enviados = filtrosExpedienteToParams(filtros);

  /** Cambia un parametro y vuelve a pedir los datos al servidor. */
  function aplicar(cambios: Record<string, string | undefined>) {
    const p = new URLSearchParams(enviados);
    for (const [k, v] of Object.entries(cambios)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const q = p.toString();
    router.push(q ? `/expedientes?${q}` : '/expedientes');
  }

  const aniosVisibles = anios.filter((a) =>
    buscaAnio ? String(a.anio).includes(buscaAnio.trim()) : true,
  );
  const hayFiltro = enviados.toString().length > 0;

  return (
    <section className="card p-5" aria-label="Filtros de expedientes">
      <form action="/expedientes" method="get" id="generar-reporte">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          {/* ---------------- Anios ---------------- */}
          <fieldset>
            <legend className="font-display text-xs font-semibold tracking-wider text-ink-soft uppercase">
              Año({filtros.anioBase === 'resolucion' ? ' de la resolución' : ''})
            </legend>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Filtrar años…"
              value={buscaAnio}
              onChange={(e) => setBuscaAnio(e.target.value)}
              className="mt-2 w-full rounded border border-vin-200 bg-vin-50/40 px-2 py-1 text-sm"
              aria-label="Buscar año"
            />
            <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {aniosVisibles.map((a) => {
                const activo = filtros.anios?.includes(a.anio) ?? false;
                return (
                  <button
                    key={a.anio}
                    type="button"
                    aria-pressed={activo}
                    onClick={() =>
                      aplicar({ anios: alterna(filtros.anios, a.anio).join(',') || undefined })
                    }
                    className={`badge cursor-pointer tabular-nums ${
                      activo ? 'badge-multa' : 'badge-neutra'
                    }`}
                  >
                    {a.anio}
                    <span className="ml-1 opacity-70">{a.expedientes}</span>
                  </button>
                );
              })}
              {aniosVisibles.length === 0 && (
                <p className="text-sm text-ink-faint">Ningún año coincide.</p>
              )}
            </div>

            {/* ---------------- Semestres ---------------- */}
            {/*
              Cada celda es el par (año, semestre), que es justo lo que guarda
              `periodos`. Marcar "2do de 2025" y "1er de 2026" deja fuera el
              resto de 2026: por eso el filtro es una lista de periodos y no un
              año suelto mas un semestre suelto, que haría producto cruzado y
              traeria también el 1er semestre de 2025.
            */}
            <div className="mt-4 border-t border-vin-100 pt-3">
              <p className="font-display text-xs font-semibold tracking-wider text-ink-soft uppercase">
                Semestre
              </p>
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {aniosVisibles.map((a) => (
                  <div key={a.anio} className="flex items-center gap-1.5">
                    <span className="w-12 shrink-0 text-xs text-ink-soft tabular-nums">
                      {a.anio}
                    </span>
                    {([1, 2] as Semestre[]).map((s) => {
                      const periodo = componerPeriodo(a.anio, s);
                      const activo = filtros.periodos?.includes(periodo) ?? false;
                      return (
                        <button
                          key={periodo}
                          type="button"
                          aria-pressed={activo}
                          title={`${ETIQUETA_SEMESTRE[s]} de ${a.anio}`}
                          onClick={() =>
                            aplicar({
                              periodos:
                                alterna(filtros.periodos, periodo).join(',') || undefined,
                            })
                          }
                          className={`badge cursor-pointer ${
                            activo ? 'badge-multa' : 'badge-neutra'
                          }`}
                        >
                          {s === 1 ? '1er' : '2do'}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {aniosVisibles.length === 0 && (
                  <p className="text-sm text-ink-faint">Ningún año coincide.</p>
                )}
              </div>
              {filtros.periodos?.length ? (
                <button
                  type="button"
                  onClick={() => aplicar({ periodos: undefined })}
                  className="mt-2 rounded px-2 py-0.5 text-xs text-ink-faint underline hover:text-ink"
                >
                  Quitar filtro de semestre
                </button>
              ) : (
                <p className="mt-2 text-xs text-ink-faint">
                  Sin filtro: se muestra el año completo.
                </p>
              )}
              {filtros.periodos?.length ? (
                <p className="mt-2 text-xs text-ink-faint">
                  El semestre se cuenta sobre la fecha de{' '}
                  {filtros.anioBase === 'resolucion' ? 'la resolución' : 'recepción o entrada'}.
                </p>
              ) : null}
            </div>
          </fieldset>

          {/* ---------------- Meses ---------------- */}
          <fieldset>
            <legend className="font-display text-xs font-semibold tracking-wider text-ink-soft uppercase">
              Mes(es)
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {NOMBRES_MES.map((m, i) => {
                const mes = i + 1;
                const activo = filtros.meses?.includes(mes) ?? false;
                return (
                  <button
                    key={mes}
                    type="button"
                    aria-pressed={activo}
                    onClick={() =>
                      aplicar({ meses: alterna(filtros.meses, mes).join(',') || undefined })
                    }
                    className={`badge cursor-pointer justify-start ${
                      activo ? 'badge-multa' : 'badge-neutra'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="text-sm text-ink-soft">
                Atribuir a
                <select
                  name="anioBase"
                  value={filtros.anioBase ?? 'expediente'}
                  onChange={(e) => aplicar({ anioBase: e.target.value })}
                  className="ml-2 rounded border border-vin-200 bg-vin-50/40 px-2 py-1 text-sm"
                >
                  <option value="expediente">{ETIQUETA_ANIO_BASE.expediente}</option>
                  <option value="resolucion">{ETIQUETA_ANIO_BASE.resolucion}</option>
                </select>
              </label>

              <label className="text-sm text-ink-soft">
                Estado
                <select
                  name="estado"
                  value={filtros.estado ?? ''}
                  onChange={(e) => aplicar({ estado: e.target.value || undefined })}
                  className="ml-2 rounded border border-vin-200 bg-vin-50/40 px-2 py-1 text-sm"
                >
                  <option value="">Todos</option>
                  {estados.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={filtros.conMulta ?? false}
                  onChange={(e) => aplicar({ conMulta: e.target.checked ? '1' : undefined })}
                />
                Solo con multa
              </label>
            </div>
          </fieldset>
        </div>

        {/* ---------------- Comparacion y acciones ---------------- */}
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-vin-100 pt-4">
          <button
            type="button"
            aria-pressed={filtros.compararAnios ?? false}
            onClick={() => aplicar({ compararAnios: filtros.compararAnios ? undefined : '1' })}
            className={`badge cursor-pointer ${
              filtros.compararAnios ? 'badge-multa' : 'badge-neutra'
            }`}
          >
            Comparar años
          </button>

          <button
            type="button"
            aria-pressed={filtros.compararMeses ?? false}
            onClick={() => aplicar({ compararMeses: filtros.compararMeses ? undefined : '1' })}
            className={`badge cursor-pointer ${
              filtros.compararMeses ? 'badge-multa' : 'badge-neutra'
            }`}
          >
            Comparar meses
          </button>

          <p className="text-sm text-ink-faint">
            {total} {total === 1 ? 'aut' : 'autes'} con los filtros actuales
          </p>

          <div className="ml-auto flex items-center gap-2">
            {hayFiltro && (
              <button
                type="button"
                onClick={() => router.push('/expedientes')}
                className="rounded border border-vin-200 px-3 py-1.5 text-sm text-ink-soft"
              >
                Limpiar
              </button>
            )}
            <button
              type="submit"
              className="rounded bg-vin-900 px-4 py-1.5 text-sm font-medium text-vin-50"
            >
              Generar reporte
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
