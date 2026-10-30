import type { ReactNode } from 'react';

type Props = {
  etiqueta: string;
  valor: number | string;
  unidad?: string;
  detalle?: ReactNode;
  semaforo?: 'cumple' | 'riesgo' | 'critico' | 'neutro';
  invertirSemforo?: boolean;
};

const CLASE_SEMAFORO = {
  cumple: 'semaforo-cumple',
  riesgo: 'semaforo-riesgo',
  critico: 'semaforo-critico',
  neutro: 'semaforo-neutro',
} as const;

/**
 * Para indicadores en los que un valor bajo es lo bueno (por ejemplo, numero de
 * expedientes en curso: pocos = mejor). Se invierte el color, no el texto.
 */
const CLASE_SEMAFORO_INVERTIDO = {
  cumple: 'semaforo-critico',
  riesgo: 'semaforo-riesgo',
  critico: 'semaforo-cumple',
  neutro: 'semaforo-neutro',
} as const;

/**
 * Tarjeta de indicador. El semaforo ya viene resuelto desde la consulta
 * (v_kpi_avance / v_pilar_avance) para que la vista no recalcule reglas.
 */
export function KpiCard({
  etiqueta,
  valor,
  unidad,
  detalle,
  semaforo = 'neutro',
  invertirSemforo = false,
}: Props) {
  const clases = invertirSemforo ? CLASE_SEMAFORO_INVERTIDO : CLASE_SEMAFORO;
  const clase = clases[semaforo];

  return (
    <article className="card p-5">
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xs font-semibold tracking-wider text-ink-soft uppercase">
          {etiqueta}
        </h3>
        {semaforo !== 'neutro' && (
          <span className={`badge ${clase}`} aria-label={`Estado: ${semaforo}`} />
        )}
      </header>

      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold text-vin-900 tabular-nums">
          {typeof valor === 'number' ? valor.toLocaleString('es-VE') : valor}
        </span>
        {unidad && <span className="text-sm text-ink-faint">{unidad}</span>}
      </p>

      {detalle && <div className="mt-2 text-sm text-ink-soft">{detalle}</div>}
    </article>
  );
}
