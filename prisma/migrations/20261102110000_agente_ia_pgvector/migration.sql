CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "OrigenIncidenciaPartido" AS ENUM ('INFORME_ARBITRAL', 'INFORME_DELEGADO', 'OFICIO_COMPETICIONES', 'UNIDAD_INTEGRIDAD', 'DENUNCIA_CLUB');

-- CreateEnum
CREATE TYPE "CategoriaIncidencia" AS ENUM ('DEPORTIVA_JUGADOR', 'CUERPO_TECNICO', 'INFRAESTRUCTURA_CAMERINOS', 'FUERZA_PUBLICA_SEGURIDAD', 'PROTOCOLO_MATERIAL', 'DOCUMENTACION_ALINEACION', 'FINANCIERA_ARBITRAJE', 'INTEGRIDAD_AMANO');

-- CreateTable
CREATE TABLE "acta_disciplinaria_jornada" (
    "id" SERIAL NOT NULL,
    "codigo_acta" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "semestre" TEXT NOT NULL,
    "torneo" TEXT NOT NULL,
    "jornada_numero" INTEGER NOT NULL,
    "partidos_analizados" INTEGER NOT NULL DEFAULT 0,
    "juez_unico_ponente" TEXT NOT NULL,
    "especialista_legal" TEXT NOT NULL,
    "analista_asignado" TEXT NOT NULL,
    "total_multas_ucfvf" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_multas_usd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estado_acta" TEXT NOT NULL DEFAULT 'BORRADOR_IA',
    "fecha_sesion_cdh" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acta_disciplinaria_jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencia_acta_partido" (
    "id" SERIAL NOT NULL,
    "acta_id" INTEGER NOT NULL,
    "partido" TEXT NOT NULL,
    "fecha_partido" TIMESTAMP(3),
    "origen" "OrigenIncidenciaPartido" NOT NULL,
    "categoria" "CategoriaIncidencia" NOT NULL,
    "lugar_incidencia" TEXT,
    "motivo_estandarizado" TEXT NOT NULL,
    "club_involucrado" TEXT NOT NULL,
    "sujeto_sancionado" TEXT NOT NULL,
    "tipo_sujeto" TEXT NOT NULL,
    "cedula_o_comet_id" TEXT,
    "extracto_informe_bruto" TEXT NOT NULL,
    "articulos_rdfvf" TEXT[],
    "tipo_sancion" TEXT NOT NULL,
    "partidos_suspension" INTEGER NOT NULL DEFAULT 0,
    "multa_ucfvf" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "multa_usd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "es_reincidente" BOOLEAN NOT NULL DEFAULT false,
    "deriva_en_expediente" BOOLEAN NOT NULL DEFAULT false,
    "confianza_extraccion_ia" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "incidencia_acta_partido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_disciplinario_sujeto" (
    "id" SERIAL NOT NULL,
    "identificador_unico" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "tipo_sujeto" TEXT NOT NULL,
    "club_actual" TEXT,
    "torneo_principal" TEXT,
    "amarillas_acumuladas_ciclo" INTEGER NOT NULL DEFAULT 0,
    "rojas_acumuladas_ciclo" INTEGER NOT NULL DEFAULT 0,
    "expedientes_abiertos" INTEGER NOT NULL DEFAULT 0,
    "sanciones_historicas" INTEGER NOT NULL DEFAULT 0,
    "multas_acumuladas_ucfvf" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deuda_pendiente_usd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "solvente_licencia_clubes" BOOLEAN NOT NULL DEFAULT true,
    "indice_riesgo_reincidencia" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historial_disciplinario_sujeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memoria_juridica_vectorial" (
    "id" SERIAL NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "codigo_referencia" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "torneo" TEXT,
    "motivo_tipificado" TEXT NOT NULL,
    "articulos_clave" TEXT[],
    "extracto_hechos" TEXT NOT NULL,
    "criterio_juridico" TEXT NOT NULL,
    "multa_aplicada_ucfvf" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sancion_deportiva" TEXT,
    "metadatos_json" JSONB NOT NULL,
    "embedding" vector(768),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memoria_juridica_vectorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "acta_disciplinaria_jornada_codigo_acta_key" ON "acta_disciplinaria_jornada"("codigo_acta");

-- CreateIndex
CREATE INDEX "acta_disciplinaria_jornada_torneo_anio_jornada_numero_idx" ON "acta_disciplinaria_jornada"("torneo", "anio", "jornada_numero");

-- CreateIndex
CREATE INDEX "incidencia_acta_partido_club_involucrado_motivo_estandariza_idx" ON "incidencia_acta_partido"("club_involucrado", "motivo_estandarizado");

-- CreateIndex
CREATE INDEX "incidencia_acta_partido_sujeto_sancionado_tipo_sancion_idx" ON "incidencia_acta_partido"("sujeto_sancionado", "tipo_sancion");

-- CreateIndex
CREATE UNIQUE INDEX "historial_disciplinario_sujeto_identificador_unico_key" ON "historial_disciplinario_sujeto"("identificador_unico");

-- CreateIndex
CREATE INDEX "historial_disciplinario_sujeto_club_actual_solvente_licenci_idx" ON "historial_disciplinario_sujeto"("club_actual", "solvente_licencia_clubes");

-- CreateIndex
CREATE UNIQUE INDEX "memoria_juridica_vectorial_codigo_referencia_key" ON "memoria_juridica_vectorial"("codigo_referencia");

-- CreateIndex
CREATE INDEX "memoria_juridica_vectorial_tipo_documento_motivo_tipificado_idx" ON "memoria_juridica_vectorial"("tipo_documento", "motivo_tipificado");

-- AddForeignKey
ALTER TABLE "incidencia_acta_partido" ADD CONSTRAINT "incidencia_acta_partido_acta_id_fkey" FOREIGN KEY ("acta_id") REFERENCES "acta_disciplinaria_jornada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
