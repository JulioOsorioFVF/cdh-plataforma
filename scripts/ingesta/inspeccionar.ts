/**
 * Inspeccion de las hojas antes de escribir la ingesta.
 *
 *   npx tsx scripts/ingesta/inspeccionar.ts <archivo.csv>
 *
 * Muestra encabezados con su indice (obligatorio, porque en el CUADRO DE
 * EXPEDIENTES los nombres se repiten), numero real de filas y una muestra.
 */
import { readFileSync } from 'node:fs';
import { leerTabla, celda } from '../../src/lib/ingesta/csv.js';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: npx tsx scripts/ingesta/inspeccionar.ts <archivo.csv>');
  process.exit(1);
}

const { encabezados, filas } = leerTabla(readFileSync(ruta, 'utf8'));

console.log(`Archivo    : ${ruta}`);
console.log(`Columnas   : ${encabezados.length}`);
console.log(`Filas      : ${filas.length}`);
console.log(
  `Ancho real : ${new Set(filas.map((f) => f.length)).size} distinto(s): ${[
    ...new Set(filas.map((f) => f.length)),
  ].join(', ')}\n`,
);

console.log('INDICE  ENCABEZADO                              VALORES DISTINTOS');
console.log('-'.repeat(100));
for (let c = 0; c < encabezados.length; c++) {
  const valores = new Set<string>();
  for (const f of filas) {
    const v = celda(f, c);
    if (v !== '') valores.add(v);
  }
  const nombre = encabezados[c] ?? '(sin nombre)';
  console.log(`${String(c).padStart(6)}  ${nombre.slice(0, 36).padEnd(36)}  ${valores.size}`);
}

const conDatos = filas.find((f) => f.some((c) => c.trim() !== ''))!;
console.log('\n--- PRIMERA FILA CON DATOS ---');
encabezados.forEach((h, c) => {
  const v = celda(conDatos, c);
  console.log(
    `  [${String(c).padStart(2)}] ${(h || '(sin nombre)').slice(0, 34).padEnd(34)} | ${v.slice(0, 70)}`,
  );
});
