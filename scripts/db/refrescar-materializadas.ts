/**
 * Refresca las vistas materializadas.
 *
 *   npm run db:refresh
 *
 * Se hace por script y no con `psql` a proposito: los comandos de `package.json`
 * se ejecutan con cmd.exe en Windows, donde la sintaxis de shell de Unix
 * (comillas dobles, `$VAR`) no existe. Asi el mismo comando funciona en
 * Windows, Linux y macOS, y sirve igual contra una base en la nube.
 */
import { config } from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';

config();

/** Las tres materializadas que crea 04_indices_y_materializadas.sql. */
const VISTAS = ['mv_kpi_mensual', 'mv_ranking_clubes', 'mv_matriz_jornadas'];

const prisma = new PrismaClient();

async function main() {
  try {
    const fn = await prisma.$queryRaw<{ existe: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'refrescar_materializadas' AND n.nspname = 'public'
      ) AS existe`;

    if (!fn[0]?.existe) {
      console.error(
        'ERROR: la funcion refrescar_materializadas() no existe.\n' +
          '       Corrige primero:  npm run db:seed:indices',
      );
      process.exitCode = 1;
      return;
    }

    const inicio = Date.now();
    // La funcion devuelve void, que Prisma no sabe deserializar: se castea a
    // text (cadena vacia) para poder leer el resultado.
    await prisma.$queryRaw`SELECT refrescar_materializadas()::text AS resultado`;
    const ms = Date.now() - inicio;

    const filas = await prisma.$queryRaw<{ nombre: string; filas: bigint }[]>`
      SELECT c.relname AS nombre, c.reltuples::bigint AS filas
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY(${Prisma.sql`ARRAY[${Prisma.join(
        VISTAS.map((v) => Prisma.sql`${v}::text`),
      )}]`})`;

    console.log(`Materializadas refrescadas en ${ms} ms:`);
    for (const v of filas) console.log(`  - ${v.nombre} (~${v.filas} filas estimadas)`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
