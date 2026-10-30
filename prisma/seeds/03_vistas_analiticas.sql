/* =============================================================================
   CONSEJO DE HONOR FVF — Vistas analiticas
   Replican las 14 secciones del informe (dashboard.html) sobre el modelo
   dimensional. Todas respetan los filtros globales de la aplicacion.
   ========================================================================== */

-- -----------------------------------------------------------------------------
-- 0. Vista base: sancion Enriched.
-- Unifica los joins para que cada vista de negocio sea simple y rapida.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_sancion AS
SELECT
  s.id                AS sancion_id,
  s.fecha,
  f.anio,
  f.trimestre,
  f.mes,
  f.nombre_mes,
  s.archivado,
  s.origen_registro,
  t.nombre            AS torneo,
  c.nombre            AS categoria,
  fa.nombre           AS fase,
  j.nombre            AS jornada,
  pa.numero_acta       AS acta,
  pa.descripcion      AS partido,
  pa.fecha_acta,
  ts.nombre           AS tipo_sancionado,
  td.nombre           AS tipo_decision,
  td.es_multa          AS es_multa,
  td.es_suspension     AS es_suspension,
  m.nombre            AS motivo,
  ti.nombre           AS tipo_infraccion,
  o.texto             AS observacion,
  n.codigo            AS norma_codigo,
  n.nombre            AS norma,
  COALESCE(
    (SELECT string_agg(n2.codigo, ', ' ORDER BY sn.principal DESC, n2.codigo)
       FROM fact_sancion_norma sn
       JOIN dim_norma n2 ON n2.id = sn.norma_id
      WHERE sn.sancion_id = s.id),
    n.codigo
  ) AS normas,
  s.proc              AS comision,
  s.motivo_raw,
  s.norma_raw,
  s.observacion_raw,
  s.detalle_incidencia_raw,
  s.articulos_raw,
  s.nombre_raw,
  s.cedula_raw,
  cl.nombre           AS club,
  cl.id               AS club_id,
  p.id                AS persona_id,
  p.cedula,
  p.nombre_completo    AS sancionado,
  p.rol_habitual::text AS rol_habitual,
  s.sanction_juegos    AS juegos_suspension,
  s.sanction_dias      AS dias_suspension,
  s.multa_uc,
  s.multa_usd,
  s.tasa_usd,
  s.reintegro,
  s.alerta_suspension,
  s.incidencia_id,
  di.nombre           AS incidencia,
  ddi.nombre          AS detalle_incidencia,
  COALESCE(
    (SELECT string_agg(a.codigo, ', ' ORDER BY sa.orden)
       FROM fact_sancion_articulo sa
       JOIN dim_articulo a ON a.id = sa.articulo_id
      WHERE sa.sancion_id = s.id),
    s.articulos_raw
  ) AS articulos,
  (SELECT count(*) FROM fact_sancion_articulo sa WHERE sa.sancion_id = s.id) AS n_articulos
FROM fact_sancion s
LEFT JOIN dim_fecha   f  ON f.id  = s.fecha_id
LEFT JOIN dim_torneo  t  ON t.id  = s.torneo_id
LEFT JOIN dim_categoria c ON c.id = s.categoria_id
LEFT JOIN dim_fase    fa ON fa.id = s.fase_id
LEFT JOIN dim_jornada j  ON j.id  = s.jornada_id
LEFT JOIN fact_partido pa ON pa.id = s.partido_id
LEFT JOIN dim_tipo_sancionado ts ON ts.id = s.tipo_sancionado_id
LEFT JOIN dim_tipo_decision   td ON td.id = s.tipo_decision_id
LEFT JOIN dim_motivo          m  ON m.id  = s.motivo_id
LEFT JOIN dim_tipo_infraccion ti ON ti.id = s.tipo_infraccion_id
LEFT JOIN dim_observacion     o  ON o.id  = s.observacion_id
LEFT JOIN dim_norma           n  ON n.id  = s.norma_id
LEFT JOIN dim_club            cl ON cl.id = s.club_id
LEFT JOIN dim_persona         p  ON p.id  = s.persona_id
LEFT JOIN dim_incidencia_licencia di  ON di.id  = s.incidencia_id
LEFT JOIN dim_detalle_incidencia   ddi ON ddi.id = s.detalle_incidencia_id;

