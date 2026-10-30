-- El detalle de incidencia NO es unico por nombre: un mismo detalle pertenece
-- legtimamente a varias incidencias de licencia. En la hoja COMPETENCIAS hay 22
-- valores de DETALLE_INCIDENCIA que aparecen bajo mas de una incidencia
-- (UNIFORMES bajo DEPORTIVA, ADMINISTRATIVA e INFRAESTRUCTURA; DELEGADO bajo
-- DEPORTIVA, JUEGO y ADMINISTRATIVA, etc.).
--
-- Con el indice unico global, `skipDuplicates` descartaba esas filas y la
-- incidencia mal clasificada era la que se conservaba, dejando las sanciones con
-- una FK de detalle incorrecta o nula.
--
-- La unicidad correcta es por el par (incidencia_id, nombre).

DROP INDEX IF EXISTS dim_detalle_incidencia_nombre_key;

CREATE UNIQUE INDEX "dim_detalle_incidencia_incidencia_id_nombre_key"
  ON "dim_detalle_incidencia" USING btree ("incidencia_id", "nombre");