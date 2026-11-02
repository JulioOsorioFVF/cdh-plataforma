-- CreateEnum
CREATE TYPE "EtapaProcesal" AS ENUM ('ENTRADA', 'OFICIOS_PREVIOS', 'AUTO_DE_INICIO', 'RECEPCION_RECAUDOS', 'LAPSO_RESOLUCION', 'PROYECTO_RESOLUCION', 'PUBLICACION_NOTIFICACION', 'EJECUCION_CUMPLIMIENTO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "EstadoTramite" AS ENUM ('EN_INSTRUCCION', 'DECIDIDO', 'INADMISIBLE', 'SOBRESEIDO', 'EN_RECURSO', 'EN_TAS');

-- CreateEnum
CREATE TYPE "EstadoReportePago" AS ENUM ('PENDIENTE_VERIFICACION', 'VERIFICADO_CONCILIADO', 'RECHAZADO_INCORRECTO');

-- CreateTable
CREATE TABLE "expediente_juridico" (
    "id" SERIAL NOT NULL,
    "numero_exp" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "auto_entrada" TEXT,
    "fecha_auto_entrada" TIMESTAMP(3),
    "motivo_entrada" TEXT,
    "asunto" TEXT,
    "parte_demandante" TEXT,
    "parte_demandada" TEXT,
    "torneo_categoria" TEXT,
    "equipos" TEXT,
    "tramite" TEXT,
    "modalidad" TEXT,
    "asignado_a" TEXT,
    "status_kanban" TEXT,
    "fecha_asignacion" TIMESTAMP(3),
    "fecha_seguimiento" TIMESTAMP(3),
    "alerta" TEXT,
    "fecha_decision" TIMESTAMP(3),
    "anio_decision" INTEGER,
    "mes_decision" INTEGER,
    "numero_auto_decision" TEXT,
    "texto_decision" TEXT,
    "numero_usurpacion_fecha" TEXT,
    "segunda_decision_flag" TEXT,
    "recurso_ejercido" TEXT,
    "fecha_recurso" TIMESTAMP(3),
    "numero_decision_recurso" TEXT,
    "fecha_emision_recurso" TIMESTAMP(3),
    "texto_decision_recurso" TEXT,
    "observaciones" TEXT,
    "sancion_resumen" TEXT,
    "sancionado_nombre" TEXT,
    "multa_ucfvf" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "multa_usd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cumplimiento_decision" TEXT,
    "motivo_cumplimiento" TEXT,
    "dias_sustanciacion" INTEGER,
    "articulos_violados_ia" TEXT[],
    "categoria_infraccion_ia" TEXT,
    "riesgo_integridad_ia" BOOLEAN NOT NULL DEFAULT false,
    "resumen_ejecutivo_ia" TEXT,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expediente_juridico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "informe_partido_ia" (
    "id" SERIAL NOT NULL,
    "torneo" TEXT NOT NULL,
    "jornada" INTEGER NOT NULL,
    "partido" TEXT NOT NULL,
    "fechaPartido" TIMESTAMP(3) NOT NULL,
    "origenInforme" TEXT NOT NULL,
    "textoBruto" TEXT NOT NULL,
    "infraccionesIA" JSONB NOT NULL,
    "articulosSugeridos" TEXT[],
    "multaSugeridaUcfvf" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "alertaSeveridad" TEXT NOT NULL,
    "procesadoEnActa" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "informe_partido_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expediente_disciplinario" (
    "id" SERIAL NOT NULL,
    "codigo_expediente" TEXT NOT NULL,
    "numero_correlativo" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "modalidad" TEXT NOT NULL DEFAULT 'Digital',
    "via_ingreso" TEXT NOT NULL,
    "torneo_categoria" TEXT NOT NULL,
    "jornada" TEXT,
    "partido" TEXT,
    "motivo_principal" TEXT NOT NULL,
    "asunto_detallado" TEXT NOT NULL,
    "parte_demandante" TEXT,
    "parte_demandada" TEXT NOT NULL,
    "requiere_caucion" BOOLEAN NOT NULL DEFAULT false,
    "caucion_verificada" BOOLEAN NOT NULL DEFAULT false,
    "articulos_invocados" BOOLEAN NOT NULL DEFAULT true,
    "en_lapso_reglamentario" BOOLEAN NOT NULL DEFAULT true,
    "causa_inadmisibilidad" TEXT,
    "etapa_actual" "EtapaProcesal" NOT NULL DEFAULT 'ENTRADA',
    "estado_tramite" "EstadoTramite" NOT NULL DEFAULT 'EN_INSTRUCCION',
    "juez_unico_asignado" TEXT,
    "especialista_asignado" TEXT,
    "analista_seguimiento" TEXT,
    "prioridad_sla" TEXT NOT NULL DEFAULT 'NORMAL',
    "fecha_apertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_asignacion" TIMESTAMP(3),
    "fecha_vencimiento_sla" TIMESTAMP(3),
    "fecha_cierre_decision" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expediente_disciplinario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actuacion_procesal" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "tipo_actuacion" TEXT NOT NULL,
    "numero_actuacion" TEXT,
    "fecha_actuacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etapa_destino" "EtapaProcesal" NOT NULL,
    "resumen_dispositivo" TEXT NOT NULL,
    "organos_notificados" TEXT[],
    "creado_por" TEXT NOT NULL,
    "archivo_url_supabase" TEXT,

    CONSTRAINT "actuacion_procesal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sancion_expediente" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "sujeto_sancionado" TEXT NOT NULL,
    "tipo_sujeto" TEXT NOT NULL,
    "articulos_aplicados" TEXT NOT NULL,
    "tipo_sancion_deportiva" TEXT,
    "cantidad_partidos_meses" TEXT,
    "multa_ucfvf" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tasa_ucfvf_usd" DECIMAL(65,30) NOT NULL DEFAULT 3.0,
    "multa_usd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estado_cumplimiento" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "referencia_pago" TEXT,
    "fecha_cumplimiento" TIMESTAMP(3),
    "observacion_ejecucion" TEXT,

    CONSTRAINT "sancion_expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurso_expediente" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "tipo_recurso" TEXT NOT NULL,
    "fecha_interposicion" TIMESTAMP(3) NOT NULL,
    "numero_resolucion" TEXT,
    "fecha_resolucion" TIMESTAMP(3),
    "resultado_recurso" TEXT,
    "detalle_decision" TEXT,

    CONSTRAINT "recurso_expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_expediente" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "bucket_path" TEXT NOT NULL,
    "subido_por" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_pago_afectado" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "sancion_id" INTEGER,
    "entidad_emisor" TEXT NOT NULL,
    "referencia_bancaria" TEXT NOT NULL,
    "monto_pagado_usd" DECIMAL(65,30) NOT NULL,
    "monto_pagado_ucfvf" DECIMAL(65,30) NOT NULL,
    "fecha_pago" TIMESTAMP(3) NOT NULL,
    "comprobante_url" TEXT NOT NULL,
    "observaciones_afectado" TEXT,
    "estado" "EstadoReportePago" NOT NULL DEFAULT 'PENDIENTE_VERIFICACION',
    "conciliado_por" TEXT,
    "fecha_conciliacion" TIMESTAMP(3),
    "observacion_admin" TEXT,
    "notificado_admin" BOOLEAN NOT NULL DEFAULT true,
    "notificado_licencias" BOOLEAN NOT NULL DEFAULT false,
    "notificado_cdh" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporte_pago_afectado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expediente_juridico_anio_tramite_idx" ON "expediente_juridico"("anio", "tramite");

-- CreateIndex
CREATE INDEX "expediente_juridico_asignado_a_status_kanban_idx" ON "expediente_juridico"("asignado_a", "status_kanban");

-- CreateIndex
CREATE UNIQUE INDEX "expediente_juridico_numero_exp_anio_key" ON "expediente_juridico"("numero_exp", "anio");

-- CreateIndex
CREATE INDEX "informe_partido_ia_torneo_jornada_idx" ON "informe_partido_ia"("torneo", "jornada");

-- CreateIndex
CREATE UNIQUE INDEX "expediente_disciplinario_codigo_expediente_key" ON "expediente_disciplinario"("codigo_expediente");

-- CreateIndex
CREATE INDEX "expediente_disciplinario_anio_estado_tramite_idx" ON "expediente_disciplinario"("anio", "estado_tramite");

-- CreateIndex
CREATE INDEX "expediente_disciplinario_etapa_actual_especialista_asignado_idx" ON "expediente_disciplinario"("etapa_actual", "especialista_asignado");

-- CreateIndex
CREATE INDEX "expediente_disciplinario_torneo_categoria_idx" ON "expediente_disciplinario"("torneo_categoria");

-- CreateIndex
CREATE INDEX "actuacion_procesal_expediente_id_fecha_actuacion_idx" ON "actuacion_procesal"("expediente_id", "fecha_actuacion");

-- CreateIndex
CREATE INDEX "sancion_expediente_expediente_id_estado_cumplimiento_idx" ON "sancion_expediente"("expediente_id", "estado_cumplimiento");

-- CreateIndex
CREATE INDEX "reporte_pago_afectado_expediente_id_estado_idx" ON "reporte_pago_afectado"("expediente_id", "estado");

-- AddForeignKey
ALTER TABLE "actuacion_procesal" ADD CONSTRAINT "actuacion_procesal_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expediente_disciplinario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sancion_expediente" ADD CONSTRAINT "sancion_expediente_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expediente_disciplinario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurso_expediente" ADD CONSTRAINT "recurso_expediente_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expediente_disciplinario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_expediente" ADD CONSTRAINT "documento_expediente_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expediente_disciplinario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_pago_afectado" ADD CONSTRAINT "reporte_pago_afectado_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expediente_disciplinario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_pago_afectado" ADD CONSTRAINT "reporte_pago_afectado_sancion_id_fkey" FOREIGN KEY ("sancion_id") REFERENCES "sancion_expediente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
