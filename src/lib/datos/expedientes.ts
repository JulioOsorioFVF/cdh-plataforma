import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type { FiltrosExpediente } from '@/types/filtros-expedientes';
import {
  columnaFecha,
  exprAnio,
  exprAnioResolucion,
  filtrosExpedienteWhere,
} from '@/types/filtros-expedientes';

/**
 * Capa de lectura de la vista de Expedientes.
 *
 * Mismo criterio que el resto del proyecto: todo va contra `v_expedientes`
 * con parametros enlazados, y la vista no recalcula reglas de negocio.
 *
 * La tabla pide agrupar Año > Mes > Fecha > Nº de decision, asi que aqui se
 * devuelve la fila mas fina del dato (una fila por auto y sancionado) y es
 * el componente quien arma el arbol. Con 560 expedientes el conjunto es
 * trivial y asi las sumas del padre y del hijo nunca pueden discrepar.
 */

/** Fila mas fina: un auto, en una fecha, para un sancionado. */
export type FilaMulta = {
  /** Año por el que se agrupa: el del expediente o el de la resolucion. */
  anio: number | null;
  /** Año de creacion del expediente, siempre presente. */
  anio_expediente: number;
  /** Año de emision de la resolucion, si el numero lo trae. */
  anio_resolucion: number | null;
  mes: number | null;
  nombre_mes: string | null;
  fecha: Date | null;
  numero_decision: string | null;
  numero: string;
  sancionado_raw: string | null;
  multa_uc: number;
  multa_usd: number;
};

export type OpcionAnio = { anio: number; expedientes: number };

/**
 * `count(*)` en PostgreSQL devuelve `bigint`, y Prisma lo entrega como
 * `BigInt`. Todas las cuentas de esta vista se castean a `::int` en el SQL
 * para que el tipo TypeScript sea cierto: declararlas `number` sin castear
 * hacia que `sum` explota en tiempo de ejecucion mezclando BigInt y number.
 */

export type BarraMulta = {
  sancionado: string;
  multa_uc: number;
  multa_usd: number;
  expedientes: number;
};

/** Como se escribe `sancionado_raw`: tildes y puntuacion ignoradas. */
export type DiagnosticoSancionados = {
  /** Formas de escritura distintas tal cual llegan de la hoja. */
  formas: number;
  /** Entidades distintas ignorando tildes, mayusculas, espacios y puntos. */
  entidades: number;
  /** Grupos escritos de mas de una forma, solo por tildes o puntuacion. */
  variantes: number;
  ejemplos: { clave: string; formas: string[] }[];
};

/**
 * Anios disponibles con su peso, segun el modo de atribucion.
 *
 * En modo `resolucion` el año sale del numero del acto, asi que el listado de
 * años no es el mismo que en modo `expediente`: 2026 tiene 60 expedientes
 * pero solo 56 resoluciones emitidas ese ano.
 *
 * `count(*) FILTER (WHERE ... > 0)` cuenta solo los expedientes con multa:
 * una opcion que al final no muestra nada no debe aparecer en el filtro.
 */
export async function getAniosExpedientes(f: FiltrosExpediente = {}): Promise<OpcionAnio[]> {
  const anio = exprAnio(f);
  return prisma.$queryRaw<OpcionAnio[]>(Prisma.sql`
    SELECT ${anio} AS anio, count(*)::int AS expedientes
      FROM v_expedientes
     WHERE ${anio} IS NOT NULL
     GROUP BY 1
     ORDER BY 1 DESC`);
}

/** Valores disponibles para el filtro de estado. */
export async function getEstadosExpedientes(): Promise<string[]> {
  const filas = await prisma.$queryRaw<{ estado: string | null }[]>(Prisma.sql`
    SELECT DISTINCT estado FROM v_expedientes WHERE estado IS NOT NULL ORDER BY estado`);
  // El `IS NOT NULL` de arriba ya lo garantiza; el filtro es para que TypeScript
  // lo sepa tambien y no devuelva `string[]` con un hueco.
  return filas.map((f) => f.estado).filter((e): e is string => e !== null);
}

export type CeldaPeriodo = {
  anio: number;
  semestre: 1 | 2;
  expedientes: number;
};

