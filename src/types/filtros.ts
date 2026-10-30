import { Prisma } from '@prisma/client';

/**
 * Tipos compartidos de los filtros globales.
 * Se usan en la barra de filtros, en las consultas de las vistas y en la
 * exportacion a PDF/Excel/CSV, para garantizar que el dato exportado sea
 * exactamente el que el usuario ve en pantalla.
 */

export type FiltrosSancion = {
  anio?: number;
  torneo?: string;
  categoria?: string;
  fase?: string;
  jornada?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  tipoSancionado?: string;
  tipoDecision?: string;
  motivo?: string;
  tipoInfraccion?: string;
  norma?: string;
  articulo?: string;
  club?: string;
  persona?: string;
  incidencia?: string;
  soloMultas?: boolean;
  soloSuspensiones?: boolean;
};

export const FILTROS_VACIOS: FiltrosSancion = {};

/** Opciones de un control de filtrado, servidas desde las dimensiones. */
export type OpcionFiltro = { valor: string; etiqueta: string; total?: number };

/** Etiquetas visuales de cada tipo de decisión (badge). */
export const CLASE_DECISION: Record<string, string> = {
  Amonestacion: 'badge badge-amarilla',
  'Tarjeta Roja': 'badge badge-roja',
  'Tarjeta Roja Indirecta': 'badge badge-roja-indirecta',
  Suspension: 'badge badge-suspension',
  Multa: 'badge badge-multa',
};

/** Normaliza un objeto de filtros a query params de la URL. */
export function filtrosToParams(f: FiltrosSancion): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === '' || v === false) continue;
    p.set(k, String(v));
  }
  return p;
}

/** Lee los filtros globales desde la query string de la URL. */
export function filtrosFromSearch(
  sp: URLSearchParams | Record<string, string>,
): FiltrosSancion {
  const get = (k: string): string | undefined => {
    if (sp instanceof URLSearchParams) return sp.get(k) ?? undefined;
    return sp[k];
  };
  const anio = get('anio');
  return {
    anio: anio ? Number(anio) : undefined,
    torneo: get('torneo'),
    categoria: get('categoria'),
    fase: get('fase'),
    jornada: get('jornada'),
    fechaDesde: get('fechaDesde'),
    fechaHasta: get('fechaHasta'),
    tipoSancionado: get('tipoSancionado'),
    tipoDecision: get('tipoDecision'),
    motivo: get('motivo'),
    tipoInfraccion: get('tipoInfraccion'),
    norma: get('norma'),
    articulo: get('articulo'),
    club: get('club'),
    persona: get('persona'),
    incidencia: get('incidencia'),
    soloMultas: get('soloMultas') === '1',
    soloSuspensiones: get('soloSuspensiones') === '1',
  };
}

/**
 * Construye el predicado para `v_sancion` como fragmentos `Prisma.Sql`.
 * Los valores viajan SIEMPRE como parametros enlazados; nunca se interpolan
 * en la cadena SQL, de modo que un filtro malicioso no puede inyectar codigo.
 */
export function filtrosWhere(f: FiltrosSancion): Prisma.Sql {
  const cond: Prisma.Sql[] = [Prisma.sql`NOT archivado`];

  if (f.anio) cond.push(Prisma.sql`anio = ${f.anio}`);
  if (f.torneo) cond.push(Prisma.sql`torneo = ${f.torneo}`);
  if (f.categoria) cond.push(Prisma.sql`categoria = ${f.categoria}`);
  if (f.fase) cond.push(Prisma.sql`fase = ${f.fase}`);
  if (f.jornada) cond.push(Prisma.sql`jornada = ${f.jornada}`);
  if (f.fechaDesde) cond.push(Prisma.sql`fecha >= ${f.fechaDesde}::date`);
  if (f.fechaHasta) cond.push(Prisma.sql`fecha <= ${f.fechaHasta}::date`);
  if (f.tipoSancionado) cond.push(Prisma.sql`tipo_sancionado = ${f.tipoSancionado}`);
  if (f.tipoDecision) cond.push(Prisma.sql`tipo_decision = ${f.tipoDecision}`);
  if (f.motivo) cond.push(Prisma.sql`motivo = ${f.motivo}`);
  if (f.tipoInfraccion) cond.push(Prisma.sql`tipo_infraccion = ${f.tipoInfraccion}`);
  if (f.norma) cond.push(Prisma.sql`norma_codigo = ${f.norma}`);
  if (f.club) cond.push(Prisma.sql`club = ${f.club}`);
  if (f.incidencia) cond.push(Prisma.sql`incidencia = ${f.incidencia}`);
  if (f.soloMultas) cond.push(Prisma.sql`es_multa`);
  if (f.soloSuspensiones) cond.push(Prisma.sql`es_suspension`);

  // Articulo y persona viven en tablas de detalle: se resuelven con EXISTS
  // para no duplicar filas ni alterar los conteos.
  if (f.articulo) {
    cond.push(Prisma.sql`EXISTS (
      SELECT 1 FROM fact_sancion_articulo sa
      JOIN dim_articulo a ON a.id = sa.articulo_id
      WHERE sa.sancion_id = v_sancion.sancion_id
        AND a.codigo = ${f.articulo}
    )`);
  }
  if (f.persona) {
    cond.push(
      Prisma.sql`(sancionado ILIKE ${`%${f.persona}%`} OR cedula ILIKE ${`%${f.persona}%`})`,
    );
  }

  return Prisma.join(cond, ' AND ');
}