-- -----------------------------------------------------------------------------
-- 1. Panel de control: KPIs globales
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_kpi_general AS
SELECT
  anio,
  count(*)                                                        AS total_sanciones,
  count(DISTINCT partido)                                        AS partidos_con_incidencia,
  count(DISTINCT club)                                           AS clubes_afectados,
  count(DISTINCT sancionado)                                     AS sancionados_unicos,
  count(*) FILTER (WHERE tipo_decision = 'Amonestacion')        AS amonestaciones,
  count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja')         AS tarjetas_rojas,
  count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja Indirecta') AS tarjetas_rojas_indirectas,
  count(*) FILTER (WHERE es_suspension)                          AS suspensiones,
  count(*) FILTER (WHERE es_multa)                               AS multas,
  count(*) FILTER (WHERE tipo_sancionado = 'Club')               AS sanciones_club,
  count(*) FILTER (WHERE tipo_sancionado = 'Cuerpo Tecnico')     AS sanciones_cuerpo_tecnico,
  count(*) FILTER (WHERE tipo_sancionado = 'Jugador')            AS sanciones_jugador,
  coalesce(sum(multa_usd), 0)                                     AS total_multa_usd,
  coalesce(sum(multa_uc), 0)                                      AS total_multa_uc
FROM v_sancion
WHERE NOT archivado
GROUP BY anio;

-- -----------------------------------------------------------------------------
-- 2. Sancionados por funcion (tipo de sancionado) x decision
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_sancionados_por_funcion AS
SELECT anio, torneo, categoria, tipo_sancionado, tipo_decision, count(*) AS total
FROM v_sancion
WHERE NOT archivado
GROUP BY anio, torneo, categoria, tipo_sancionado, tipo_decision;

-- -----------------------------------------------------------------------------
-- 3. Tipos de decisiones (distribucion)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tipos_decision AS
SELECT anio, torneo, categoria, tipo_decision, count(*) AS total,
       count(DISTINCT club) AS clubes, count(DISTINCT sancionado) AS personas
FROM v_sancion
WHERE NOT archivado
GROUP BY anio, torneo, categoria, tipo_decision;

-- -----------------------------------------------------------------------------
-- 4. Motivos de infraccion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_motivos_infraccion AS
SELECT anio, torneo, categoria, tipo_infraccion, motivo, count(*) AS total
FROM v_sancion
WHERE NOT archivado
GROUP BY anio, torneo, categoria, tipo_infraccion, motivo;

-- -----------------------------------------------------------------------------
-- 5. Normativas afectadas (por norma y por articulo)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_normativas_afectadas AS
SELECT anio, torneo, categoria, norma_codigo, norma, count(*) AS total,
       count(DISTINCT club) AS clubes, count(DISTINCT sancionado) AS personas
FROM v_sancion
WHERE NOT archivado AND norma_codigo IS NOT NULL
GROUP BY anio, torneo, categoria, norma_codigo, norma;

CREATE OR REPLACE VIEW v_articulos_infringidos AS
SELECT sa.articulo_id, a.codigo, n.codigo AS norma_codigo, n.nombre AS norma,
       v.anio, v.torneo, v.categoria, v.club, count(*) AS usos
FROM fact_sancion_articulo sa
JOIN dim_articulo a ON a.id = sa.articulo_id
JOIN dim_norma   n ON n.id = a.norma_id
JOIN v_sancion   v ON v.sancion_id = sa.sancion_id
WHERE NOT v.archivado
GROUP BY sa.articulo_id, a.codigo, n.codigo, n.nombre, v.anio, v.torneo, v.categoria, v.club;

-- -----------------------------------------------------------------------------
-- 6. Clubes con mayor sancion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_clubes_sancionados AS
SELECT anio, torneo, categoria, club_id, club,
       count(*) AS total_sanciones,
       count(DISTINCT partido) AS partidos,
       count(*) FILTER (WHERE tipo_decision = 'Amonestacion') AS amonestaciones,
       count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja')  AS rojas,
       count(*) FILTER (WHERE es_suspension) AS suspensiones,
       coalesce(sum(multa_usd), 0) AS multa_usd,
       coalesce(sum(multa_uc), 0)  AS multa_uc
FROM v_sancion
WHERE NOT archivado AND club_id IS NOT NULL
GROUP BY anio, torneo, categoria, club_id, club;

-- -----------------------------------------------------------------------------
-- 7. Analisis de suspendidos (por persona, con jogos suspension)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_suspendidos AS
SELECT anio, torneo, categoria, persona_id, cedula, sancionado, club, rol_habitual,
       sum(coalesce(juegos_suspension, 0)) AS total_juegos,
       sum(coalesce(dias_suspension, 0))   AS total_dias,
       count(*) AS registros
