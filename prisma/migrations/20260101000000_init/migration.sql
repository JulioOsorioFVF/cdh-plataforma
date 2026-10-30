-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PolaridadKpi" AS ENUM ('MAYOR_MEJOR', 'MENOR_MEJOR', 'IGUAL_META');

-- CreateEnum
CREATE TYPE "EstadoObjetivo" AS ENUM ('NO_INICIADO', 'EN_CURSO', 'ALCANZADO', 'SUPERADO', 'DETENIDO');

-- CreateEnum
CREATE TYPE "EstadoExpediente" AS ENUM ('RECIBIDO', 'EN_ESTUDIO', 'RESUELTO', 'NOTIFICADO', 'EN_RECURSO', 'ARCHIVADO', 'DESESTIMADO', 'REMITIDO');

-- CreateEnum
CREATE TYPE "EstadoIngesta" AS ENUM ('PENDIENTE', 'PROCESANDO', 'VALIDADO', 'CARGADO', 'CON_ERRORES', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "EstadoOcr" AS ENUM ('PENDIENTE', 'PROCESANDO', 'REVISADO', 'APROBADO', 'RECHAZADO', 'ERROR');

-- CreateEnum
CREATE TYPE "TipoParte" AS ENUM ('JUGADOR', 'CUERPO_TECNICO', 'CLUB', 'COMISION', 'LIGA', 'ORGANIZADOR', 'FVF', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoMovimientoExpediente" AS ENUM ('AUTO', 'PROVIDENCIA', 'RESOLUCION', 'SENTENCIA', 'AUTO_ADMISORIO', 'RECONSIDERACION', 'SEGUNDA_INSTANCIA', 'REMISION', 'NOTIFICACION', 'CONSIGNACION', 'ARIETE', 'OTRO');

-- CreateEnum
CREATE TYPE "RolHabitual" AS ENUM ('JUGADOR', 'DIRECTOR_TECNICO', 'ASISTENTE_TECNICO', 'PREPARADOR_FISICO', 'DELEGADO', 'ARBITRO', 'ASISTENTE_ARBITRO', 'MEDICO', 'FISIOTERAPEUTA', 'UTILLERO', 'CAMILLERO', 'DIRIGENTE', 'OTRO');

-- CreateEnum
CREATE TYPE "Catalogo" AS ENUM ('TIPO_DE_SANCIONADO', 'TIPO', 'MOTIVO', 'TIPO_DE_INFRACCION', 'INCIDENCIA_LICENCIA', 'DETALLE_INCIDENCIA', 'FUENTE_NORMA', 'TIPO_DE_REGISTRO', 'SALDO');

-- CreateTable
CREATE TABLE "dim_fecha" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "trimestre" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "semana_iso" INTEGER NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "nombre_mes" TEXT NOT NULL,
    "nombre_trimestre" TEXT NOT NULL,
    "es_fin_semana" BOOLEAN NOT NULL DEFAULT false,
    "es_feriado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dim_fecha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_torneo" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "temporada" INTEGER,
    "temporada_slug" TEXT,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dim_torneo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_torneo_categoria" (
    "torneo_id" INTEGER NOT NULL,
    "categoria_id" INTEGER NOT NULL,

    CONSTRAINT "dim_torneo_categoria_pkey" PRIMARY KEY ("torneo_id","categoria_id")
);

-- CreateTable
CREATE TABLE "dim_categoria" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "subdivision" TEXT,
    "vigente" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dim_categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_fase" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "temporada" INTEGER,
    "torneo_id" INTEGER NOT NULL,

    CONSTRAINT "dim_fase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_ronda" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "temporada" INTEGER,
    "torneo_id" INTEGER NOT NULL,

    CONSTRAINT "dim_ronda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_jornada" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "numero" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "temporada" INTEGER,
    "torneo_id" INTEGER NOT NULL,

    CONSTRAINT "dim_jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_club" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "nombre_normalizado" TEXT NOT NULL,
    "nombre_corto" TEXT,
    "alias" TEXT[],
    "grupo" TEXT,
    "liga" TEXT,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dim_club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_club_categoria" (
    "club_id" INTEGER NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "temporada" INTEGER,
    "grupo" TEXT,
    "vigente" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dim_club_categoria_pkey" PRIMARY KEY ("club_id","categoria_id")
);

