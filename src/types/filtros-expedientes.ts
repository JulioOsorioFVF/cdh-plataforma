import { Prisma } from '@prisma/client';

/**
 * Filtros de la vista de Expedientes.
 *
 * Van aparte de `FiltrosSancion` a proposito: aquel tipo construye el
 * predicado sobre `v_sancion` (hoja COMPETENCIAS), y estos sobre
 * `v_expedientes` (hoja CUADRO DE EXPEDIENTES). Mezclarlos obligaria a
 * duplicar los mismos campos en dos lugaress con semanticas distintas.
 *
 * A diferencia de las sanciones, aqui los anos y los meses son LISTAS: el
 * contraste de periodos es el objetivo de la vista.
 */

/**
 * A que ano se atribuye la fila.
 *
 * Son dos anos distintos y a veces no coinciden:
 *
 * - `expediente`: el ano en que se CREO el expediente (`fact_expediente.anio`).
 * - `resolucion`: el ano en que se EMITIO el auto o la decision. No esta en
 *   una columna: viaja dentro del texto de `numero_decision` ("Res. 052/2024").
 *   De los 560 expedientes, **145 tienen anos distintos** entre expediente y
 *   resolucion (54 son de 2024 con resolucion de 2025, 33 son de 2025 con
 *   resolucion de 2026…).
 *
 * Importa porque las multas deben caer en el ano en que se sanciono, no en el
 * en que se abrio el expediente: 14.136 de las 32.335 UCFVF del total estan
 * en filas donde los dos anos difieren.
 */
export type AnioBase = 'expediente' | 'resolucion';

/**
 * Semestre del ano: 1 = enero-junio, 2 = julio-diciembre.
 */
export type Semestre = 1 | 2;

/** Un periodo concreto: `"2025-2"` es el segundo semestre de 2025. */
export type Periodo = `${number}-${Semestre}`;

export const ETIQUETA_SEMESTRE: Record<Semestre, string> = {
  1: 'Primer semestre',
  2: 'Segundo semestre',
};

/** Meses que cubre cada semestre, para el predicado SQL. */
export const RANGO_MESES_SEMESTRE: Record<Semestre, [number, number]> = {
  1: [1, 6],
  2: [7, 12],
};

/** `"2025-2"` -> `2025`, `2`. `null` si el texto no tiene esa forma. */
export function desglosarPeriodo(p: string): { anio: number; semestre: Semestre } | null {
  const m = /^(\d{4})-([12])$/.exec(p.trim());
  if (!m) return null;
  return { anio: Number(m[1]), semestre: Number(m[2]) as Semestre };
}

/** `2025`, `2` -> `"2025-2"`. */
export function componerPeriodo(anio: number, semestre: Semestre): Periodo {
  return `${anio}-${semestre}`;
}

/** `"2do semestre de 2025"`, para las etiquetas y el resumen. */
export function describirPeriodo(p: string): string {
  const d = desglosarPeriodo(p);
  if (!d) return p;
  return `${d.semestre === 1 ? '1er' : '2do'} semestre de ${d.anio}`;
}

export type FiltrosExpediente = {
  anios?: number[];
  meses?: number[];
  /**
   * Periodosmarkados en la matriz, cada uno `"YYYY-1"` o `"YYYY-2"`.
   *
   * Va como LISTA y no como un par de desplegables "desde/hasta" porque el caso
   * real no es un intervalo: se quiere "2do semestre de 2025 Y 1er semestre de
   * 2026", sin lo que hay en medio de 2026 ni el 1er semestre de 2025. Con
   * `anios` y `semestres` por separado eso es imposible de expresar, porque el
   * filtro hace producto cruz.
   *
   * Vacio o ausente = no se filtra por periodo, que es el estado inicial: el
   * filtro solo actua cuando quien mira marca alguna celda.
   */
  periodos?: Periodo[];
  /** Que ano manda para filtrar y para agrupar. */
  anioBase?: AnioBase;
  estado?: string;
  conMulta?: boolean;
  cumplimiento?: string;
  compararAnios?: boolean;
  compararMeses?: boolean;
};

export const ETIQUETA_ANIO_BASE: Record<AnioBase, string> = {
  expediente: 'Ano del expediente (creacion)',
  resolucion: 'Ano de la resolucion (emision)',
};

export const NOMBRES_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const FILTROS_EXPEDIENTE_VACIOS: FiltrosExpediente = {};