FROM v_sancion
WHERE NOT archivado AND es_suspension AND persona_id IS NOT NULL
GROUP BY anio, torneo, categoria, persona_id, cedula, sancionado, club, rol_habitual;

-- -----------------------------------------------------------------------------
-- 8. Multas en USD por club
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_multas_por_club AS
SELECT anio, torneo, categoria, club_id, club,
       count(*) AS registros,
       coalesce(sum(multa_uc), 0)  AS multa_uc,
       coalesce(sum(multa_usd), 0) AS multa_usd
FROM v_sancion
WHERE NOT archivado AND club_id IS NOT NULL AND coalesce(multa_usd, 0) > 0
GROUP BY anio, torneo, categoria, club_id, club;

-- -----------------------------------------------------------------------------
-- 9. Incidencias de licencia por club y detalle
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_incidencias_por_club AS
SELECT anio, torneo, categoria, club_id, club, incidencia, detalle_incidencia,
       count(*) AS total
FROM v_sancion
WHERE NOT archivado AND club_id IS NOT NULL AND incidencia IS NOT NULL
GROUP BY anio, torneo, categoria, club_id, club, incidencia, detalle_incidencia;

-- -----------------------------------------------------------------------------
-- 10. Matriz de tarjetas por jornada (heatmap)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_matriz_tarjetas_jornada AS
SELECT anio, torneo, categoria, jornada, partido, acta,
       count(*) FILTER (WHERE tipo_decision = 'Amonestacion')         AS amarillas,
       count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja')          AS rojas,
       count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja Indirecta') AS rojas_indirectas,
       count(*) FILTER (WHERE es_suspension)                           AS suspensiones,
       count(*) AS total
FROM v_sancion
WHERE NOT archivado
GROUP BY anio, torneo, categoria, jornada, partido, acta;

-- -----------------------------------------------------------------------------
-- 11. Sanciones a ligas, comisiones y organismos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_sanciones_organismos AS
SELECT anio, torneo, categoria, tipo_sancionado, sancionado, club,
       tipo_decision, motivo, norma, articulos, multa_usd, fecha
FROM v_sancion
WHERE NOT archivado AND tipo_sancionado IN ('Comision', 'Liga', 'Organizador')
ORDER BY fecha DESC;

-- -----------------------------------------------------------------------------
-- 12. Detalle de tarjetas por club y sancionado (drill-down)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_detalle_tarjetas AS
SELECT anio, torneo, categoria, club, sancionado, cedula, tipo_sancionado,
       tipo_decision, motivo, observacion, norma, articulos, partido, jornada, fecha
FROM v_sancion
WHERE NOT archivado AND tipo_decision IN ('Amonestacion', 'Tarjeta Roja', 'Tarjeta Roja Indirecta')
ORDER BY anio DESC, fecha DESC;

-- -----------------------------------------------------------------------------
-- 13. Expedientes: estado y tiempos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_expedientes AS
SELECT
  e.id, e.numero, e.anio, e.nombre, e.motivo, e.sub_motivo, e.liga_torneo,
  e.estatus, e.estado::text AS estado, e.fecha_recepcion, e.fecha_resolucion, e.dias_tramitacion,
  e.auto_entrada, e.fecha_auto_entrada, e.equipos,
  e.tramite_raw AS tramite_raw, e.modalidad, e.asignado,
  e.fecha_asignacion, e.fecha_seguimiento, e.alerta,
  e.numero_decision, e.sancion_raw, e.sancionado_raw,
  e.multa_uc, e.multa_usd, e.cumplimiento_decision, e.motivo_cumplimiento,
  t.nombre AS torneo, c.nombre AS categoria,
  p1.tipo::text AS parte1_tipo, p1.nombre AS parte1_nombre, p1.cedula AS parte1_cedula,
  p2.tipo::text AS parte2_tipo, p2.nombre AS parte2_nombre, p2.cedula AS parte2_cedula,
  (SELECT count(*) FROM fact_expediente_movimiento m WHERE m.expediente_id = e.id) AS n_movimientos,
  (SELECT count(*) FROM fact_sancion_expediente se WHERE se.expediente_id = e.id) AS n_sanciones,
  (SELECT string_agg(m.tipo::text || COALESCE(' ' || m.codigo, ''), ' | ' ORDER BY m.fecha NULLS FIRST, m.orden)
     FROM fact_expediente_movimiento m WHERE m.expediente_id = e.id) AS movimientos,
  (SELECT count(*) FROM fact_admin_multa am WHERE am.expediente_id = e.id) AS n_multas
