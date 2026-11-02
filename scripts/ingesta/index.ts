/**
 * Punto de entrada de la ingesta.
 *
 *   npm run ingesta                       # ambos documentos
 *   npm run ingesta -- competencias       # solo COMPETENCIAS
 *   npm run ingesta -- expedientes
 *   npm run ingesta -- competencias --limpio
 *
 * Cada ejecucion queda registrada en `ingesta_log` con lo leido, lo cargado y
 * los errores, para poder auditar de donde salio cada dato.
 */
import { Prisma, PrismaClient, EstadoIngesta } from '@prisma/client';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerTabla } from '../../src/lib/ingesta/csv.js';
import { ingestaCompetencias } from '../../src/lib/ingesta/competencias.js';
import { ingestaExpedientes } from '../../src/lib/ingesta/expedientes.js';

const FUENTES = {
  competencias: {
    documento: 'COMPETENCIAS',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTNosjqXFHJudTeOffMON_e-W0oslKa1oaR50-SzFIhDbD5X24T7j-FxrV9z4NsQA/pub?gid=1639745222&single=true&output=csv',
    gid: '1639745222',
    archivo: 'competencias.csv',
  },
  expedientes: {
    documento: 'EXPEDIENTES',
    url: 'https://docs.google.com/spreadsheets/d/1Njhrbdf32k4TfAAaTh-gVYH6BaVUZ8yMh5vUs3h7PgE/export?format=csv&gid=1385768914',
    gid: '1385768914',
    archivo: 'expedientes.csv',
  },
} as const;

const CACHE = join(process.env.TEMP ?? '.', 'opencode', 'datos');

