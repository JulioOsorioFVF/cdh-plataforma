/* =============================================================================
   CONSEJO DE HONOR FVF — Indices de performance
   Ejecutar despues de la migracion de Prisma.
   ========================================================================== */

-- Indice GIN para busqueda full-text en sanction y partido
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Busqueda de sancionados por nombre (fuzzy, tolerancia a acentos y typos)
CREATE INDEX IF NOT EXISTS ix_persona_nombre_trgm
  ON dim_persona USING gin (nombre_normalizado gin_trgm_ops);

-- Busqueda de articulos por codigo
CREATE INDEX IF NOT EXISTS ix_articulo_codigo_trgm
  ON dim_articulo USING gin (codigo_normalizado gin_trgm_ops);

-- Busqueda de partidos por descripcion
CREATE INDEX IF NOT EXISTS ix_partido_descripcion_trgm
  ON fact_partido USING gin (descripcion gin_trgm_ops);

-- Indice compuesto del dashboard principal: filtros globales en una sola pasada
CREATE INDEX IF NOT EXISTS ix_sancion_dashboard
  ON fact_sancion (fecha_id, torneo_id, categoria_id)
  WHERE archivado = FALSE;

-- Suspensiones activas por persona (consulta frecuente de Jenis Unico)
CREATE INDEX IF NOT EXISTS ix_sancion_suspensiones
  ON fact_sancion (persona_id, fecha DESC)
  WHERE archivado = FALSE;

-- Multas por club y temporada
CREATE INDEX IF NOT EXISTS ix_sancion_multas
  ON fact_sancion (club_id, fecha_id, multa_usd)
  WHERE archivado = FALSE AND multa_usd IS NOT NULL;

-- Expedientes por estado y fecha
CREATE INDEX IF NOT EXISTS ix_expediente_estado_fecha
  ON fact_expediente (estado, fecha_id DESC);

-- Busqueda de expedientes por numero y nombre
CREATE INDEX IF NOT EXISTS ix_expediente_numero_trgm
  ON fact_expediente USING gin (numero gin_trgm_ops);

-- Ingesta: hash de origen para idempotencia
CREATE INDEX IF NOT EXISTS ix_sancion_hash
  ON fact_sancion (hash_origen);
CREATE INDEX IF NOT EXISTS ix_expediente_hash
  ON fact_expediente (hash_origen);

-- Bits de procedencia normativa (flags)
CREATE INDEX IF NOT EXISTS ix_sancion_flag_por_flag
  ON fact_sancion_flag (flag) WHERE activo = TRUE;

-- Vista de texto completo para el buscador global
CREATE OR REPLACE VIEW v_buscador AS
SELECT
  'SANCION'    AS tipo,
  s.id::text   AS id,
  s.fecha      AS fecha,
  coalesce(p.nombre_completo, cl.nombre, s.nombre_raw, s.cedula_raw, '(sin identificar)') AS etiqueta,
  coalesce(cl.nombre, p.club_id::text) AS contexto,
  s.created_at  AS referencia
FROM fact_sancion s
LEFT JOIN dim_persona p ON p.id = s.persona_id
LEFT JOIN dim_club    cl ON cl.id = s.club_id
UNION ALL
SELECT
  'EXPEDIENTE', e.id::text, e.fecha_recepcion,
  coalesce(e.nombre, e.numero, '(sin nombre)'), e.motivo, e.created_at
FROM fact_expediente e
UNION ALL
SELECT
  'CLUB', c.id::text, NULL, c.nombre, c.liga, c.created_at
FROM dim_club c;

-- -----------------------------------------------------------------------------
-- Vistas materializadas (dashboard de alto volumen)
-- Se refrescan con: REFRESH MATERIALIZED VIEW CONCURRENTLY <vista>;
-- -----------------------------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_kpi_mensual AS
SELECT
  anio, mes, nombre_mes, torneo, categoria,
  count(*) AS sanciones,
  count(*) FILTER (WHERE tipo_decision = 'Amonestacion') AS amonestaciones,
  count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja')  AS rojas,
  count(*) FILTER (WHERE es_suspension) AS suspensiones,
  count(*) FILTER (WHERE es_multa)      AS multas,
  coalesce(sum(multa_usd), 0) AS multa_usd,
  now() AS calculado_en
FROM v_sancion
WHERE NOT archivado
GROUP BY anio, mes, nombre_mes, torneo, categoria
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_kpi_mensual
  ON mv_kpi_mensual (coalesce(anio,0), coalesce(mes,0), coalesce(torneo,''), coalesce(categoria,''));
CREATE INDEX IF NOT EXISTS ix_mv_kpi_mensual_anio ON mv_kpi_mensual (anio);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ranking_clubes AS
SELECT
  anio, torneo, categoria, club_id, club,
  count(*) AS sanciones,
  count(DISTINCT partido) AS partidos,
  coalesce(sum(multa_usd), 0) AS multa_usd,
  row_number() OVER (PARTITION BY anio, torneo, categoria ORDER BY count(*) DESC) AS posicion,
  now() AS calculado_en
FROM v_sancion
WHERE NOT archivado AND club_id IS NOT NULL
GROUP BY anio, torneo, categoria, club_id, club
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_ranking_clubes
  ON mv_ranking_clubes (coalesce(anio,0), coalesce(torneo,''), coalesce(categoria,''), club_id);
CREATE INDEX IF NOT EXISTS ix_mv_ranking_clubes_pos ON mv_ranking_clubes (anio, posicion);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_matriz_jornadas AS
SELECT anio, torneo, categoria, jornada, partido,
  count(*) FILTER (WHERE tipo_decision = 'Amonestacion') AS amarillas,
  count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja')  AS rojas,
  count(*) FILTER (WHERE es_suspension) AS suspensiones,
  now() AS calculado_en
FROM v_sancion
WHERE NOT archivado
GROUP BY anio, torneo, categoria, jornada, partido
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_matriz_jornadas
  ON mv_matriz_jornadas (coalesce(anio,0), coalesce(torneo,''), coalesce(categoria,''), coalesce(jornada,''), coalesce(partido,''));

-- Funcion de refresco
CREATE OR REPLACE FUNCTION refrescar_materializadas()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_kpi_mensual;
  REFRESH MATERIALIZED VIEW mv_ranking_clubes;
  REFRESH MATERIALIZED VIEW mv_matriz_jornadas;
END;
$$ LANGUAGE plpgsql;
