/**
 * Prueba de humo de las consultas del tablero.
 *
 *   npx tsx scripts/db/probar-consultas.ts
 *
 * La pagina del tablero solo ejercita algunas consultas; los filtros por
 * temporada, club o fecha dejan sin probar varias otras. Este script llama a
 * TODAS las funciones de datos con filtros vacios y con filtros completos,
 * para que un nombre de columna mal escrito salte aqui y no en produccion.
 */
import * as d from '../../src/lib/datos/dashboard.js';
import type { FiltrosSancion } from '../../src/types/filtros.js';

type Caso = { nombre: string; fn: () => Promise<unknown> };

const filtrosSancion: FiltrosSancion[] = [
  {},
  { anio: 2025, torneo: 'inexistente', club: 'inexistente-club' },
  { fechaDesde: '2024-01-01', fechaHasta: '2025-12-31', soloMultas: true },
];

// Los nombres se leen en tiempo de ejecucion a proposito: si alguien renombra o
// elimina una funcion, este script lo detecta en vez de compilar en silencio.
const sanctionKeys = [
  'getTotales',
  'getDecisiones',
  'getPorFuncion',
  'getRankingClubes',
  'getEvolucionMensual',
  'getAniosDisponibles',
] as const;

async function main() {
  const casos: Caso[] = [];
  const api = d as unknown as Record<string, (...a: never[]) => Promise<unknown>>;

  for (const k of sanctionKeys) {
    for (const [i, f] of filtrosSancion.entries()) {
      casos.push({ nombre: `${k} [sancion ${i}]`, fn: () => api[k]!(f as never) });
    }
  }

  let ok = 0;
  const fallos: string[] = [];

  for (const c of casos) {
    try {
      const r = await c.fn();
      const n = Array.isArray(r) ? `${r.length} filas` : 'ok';
      ok++;
      console.log(`  OK    ${c.nombre.padEnd(44)} ${n}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split('\n').slice(0, 2).join(' ') : String(e);
      fallos.push(`${c.nombre}\n         ${msg}`);
      console.log(`  FALLA ${c.nombre}\n         ${msg}`);
    }
  }

  console.log(`\n${ok} de ${casos.length} consultas correctas.`);
  if (fallos.length) {
    console.log(`\n${fallos.length} con error.`);
    process.exitCode = 1;
  }
}

void main();