/** Si el CSV no esta en cache, lo descarga. */
async function obtener(fuente: { url: string; archivo: string }): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const ruta = join(CACHE, fuente.archivo);
  try {
    const previo = readFileSync(ruta, 'utf8');
    if (previo.length > 1000) return ruta;
  } catch {
    // No hay copia local: se descarga.
  }
  process.stdout.write(`  Descargando ${fuente.archivo}... `);
  const res = await fetch(fuente.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${fuente.url}`);
  const texto = await res.text();
  writeFileSync(ruta, texto, 'utf8');
  console.log(`${(texto.length / 1024 / 1024).toFixed(1)} MB`);
  return ruta;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  const pedidos = args.filter((a) => !a.startsWith('--'));
  const limpio = args.includes('--limpio');
  const solo = pedidos.length > 0 ? pedidos : ['competencias', 'expedientes'];

  const resumen: any[] = [];

  try {
    for (const clave of solo) {
      const fuente = FUENTES[clave as keyof typeof FUENTES];
      if (!fuente) {
        console.error(`Documento desconocido: ${clave}`);
        continue;
      }

      console.log(`\n=== ${fuente.documento} ===`);
      const log = await prisma.ingesta_log.create({
        data: {
          fuente: 'GOOGLE_SHEETS',
          documento: fuente.documento,
          url: fuente.url,
          hojaGid: fuente.gid,
          estado: EstadoIngesta.PROCESANDO,
        },
      });
      const inicio = Date.now();

      try {
        const ruta = await obtener(fuente);
        const { filas } = leerTabla(readFileSync(ruta, 'utf8'));
        console.log(`  ${filas.length} filas leidas`);

        if (limpio) {
          // Vacia solo las tablas del documento, no los catalogos compartidos.
          if (clave === 'competencias') {
            await prisma.fact_sancion_flag.deleteMany({});
            await prisma.fact_sancion_norma.deleteMany({});
            await prisma.fact_sancion_articulo.deleteMany({});
            await prisma.fact_sancion.deleteMany({});
            // Los detalles de incidencia se reconstruyen desde cero. Los que
            // dejaron intentos anteriores pueden tener la incidencia equivocada
            // (la resolucion padre se mezclaba entre dimensiones), y como el
            // indice unico por (incidencia, nombre) no los dejaria recolocar.
            await prisma.dim_detalle_incidencia.deleteMany({});
            // La fila "JUEGO" en mayusculas que creo una ingesta anterior por
            // no normalizar el nombre duplica la del catalogo ("Juego").
            await prisma.dim_incidencia_licencia.deleteMany({
              where: { nombre: { equals: 'JUEGO' } },
            });
            console.log('  Tablas de sanciones y detalles de incidencia vaciadas');
          } else {
            // OJO: `fact_expediente_parte`, `fact_expediente_movimiento`,
            // `fact_expediente_partido`, `fact_expediente_documento` y
            // `fact_sancion_expediente` estÃ¡n en CASCADE desde
            // `fact_expediente` (verificado en `pg_constraint`), asi que este
            // deleteMany se los lleva puesto.
            //
            // Hoy eso no rompe nada: `fact_sancion_expediente` esta vacia
            // porque el vinculo sancion<->expediente queda para confirmacion
            // humana (ver `docs/MAPEO_DATOS.md`, seccion 4). En cuanto alguien
            // lo llene desde COMPETENCIAS o desde la UI, este `--limpio`
            // borraria en silencio los vinculos que esta ingesta no sabe
            // reconstruir, porque los links los produce la de competencias.
            //
            // Si alguna vez se puebla esa tabla, hay que respaldarla y
            // repoblarla despues, o cambiar la FK a `ON DELETE SET NULL`.
            const vinculos = await prisma.fact_sancion_expediente.count();
            if (vinculos > 0) {
              throw new Error(
                `ABORTADO: fact_sancion_expediente tiene ${vinculos} vinculos y ` +
                  `este --limpio los borraria en cascada sin poder reconstruirlos. ` +
                  `Respalda y repuebla esa tabla, o quita --limpio.`,
              );
            }
            await prisma.fact_expediente.deleteMany();
            console.log('  Tablas de expedientes vaciadas');
          }
        }

        const r =
          clave === 'competencias'
            ? await ingestaCompetencias(prisma, filas, fuente.archivo)
            : await ingestaExpedientes(prisma, filas, fuente.archivo);

        const duracion = Date.now() - inicio;
        await prisma.ingesta_log.update({
          where: { id: log.id },
          data: {
            estado: EstadoIngesta.CARGADO,
            filasLeidas: r.leidas,
            filasInsertadas: r.insertadas,
            filasActualizadas: r.actualizadas,
            filasOmitidas: r.omitidas,
            duracionMs: duracion,
            finalizadaEn: new Date(),
            detalle: r.dimensiones as Prisma.InputJsonValue,
          },
        });

        console.log(`  Insertadas: ${r.insertadas}`);
        console.log(`  Actualizadas: ${r.actualizadas}`);
        console.log(`  Omitidas: ${r.omitidas}`);
        console.log(`  Duracion: ${(duracion / 1000).toFixed(1)} s`);
        resumen.push({ ...r, duracionMs: duracion });
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : String(e);
        console.error(`  ERROR: ${mensaje}`);
        await prisma.ingesta_log.update({
          where: { id: log.id },
          data: {
            estado: EstadoIngesta.CON_ERRORES,
            mensaje,
            finalizadaEn: new Date(),
            duracionMs: Date.now() - inicio,
          },
        });
        throw e;
      }
    }

    // Totales, para ver de un vistazo que hay en la base.
    const [sanciones, expedientes, clubes, personas, normas, articulos] = await Promise.all([
      prisma.fact_sancion.count(),
      prisma.fact_expediente.count(),
      prisma.dim_club.count(),
      prisma.dim_persona.count(),
      prisma.dim_norma.count(),
      prisma.dim_articulo.count(),
    ]);

    console.log('\n=== TOTALES EN LA BASE ===');
    console.log(`  fact_sancion     : ${sanciones}`);
    console.log(`  fact_expediente  : ${expedientes}`);
    console.log(`  dim_club         : ${clubes}`);
    console.log(`  dim_persona      : ${personas}`);
    console.log(`  dim_norma        : ${normas}`);
    console.log(`  dim_articulo     : ${articulos}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
