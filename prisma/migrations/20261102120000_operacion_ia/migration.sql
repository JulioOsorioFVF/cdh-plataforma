-- CreateTable
CREATE TABLE "plantilla_procedimiento_cdh" (
    "id" SERIAL NOT NULL,
    "codigo_tipologia" TEXT NOT NULL,
    "nombre_procedimiento" TEXT NOT NULL,
    "articulos_base" TEXT[],
    "documentos_requeridos" TEXT[],
    "lapso_descargos_dias" INTEGER NOT NULL DEFAULT 5,
    "tipo_dias_descargos" TEXT NOT NULL DEFAULT 'HABILES',
    "lapso_cumplimiento_dias" INTEGER NOT NULL DEFAULT 30,
    "requiere_audiencia" BOOLEAN NOT NULL DEFAULT false,
    "unidades_notificar_inicio" TEXT[],
    "unidades_notificar_decision" TEXT[],
    "pasos_json" JSONB NOT NULL,
    "preguntas_base_interrogatorio" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantilla_procedimiento_cdh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audiencia_interrogatorio" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "compareciente_nombre" TEXT NOT NULL,
    "compareciente_cedula" TEXT,
    "rol_compareciente" TEXT NOT NULL,
    "abogado_asistente" TEXT,
    "modalidad" TEXT NOT NULL DEFAULT 'TELEMATICA_MEET',
    "enlace_meet" TEXT,
    "fecha_programada" TIMESTAMP(3) NOT NULL,
    "reprogramada" BOOLEAN NOT NULL DEFAULT false,
    "motivo_reprogramacion" TEXT,
    "estado_audiencia" TEXT NOT NULL DEFAULT 'CITADA',
    "pliego_preguntas_respuestas" JSONB NOT NULL,
    "lapso_pruebas_extra_dias" INTEGER,
    "acta_firmada_url" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audiencia_interrogatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medida_cautelar_disciplinaria" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "sujeto_afectado" TEXT NOT NULL,
    "cedula_sujeto" TEXT,
    "cargo_rol" TEXT NOT NULL,
    "tipo_medida" TEXT NOT NULL,
    "dictada_por" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "dias_maximos_legales" INTEGER NOT NULL DEFAULT 30,
    "fecha_vencimiento_fatal" TIMESTAMP(3) NOT NULL,
    "estado_medida" TEXT NOT NULL DEFAULT 'VIGENTE',
    "descontar_de_sancion_final" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "medida_cautelar_disciplinaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturacion_multa_fvf" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "numero_decision" TEXT NOT NULL,
    "sancionado_nombre" TEXT NOT NULL,
    "rif_sancionado" TEXT,
    "correo_facturacion" TEXT,
    "telefono_contacto" TEXT,
    "multa_ucfvf" DECIMAL(65,30) NOT NULL,
    "multa_usd" DECIMAL(65,30) NOT NULL,
    "tasa_cambio_bs" DECIMAL(65,30),
    "monto_pagado_bs" DECIMAL(65,30),
    "referencias_bancarias" TEXT[],
    "reportado_en_form_uca" BOOLEAN NOT NULL DEFAULT false,
    "numero_factura_fiscal" TEXT,
    "numero_control_fiscal" TEXT,
    "estado_cobranza" TEXT NOT NULL DEFAULT 'PENDIENTE_DATOS_RIF',
    "requiere_curso_integridad" BOOLEAN NOT NULL DEFAULT false,
    "curso_integridad_cumplido" BOOLEAN NOT NULL DEFAULT false,
    "fecha_curso_integridad" TIMESTAMP(3),
    "referencia_clausura_cdh" TEXT,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturacion_multa_fvf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contador_advertencia_club" (
    "id" SERIAL NOT NULL,
    "club" TEXT NOT NULL,
    "torneo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "motivo_advertencia" TEXT NOT NULL,
    "articulos_infringidos" TEXT NOT NULL,
    "cantidad_acumulada" INTEGER NOT NULL DEFAULT 1,
    "ultima_jornada" INTEGER NOT NULL,
    "deriva_en_multa" BOOLEAN NOT NULL DEFAULT false,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contador_advertencia_club_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plantilla_procedimiento_cdh_codigo_tipologia_key" ON "plantilla_procedimiento_cdh"("codigo_tipologia");

-- CreateIndex
CREATE INDEX "audiencia_interrogatorio_expediente_id_fecha_programada_idx" ON "audiencia_interrogatorio"("expediente_id", "fecha_programada");

-- CreateIndex
CREATE INDEX "medida_cautelar_disciplinaria_estado_medida_fecha_vencimien_idx" ON "medida_cautelar_disciplinaria"("estado_medida", "fecha_vencimiento_fatal");

-- CreateIndex
CREATE INDEX "facturacion_multa_fvf_estado_cobranza_numero_factura_fiscal_idx" ON "facturacion_multa_fvf"("estado_cobranza", "numero_factura_fiscal");

-- CreateIndex
CREATE UNIQUE INDEX "contador_advertencia_club_club_torneo_categoria_motivo_adve_key" ON "contador_advertencia_club"("club", "torneo", "categoria", "motivo_advertencia");

-- AddForeignKey
ALTER TABLE "audiencia_interrogatorio" ADD CONSTRAINT "audiencia_interrogatorio_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expediente_disciplinario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medida_cautelar_disciplinaria" ADD CONSTRAINT "medida_cautelar_disciplinaria_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expediente_disciplinario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturacion_multa_fvf" ADD CONSTRAINT "facturacion_multa_fvf_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expediente_disciplinario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
