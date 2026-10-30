# Notas de procedencia — `catalogos.json`

Generado a partir de la hoja `DATA` (26.981 filas) del libro
`COMPETENCIAS` de Google Sheets. No editar a mano: se regenera desde la
fuente y luego se aplica con `npm run db:seed:catalogos`.

## Contenido

| Clave             | Registros | Origen                                                        |
| ----------------- | --------- | ------------------------------------------------------------- |
| `normas`          | 16        | Tokens unicos de la columna `NORMA`                           |
| `articulos`       | 428       | Tokens normalizados de `ARTÍCULOS` (de 431 crudos)            |
| `observaciones`   | 102       | Valores unicos de `OBSERVACIÓN` + tipo de infracción resuelto |
| `tiposInfraccion` | 4         | Catalogo `TIPO_DE_INFRACCION` de la hoja                      |

## Limitaciones conocidas

1. **`articulos[].norma` esta fijado a `RD` para los 428 articulos.**
   La columna `ARTÍCULOS` de la hoja no incluye el reglamento de procedencia,
   solo el numero. Como 16 reglamentos distintos conviven en la base (RD, NR,
   RGC, RJ, LODAFEF, CD_FIFA, E_FVF, LEY_DEL_DEPORTE, IFAB, ...) y `RD` es
   con diferencia el mayoritario, todos se atribuyen a `RD` como aproximacion.

   **Consecuencia:** el reporte "articulos infringidos por norma" esta sesgado
   hacia `RD`. No usar para decisiones juridicas hasta resolver la atribucion.

   **Como resolverlo** (Fase 3, al escribir el normalizador de ingesta):
   - Usar el indice de frecuencia ya calculado: cuando un articulo aparece
     siempre junto a una misma norma en `NORMA`, Heredar esa norma.
   - Los articulos sin evidencia se cargan con `normaId = null` y una entrada
     en `fact_sancion_flag` con `flag = 'NORMA_PENDIENTE'`, para que el
     dashboard los muestre como "sin norma confirmada" en vez de contarlos
     como RD.

2. **`observaciones[].tipoInfraccion` proviene del catalogo, no de la fila.**
   La columna `TIPO_DE_INFRACCION` de la hoja esta rota (13.965 celdas con
   `#NAME?` por una formula `BUSCARX` invalida). El mapeo se reconstruyo
   desde el catalogo de la hoja, que si es confiable.

3. **`normas[].documentos`** es descriptivo: no son rutas a los reglamentos.
   El texto oficial de cada articulo habria queincorporarlo aparte.

## Aplicacion

```powershell
npm run db:seed:catalogos
```

Es idempotente: usa `upsert` sobre `dim_norma`, `dim_articulo`,
`dim_tipo_infraccion` y `dim_observacion`. Puede reejecutarse cuantas veces
haga falta.