/**
 * Año de la resolución, sacado del número del acto.
 *
 * OJO con los barras invertidos. Este texto es un template literal de
 * JavaScript, y ahí `\s` y `\d` NO son escapes: valen literalmente `s` y `d`.
 * Hay que escribir `\\s` y `\\d` para que PostgreSQL reciba el regex de
 * verdad. Sin los dobles, el patrón se convierte en `/s*(d{4})`, no casa con
 * nada, el año sale siempre NULL y el `coalesce` de abajo lo reemplaza por la
 * fecha sin avisar. Es un fallo silencioso: los números salen razonables y
 * nadie nota que el año vino de la columna equivocada.
 */
export function exprAnioResolucion(): Prisma.Sql {
  return Prisma.sql`nullif(substring(numero_decision from '/\\s*(\\d{4})'), '')::int`;
}

/**
 * Año de referencia de la fila, segun el modo elegido.
 *
 * El año de la resolucion se saca del texto de `numero_decision`, que es el
 * identificador oficial del acto ("Res. 052/2024" -> 2024). Se recurre a la
 * fecha solo cuando el numero no trae ano. De los 480 casos comparables, el
 * numero y la fecha coinciden en 479, asi que la precedencia es casi
 * irrelevante; se documenta igual para que quede claro cual manda.
 *
 * Ambos años se exponen también por separado en la vista, porque la
 * diferencia entre ellos es informacion, no un error a esconder.
 */
export function exprAnio(f: FiltrosExpediente): Prisma.Sql {
  if (f.anioBase === 'resolucion') {
    return Prisma.sql`coalesce(${exprAnioResolucion()}, extract(year from fecha_resolucion)::int)`;
  }
  return Prisma.sql`anio`;
}

/**
 * Fecha que define el mes, coherente con `exprAnio`.
 *
 * Va acompanada a proposito del año: si el año viene del número de la
 * resolucion, el mes tiene que salir de la fecha de la resolucion. Elegir el
 * año por un lado y la fecha por otro produce filas como "2024 · Enero" que
 * en realidad son de enero de 2026.
 */
export function columnaFecha(f: FiltrosExpediente): Prisma.Sql {
  if (f.anioBase === 'resolucion') {
    return Prisma.sql`coalesce(fecha_resolucion, fecha_auto_entrada, fecha_recepcion)`;
  }
  return Prisma.sql`coalesce(fecha_recepcion, fecha_auto_entrada)`;
}

/**
 * Predicado para `v_expedientes`.
 *
 * El mes se extrae de la fecha coherente con el año elegido. Los expedientes
 * sin ninguna fecha tienen `mes = NULL` y solo aparecen si el filtro de meses
 * esta vacio: si pides "Enero" no tiene sentido que un expediente sin fecha
 * se cuele dentro.
 */
export function filtrosExpedienteWhere(f: FiltrosExpediente): Prisma.Sql {
  const cond: Prisma.Sql[] = [];
  const anio = exprAnio(f);

  if (f.anios?.length) cond.push(Prisma.sql`${anio} IN (${Prisma.join(f.anios)})`);
  if (f.meses?.length) {
    cond.push(
      Prisma.sql`extract(month from ${columnaFecha(f)})::int IN (${Prisma.join(f.meses)})`,
    );
  }

  /**
   * Periodos: una celda es `(año AND mes-dentro-del-semestre)`.
   *
   * El año y el rango de meses van JUNTOS dentro de la misma pareja de
   * paréntesis, y el `OR` entre celdas dentro de otro par. El orden importa:
   * `AND` une antes que `OR`, asi que un `año = 2025 AND mes >= 7 OR mes <= 6`
   * sin agrupar devolvería "cualquier mes del primer semestre, de cualquier
   * año". Ademas el paréntesis exterior es obligatorio para que el `OR` no se
   * coma el `AND` de los filtros que vienen despues (año, estado, con multa).
   *
   * Sin selección no se añade predicado: el filtro no actúa hasta que se marca
   * alguna celda. Un expediente sin fecha tiene mes `NULL`, y
   * `NULL BETWEEN 7 AND 12` no es verdadero, asi que queda fuera. Es lo
   * correcto: no se puede afirmar que un expediente sin fecha cayó en el 2do
   * semestre. La interfaz informa de cuántos se quedan fuera en vez de dejarlos
   * desaparecer sin aviso.
   */
  const periodos = (f.periodos ?? []).map(desglosarPeriodo).filter((p) => p !== null);
  if (periodos.length) {
    const fecha = columnaFecha(f);
    const celdas = periodos.map((p) => {
      const [desde, hasta] = RANGO_MESES_SEMESTRE[p.semestre];
      return Prisma.sql`(${anio} = ${p.anio} AND extract(month from ${fecha})::int BETWEEN ${desde} AND ${hasta})`;
    });
    cond.push(Prisma.sql`(${Prisma.join(celdas, ' OR ')})`);
  }

  if (f.estado) cond.push(Prisma.sql`estado = ${f.estado}`);

  /**
   * El `OR` va SIEMPRE entre parentesis.
   *
   * En SQL `AND` une antes que `OR`, asi que
   * `anio IN (2026) AND uc > 0 OR usd > 0` se lee como
   * `(anio = 2026 AND uc > 0) OR usd > 0`: el `OR` se escapa del filtro de año
   * y devuelve filas de todos los años. No da error, devuelve cifras que
   * parecen razonables y estan mal.
   */
  if (f.conMulta)
    cond.push(Prisma.sql`(coalesce(multa_uc, 0) > 0 OR coalesce(multa_usd, 0) > 0)`);
  if (f.cumplimiento) cond.push(Prisma.sql`cumplimiento_decision = ${f.cumplimiento}`);

  if (cond.length === 0) return Prisma.sql`true`;
  return Prisma.join(cond, ' AND ');
}

