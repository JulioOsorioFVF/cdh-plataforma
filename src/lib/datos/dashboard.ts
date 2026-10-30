import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type { FiltrosSancion } from '@/types/filtros';
import { filtrosWhere } from '@/types/filtros';

/**
 * Capa de lectura del tablero.
 *
 * Todas las consultas van contra las vistas de
 * `prisma/seeds/03_vistas_analiticas.sql`, de modo que el tablero, los reportes
 * y las exportaciones comparten exactamente la misma definicion de cada
 * indicador. Todos los valores viajan como parametros enlazados.
 */

export type FilaDecision = {
  tipo_decision: string | null;
  total: bigint;
  clubes: bigint;
  personas: bigint;
};

export type FilaClub = {
  club_id: number;
  club: string;
  total_sanciones: bigint;
  partidos: bigint;
  amonestaciones: bigint;
  rojas: bigint;
  suspensiones: bigint;
  multa_usd: number | null;
};

export type FilaMensual = {
  anio: number;
  mes: number;
  nombre_mes: string;
  sanciones: bigint;
  amonestaciones: bigint;
  rojas: bigint;
  suspensiones: bigint;
  multa_usd: number | null;
};

export type FilaFuncion = {
  tipo_sancionado: string | null;
  tipo_decision: string | null;
  total: bigint;
};

export type Totales = {
  total_sanciones: bigint;
  partidos_con_incidencia: bigint;
  clubes_afectados: bigint;
  sancionados_unicos: bigint;
  amonestaciones: bigint;
  tarjetas_rojas: bigint;
  tarjetas_rojas_indirectas: bigint;
  suspensiones: bigint;
  multas: bigint;
  sanciones_club: bigint;
  total_multa_usd: number | null;
};

export async function getTotales(f: FiltrosSancion = {}): Promise<Totales | null> {
  const where = filtrosWhere(f);
  const filas = await prisma.$queryRaw<Totales[]>(Prisma.sql`
    SELECT count(*)                                                    AS total_sanciones,
           count(DISTINCT partido)                                    AS partidos_con_incidencia,
           count(DISTINCT club)                                       AS clubes_afectados,
           count(DISTINCT sancionado)                                 AS sancionados_unicos,
           count(*) FILTER (WHERE tipo_decision = 'Amonestacion')          AS amonestaciones,
           count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja')           AS tarjetas_rojas,
           count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja Indirecta') AS tarjetas_rojas_indirectas,
           count(*) FILTER (WHERE es_suspension)                           AS suspensiones,
           count(*) FILTER (WHERE es_multa)                                AS multas,
           count(*) FILTER (WHERE tipo_sancionado = 'Club')                AS sanciones_club,
           coalesce(sum(multa_usd), 0)                                   AS total_multa_usd
      FROM v_sancion
     WHERE ${where}`);
  return filas[0] ?? null;
}

export async function getDecisiones(f: FiltrosSancion = {}): Promise<FilaDecision[]> {
  const where = filtrosWhere(f);
  return prisma.$queryRaw<FilaDecision[]>(Prisma.sql`
    SELECT tipo_decision,
           count(*)                  AS total,
           count(DISTINCT club)      AS clubes,
           count(DISTINCT sancionado) AS personas
      FROM v_sancion
     WHERE ${where}
     GROUP BY tipo_decision
     ORDER BY total DESC`);
}

export async function getPorFuncion(f: FiltrosSancion = {}): Promise<FilaFuncion[]> {
  const where = filtrosWhere(f);
  return prisma.$queryRaw<FilaFuncion[]>(Prisma.sql`
    SELECT tipo_sancionado, tipo_decision, count(*) AS total
      FROM v_sancion
     WHERE ${where}
     GROUP BY tipo_sancionado, tipo_decision
     ORDER BY tipo_sancionado, total DESC`);
}

export async function getRankingClubes(
  f: FiltrosSancion = {},
  limite = 15,
): Promise<FilaClub[]> {
  const where = filtrosWhere(f);
  return prisma.$queryRaw<FilaClub[]>(Prisma.sql`
    SELECT club_id, club,
           count(*)                                        AS total_sanciones,
           count(DISTINCT partido)                        AS partidos,
           count(*) FILTER (WHERE tipo_decision = 'Amonestacion') AS amonestaciones,
           count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja')  AS rojas,
           count(*) FILTER (WHERE es_suspension)           AS suspensiones,
           coalesce(sum(multa_usd), 0)                    AS multa_usd
      FROM v_sancion
     WHERE ${where} AND club_id IS NOT NULL
     GROUP BY club_id, club
     ORDER BY total_sanciones DESC
     LIMIT ${limite}`);
}

export async function getEvolucionMensual(f: FiltrosSancion = {}): Promise<FilaMensual[]> {
  const where = filtrosWhere(f);
  return prisma.$queryRaw<FilaMensual[]>(Prisma.sql`
    SELECT anio, mes, nombre_mes,
           count(*)                                              AS sanciones,
           count(*) FILTER (WHERE tipo_decision = 'Amonestacion') AS amonestaciones,
           count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja')  AS rojas,
           count(*) FILTER (WHERE es_suspension)                 AS suspensiones,
           coalesce(sum(multa_usd), 0)                          AS multa_usd
      FROM v_sancion
     WHERE ${where}
     GROUP BY anio, mes, nombre_mes
     ORDER BY anio, mes`);
}

export async function getAniosDisponibles(): Promise<number[]> {
  const filas = await prisma.$queryRaw<{ anio: number }[]>(Prisma.sql`
    SELECT DISTINCT anio FROM v_sancion WHERE anio IS NOT NULL ORDER BY anio DESC`);
  return filas.map((f) => f.anio);
}

/**
 * Envoltura para Server Components: si la base no esta disponible todavia,
 * devuelve el estado vacio en lugar de romper la pagina.
 */
export async function seguro<T>(
  carga: () => Promise<T>,
  vacio: T,
): Promise<{ datos: T; error: string | null }> {
  try {
    return { datos: await carga(), error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    return { datos: vacio, error: msg };
  }
}
