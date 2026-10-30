-- =============================================================================
-- FASE 4: Autenticacion
--
-- - debe_cambiar_password: obliga a cambiar la clave estandar en el proximo
--   ingreso.
-- - password_actualizado_en: version de sesion. Si cambia, los tokens de
--   sesion emitidos antes dejan de validar.
-- - cambios_password: contador de cambios propios, para el expediente del
--   usuario.
-- =============================================================================

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usuario" ADD COLUMN     "password_actualizado_en" TIMESTAMP(3);
ALTER TABLE "usuario" ADD COLUMN     "cambios_password" INTEGER NOT NULL DEFAULT 0;