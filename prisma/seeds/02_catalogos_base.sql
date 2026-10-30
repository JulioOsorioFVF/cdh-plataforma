/* =============================================================================
   CONSEJO DE HONOR FVF — Catalogos base
   Valores derivados de la data real (26.981 filas de DATA).
   ========================================================================== */

-- Tipos de sancionado observados en la columna TIPO DE SANCIONADO
INSERT INTO dim_tipo_sancionado (codigo, nombre, orden, aplica_a_persona, aplica_a_club) VALUES
  ('JUGADOR',              'Jugador',              1, TRUE,  FALSE),
  ('CUERPO_TECNICO',       'Cuerpo Tecnico',       2, TRUE,  FALSE),
  ('OFICIAL_DE_PARTIDO',   'Oficial de Partido',   3, TRUE,  FALSE),
  ('DIRECTIVO',            'Directivo',            4, TRUE,  FALSE),
  ('ESPECTADOR',           'Espectador',           5, TRUE,  FALSE),
  ('PERSONAL_DEL_CLUB',    'Personal del Club',    6, TRUE,  FALSE),
  ('CLUB',                 'Club',                 7, FALSE, TRUE),
  ('COMISION',             'Comision',             8, FALSE, FALSE),
  ('ORGANIZADOR',          'Organizador',          9, FALSE, FALSE),
  ('LIGA',                 'Liga',                10, FALSE, FALSE),
  ('ARBITRO',              'Arbitro',             11, TRUE,  FALSE),
  ('DELEGADO',             'Delegado',            12, TRUE,  FALSE),
  ('OTRO',                 'Otro',                13, TRUE,  TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- Tipos de decision observados en la columna TIPO
INSERT INTO dim_tipo_decision (codigo, nombre, orden, aplica_a_persona, aplica_a_club, aplica_a_comision, es_multa, es_suspension) VALUES
  ('ADVERTENCIA',               'Advertencia',              1, TRUE, TRUE,  TRUE, FALSE, FALSE),
  ('ACLARATORIA',               'Aclaratoria',              2, TRUE, TRUE,  TRUE, FALSE, FALSE),
  ('AMONESTACION',             'Amonestacion',             3, TRUE, FALSE, FALSE, FALSE, FALSE),
  ('SUSPENSION',                'Suspension',               4, TRUE, FALSE, FALSE, FALSE, TRUE),
  ('TARJETA_ROJA',              'Tarjeta Roja',             5, TRUE, FALSE, FALSE, FALSE, FALSE),
  ('TARJETA_ROJA_INDIRECTA',    'Tarjeta Roja Indirecta',   6, TRUE, FALSE, FALSE, FALSE, FALSE),
  ('MULTA',                     'Multa',                    7, TRUE, TRUE,  TRUE, TRUE,  FALSE),
  ('SANSION',                   'Sancion',                  8, TRUE, TRUE,  TRUE, FALSE, TRUE),
  ('EXCLUSION',                 'Exclusion',                9, TRUE, TRUE,  TRUE, FALSE, FALSE),
  ('INHABILITACION',            'Inhabilitacion',          10, TRUE, FALSE, FALSE, FALSE, TRUE),
  ('DESASTRESION_DEL_PARTIDO',  'Desastresion del Partido',11, FALSE, TRUE, FALSE, FALSE, FALSE),
  ('REMISION',                  'Remision',                12, TRUE, TRUE,  TRUE, FALSE, FALSE),
  ('NULIDAD',                   'Nulidad',                 13, FALSE, FALSE, TRUE, FALSE, FALSE),
  ('OTRO',                      'Otro',                    14, TRUE, TRUE,  TRUE, FALSE, FALSE)
ON CONFLICT (codigo) DO NOTHING;

-- Tipos de infraccion (catalogo TIPO_DE_INFRACCION de la hoja)
INSERT INTO dim_tipo_infraccion (codigo, nombre, orden) VALUES
  ('CONDUCTA_ANTIDEPORTIVA',    'Conducta Antideportiva',       1),
  ('OPERATIVAS_ADMINISTRATIVAS','Operativas / Administrativas', 2),
  ('VIOLENCIA_SEGURIDAD',       'Violencia / Seguridad',        3),
  ('TARJETAS_ROJAS',            'Tarjetas Rojas',               4)
ON CONFLICT (codigo) DO NOTHING;

-- Motivos observados en la columna MOTIVO
INSERT INTO dim_motivo (codigo, nombre, tipo_decision_id, orden) VALUES
  ('TARJETA_AMARILLA',                    'Tarjeta Amarilla',                    NULL, 1),
  ('ADMINISTRATIVA',                      'Administrativa',                      NULL, 2),
  ('DEPORTIVA',                           'Deportiva',                           NULL, 3),
  ('INFRAESTRUCTURA',                     'Infraestructura',                     NULL, 4),
  ('TARJETA_ROJA',                        'Tarjeta Roja',                        NULL, 5),
  ('TARJETA_ROJA_INDIRECTA',              'Tarjeta Roja Indirecta',              NULL, 6),
  ('4TA_AMONESTACION',                    '4ta Amonestacion (Acumulacion)',      NULL, 7),
  ('AMONESTACION_TARJETA_AMARILLA',       'Amonestacion (Tarjeta Amarilla)',      NULL, 8),
  ('2DA_AMONESTACION',                    '2da Amonestacion en el Mismo Juego',   NULL, 9),
  ('JUEGO_BRUSCO_GRAVE',                  'Juego Brusco Grave',                  NULL, 10),
  ('CONDUCTA_VIOLENTA',                   'Conducta Violenta',                   NULL, 11),
  ('CONDUCTA_ANTIDEPORTIVA',              'Conducta Antideportiva',              NULL, 12),
  ('PROTESTAR_AIRADA',                    'Protestar Airada y Obstensiblemente',  NULL, 13),
  ('PUBLICO_VIOLENTO',                    'Publico Violento',                    NULL, 14),
  ('MEDIDA_DISCIPLINARIA',                'Medida Disciplinaria',                NULL, 15),
  ('TARJETA_ROJA_DIRECTA',                'Tarjeta Roja Directa',                NULL, 16),
  ('SANCIONES_ANTERIORES',                'Sanciones Anteriores',                NULL, 17),
  ('INJURIA',                             'Injuria',                             NULL, 18),
  ('DOBLE_AMONESTACION',                  'Doble Amonestacion',                  NULL, 19)
ON CONFLICT (codigo) DO NOTHING;

-- Tipos de incidencia de licencia observados
INSERT INTO dim_incidencia_licencia (codigo, nombre, orden) VALUES
  ('DEPORTIVA',        'Deportiva',        1),
  ('JUEGO',            'Juego',            2),
  ('ADMINISTRATIVA',   'Administrativa',   3),
  ('INFRAESTRUCTURA',  'Infraestructura',  4),
  ('MEDICO',           'Medico',           5),
  ('DIRECTOR_TECNICO', 'Director Tecnico', 6),
  ('PREPARADOR_FISICO','Preparador Fisico',7),
  ('ASISTENTE_TECNICO','Asistente Tecnico',8),
  ('ARBITRO',          'Arbitro',          9)
ON CONFLICT (codigo) DO NOTHING;
