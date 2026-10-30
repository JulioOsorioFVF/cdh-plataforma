import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Configuracion de Prisma 6.19+
 * Reemplaza la clave `prisma` de package.json (deprecada, se elimina en Prisma 7).
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seeds/catalogos.ts',
  },
});