/** `2024,2025` -> `[2024, 2025]`. Tolera espacios y vacios. */
function lista(sp: URLSearchParams | Record<string, string>, k: string): number[] | undefined {
  const get = (x: string): string | undefined =>
    sp instanceof URLSearchParams ? (sp.get(x) ?? undefined) : sp[x];
  const crudo = get(k);
  if (!crudo) return undefined;
  const n = crudo
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isInteger(x));
  return n.length ? n : undefined;
}

/**
 * Periodos presentes en la query.
 *
 * Se deduplican y se validan uno por uno con `desglosarPeriodo`, porque un
 * `?periodos=2025-9` escrito a mano no debe colarse en el predicado como un
 * `BETWEEN NULL AND NULL`, ni un `2025` sin semestre.
 */
function periodos(sp: URLSearchParams | Record<string, string>): Periodo[] | undefined {
  const get = (x: string): string | undefined =>
    sp instanceof URLSearchParams ? (sp.get(x) ?? undefined) : sp[x];
  const crudo = get('periodos');
  if (!crudo) return undefined;
  const validos = crudo
    .split(',')
    .map((x) => x.trim())
    .filter((x) => desglosarPeriodo(x) !== null)
    .map((x) => x.trim() as Periodo);
  const unicos = [...new Set(validos)];
  if (!unicos.length) return undefined;
  // Orden cronologico, para que el resumen y la URL se lean en orden.
  return unicos.sort((a, b) => {
    const da = desglosarPeriodo(a)!;
    const db = desglosarPeriodo(b)!;
    return da.anio - db.anio || da.semestre - db.semestre;
  });
}

/** Normaliza a los dos valores permitidos; cualquier otro cae en `expediente`. */
function anioBase(sp: URLSearchParams | Record<string, string>): AnioBase {
  const get = (x: string): string | undefined =>
    sp instanceof URLSearchParams ? (sp.get(x) ?? undefined) : sp[x];
  return get('anioBase') === 'resolucion' ? 'resolucion' : 'expediente';
}

function bandera(sp: URLSearchParams | Record<string, string>, k: string): boolean {
  const get = (x: string): string | undefined =>
    sp instanceof URLSearchParams ? (sp.get(x) ?? undefined) : sp[x];
  return get(k) === '1';
}

export function filtrosExpedienteFromSearch(
  sp: URLSearchParams | Record<string, string>,
): FiltrosExpediente {
  const get = (k: string): string | undefined =>
    sp instanceof URLSearchParams ? (sp.get(k) ?? undefined) : sp[k];
  return {
    anios: lista(sp, 'anios'),
    meses: lista(sp, 'meses'),
    periodos: periodos(sp),
    anioBase: anioBase(sp),
    estado: get('estado'),
    conMulta: bandera(sp, 'conMulta'),
    cumplimiento: get('cumplimiento'),
    compararAnios: bandera(sp, 'compararAnios'),
    compararMeses: bandera(sp, 'compararMeses'),
  };
}

export function filtrosExpedienteToParams(f: FiltrosExpediente): URLSearchParams {
  const p = new URLSearchParams();
  if (f.anios?.length) p.set('anios', f.anios.join(','));
  if (f.meses?.length) p.set('meses', f.meses.join(','));
  if (f.periodos?.length) p.set('periodos', f.periodos.join(','));
  if (f.anioBase && f.anioBase !== 'expediente') p.set('anioBase', f.anioBase);
  if (f.estado) p.set('estado', f.estado);
  if (f.conMulta) p.set('conMulta', '1');
  if (f.cumplimiento) p.set('cumplimiento', f.cumplimiento);
  if (f.compararAnios) p.set('compararAnios', '1');
  if (f.compararMeses) p.set('compararMeses', '1');
  return p;
}
