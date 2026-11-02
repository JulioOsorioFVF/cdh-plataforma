import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config();
const prisma = new PrismaClient();

async function main() {
  // 1. Crea la extensión vector en public si no existe
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;');
  // 2. Si ya existía en el esquema "extensions" de Supabase, la mueve a "public" para que Prisma la reconozca
  await prisma.$executeRawUnsafe('ALTER EXTENSION vector SET SCHEMA public;').catch(() => {});
  console.log('OK: Extensión pgvector habilitada en el esquema public de Supabase.');
}

main()
  .catch((e) => {
    console.error('Error activando vector:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
