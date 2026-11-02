-- Capa de staging de la ingesta.
--
-- stg_lote  : una corrida (de Google Sheets o de un archivo subido).
-- stg_fila  : el resultado de estandarizar cada fila del CSV.
--
-- No duplica los hechos: es la zona de aterrizaje y de diagnostico. Las filas
-- limpias solo guardan su huella; las que fallan guardan el contenido crudo
-- para poder explicar por que se rechazaron.

-- CreateEnum
CREATE TYPE "EstadoFila" AS ENUM ('VALIDA', 'ADVERTENCIA', 'RECHAZADA', 'CARGADA');

-- CreateTable
CREATE TABLE "stg_lote" (
    "id" SERIAL NOT NULL,
    "documento" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "url" TEXT,
    "archivo" TEXT,
    "huella" TEXT,
    "separador" TEXT,
    "encabezados" JSONB,
    "esquema_ok" BOOLEAN NOT NULL DEFAULT true,
    "columnas_faltantes" JSONB,
    "filas_leidas" INTEGER NOT NULL DEFAULT 0,
    "filas_validas" INTEGER NOT NULL DEFAULT 0,
    "filas_advertencia" INTEGER NOT NULL DEFAULT 0,
    "filas_rechazadas" INTEGER NOT NULL DEFAULT 0,
    "filas_cargadas" INTEGER NOT NULL DEFAULT 0,
    "filas_omitidas" INTEGER NOT NULL DEFAULT 0,
    "perfil" JSONB,
    "motor_version" TEXT NOT NULL DEFAULT '1',
    "estado" "EstadoIngesta" NOT NULL DEFAULT 'PENDIENTE',
    "fase" TEXT NOT NULL DEFAULT 'RECIBIDO',
    "mensaje" TEXT,
    "duracion_ms" INTEGER,
    "usuario_id" INTEGER,
    "ingesta_log_id" INTEGER,
    "iniciada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_en" TIMESTAMP(3),

    CONSTRAINT "stg_lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stg_fila" (
    "id" BIGSERIAL NOT NULL,
    "lote_id" INTEGER NOT NULL,
    "numero_fila" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "estado" "EstadoFila" NOT NULL DEFAULT 'VALIDA',
    "errores" JSONB,
    "avisos" JSONB,
    "crudo" JSONB,

    CONSTRAINT "stg_fila_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stg_lote_documento_iniciada_en_idx" ON "stg_lote"("documento", "iniciada_en");
CREATE INDEX "stg_lote_estado_idx" ON "stg_lote"("estado");
CREATE INDEX "stg_fila_lote_id_estado_idx" ON "stg_fila"("lote_id", "estado");
CREATE INDEX "stg_fila_hash_idx" ON "stg_fila"("hash");

-- AddForeignKey
ALTER TABLE "stg_lote" ADD CONSTRAINT "stg_lote_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stg_fila" ADD CONSTRAINT "stg_fila_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "stg_lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