FROM fact_expediente e
LEFT JOIN dim_torneo    t ON t.id = e.torneo_id
LEFT JOIN dim_categoria c ON c.id = e.categoria_id
LEFT JOIN fact_expediente_parte p1 ON p1.expediente_id = e.id AND p1.orden = 1
LEFT JOIN fact_expediente_parte p2 ON p2.expediente_id = e.id AND p2.orden = 2;

CREATE OR REPLACE VIEW v_expedientes_resumen AS
SELECT anio, estado, count(*) AS total,
       round(avg(dias_tramitacion)::numeric, 1) AS dias_promedio,
       min(fecha_recepcion) AS primero, max(fecha_recepcion) AS ultimo
FROM v_expedientes
GROUP BY anio, estado;

-- -----------------------------------------------------------------------------
-- 14. Administracion / finanzas: multas, pagos y saldos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_admin_multas AS
SELECT
  am.id AS multa_id,
  am.fecha_registro,
  am.fecha_recepcion_resol,
  am.fecha_pago,
  am.fecha_factura,
  am.club_nombre          AS club,
  am.club_id,
  am.torneo_nombre        AS torneo,
  am.torneo_id,
  am.categoria_nombre     AS categoria,
  am.categoria_id,
  am.temporada,
  am.tipo_registro,
  am.fase_nombre          AS fase,
  am.jornada_nombre       AS jornada,
  am.numero_resolucion,
  am.unidad_convertible,
  am.total_multa,
  am.pagado_bs,
  am.tasa_bcv,
  am.pagado_usd,
  am.numero_factura,
  am.numero_comprobante,
  am.observaciones,
  am.saldo,
  am.pagado,
  am.expediente_id,
  coalesce(am.total_multa, 0) - coalesce(am.pagado_bs, 0) AS saldo_calculado
FROM fact_admin_multa am;

CREATE OR REPLACE VIEW v_admin_saldos AS
SELECT club,
       count(*) AS registros,
       sum(coalesce(total_multa, 0)) AS total_multa_uc,
       sum(coalesce(pagado_bs, 0))   AS total_pagado_bs,
       sum(coalesce(saldo, 0))       AS saldo,
       sum(CASE WHEN NOT pagado THEN coalesce(total_multa, 0) ELSE 0 END) AS pendiente_uc
FROM v_admin_multas
GROUP BY club;

-- Cumplimiento de las decisiones con multa (dato del CUADRO DE EXPEDIENTES).
CREATE OR REPLACE VIEW v_expedientes_cumplimiento AS
SELECT anio,
       coalesce(cumplimiento_decision, 'SIN_DATO') AS cumplimiento,
       coalesce(motivo_cumplimiento, 'SIN_MOTIVO') AS motivo,
       count(*) AS expedientes,
       count(*) FILTER (WHERE multa_uc > 0)       AS con_multa,
       coalesce(sum(multa_uc), 0)                 AS multa_uc,
       coalesce(sum(multa_usd), 0)                AS multa_usd
FROM v_expedientes
GROUP BY anio, coalesce(cumplimiento_decision, 'SIN_DATO'), coalesce(motivo_cumplimiento, 'SIN_MOTIVO');

-- Distribucion por modalidad del tramite (Fisico / Mixto / Digital).
CREATE OR REPLACE VIEW v_expedientes_modalidad AS
SELECT anio,
       coalesce(modalidad, 'SIN_DATO')        AS modalidad,
       coalesce(tramite_raw, 'SIN_DATO')      AS tramite,
       count(*)                               AS expedientes,
       round(avg(dias_tramitacion)::numeric, 1) AS dias_promedio
FROM v_expedientes
GROUP BY anio, coalesce(modalidad, 'SIN_DATO'), coalesce(tramite_raw, 'SIN_DATO');

-- Carga de trabajo por juez (columna ASIGNADO: varios nombres separados por coma).
CREATE OR REPLACE VIEW v_expedientes_carga AS
SELECT a.juez, v.anio,
       count(*) AS expedientes,
       count(*) FILTER (WHERE v.estado IN ('RESUELTO','DESESTIMADO','ARCHIVADO')) AS cerrados,
       count(*) FILTER (WHERE v.estado NOT IN ('RESUELTO','DESESTIMADO','ARCHIVADO')) AS abiertos,
       round(avg(v.dias_tramitacion)::numeric, 1) AS dias_promedio
