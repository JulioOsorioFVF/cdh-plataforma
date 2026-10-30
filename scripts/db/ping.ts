/**
 * Verifica la conexion a la base de datos.
 *
 *   npm run db:ping                 -> usa .env
 *   npm run db:ping -- "postgresql://..."  -> prueba un DSN puntual
 *
 * Util para validar el DSN de la nube ANTES de correr migraciones: si el
 * `sslmode` esta mal, el firewall bloquea o la contrasena caduco, se entera
 * aqui y no a mitad de `migrate deploy`.
 */
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config();

const dsn = process.argv[2] ?? process.env.DATABASE_URL;

function ocultar(url: string): string {
  if (!url) return '(vacia)';
  try {
    const u = new URL(url);
    const auth = u.username ? `${u.username}:***@` : '';
    const q = u.search ? `?${u.searchParams.toString()}` : '';
    return `${u.protocol}//${auth}${u.host}${u.pathname}${q}`;
  } catch {
    return '(formato no reconocido)';
  }
}

function clasificar(url: string): string {
  const h = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  if (!h) return 'indeterminada';
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return 'LOCAL';
  if (h.includes('pooler')) return 'NUBE (pooler)';
  if (h.endsWith('neon.tech')) return 'NUBE (Neon, directo)';
  if (h.includes('supabase')) return 'NUBE (Supabase, directo)';
  return 'NUBE / remoto';
}

async function main() {
  console.log(`DSN        : ${ocultar(dsn ?? '')}`);
  console.log(`Tipo       : ${clasificar(dsn ?? '')}`);

  if (!dsn) {
    console.error('\nERROR: no hay DSN. Define DATABASE_URL en .env o pasalo como argumento.');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dsn } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [info] = await prisma.$queryRaw<
      { version: string; ssl: string; db: string; user: string }[]
    >`SELECT version(), current_setting('ssl') AS ssl, current_database() AS db, current_user AS user`;

    if (!info) throw new Error('La consulta de version no devolvio filas.');

    console.log(`Servidor   : ${info.version.split(',')[0]}`);
    console.log(`Base       : ${info.db}`);
    console.log(`Usuario    : ${info.user}`);
    console.log(`SSL        : ${info.ssl}`);

    const tablas = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`;

    console.log(`Tablas     : ${tablas[0]?.n ?? 0}`);
    console.log('\nConexion OK.');
  } catch (e) {
    console.error(`\nERROR de conexion: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    console.error('\nCausas frecuentes:');
    console.error('  - `sslmode=require` faltando (obligatorio en la nube)');
    console.error('  - base de datos en pausa (Neon/Render la reanudan por HTTP)');
    console.error('  - IP no permitida en el firewall del proveedor');
    console.error('  - contrasena o usuario incorrectos');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