export type TableroPeriodos = {
  /** Celdas con conteo, para pintar la matriz. Las vacias se omiten. */
  celdas: CeldaPeriodo[];
  /**
   * Expedientes del filtro actual SIN fecha de referencia.
   *
   * No son un semestre, asi que ningun filtro de periodo puede capturarlos.
   * Se exponen para que la interfaz lo diga en voz alta: si no, al marcar
   * "1er semestre 2026" el total baja de 60 a 34 y no hay forma de saber que
   * los otros 26 se quedaron fuera por no tener fecha, no por estar mal.
   */
  sinFecha: number;
  /** Expedientes que el filtro actual tiene en total, con y sin fecha. */
  total: number;
};

/**
 * Conteos por celda `(año, semestre)` para la matriz de periodos.
 *
 * Ignora el filtro `periodos` a proposito: la matriz tiene que mostrar todas las
 * celdas disponibles para que se pueda marcar y desmarcar. Si se filtrara, al
 * marcar una celda desaparecerian las demas y no habria forma de volver.
 *
 * Las celdas vacias no se devuelven; el componente las pinta igual en cero, que
 * es informacion: un semestre sin expedientes es un dato, no un hueco.
 */
export async function getPeriodosExpedientes(
  f: FiltrosExpediente = {},
): Promise<TableroPeriodos> {
  const { periodos: _omitido, ...resto } = f;
  const where = filtrosExpedienteWhere(resto);
  const anio = exprAnio(f);
  const fecha = columnaFecha(f);
  const mes = Prisma.sql`extract(month from ${fecha})::int`;

  // Una sola consulta trae las tres cosas que hacen falta: el desglose por
  // celda, el total y cuantos quedan fuera por no tener fecha.
  const filas = await prisma.$queryRaw<
    {
      anio: number;
      semestre: number | null;
      expedientes: number;
      sin_fecha: number;
    }[]
  >(Prisma.sql`
    SELECT ${anio}                                                          AS anio,
           CASE WHEN ${mes} BETWEEN 1 AND 6 THEN 1
                WHEN ${mes} BETWEEN 7 AND 12 THEN 2
           END                                                               AS semestre,
           count(*)::int                                                    AS expedientes,
           count(*) FILTER (WHERE ${fecha} IS NULL)::int                    AS sin_fecha
      FROM v_expedientes
     WHERE ${where} AND ${anio} IS NOT NULL
     GROUP BY 1, 2
     ORDER BY 1, 2`);

  const celdas: CeldaPeriodo[] = [];
  let total = 0;
  let sinFecha = 0;

  for (const fila of filas) {
    total += fila.expedientes;
    sinFecha += fila.sin_fecha;
    // El grupo con `semestre = NULL` son los que no tienen fecha: son los
    // descartes del filtro, no una celda del tablero.
    if (fila.semestre === 1 || fila.semestre === 2) {
      celdas.push({
        anio: fila.anio,
        semestre: fila.semestre,
        expedientes: fila.expedientes,
      });
    }
  }

  return { celdas, sinFecha, total };
}

/**
 * Multas de la hoja CUADRO DE EXPEDIENTES, en su fila mas fina.
 *
 * El año y el mes salen siempre del mismo hecho (`exprAnio` y
 * `columnaFecha` van acompaniados), de modo que no se puede mezclar el año de
 * creacion con el mes de emision: eso daria filas "2024 · Enero" que en
 * realidad son de enero de 2026.
 *
 * Se devuelven los dos anos por separado para que la vista pueda mostrar la
 * diferencia: es informacion que el Consejo necesita, no un error a tapar.
 *
 * Se coalesce a 0 para que el padre y el hijo sumen exactamente igual.
 */
