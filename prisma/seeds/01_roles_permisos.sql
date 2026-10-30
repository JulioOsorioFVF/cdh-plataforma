/* =============================================================================
   CONSEJO DE HONOR FVF — Roles y permisos
   ========================================================================== */
INSERT INTO rol (codigo, nombre, descripcion) VALUES
  ('ADMINISTRADOR', 'Administrador', 'Acceso total: usuarios, configuracion, ingesta, auditoria y eliminacion fisica.'),
  ('JUEZ',         'Juez',           'Resolver expedientes, aplicar sanciones, aprobar OCR, firmar resoluciones.'),
  ('SECRETARIA',   'Secretaria',     'Registrar y editar actas, expedientes e incidencias. Sin eliminar.'),
  ('CONSULTA',     'Consulta',       'Solo lectura de dashboards, informes y reportes.')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO permiso (codigo, modulo, descripcion) VALUES
  -- Sanciones
  ('sancion:read',        'Sanciones',  'Consultar sanciones e incidencias.'),
  ('sancion:create',      'Sanciones',  'Registrar nueva sancion o incidencia.'),
  ('sancion:update',      'Sanciones',  'Editar sanciones e incidencias.'),
  ('sancion:delete',      'Sanciones',  'Eliminar sanciones (soft/hard delete).'),
  ('sancion:export',      'Sanciones',  'Exportar sanciones a PDF/Excel/CSV.'),
  -- Expedientes
  ('expediente:read',     'Expedientes','Consultar expedientes.'),
  ('expediente:create',   'Expedientes','Abrir expedientes.'),
  ('expediente:update',   'Expedientes','Editar expedientes y movimientos.'),
  ('expediente:delete',   'Expedientes','Eliminar expedientes.'),
  ('expediente:resolver', 'Expedientes','Marcar como resuelto y registrar decision.'),
  ('expediente:export',   'Expedientes','Exportar expedientes.'),
  -- Partidos
  ('partido:read',        'Partidos',   'Consultar calendario de partidos.'),
  ('partido:create',      'Partidos',   'Registrar partidos.'),
  ('partido:update',      'Partidos',   'Editar partidos.'),
  ('partido:delete',      'Partidos',   'Eliminar partidos.'),
  -- Maestros
  ('club:read',           'Maestros',   'Consultar clubes.'),
  ('club:manage',         'Maestros',   'Crear y editar clubes.'),
  ('persona:read',        'Maestros',   'Consultar personas.'),
  ('persona:manage',      'Maestros',   'Crear y editar personas.'),
  ('torneo:read',         'Maestros',   'Consultar torneos, fases y jornadas.'),
  ('torneo:manage',       'Maestros',   'Crear y editar torneos, fases y jornadas.'),
  ('catalogo:manage',     'Maestros',   'Administrar catalogos (motivos, normas, articulos).'),
  -- OCRA
  ('ocr:read',            'OCR',        'Ver trabajos de extraccion.'),
  ('ocr:create',          'OCR',        'Subir actas para extraccion.'),
  ('ocr:review',          'OCR',        'Revisar y aprobar extracciones.'),
  -- Ingesta
  ('ingesta:read',        'Ingesta',    'Ver historial de sincronizacion.'),
  ('ingesta:run',         'Ingesta',    'Ejecutar sincronizacion desde Google Sheets.'),
  -- Contenido inspiracional
  ('inspiracional:read',  'Inspiracional','Leer plan, objetivos, pilares y KPIs.'),
  ('inspiracional:manage','Inspiracional','Editar plan, objetivos, pilares y KPIs.'),
  -- Informes
  ('informe:read',        'Informes',   'Ver dashboards y reportes.'),
  ('informe:export',      'Informes',   'Exportar informes a PDF/Excel/CSV.'),
  -- Administracion
  ('admin:usuarios',      'Admin',      'Gestionar usuarios y roles.'),
  ('admin:auditoria',     'Admin',      'Ver bitacora de auditoria.'),
  ('admin:configuracion', 'Admin',      'Editar tasas, catalogos y parametros.'),
  ('admin:sistema',       'Admin',      'Acceso tecnico total.')
ON CONFLICT (codigo) DO NOTHING;

-- Matriz rol x permiso. Idempotente: se puede reejecutar tras anadir permisos.

-- ADMINISTRADOR: todos los permisos (incluye borrado fisico y gestion de usuarios).
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r CROSS JOIN permiso p
WHERE r.codigo = 'ADMINISTRADOR'
ON CONFLICT DO NOTHING;

-- JUEZ: resuelve expedientes y aplica sanciones. Sin borrado fisico,
-- sin gestion de usuarios ni de configuracion del sistema.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM rol r CROSS JOIN permiso p
WHERE r.codigo = 'JUEZ'
  AND p.codigo NOT IN (
    'sancion:delete',
    'expediente:delete',
    'partido:delete',
    'club:manage',
    'persona:manage',
    'torneo:manage',
    'catalogo:manage',
    'ingesta:run',
    'admin:usuarios',
    'admin:auditoria',
    'admin:configuracion',
    'admin:sistema'
  )
ON CONFLICT DO NOTHING;

-- SECRETARIA: registra y edita. Aprobacion de OCR e inspiracional.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM rol r CROSS JOIN permiso p
WHERE r.codigo = 'SECRETARIA'
  AND p.codigo IN (
    'sancion:read','sancion:create','sancion:update','sancion:export',
    'expediente:read','expediente:create','expediente:update','expediente:export',
    'partido:read','club:read','persona:read','torneo:read',
    'ocr:read','ocr:create','ocr:review',
    'inspiracional:read','inspiracional:manage',
    'informe:read','informe:export'
  )
ON CONFLICT DO NOTHING;

-- CONSULTA: solo lectura.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM rol r CROSS JOIN permiso p
WHERE r.codigo = 'CONSULTA'
  AND p.codigo IN (
    'sancion:read','expediente:read','partido:read','club:read','persona:read',
    'torneo:read','ocr:read','inspiracional:read','informe:read','informe:export'
  )
ON CONFLICT DO NOTHING;