FROM v_expedientes v
CROSS JOIN LATERAL unnest(string_to_array(v.asignado, ',')) AS a(juez)
WHERE v.asignado IS NOT NULL
  AND btrim(a.juez) <> ''
  AND a.juez NOT ILIKE '%por asignar%'
GROUP BY a.juez, v.anio;

-- -----------------------------------------------------------------------------
-- 15. Contenido inspiracional: avance de KPIs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_kpi_avance AS
SELECT
  k.id              AS kpi_id,
  k.codigo,
  k.nombre,
  k.unidad,
  k.polaridad,
  k.meta,
  k.periodicidad,
  p.id              AS pilar_id,
  p.nombre          AS pilar,
  p.color           AS pilar_color,
  pl.id             AS plan_id,
  pl.titulo         AS plan,
  pl.anio           AS plan_anio,
  m.periodo,
  m.granularidad,
  m.valor,
  m.cumplio,
  CASE
    WHEN k.polaridad = 'MAYOR_MEJOR' AND k.meta IS NOT NULL AND k.meta > 0
      THEN round(((m.valor - k.meta) / k.meta) * 100, 2)
    WHEN k.polaridad = 'MENOR_MEJOR' AND k.meta IS NOT NULL AND k.meta > 0
      THEN round(((k.meta - m.valor) / k.meta) * 100, 2)
    ELSE NULL
  END AS desvio_pct
FROM kpi_medicion m
JOIN kpi_definicion k  ON k.id = m.kpi_id
LEFT JOIN pilar        p  ON p.id = k.pilar_id
LEFT JOIN plan_accion  pl ON pl.id = k.plan_id;

-- Avance agregado por pilar (semforo: CUMPLE / EN RIESGO / CRITICO)
CREATE OR REPLACE VIEW v_pilar_avance AS
SELECT
  pl.id AS plan_id, pl.titulo AS plan, pl.anio,
  p.id AS pilar_id, p.nombre AS pilar, p.color, p.peso, p.orden,
  count(k.id) AS n_kpis,
  count(*) FILTER (WHERE m.cumplio) AS kpis_cumplidos,
  round(100.0 * count(*) FILTER (WHERE m.cumplio) / NULLIF(count(m.id), 0), 1) AS pct_cumplimiento,
  round(avg(m.valor), 2) AS valor_promedio
FROM plan_accion pl
JOIN pilar p ON p.plan_id = pl.id
LEFT JOIN kpi_definicion k ON k.pilar_id = p.id
LEFT JOIN kpi_medicion m   ON m.kpi_id = k.id AND m.granularidad = 'MES'
GROUP BY pl.id, pl.titulo, pl.anio, p.id, p.nombre, p.color, p.peso, p.orden;

-- -----------------------------------------------------------------------------
-- 16. Evolucion mensual (series de tiempo para el dashboard)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_evolucion_mensual AS
SELECT anio, mes, nombre_mes,
       count(*) AS sanciones,
       count(*) FILTER (WHERE tipo_decision = 'Amonestacion') AS amonestaciones,
       count(*) FILTER (WHERE tipo_decision = 'Tarjeta Roja')  AS rojas,
       count(*) FILTER (WHERE es_suspension) AS suspensiones,
       coalesce(sum(multa_usd), 0) AS multa_usd
FROM v_sancion
WHERE NOT archivado
GROUP BY anio, mes, nombre_mes;

-- -----------------------------------------------------------------------------
-- 17. Cobertura de ingesta y calidad de datos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_calidad_datos AS
SELECT
  'SANCIONES' AS entidad,
  count(*) AS total,
  count(*) FILTER (WHERE persona_id IS NULL AND club_id IS NULL) AS huerfanos,
  count(*) FILTER (WHERE partido IS NULL) AS sin_partido,
  count(*) FILTER (WHERE norma_codigo IS NULL) AS sin_norma,
  count(*) FILTER (WHERE tipo_infraccion IS NULL) AS sin_tipo_infraccion,
  count(*) FILTER (WHERE tipo_decision IS NULL) AS sin_tipo_decision
FROM v_sancion
UNION ALL
SELECT
  'EXPEDIENTES',
  count(*),
  count(*) FILTER (WHERE parte1_nombre IS NULL),
  0, 0, 0, 0
FROM v_expedientes;