export async function getPivotMultas(f: FiltrosExpediente = {}): Promise<FilaMulta[]> {
  const where = filtrosExpedienteWhere(f);
  const anio = exprAnio(f);
  const anioRes = exprAnioResolucion();
  return prisma.$queryRaw<FilaMulta[]>(Prisma.sql`
    SELECT ${anio}                                                AS anio,
           anio                                                   AS anio_expediente,
           ${anioRes}                                             AS anio_resolucion,
           extract(month from ${columnaFecha(f)})::int          AS mes,
           to_char(${columnaFecha(f)}, 'FMMonth')                AS nombre_mes,
           ${columnaFecha(f)}::date                              AS fecha,
           numero_decision,
           numero,
           coalesce(sancionado_raw, 'SIN SANCIONADO')            AS sancionado_raw,
           coalesce(multa_uc, 0)::float8                         AS multa_uc,
           coalesce(multa_usd, 0)::float8                        AS multa_usd
      FROM v_expedientes
     WHERE ${where}
     ORDER BY 1, mes NULLS LAST, fecha NULLS LAST, numero`);
}

/**
 * Total de multa en UCFVF por sancionado, de mayor a menor.
 *
 * Mezcla clubes y personas a proposito: `sancionado_raw` no distingue, y en
 * la hoja ambos aparecen igual. Quien necesite separarlos debe pedirlo
 * explicitamente, no inferirlo de un texto libre.
 *
 * El limite evita que un nombre mal escrito contamine el grafico.
 */
export async function getMultasPorSancionado(
  f: FiltrosExpediente = {},
  limite = 25,
): Promise<BarraMulta[]> {
  const where = filtrosExpedienteWhere(f);
  return prisma.$queryRaw<BarraMulta[]>(Prisma.sql`
    SELECT coalesce(sancionado_raw, 'SIN SANCIONADO')  AS sancionado,
           coalesce(sum(multa_uc), 0)::float8          AS multa_uc,
           coalesce(sum(multa_usd), 0)::float8         AS multa_usd,
           count(*)                                   AS expedientes
      FROM v_expedientes
     WHERE ${where}
     GROUP BY 1
     HAVING coalesce(sum(multa_uc), 0) > 0
     ORDER BY multa_uc DESC, sancionado
     LIMIT ${limite}`);
}

/**
 * Como esta escrito `sancionado_raw` en el filtro actual.
 *
 * OJO con lo que esto NO es. "DEPORTIVO TACHIRA" (club) y "TACHIRA"
 * (seleccion de estado) son entidades distintas y deben seguir separadas:
 * quitar palabras para "unificar" nombres fundiria un club con una seleccion.
 * Por eso aqui SOLO se ignoran tildes, mayusculas, espacios y puntos, que es
 * lo unico que no cambia el significado. Cualquier otra normalizacion queda
 * fuera a proposito.
 *
 * `variantes` cuenta los grupos que aparecen escritos de mas de una forma
 * SOLO por tildes o puntuacion. No es un defecto de la hoja ni algo que el
 * sistema intente arreglar: es informacion para que quien lee sepa cuantos
 * nombres hay en pantalla.
 */
export async function getVariantesDeEscritura(
  f: FiltrosExpediente = {},
): Promise<DiagnosticoSancionados> {
  const where = filtrosExpedienteWhere(f);
  const filas = await prisma.$queryRaw<DiagnosticoSancionados[]>(Prisma.sql`
    WITH base AS (
      SELECT DISTINCT btrim(sancionado_raw) AS forma
        FROM v_expedientes
       WHERE ${where} AND sancionado_raw IS NOT NULL AND btrim(sancionado_raw) <> ''
    ),
    grupos AS (
      SELECT lower(regexp_replace(forma, '[^[:alnum:]]+', '', 'g')) AS clave,
             array_agg(forma ORDER BY forma) AS formas,
             count(*) AS variantes
        FROM base
         GROUP BY 1
    )
    SELECT (SELECT count(*)::int FROM base)                            AS formas,
           (SELECT count(*)::int FROM grupos)                          AS entidades,
           (SELECT count(*)::int FROM grupos WHERE variantes > 1)     AS variantes,
           coalesce((
             SELECT json_agg(json_build_object('clave', clave, 'formas', formas))
               FROM (SELECT * FROM grupos WHERE variantes > 1
                      ORDER BY variantes DESC, clave LIMIT 5) g
           ), '[]'::json)                                               AS ejemplos`);
  const d = filas[0];
  return {
    formas: d?.formas ?? 0,
    entidades: d?.entidades ?? 0,
    variantes: d?.variantes ?? 0,
    ejemplos: d?.ejemplos ?? [],
  };
}
