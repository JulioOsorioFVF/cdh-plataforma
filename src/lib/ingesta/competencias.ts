/**
 * Ingesta de la hoja COMPETENCIAS.
 *
 * Cada fila es una sancion disciplinaria. La hoja viene aplanada: no trae tablas
 * de busqueda, sino que repite el nombre del torneo, el del club, el del motivo
 * una vez por fila. Aqui se resuelve cada dimension y se escribe una fila en
 * `fact_sancion` con sus tablas hijas (flags y normas).
 *
 * La ingesta es idempotente: cada fila lleva un hash de su contenido en
 * `hash_origen`, que es unico. Reejecutarla no duplica nada.
 */
import { PrismaClient } from '@prisma/client';
import { celda } from './csv';
import { Dimensiones } from './dimensiones';
import { esCitaVacia, esNulo, hashFila, parseFecha, parseNumero, textoONulo } from './util';

const DOCUMENTO = 'COMPETENCIAS';
const GID = '1639745222';

/** Columnas de la hoja, por indice. Se accede siempre por indice. */
const C = {
  anio: 0,
  torneo: 1,
  categoria: 2,
  fase: 3,
  jornada: 4,
  acta: 5,
  proc: 6,
  tipoSancionado: 7,
  sancionado: 8,
  tipo: 9,
  motivo: 10,
  observacion: 11,
  norma: 12,
  articulos: 13,
  sancion: 14,
  sancionTiempo: 15,
  uc: 16,
  club: 17,
  nombre: 18,
  incidencia: 19,
  detalle: 20,
  partido: 21,
  idPartido: 22,
  flags: [23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  reintegro: 34,
  alerta: 35,
  tipoInfraccion: 36,
} as const;

const FLAG_NOMBRES = [
  'RD',
  'NR',
  'RGC',
  'E_FVF',
  'CD_FIFA',
  'LODAFEF',
  'RP1_LOD',
  'OFICIO_COMPETICIONES',
  'OFICIO_LICENCIAS',
  'OFICIO_CNA',
  'OFICIO_INTEGRIDAD',
];

export interface ResultadoIngesta {
  documento: string;
  leidas: number;
  insertadas: number;
  actualizadas: number;
  omitidas: number;
  dimensiones: Record<string, number>;
}

export async function ingestaCompetencias(
  prisma: PrismaClient,
  filas: string[][],
  archivoOrigen: string,
): Promise<ResultadoIngesta> {
  const dim = new Dimensiones(prisma);
  let omitidas = 0;

  // --- Pasada 1: registrar dimensiones y quedarnos con las claves -----------
  interface Preparada {
    hash: string;
    filaOrigen: number;
    fechaIso: string;
    fechaClave: string;
    club: string | null;
    torneo: string | null;
    categoria: string | null;
    fase: string | null;
    jornada: string | null;
    partido: string | null;
    tipoSancionado: string | null;
    persona: string | null;
    tipoDecision: string | null;
    motivo: string | null;
    tipoInfraccion: string | null;
    observacion: string | null;
    incidencia: string | null;
    detalle: string | null;
    flags: string[];
    juegos: number | null;
    dias: number | null;
    uc: number | null;
    reintegro: boolean;
    alerta: boolean;
    proc: string | null;
    motivoRaw: string | null;
    observacionRaw: string | null;
    detalleRaw: string | null;
    articulosRaw: string | null;
    normaRaw: string | null;
    nombreRaw: string | null;
    cedulaRaw: string | null;
    normas: string[];
  }

  const preparadas: Preparada[] = [];

  // Pasada previa: aprender que cedula corresponde a cada nombre. Sin esto, una
  // fila con la cedula mal escrita que aparezca antes que la correcta se crearia
  // con una cedula sintetizada y chocaria con `nombre_normalizado` unico, dejando
  // esa fila sin persona. El orden de la hoja no debe afectar al resultado.
  // Primero lo que ya esta en la base, despues lo que aporta la propia hoja (que
  // tiene prioridad: si la hoja dice la cedula correcta, esa gana).
  await dim.cargarIndicePersonas();
  await dim.cargarCatalogos();
  dim.aprenderCedulas(
    filas.map((f) => ({ cedula: celda(f, C.sancionado), nombre: celda(f, C.nombre) })),
  );

  for (let i = 0; i < filas.length; i++) {
    const f = filas[i]!;
    // La columna AÑO trae la fecha del acta, no solo el ano: "01/01/2025".
    // Es la unica fecha fiable de la hoja y la que se usa para el periodo.
    const fechaIso = parseFecha(celda(f, C.anio));
    if (!fechaIso) {
      omitidas++;
      continue;
    }

    const temporada = Number(fechaIso.slice(0, 4));
    const tipo = celda(f, C.tipo);
    const motivo = celda(f, C.motivo);
    const torneo = celda(f, C.torneo);
    const jornada = celda(f, C.jornada);
    const incidencia = celda(f, C.incidencia);
    const tipoSancionado = celda(f, C.tipoSancionado);
    const club = celda(f, C.club);

    const flags: string[] = [];
    C.flags.forEach((idx, n) => {
      const v = celda(f, idx);
      if (!esNulo(v) && v !== '0' && v.toUpperCase() !== 'FALSE' && v.toUpperCase() !== 'NO') {
        flags.push(FLAG_NOMBRES[n]!);
      }
    });

    const meses = celda(f, C.sancionTiempo).match(/(\d+)\s*MES/i);
    const juegos = parseNumero(celda(f, C.sancion));

    // El hash se calcula sobre TODAS las columnas de la fila, no sobre un
    // subconjunto. Antes se hasheaban nueve campos (fecha, id de partido,
    // sancionado, nombre, tipo, motivo, articulos, observacion y club) y eso
    // fundia sanciones de verdad: 27.679 filas de la hoja secebaban en 22.292
    // porque dos actas distintas con el mismo jugador y el mismo motivo tienen
    // esos nueve campos iguales pero montos, tipo de sancionado, incidencia y
    // partido distintos. Hashando la fila entera solo se funden los duplicados
    // exactos, que en la hoja son 125, y reejecutar la ingesta sigue sin
    // duplicar nada.
    const hash = hashFila(
      DOCUMENTO,
      f.map((c) => c.trim()),
    );

    preparadas.push({
      hash,
      filaOrigen: i + 2, // +1 por el encabezado, +1 porque las hojas empiezan en 1
      fechaIso,
      fechaClave: dim.fecha(fechaIso)!,
      club: dim.club(club),
      torneo: dim.torneo(torneo, temporada),
      categoria: dim.categoria(celda(f, C.categoria)),
      fase: dim.fase(celda(f, C.fase), torneo),
      jornada: dim.jornada(jornada, torneo, parseNumero(jornada)),
      partido: dim.partido(
        celda(f, C.idPartido),
        celda(f, C.partido),
        celda(f, C.acta),
        fechaIso,
      ),
      tipoSancionado: dim.tipoSancionado(tipoSancionado, 0),
      persona: dim.persona(
        celda(f, C.sancionado),
        celda(f, C.nombre),
        tipoSancionado,
        celda(f, C.club),
      ),
      tipoDecision: dim.tipoDecision(tipo, 0),
      motivo: dim.motivo(motivo, tipo, 0),
      tipoInfraccion: dim.tipoInfraccion(celda(f, C.tipoInfraccion), 0),
      observacion: dim.observacion(celda(f, C.observacion)),
      incidencia: dim.incidencia(incidencia, 0),
      detalle: dim.detalle(celda(f, C.detalle), incidencia, 0),
      flags,
      juegos,
      dias: meses ? Number(meses[1]) * 30 : null,
      uc: parseNumero(celda(f, C.uc)),
      reintegro: /^(SI|SÍ|1|TRUE)$/i.test(celda(f, C.reintegro)),
      alerta: /^(SI|SÍ|1|TRUE)$/i.test(celda(f, C.alerta)),
      proc: textoONulo(celda(f, C.proc)),
      motivoRaw: textoONulo(motivo),
      observacionRaw: textoONulo(celda(f, C.observacion)),
      detalleRaw: textoONulo(celda(f, C.detalle)),
      articulosRaw: textoONulo(celda(f, C.articulos)),
      normaRaw: textoONulo(celda(f, C.norma)),
      nombreRaw: textoONulo(celda(f, C.nombre)),
      cedulaRaw: textoONulo(celda(f, C.sancionado)),
      normas: celda(f, C.norma)
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter((s) => !esCitaVacia(s)),
    });
  }

  // --- Pasada 2: insertar dimensiones y obtener sus ids --------------------
  const dimensiones = await dim.volcar();

  // --- Pasada 3: escribir los hechos ---------------------------------------
  let insertadas = 0;
  let actualizadas = 0;

  // Los hashes que ya existen se actualizan; los demas se insertan. Se consulta
  // una sola vez el conjunto ya cargado para no preguntar 27.000 veces.
  const existentes = await prisma.fact_sancion.findMany({
    where: { hashOrigen: { in: preparadas.map((p) => p.hash) } },
    select: { id: true, hashOrigen: true },
  });
  const idPorHash = new Map(existentes.map((e) => [e.hashOrigen!, e.id]));

  // Citas de norma y articulo que la hoja trae pero el catalogo no tiene.
  let sinNormaCitas = 0;
  let sinArticuloCitas = 0;

  const LOTE = 1000;
  for (let i = 0; i < preparadas.length; i += LOTE) {
    const lote = preparadas.slice(i, i + LOTE);

    for (const p of lote) {
      const datos = {
        origenFila: p.filaOrigen,
        origenArchivo: archivoOrigen,
        origenGid: GID,
        fecha: new Date(p.fechaIso),
        fechaId: dim.idDe(p.fechaClave),
        personaId: dim.idDe(p.persona),
        clubId: dim.idDe(p.club),
        sanctionJuegos: p.juegos,
        sanctionDias: p.dias,
        multaUc: p.uc,
        reintegro: p.reintegro,
        alertaSuspension: p.alerta,
        proc: p.proc,
        motivoRaw: p.motivoRaw,
        observacionRaw: p.observacionRaw,
        detalleIncidenciaRaw: p.detalleRaw,
        articulosRaw: p.articulosRaw,
        normaRaw: p.normaRaw,
        nombreRaw: p.nombreRaw,
        cedulaRaw: p.cedulaRaw,
        torneoId: dim.idDe(p.torneo),
        categoriaId: dim.idDe(p.categoria),
        faseId: dim.idDe(p.fase),
        jornadaId: dim.idDe(p.jornada),
        partidoId: dim.idDe(p.partido),
        tipoSancionadoId: dim.idDe(p.tipoSancionado),
        tipoDecisionId: dim.idDe(p.tipoDecision),
        motivoId: dim.idDe(p.motivo),
        tipoInfraccionId: dim.idDe(p.tipoInfraccion),
        observacionId: dim.idDe(p.observacion),
        incidenciaId: dim.idDe(p.incidencia),
        detalleIncidenciaId: dim.idDe(p.detalle),
      };

      // Las tablas hijas se escriben SIEMPRE, tanto en filas nuevas como en las
      // ya existentes: al actualizar por hash hay que reemplazarlas, o quedaria
      // la combinacion de articulos y normas de una version anterior de la fila.
      const filial = async (sancionId: bigint) => {
        await prisma.fact_sancion_flag.deleteMany({ where: { sancionId } });
        await prisma.fact_sancion_norma.deleteMany({ where: { sancionId } });
        await prisma.fact_sancion_articulo.deleteMany({ where: { sancionId } });

        if (p.flags.length) {
          await prisma.fact_sancion_flag.createMany({
            data: p.flags.map((flag) => ({ sancionId, flag })),
            skipDuplicates: true,
          });
        }

        // NORMA: la celda es una combinacion ("NR, RD, RGC"). La primera se marca
        // como principal. Un literal pegado ("RD-NRLFJ") tambien puede traer dos
        // normas, y `idsNorma` devuelve todas las que reconoce. Se guarda el
        // literal tal cual vino para trazabilidad.
        const normas: { normaId: number; literal: string }[] = [];
        for (const literal of p.normas) {
          for (const normaId of dim.idsNorma(literal)) {
            normas.push({ normaId, literal });
          }
        }
        if (normas.length) {
          const vistos = new Set<number>();
          const unicas = normas.filter((n) => !vistos.has(n.normaId) && vistos.add(n.normaId));
          await prisma.fact_sancion_norma.createMany({
            data: unicas.map((n, i) => ({
              sancionId,
              normaId: n.normaId,
              principal: i === 0,
              literal: n.literal,
            })),
            skipDuplicates: true,
          });
        }

        // ARTICULOS: separados por coma o punto y coma, con el prefijo de norma
        // que usa la hoja ("RD-67-6").
        const articulos = (p.articulosRaw ?? '')
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter((s) => !esCitaVacia(s));
        const arts = articulos
          .map((literal) => ({ literal, articuloId: dim.idArticulo(literal) }))
          .filter((a): a is { literal: string; articuloId: number } => a.articuloId !== null);
        if (arts.length) {
          const vistosA = new Set<number>();
          const unicosA = arts.filter(
            (a) => !vistosA.has(a.articuloId) && vistosA.add(a.articuloId),
          );
          await prisma.fact_sancion_articulo.createMany({
            data: unicosA.map((a, i) => ({
              sancionId,
              articuloId: a.articuloId,
              orden: i,
              literal: a.literal,
            })),
            skipDuplicates: true,
          });
        }

        // Cuentan las citas que el catalogo no tiene, para poder avisar en consola en
        // vez de perderlas en silencio.
        sinNormaCitas += p.normas.filter(
          (literal) => dim.idsNorma(literal).length === 0,
        ).length;
        sinArticuloCitas += articulos.filter(
          (literal) => dim.idArticulo(literal) === null,
        ).length;
      };

      const hashPrevio = idPorHash.get(p.hash);
      if (hashPrevio !== undefined) {
        await prisma.fact_sancion.update({ where: { id: hashPrevio }, data: datos });
        actualizadas++;
        await filial(hashPrevio);
      } else {
        const creada = await prisma.fact_sancion.create({
          data: { ...datos, hashOrigen: p.hash },
        });
        idPorHash.set(p.hash, creada.id);
        insertadas++;
        await filial(creada.id);
      }
    }

    process.stdout.write(
      `\r  ${Math.min(i + LOTE, preparadas.length)}/${preparadas.length} sanciones`,
    );
  }
  process.stdout.write('\n');

  if (sinNormaCitas || sinArticuloCitas) {
    console.warn(
      `  [aviso] citas sin resolver: ${sinNormaCitas} de norma, ${sinArticuloCitas} de articulo.` +
        ' El catalogo dim_articulo solo tiene articulos del RD, asi que las citas' +
        ' de las Normas Reguladoras (NR) no tienen a donde apuntar. Los literales' +
        ' quedan guardados en fact_sancion.normaRaw y .articulosRaw.',
    );
  }

  return {
    documento: DOCUMENTO,
    leidas: filas.length,
    insertadas,
    actualizadas,
    omitidas,
    dimensiones,
  };
}