-- CreateTable
CREATE TABLE "dim_categoria_conductor" (
    "id" SERIAL NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "conductor_id" INTEGER NOT NULL,
    "rol" "RolHabitual" NOT NULL,
    "temporada" INTEGER,
    "notas" TEXT,

    CONSTRAINT "dim_categoria_conductor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_persona" (
    "id" SERIAL NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombres" TEXT,
    "apellidos" TEXT,
    "nombre_completo" TEXT NOT NULL,
    "nombre_normalizado" TEXT NOT NULL,
    "rol_habitual" "RolHabitual",
    "rol_texto" TEXT,
    "club_id" INTEGER,
    "email" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dim_persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_tipo_sancionado" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "aplica_a_persona" BOOLEAN NOT NULL DEFAULT true,
    "aplica_a_club" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dim_tipo_sancionado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_tipo_decision" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "aplica_a_persona" BOOLEAN NOT NULL DEFAULT true,
    "aplica_a_club" BOOLEAN NOT NULL DEFAULT true,
    "aplica_a_comision" BOOLEAN NOT NULL DEFAULT true,
    "es_multa" BOOLEAN NOT NULL DEFAULT false,
    "es_suspension" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dim_tipo_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_motivo" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "tipo_decision_id" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "requiere_articulo" BOOLEAN NOT NULL DEFAULT true,
    "vigente" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dim_motivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_tipo_infraccion" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "ambito" TEXT,

    CONSTRAINT "dim_tipo_infraccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_observacion" (
    "id" SERIAL NOT NULL,
    "texto" TEXT NOT NULL,
    "texto_normalizado" TEXT NOT NULL,
    "tipo_infraccion_id" INTEGER,
    "vigente" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dim_observacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_norma" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "documentos" TEXT[],
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dim_norma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_articulo" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "codigo_normalizado" TEXT NOT NULL,
    "descripcion" TEXT,
    "texto" TEXT,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "norma_id" INTEGER NOT NULL,

    CONSTRAINT "dim_articulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_incidencia_licencia" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dim_incidencia_licencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_detalle_incidencia" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "incidencia_id" INTEGER NOT NULL,

    CONSTRAINT "dim_detalle_incidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dim_tasa_uc" (
    "id" SERIAL NOT NULL,
    "fecha_vigencia" DATE NOT NULL,
    "valor_uc_usd" DECIMAL(18,6) NOT NULL,
    "fuente" TEXT,
    "notas" TEXT,

    CONSTRAINT "dim_tasa_uc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_partido" (
    "id" SERIAL NOT NULL,
    "cdh_id" TEXT,
    "id_partido" TEXT,
    "descripcion" TEXT NOT NULL,
    "local" TEXT,
    "visitante" TEXT,
    "marcador" TEXT,
    "fecha_acta" DATE,
    "numero_acta" TEXT,
    "acta" TEXT,
    "numero_jornada" TEXT,
    "suspendido" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "fecha_id" INTEGER,
    "torneo_id" INTEGER,
    "categoria_id" INTEGER,
    "fase_id" INTEGER,
    "ronda_id" INTEGER,
    "jornada_id" INTEGER,
    "local_id" INTEGER,
    "visitante_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fact_partido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_sancion" (
    "id" BIGSERIAL NOT NULL,
    "hash_origen" TEXT NOT NULL,
    "origen_fila" INTEGER,
    "origen_archivo" TEXT,
    "origen_gid" TEXT,
    "fecha" DATE NOT NULL,
    "persona_id" INTEGER,
    "club_id" INTEGER,
    "sanction_juegos" INTEGER,
    "sanction_dias" INTEGER,
    "multa_uc" DECIMAL(18,4),
    "multa_usd" DECIMAL(18,2),
    "tasa_usd" DECIMAL(18,6),
    "reintegro" BOOLEAN NOT NULL DEFAULT false,
    "alerta_suspension" BOOLEAN NOT NULL DEFAULT false,
    "proc" TEXT,
    "motivo_raw" TEXT,
    "observacion_raw" TEXT,
    "detalle_incidencia_raw" TEXT,
    "articulos_raw" TEXT,
    "norma_raw" TEXT,
    "nombre_raw" TEXT,
    "cedula_raw" TEXT,
    "es_nulo" BOOLEAN NOT NULL DEFAULT false,
    "fecha_id" INTEGER,
    "torneo_id" INTEGER,
    "categoria_id" INTEGER,
    "fase_id" INTEGER,
    "ronda_id" INTEGER,
    "jornada_id" INTEGER,
    "partido_id" INTEGER,
    "tipo_sancionado_id" INTEGER,
    "tipo_decision_id" INTEGER,
    "motivo_id" INTEGER,
    "tipo_infraccion_id" INTEGER,
    "observacion_id" INTEGER,
    "norma_id" INTEGER,
    "incidencia_id" INTEGER,
    "detalle_incidencia_id" INTEGER,
    "origen_registro" TEXT NOT NULL DEFAULT 'SHEETS',
    "ocr_job_id" INTEGER,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archivado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fact_sancion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_sancion_articulo" (
    "sancion_id" BIGINT NOT NULL,
    "articulo_id" INTEGER NOT NULL,
    "literal" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fact_sancion_articulo_pkey" PRIMARY KEY ("sancion_id","articulo_id")
);

-- CreateTable
CREATE TABLE "fact_sancion_flag" (
    "id" SERIAL NOT NULL,
    "sancion_id" BIGINT NOT NULL,
    "flag" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fact_sancion_flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_sancion_norma" (
    "sancion_id" BIGINT NOT NULL,
    "norma_id" INTEGER NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "literal" TEXT,

    CONSTRAINT "fact_sancion_norma_pkey" PRIMARY KEY ("sancion_id","norma_id")
);

-- CreateTable
CREATE TABLE "fact_expediente" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "nombre" TEXT,
    "motivo" TEXT,
    "sub_motivo" TEXT,
    "liga_torneo" TEXT,
    "nombre_torneo" TEXT,
    "auto_entrada" TEXT,
    "fecha_auto_entrada" DATE,
    "equipos" TEXT,
    "tramite_raw" TEXT,
    "modalidad" TEXT,
    "asignado" TEXT,
    "fecha_asignacion" DATE,
    "fecha_seguimiento" DATE,
    "alerta" TEXT,
    "estatus" TEXT NOT NULL,
    "estado" "EstadoExpediente" NOT NULL DEFAULT 'RECIBIDO',
    "fecha_recepcion" DATE,
    "fecha_resolucion" DATE,
    "dias_tramitacion" INTEGER,
    "tipo" TEXT,
    "notas" TEXT,
    "numero_decision" TEXT,
    "sancion_raw" TEXT,
    "sancionado_raw" TEXT,
    "multa_uc" DECIMAL(18,4),
    "multa_usd" DECIMAL(18,2),
    "cumplimiento_decision" TEXT,
    "motivo_cumplimiento" TEXT,
    "archivo_origen" TEXT,
    "fila_origen" INTEGER,
    "hash_origen" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fecha_id" INTEGER,
    "torneo_id" INTEGER,
    "categoria_id" INTEGER,
    "creado_por_id" INTEGER,

    CONSTRAINT "fact_expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_expediente_movimiento" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "fecha" DATE,
    "tipo" "TipoMovimientoExpediente" NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fact_expediente_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_expediente_parte" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoParte" NOT NULL,
    "nombre" TEXT NOT NULL,
    "cedula" TEXT,
    "persona_id1" INTEGER,
    "club_id1" INTEGER,
    "persona_id2" INTEGER,
    "club_id2" INTEGER,

    CONSTRAINT "fact_expediente_parte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_expediente_partido" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "partido_id" INTEGER NOT NULL,
    "rol" TEXT,

    CONSTRAINT "fact_expediente_partido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_sancion_expediente" (
    "id" SERIAL NOT NULL,
    "sancion_id" BIGINT NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "vinculo" TEXT NOT NULL DEFAULT 'AUTOMATICO',
    "confianza" DECIMAL(5,2),

    CONSTRAINT "fact_sancion_expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expediente_documento" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PDF',
    "subido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expediente_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_admin_multa" (
    "id" SERIAL NOT NULL,
    "fecha_registro" DATE,
    "fecha_recepcion_resol" DATE,
    "fecha_pago" DATE,
    "fecha_factura" DATE,
    "torneo_nombre" TEXT,
    "club_nombre" TEXT,
    "categoria_nombre" TEXT,
    "tipo_registro" TEXT,
    "temporada" TEXT,
    "fase_nombre" TEXT,
    "jornada_nombre" TEXT,
    "numero_resolucion" TEXT,
    "unidad_convertible" DECIMAL(18,4),
    "total_multa" DECIMAL(18,4),
    "pagado_bs" DECIMAL(18,2),
    "tasa_bcv" DECIMAL(18,6),
    "pagado_usd" DECIMAL(18,2),
    "numero_factura" TEXT,
    "numero_comprobante" TEXT,
    "observaciones" TEXT,
    "saldo" DECIMAL(18,2),
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fila_origen" INTEGER,
    "hash_origen" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fecha_id" INTEGER,
    "tasa_id" INTEGER,
    "torneo_id" INTEGER,
    "categoria_id" INTEGER,
    "club_id" INTEGER,
    "expediente_id" INTEGER,

    CONSTRAINT "fact_admin_multa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_rol" (
    "usuario_id" INTEGER NOT NULL,
    "rol_id" INTEGER NOT NULL,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("usuario_id","rol_id")
);

-- CreateTable
CREATE TABLE "permiso" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permiso" (
    "rol_id" INTEGER NOT NULL,
    "permiso_id" INTEGER NOT NULL,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "bitacora_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "cambios" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "usuario_id" INTEGER,
    "usuario_nombre" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingesta_log" (
    "id" SERIAL NOT NULL,
    "fuente" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "url" TEXT,
    "hoja_gid" TEXT,
    "estado" "EstadoIngesta" NOT NULL DEFAULT 'PENDIENTE',
    "filas_leidas" INTEGER NOT NULL DEFAULT 0,
    "filas_insertadas" INTEGER NOT NULL DEFAULT 0,
    "filas_actualizadas" INTEGER NOT NULL DEFAULT 0,
    "filas_omitidas" INTEGER NOT NULL DEFAULT 0,
    "filas_con_error" INTEGER NOT NULL DEFAULT 0,
    "duracion_ms" INTEGER,
    "mensaje" TEXT,
    "detalle" JSONB,
    "iniciada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_en" TIMESTAMP(3),
    "usuario_id" INTEGER,

    CONSTRAINT "ingesta_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_job" (
    "id" SERIAL NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "estado" "EstadoOcr" NOT NULL DEFAULT 'PENDIENTE',
    "motor" TEXT,
    "confianza" DECIMAL(5,2),
    "resultado" JSONB,
    "borrador" JSONB,
    "observaciones" TEXT,
    "iniciado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisado_en" TIMESTAMP(3),
    "usuario_id" INTEGER,

    CONSTRAINT "ocr_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_accion" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "descripcion" TEXT,
    "contexto" TEXT,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_accion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivo_general" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "enunciado" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "objetivo_general_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivo_especifico" (
    "id" SERIAL NOT NULL,
    "objetivo_id" INTEGER NOT NULL,
    "enunciado" TEXT NOT NULL,
    "descripcion" TEXT,
    "meta" DECIMAL(18,4),
    "avance" DECIMAL(18,4),
    "estado" "EstadoObjetivo" NOT NULL DEFAULT 'NO_INICIADO',
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "objetivo_especifico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pilar" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "objetivo_id" INTEGER,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "peso" DECIMAL(5,2),

    CONSTRAINT "pilar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_definicion" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "pilar_id" INTEGER,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "formula" JSONB NOT NULL,
    "unidad" TEXT NOT NULL,
    "meta" DECIMAL(18,4),
    "polaridad" "PolaridadKpi" NOT NULL DEFAULT 'MAYOR_MEJOR',
    "periodicidad" TEXT NOT NULL DEFAULT 'MENSUAL',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_definicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_medicion" (
    "id" SERIAL NOT NULL,
    "kpi_id" INTEGER NOT NULL,
    "periodo" DATE NOT NULL,
    "granularidad" TEXT NOT NULL,
    "valor" DECIMAL(18,4) NOT NULL,
    "meta" DECIMAL(18,4),
    "cumplio" BOOLEAN,
    "calculado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_medicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogo_item" (
    "id" SERIAL NOT NULL,
    "catalogo" "Catalogo" NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogo_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dim_fecha_fecha_key" ON "dim_fecha"("fecha");

-- CreateIndex
CREATE INDEX "dim_fecha_anio_mes_idx" ON "dim_fecha"("anio", "mes");

-- CreateIndex
CREATE INDEX "dim_fecha_anio_trimestre_idx" ON "dim_fecha"("anio", "trimestre");

-- CreateIndex
CREATE UNIQUE INDEX "dim_torneo_codigo_key" ON "dim_torneo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dim_torneo_nombre_key" ON "dim_torneo"("nombre");

-- CreateIndex
CREATE INDEX "dim_torneo_temporada_idx" ON "dim_torneo"("temporada");

-- CreateIndex
CREATE INDEX "dim_torneo_categoria_categoria_id_idx" ON "dim_torneo_categoria"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "dim_categoria_codigo_key" ON "dim_categoria"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dim_categoria_nombre_key" ON "dim_categoria"("nombre");

-- CreateIndex
CREATE INDEX "dim_categoria_orden_idx" ON "dim_categoria"("orden");

-- CreateIndex
CREATE INDEX "dim_fase_nombre_idx" ON "dim_fase"("nombre");

-- CreateIndex
CREATE INDEX "dim_fase_orden_idx" ON "dim_fase"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "dim_fase_torneo_id_nombre_key" ON "dim_fase"("torneo_id", "nombre");

-- CreateIndex
CREATE INDEX "dim_ronda_nombre_idx" ON "dim_ronda"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "dim_ronda_torneo_id_nombre_key" ON "dim_ronda"("torneo_id", "nombre");

-- CreateIndex
CREATE INDEX "dim_jornada_numero_idx" ON "dim_jornada"("numero");

-- CreateIndex
CREATE INDEX "dim_jornada_nombre_idx" ON "dim_jornada"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "dim_jornada_torneo_id_nombre_key" ON "dim_jornada"("torneo_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "dim_club_codigo_key" ON "dim_club"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dim_club_nombre_key" ON "dim_club"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "dim_club_nombre_normalizado_key" ON "dim_club"("nombre_normalizado");

-- CreateIndex
CREATE INDEX "dim_club_grupo_idx" ON "dim_club"("grupo");

-- CreateIndex
CREATE INDEX "dim_club_categoria_categoria_id_idx" ON "dim_club_categoria"("categoria_id");

-- CreateIndex
CREATE INDEX "dim_categoria_conductor_conductor_id_idx" ON "dim_categoria_conductor"("conductor_id");

-- CreateIndex
CREATE UNIQUE INDEX "dim_categoria_conductor_categoria_id_conductor_id_rol_tempo_key" ON "dim_categoria_conductor"("categoria_id", "conductor_id", "rol", "temporada");

-- CreateIndex
CREATE UNIQUE INDEX "dim_persona_cedula_key" ON "dim_persona"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "dim_persona_nombre_normalizado_key" ON "dim_persona"("nombre_normalizado");

-- CreateIndex
CREATE INDEX "dim_persona_nombre_normalizado_idx" ON "dim_persona"("nombre_normalizado");

-- CreateIndex
CREATE INDEX "dim_persona_rol_habitual_idx" ON "dim_persona"("rol_habitual");

-- CreateIndex
CREATE INDEX "dim_persona_club_id_idx" ON "dim_persona"("club_id");

-- CreateIndex
CREATE UNIQUE INDEX "dim_tipo_sancionado_codigo_key" ON "dim_tipo_sancionado"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dim_tipo_sancionado_nombre_key" ON "dim_tipo_sancionado"("nombre");

-- CreateIndex
CREATE INDEX "dim_tipo_sancionado_orden_idx" ON "dim_tipo_sancionado"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "dim_tipo_decision_codigo_key" ON "dim_tipo_decision"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dim_tipo_decision_nombre_key" ON "dim_tipo_decision"("nombre");

-- CreateIndex
CREATE INDEX "dim_tipo_decision_orden_idx" ON "dim_tipo_decision"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "dim_motivo_codigo_key" ON "dim_motivo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dim_motivo_nombre_key" ON "dim_motivo"("nombre");

-- CreateIndex
CREATE INDEX "dim_motivo_orden_idx" ON "dim_motivo"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "dim_tipo_infraccion_codigo_key" ON "dim_tipo_infraccion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dim_tipo_infraccion_nombre_key" ON "dim_tipo_infraccion"("nombre");

-- CreateIndex
CREATE INDEX "dim_tipo_infraccion_orden_idx" ON "dim_tipo_infraccion"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "dim_observacion_texto_normalizado_key" ON "dim_observacion"("texto_normalizado");

-- CreateIndex
CREATE INDEX "dim_observacion_tipo_infraccion_id_idx" ON "dim_observacion"("tipo_infraccion_id");

-- CreateIndex
CREATE UNIQUE INDEX "dim_norma_codigo_key" ON "dim_norma"("codigo");

-- CreateIndex
CREATE INDEX "dim_articulo_norma_id_idx" ON "dim_articulo"("norma_id");

-- CreateIndex
CREATE UNIQUE INDEX "dim_articulo_norma_id_codigo_normalizado_key" ON "dim_articulo"("norma_id", "codigo_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "dim_incidencia_licencia_codigo_key" ON "dim_incidencia_licencia"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dim_incidencia_licencia_nombre_key" ON "dim_incidencia_licencia"("nombre");

-- CreateIndex
CREATE INDEX "dim_incidencia_licencia_orden_idx" ON "dim_incidencia_licencia"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "dim_detalle_incidencia_codigo_key" ON "dim_detalle_incidencia"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dim_detalle_incidencia_nombre_key" ON "dim_detalle_incidencia"("nombre");

-- CreateIndex
CREATE INDEX "dim_detalle_incidencia_incidencia_id_idx" ON "dim_detalle_incidencia"("incidencia_id");

-- CreateIndex
CREATE UNIQUE INDEX "dim_tasa_uc_fecha_vigencia_key" ON "dim_tasa_uc"("fecha_vigencia");

-- CreateIndex
CREATE INDEX "dim_tasa_uc_fecha_vigencia_idx" ON "dim_tasa_uc"("fecha_vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "fact_partido_cdh_id_key" ON "fact_partido"("cdh_id");

-- CreateIndex
CREATE INDEX "fact_partido_torneo_id_categoria_id_jornada_id_idx" ON "fact_partido"("torneo_id", "categoria_id", "jornada_id");

-- CreateIndex
CREATE INDEX "fact_partido_fecha_id_idx" ON "fact_partido"("fecha_id");

-- CreateIndex
CREATE INDEX "fact_partido_local_id_idx" ON "fact_partido"("local_id");

-- CreateIndex
CREATE INDEX "fact_partido_visitante_id_idx" ON "fact_partido"("visitante_id");

-- CreateIndex
CREATE INDEX "fact_partido_descripcion_idx" ON "fact_partido"("descripcion");

-- CreateIndex
CREATE UNIQUE INDEX "fact_sancion_hash_origen_key" ON "fact_sancion"("hash_origen");

-- CreateIndex
CREATE INDEX "fact_sancion_fecha_id_idx" ON "fact_sancion"("fecha_id");

-- CreateIndex
CREATE INDEX "fact_sancion_torneo_id_categoria_id_idx" ON "fact_sancion"("torneo_id", "categoria_id");

-- CreateIndex
CREATE INDEX "fact_sancion_club_id_fecha_id_idx" ON "fact_sancion"("club_id", "fecha_id");

-- CreateIndex
CREATE INDEX "fact_sancion_persona_id_fecha_id_idx" ON "fact_sancion"("persona_id", "fecha_id");

-- CreateIndex
CREATE INDEX "fact_sancion_partido_id_idx" ON "fact_sancion"("partido_id");

-- CreateIndex
CREATE INDEX "fact_sancion_tipo_decision_id_motivo_id_idx" ON "fact_sancion"("tipo_decision_id", "motivo_id");

-- CreateIndex
CREATE INDEX "fact_sancion_norma_id_idx" ON "fact_sancion"("norma_id");

-- CreateIndex
CREATE INDEX "fact_sancion_origen_registro_idx" ON "fact_sancion"("origen_registro");

-- CreateIndex
CREATE INDEX "fact_sancion_archivado_fecha_idx" ON "fact_sancion"("archivado", "fecha");

-- CreateIndex
CREATE INDEX "fact_sancion_articulo_articulo_id_idx" ON "fact_sancion_articulo"("articulo_id");

-- CreateIndex
CREATE INDEX "fact_sancion_flag_flag_idx" ON "fact_sancion_flag"("flag");

-- CreateIndex
CREATE UNIQUE INDEX "fact_sancion_flag_sancion_id_flag_key" ON "fact_sancion_flag"("sancion_id", "flag");

-- CreateIndex
CREATE INDEX "fact_sancion_norma_norma_id_idx" ON "fact_sancion_norma"("norma_id");

-- CreateIndex
CREATE UNIQUE INDEX "fact_expediente_hash_origen_key" ON "fact_expediente"("hash_origen");

-- CreateIndex
CREATE INDEX "fact_expediente_anio_estado_idx" ON "fact_expediente"("anio", "estado");

-- CreateIndex
CREATE INDEX "fact_expediente_fecha_id_idx" ON "fact_expediente"("fecha_id");

-- CreateIndex
CREATE INDEX "fact_expediente_torneo_id_categoria_id_idx" ON "fact_expediente"("torneo_id", "categoria_id");

-- CreateIndex
CREATE INDEX "fact_expediente_estatus_idx" ON "fact_expediente"("estatus");

-- CreateIndex
CREATE INDEX "fact_expediente_tramite_raw_idx" ON "fact_expediente"("tramite_raw");

-- CreateIndex
CREATE UNIQUE INDEX "fact_expediente_anio_numero_key" ON "fact_expediente"("anio", "numero");

-- CreateIndex
CREATE INDEX "fact_expediente_movimiento_expediente_id_fecha_idx" ON "fact_expediente_movimiento"("expediente_id", "fecha");

-- CreateIndex
CREATE INDEX "fact_expediente_movimiento_tipo_idx" ON "fact_expediente_movimiento"("tipo");

-- CreateIndex
CREATE INDEX "fact_expediente_parte_persona_id1_idx" ON "fact_expediente_parte"("persona_id1");

-- CreateIndex
CREATE INDEX "fact_expediente_parte_persona_id2_idx" ON "fact_expediente_parte"("persona_id2");

-- CreateIndex
CREATE INDEX "fact_expediente_parte_club_id1_idx" ON "fact_expediente_parte"("club_id1");

-- CreateIndex
CREATE INDEX "fact_expediente_parte_club_id2_idx" ON "fact_expediente_parte"("club_id2");

-- CreateIndex
CREATE UNIQUE INDEX "fact_expediente_parte_expediente_id_orden_key" ON "fact_expediente_parte"("expediente_id", "orden");

-- CreateIndex
CREATE INDEX "fact_expediente_partido_partido_id_idx" ON "fact_expediente_partido"("partido_id");

-- CreateIndex
CREATE UNIQUE INDEX "fact_expediente_partido_expediente_id_partido_id_key" ON "fact_expediente_partido"("expediente_id", "partido_id");

-- CreateIndex
CREATE INDEX "fact_sancion_expediente_expediente_id_idx" ON "fact_sancion_expediente"("expediente_id");

-- CreateIndex
CREATE UNIQUE INDEX "fact_sancion_expediente_sancion_id_expediente_id_key" ON "fact_sancion_expediente"("sancion_id", "expediente_id");

-- CreateIndex
CREATE INDEX "expediente_documento_expediente_id_idx" ON "expediente_documento"("expediente_id");

-- CreateIndex
CREATE UNIQUE INDEX "fact_admin_multa_hash_origen_key" ON "fact_admin_multa"("hash_origen");

-- CreateIndex
CREATE INDEX "fact_admin_multa_club_id_fecha_registro_idx" ON "fact_admin_multa"("club_id", "fecha_registro");

-- CreateIndex
CREATE INDEX "fact_admin_multa_pagado_idx" ON "fact_admin_multa"("pagado");

-- CreateIndex
CREATE INDEX "fact_admin_multa_temporada_idx" ON "fact_admin_multa"("temporada");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rol_codigo_key" ON "rol"("codigo");

-- CreateIndex
CREATE INDEX "usuario_rol_rol_id_idx" ON "usuario_rol"("rol_id");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_codigo_key" ON "permiso"("codigo");

-- CreateIndex
CREATE INDEX "permiso_modulo_idx" ON "permiso"("modulo");

-- CreateIndex
CREATE INDEX "rol_permiso_permiso_id_idx" ON "rol_permiso"("permiso_id");

-- CreateIndex
CREATE INDEX "bitacora_auditoria_entidad_entidad_id_idx" ON "bitacora_auditoria"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "bitacora_auditoria_usuario_id_created_at_idx" ON "bitacora_auditoria"("usuario_id", "created_at");

-- CreateIndex
CREATE INDEX "bitacora_auditoria_created_at_idx" ON "bitacora_auditoria"("created_at");

-- CreateIndex
CREATE INDEX "ingesta_log_documento_iniciada_en_idx" ON "ingesta_log"("documento", "iniciada_en");

-- CreateIndex
CREATE INDEX "ingesta_log_estado_idx" ON "ingesta_log"("estado");

-- CreateIndex
CREATE INDEX "ocr_job_estado_idx" ON "ocr_job"("estado");

-- CreateIndex
CREATE INDEX "ocr_job_tipo_documento_idx" ON "ocr_job"("tipo_documento");

-- CreateIndex
CREATE INDEX "plan_accion_anio_idx" ON "plan_accion"("anio");

-- CreateIndex
CREATE UNIQUE INDEX "plan_accion_titulo_anio_key" ON "plan_accion"("titulo", "anio");

-- CreateIndex
CREATE INDEX "objetivo_general_plan_id_idx" ON "objetivo_general"("plan_id");

-- CreateIndex
CREATE INDEX "objetivo_especifico_objetivo_id_idx" ON "objetivo_especifico"("objetivo_id");

-- CreateIndex
CREATE INDEX "pilar_plan_id_idx" ON "pilar"("plan_id");

-- CreateIndex
CREATE INDEX "pilar_objetivo_id_idx" ON "pilar"("objetivo_id");

-- CreateIndex
CREATE INDEX "kpi_definicion_pilar_id_idx" ON "kpi_definicion"("pilar_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_definicion_plan_id_codigo_key" ON "kpi_definicion"("plan_id", "codigo");

-- CreateIndex
CREATE INDEX "kpi_medicion_periodo_idx" ON "kpi_medicion"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_medicion_kpi_id_periodo_granularidad_key" ON "kpi_medicion"("kpi_id", "periodo", "granularidad");

-- CreateIndex
CREATE INDEX "catalogo_item_catalogo_orden_idx" ON "catalogo_item"("catalogo", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_item_catalogo_codigo_key" ON "catalogo_item"("catalogo", "codigo");

-- AddForeignKey
ALTER TABLE "dim_torneo_categoria" ADD CONSTRAINT "dim_torneo_categoria_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "dim_torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_torneo_categoria" ADD CONSTRAINT "dim_torneo_categoria_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "dim_categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_fase" ADD CONSTRAINT "dim_fase_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "dim_torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_ronda" ADD CONSTRAINT "dim_ronda_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "dim_torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_jornada" ADD CONSTRAINT "dim_jornada_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "dim_torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_club_categoria" ADD CONSTRAINT "dim_club_categoria_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "dim_club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_club_categoria" ADD CONSTRAINT "dim_club_categoria_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "dim_categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_categoria_conductor" ADD CONSTRAINT "dim_categoria_conductor_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "dim_categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_categoria_conductor" ADD CONSTRAINT "dim_categoria_conductor_conductor_id_fkey" FOREIGN KEY ("conductor_id") REFERENCES "dim_persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_persona" ADD CONSTRAINT "dim_persona_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "dim_club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_motivo" ADD CONSTRAINT "dim_motivo_tipo_decision_id_fkey" FOREIGN KEY ("tipo_decision_id") REFERENCES "dim_tipo_decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_observacion" ADD CONSTRAINT "dim_observacion_tipo_infraccion_id_fkey" FOREIGN KEY ("tipo_infraccion_id") REFERENCES "dim_tipo_infraccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_articulo" ADD CONSTRAINT "dim_articulo_norma_id_fkey" FOREIGN KEY ("norma_id") REFERENCES "dim_norma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dim_detalle_incidencia" ADD CONSTRAINT "dim_detalle_incidencia_incidencia_id_fkey" FOREIGN KEY ("incidencia_id") REFERENCES "dim_incidencia_licencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_partido" ADD CONSTRAINT "fact_partido_fecha_id_fkey" FOREIGN KEY ("fecha_id") REFERENCES "dim_fecha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_partido" ADD CONSTRAINT "fact_partido_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "dim_torneo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_partido" ADD CONSTRAINT "fact_partido_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "dim_categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_partido" ADD CONSTRAINT "fact_partido_fase_id_fkey" FOREIGN KEY ("fase_id") REFERENCES "dim_fase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_partido" ADD CONSTRAINT "fact_partido_ronda_id_fkey" FOREIGN KEY ("ronda_id") REFERENCES "dim_ronda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_partido" ADD CONSTRAINT "fact_partido_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "dim_jornada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_partido" ADD CONSTRAINT "fact_partido_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "dim_club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_partido" ADD CONSTRAINT "fact_partido_visitante_id_fkey" FOREIGN KEY ("visitante_id") REFERENCES "dim_club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_fecha_id_fkey" FOREIGN KEY ("fecha_id") REFERENCES "dim_fecha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "dim_torneo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "dim_categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_fase_id_fkey" FOREIGN KEY ("fase_id") REFERENCES "dim_fase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_ronda_id_fkey" FOREIGN KEY ("ronda_id") REFERENCES "dim_ronda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "dim_jornada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_partido_id_fkey" FOREIGN KEY ("partido_id") REFERENCES "fact_partido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_tipo_sancionado_id_fkey" FOREIGN KEY ("tipo_sancionado_id") REFERENCES "dim_tipo_sancionado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_tipo_decision_id_fkey" FOREIGN KEY ("tipo_decision_id") REFERENCES "dim_tipo_decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_motivo_id_fkey" FOREIGN KEY ("motivo_id") REFERENCES "dim_motivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_tipo_infraccion_id_fkey" FOREIGN KEY ("tipo_infraccion_id") REFERENCES "dim_tipo_infraccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_observacion_id_fkey" FOREIGN KEY ("observacion_id") REFERENCES "dim_observacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_norma_id_fkey" FOREIGN KEY ("norma_id") REFERENCES "dim_norma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_incidencia_id_fkey" FOREIGN KEY ("incidencia_id") REFERENCES "dim_incidencia_licencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_detalle_incidencia_id_fkey" FOREIGN KEY ("detalle_incidencia_id") REFERENCES "dim_detalle_incidencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "dim_persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "dim_club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion" ADD CONSTRAINT "fact_sancion_ocr_job_id_fkey" FOREIGN KEY ("ocr_job_id") REFERENCES "ocr_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion_articulo" ADD CONSTRAINT "fact_sancion_articulo_sancion_id_fkey" FOREIGN KEY ("sancion_id") REFERENCES "fact_sancion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion_articulo" ADD CONSTRAINT "fact_sancion_articulo_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "dim_articulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion_flag" ADD CONSTRAINT "fact_sancion_flag_sancion_id_fkey" FOREIGN KEY ("sancion_id") REFERENCES "fact_sancion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion_norma" ADD CONSTRAINT "fact_sancion_norma_sancion_id_fkey" FOREIGN KEY ("sancion_id") REFERENCES "fact_sancion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion_norma" ADD CONSTRAINT "fact_sancion_norma_norma_id_fkey" FOREIGN KEY ("norma_id") REFERENCES "dim_norma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente" ADD CONSTRAINT "fact_expediente_fecha_id_fkey" FOREIGN KEY ("fecha_id") REFERENCES "dim_fecha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente" ADD CONSTRAINT "fact_expediente_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "dim_torneo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente" ADD CONSTRAINT "fact_expediente_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "dim_categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente" ADD CONSTRAINT "fact_expediente_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente_movimiento" ADD CONSTRAINT "fact_expediente_movimiento_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "fact_expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente_parte" ADD CONSTRAINT "fact_expediente_parte_persona_id1_fkey" FOREIGN KEY ("persona_id1") REFERENCES "dim_persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente_parte" ADD CONSTRAINT "fact_expediente_parte_club_id1_fkey" FOREIGN KEY ("club_id1") REFERENCES "dim_club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente_parte" ADD CONSTRAINT "fact_expediente_parte_persona_id2_fkey" FOREIGN KEY ("persona_id2") REFERENCES "dim_persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente_parte" ADD CONSTRAINT "fact_expediente_parte_club_id2_fkey" FOREIGN KEY ("club_id2") REFERENCES "dim_club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente_parte" ADD CONSTRAINT "fact_expediente_parte_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "fact_expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente_partido" ADD CONSTRAINT "fact_expediente_partido_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "fact_expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_expediente_partido" ADD CONSTRAINT "fact_expediente_partido_partido_id_fkey" FOREIGN KEY ("partido_id") REFERENCES "fact_partido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion_expediente" ADD CONSTRAINT "fact_sancion_expediente_sancion_id_fkey" FOREIGN KEY ("sancion_id") REFERENCES "fact_sancion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sancion_expediente" ADD CONSTRAINT "fact_sancion_expediente_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "fact_expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expediente_documento" ADD CONSTRAINT "expediente_documento_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "fact_expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_admin_multa" ADD CONSTRAINT "fact_admin_multa_fecha_id_fkey" FOREIGN KEY ("fecha_id") REFERENCES "dim_fecha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_admin_multa" ADD CONSTRAINT "fact_admin_multa_tasa_id_fkey" FOREIGN KEY ("tasa_id") REFERENCES "dim_tasa_uc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_admin_multa" ADD CONSTRAINT "fact_admin_multa_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "dim_torneo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_admin_multa" ADD CONSTRAINT "fact_admin_multa_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "dim_categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_admin_multa" ADD CONSTRAINT "fact_admin_multa_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "dim_club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_admin_multa" ADD CONSTRAINT "fact_admin_multa_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "fact_expediente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingesta_log" ADD CONSTRAINT "ingesta_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_job" ADD CONSTRAINT "ocr_job_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivo_general" ADD CONSTRAINT "objetivo_general_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_accion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivo_especifico" ADD CONSTRAINT "objetivo_especifico_objetivo_id_fkey" FOREIGN KEY ("objetivo_id") REFERENCES "objetivo_general"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilar" ADD CONSTRAINT "pilar_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_accion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilar" ADD CONSTRAINT "pilar_objetivo_id_fkey" FOREIGN KEY ("objetivo_id") REFERENCES "objetivo_especifico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_definicion" ADD CONSTRAINT "kpi_definicion_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_accion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_definicion" ADD CONSTRAINT "kpi_definicion_pilar_id_fkey" FOREIGN KEY ("pilar_id") REFERENCES "pilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_medicion" ADD CONSTRAINT "kpi_medicion_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpi_definicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
