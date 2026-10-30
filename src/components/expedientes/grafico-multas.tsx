'use client';

import { useEffect, useRef } from 'react';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
} from 'chart.js';
import type { BarraMulta } from '@/lib/datos/expedientes';

/**
 * Barras horizontales: total de multa en UCFVF por sancionado.
 *
 * Se usa el Chart.js pelado sobre un `<canvas>` en vez de un envoltorio de
 * React: son 25 barras, no hace falta otra dependencia, y el componente se
 * reduce a leer datos que ya le dio el servidor.
 *
 * Solo se registran los modulos que se usan. Importar el paquete completo
 * (`import 'chart.js/auto'`) arrastra los 40 modulos que esta vista no
 * necesita.
 */

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

type Props = {
  barras: BarraMulta[];
};

/**
 * Color de las barras.
 *
 * Se lee del token `--color-vin-900` en vez de escribir un hex aqui: asi el
 * grafico sigue al tema claro/oscuro y no queda un color suelto que nadie
 * encuentra despues. `vin-900` es el vinotinto de marca (`#3c0c24`).
 * `vin-800` esta en oklch, y el canvas no siempre lo resuelve, por eso se usa
 * el unico token de la escala que es un hex.
 */
function colorBarras(): string {
  if (typeof window === 'undefined') return '#3c0c24';
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-vin-900')
    .trim();
  return v || '#3c0c24';
}

export function GraficoMultasPorSancionado({ barras }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const color = colorBarras();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Chart.js no necesita animacion en un tableau que se relee cada vez que
    // cambia un filtro: solo se nota el parpadeo.
    const grafico = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: barras.map((b) => b.sancionado),
        datasets: [
          {
            label: 'Multa UCFVF',
            data: barras.map((b) => b.multa_uc),
            backgroundColor: color,
            borderRadius: 3,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { right: 24 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const b = barras[c.dataIndex];
                if (!b) return '';
                return [
                  ` ${b.multa_uc.toLocaleString('es-VE')} UCFVF`,
                  ` $${b.multa_usd.toLocaleString('es-VE')}`,
                  ` ${b.expedientes} ${b.expedientes === 1 ? 'expediente' : 'expedientes'}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: 'Multa acumulada (UCFVF)' },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          y: {
            // Con muchos nombres, Chart.js los deja chiquitos y ilegibles; es
            // preferible que selean menos barras a que no se lean.
            ticks: {
              autoSkip: false,
              callback: function (valor) {
                const s = String(this.getLabelForValue(Number(valor)) ?? '');
                return s.length > 28 ? `${s.slice(0, 27)}…` : s;
              },
            },
          },
        },
      },
      plugins: [
        {
          // Etiqueta del valor al final de cada barra.
          id: 'valorEnBarra',
          afterDatasetsDraw(chart) {
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);
            ctx.save();
            ctx.font = '600 11px system-ui, sans-serif';
            ctx.fillStyle = color;
            ctx.textBaseline = 'middle';
            meta.data.forEach((barra, i) => {
              const v = Number(barra.x);
              if (!Number.isFinite(v) || v <= 0) return;
              ctx.fillText(
                Number(barras[i]?.multa_uc ?? 0).toLocaleString('es-VE'),
                v + 6,
                barra.y,
              );
            });
            ctx.restore();
          },
        },
      ],
    });

    return () => {
      grafico.destroy();
    };
  }, [barras, color]);

  if (barras.length === 0) {
    return (
      <section className="card p-8 text-center">
        <p className="text-ink-soft">Ninguna multa en UCFVF para este filtro.</p>
      </section>
    );
  }

  return (
    <section className="card p-5" aria-label="Total de multa en UCFVF por sancionado">
      <header className="mb-4">
        <h2 className="font-display text-sm font-semibold text-vin-900">
          Total de Multa en UCFVF por Sancionado
        </h2>
        <p className="mt-0.5 text-xs text-ink-faint">
          {barras.length} sancionados con multa, de mayor a menor. Clubes y personas van juntos:
          la hoja no distingue y un mismo nombre puede ser un club o una selección.
        </p>
      </header>
      {/* Altura fija: con `maintainAspectRatio: false` el canvas necesita un
          contenedor con alto explicito o se renderiza plano. */}
      <div className="h-[28rem]">
        <canvas ref={ref} role="img" aria-label="Gráfico de barras de multa en UCFVF" />
      </div>
    </section>
  );
}
