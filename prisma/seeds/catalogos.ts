/**
 * CONSEJO DE HONOR FVF — Cargador de catalogos base
 *
 * Lee prisma/seeds/catalogos.json (generado desde la data real de Google Sheets)
 * y puebla dim_norma, dim_articulo, dim_tipo_infraccion y dim_observacion.
 *
 * Ejecutar con: npm run db:seed:catalogos
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { slug } from '../../src/lib/slug';

const prisma = new PrismaClient();
const DATA = join(process.cwd(), 'prisma', 'seeds', 'catalogos.json');

type CatalogoJson = {
  normas: { codigo: string; nombre: string; documentos: string[] }[];
  articulos: { codigo: string; norma: string; usos: number }[];
  observaciones: { observacion: string; tipoInfraccion: string }[];
  tiposInfraccion: string[];
};

async function main() {
  const data: CatalogoJson = JSON.parse(readFileSync(DATA, 'utf8'));

  // --- Normas -------------------------------------------------------------
  for (const n of data.normas) {
    await prisma.dim_norma.upsert({
      where: { codigo: n.codigo },
      update: { nombre: n.nombre, documentos: n.documentos },
      create: { codigo: n.codigo, nombre: n.nombre, documentos: n.documentos },
    });
  }
  console.log(`  dim_norma      ${data.normas.length}`);

  // --- Articulos ----------------------------------------------------------
  const normas = await prisma.dim_norma.findMany({ select: { id: true, codigo: true } });
  const porCodigo = new Map(normas.map((x) => [x.codigo, x.id]));

  let arts = 0;
  for (const a of data.articulos) {
    const normaId = porCodigo.get(a.norma) ?? porCodigo.get('RD');
    if (!normaId) continue;
    await prisma.dim_articulo.upsert({
      where: { normaId_codigoNormalizado: { normaId, codigoNormalizado: a.codigo } },
      update: {},
      create: { normaId, codigo: a.codigo, codigoNormalizado: a.codigo },
    });
    arts++;
  }
  console.log(`  dim_articulo   ${arts}`);

  // --- Tipos de infraccion -----------------------------------------------
  for (const [i, t] of data.tiposInfraccion.entries()) {
    const codigo = slug(t);
    await prisma.dim_tipo_infraccion.upsert({
      where: { codigo },
      update: { nombre: t, orden: i + 1 },
      create: { codigo, nombre: t, orden: i + 1 },
    });
  }
  console.log(`  dim_tipo_infraccion ${data.tiposInfraccion.length}`);

  // --- Observaciones (con tipo de infraccion resuelto) -------------------
  const tipos = await prisma.dim_tipo_infraccion.findMany();
  const tipoPorNombre = new Map(tipos.map((t) => [t.nombre, t.id]));

  let obs = 0;
  for (const o of data.observaciones) {
    await prisma.dim_observacion.upsert({
      where: { textoNormalizado: o.observacion },
      update: { tipoInfraccionId: tipoPorNombre.get(o.tipoInfraccion) ?? null },
      create: {
        texto: o.observacion,
        textoNormalizado: o.observacion,
        tipoInfraccionId: tipoPorNombre.get(o.tipoInfraccion) ?? null,
      },
    });
    obs++;
  }
  console.log(`  dim_observacion ${obs}`);
}

main()
  .then(() => {
    console.log('\nCatalogos cargados.');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
