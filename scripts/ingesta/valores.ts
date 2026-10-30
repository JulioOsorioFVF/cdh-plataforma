/**
 * Vuelca los valores distintos de columnas concretas, con su frecuencia.
 * Sirve para escribir las reglas de mapeo mirando los datos de verdad.
 *
 *   npx tsx scripts/ingesta/valores.ts <archivo.csv> 0,7,9,10,...
 */
import { readFileSync } from 'node:fs';
import { leerTabla, celda } from './csv.js';

const [ruta, lista] = process.argv.slice(2);
if (!ruta || !lista) {
  console.error('Uso: npx tsx scripts/ingesta/valores.ts <archivo.csv> <indice,indice,...>');
  process.exit(1);
}

const indices = lista.split(',').map((n) => Number(n.trim()));
const { encabezados, filas } = leerTabla(readFileSync(ruta, 'utf8'));

for (const c of indices) {
  const conteo = new Map<string, number>();
  for (const f of filas) {
    const v = celda(f, c);
    conteo.set(v, (conteo.get(v) ?? 0) + 1);
  }
  const orden = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
  console.log(
    `\n===== [${c}] ${encabezados[c] ?? '(sin nombre)'}  ->  ${orden.length} distintos =====`,
  );
  for (const [v, n] of orden) {
    console.log(`  ${String(n).padStart(7)}  ${v === '' ? '(vacio)' : v}`);
  }
}
