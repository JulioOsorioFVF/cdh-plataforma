# Mapeo de datos: Google Sheets -> modelo dimensional

Analisis real de las dos fuentes. Todas las cifras provienen de ejecutar el
conector sobre los CSV, no de suposiciones.

---

## Fuente 1 — COMPETENCIAS (sanciones)

- URL: hoja publicada en CSV, `gid=1639745222` (`DATA`)
- **27.679 filas, 38 columnas**
- El ID real del libro no aparece en la URL publicada (va tras `2PACX-...`).
  Para leerlo con Service Account hay que pedirlo.

### Bloques de la fila

| Rango | Bloque                                                                              | Destino                                                                                                  |
| ----- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 0–5   | Contexto (año, torneo, categoría, fase, jornada, acta)                              | `dim_torneo`, `dim_categoria`, `dim_fase`, `dim_jornada`, `fact_partido`                                 |
| 6–13  | Clasificación (proc., tipo sancionado, tipo, motivo, observación, norma, artículos) | `dim_tipo_sancionado`, `dim_tipo_decision`, `dim_motivo`, `dim_observacion`, `dim_norma`, `dim_articulo` |
| 14–20 | Persona y sanción (sanción, tiempo, UC, club, nombre)                               | `dim_persona`, `dim_club`, `fact_sancion`                                                                |
| 21–22 | Partido (equipos, id de partido)                                                    | `fact_partido`                                                                                           |
| 23–33 | Flags                                                                               | `fact_sancion_flag`                                                                                      |
| 34–36 | Reintegro, alerta, tipo de infracción                                               | `fact_sancion`                                                                                           |

### Valores distintos observados

| Columna             | Distintos                               |
| ------------------- | --------------------------------------- |
| TIPO DE SANCIONADO  | 7                                       |
| TIPO                | 6                                       |
| MOTIVO              | 16                                      |
| OBSERVACIÓN         | 130                                     |
| NORMA               | 20 literales (muchos son combinaciones) |
| ARTÍCULOS           | 431 literales distintos                 |
| INCIDENCIA_LICENCIA | 9                                       |
| DETALLE_INCIDENCIA  | 69                                      |
| FASE                | 16                                      |
| CATEGORÍA           | 12                                      |
| TORNEO              | 6                                       |
| CLUB                | 91                                      |

### Defectos que la ingesta corrige

1. **`TIPO_DE_INFRACCIÓN` roto**: la columna trae `#NAME?` en 13.592 de las
   27.554 filas (49,3%) por una fórmula `BUSCARX` inválida. Se reconstruye
   desde el catálogo `dim_tipo_infraccion`, y el literal queda en la fila.
2. **`NORMA` multivalor**: son combinaciones de reglamentos (`NRLFJ, RD`,
   `NR, RGC`). No cabe en un campo; va al puente `fact_sancion_norma`. Un
   literal pegado (`RD-NRLFJ`) se parte en las dos normas.
3. **`ARTÍCULOS` multivalor**: hasta 431 literales; se separan por coma o
   punto y coma y van al puente `fact_sancion_articulo`.
4. **`SANCIÓN` contaminada**: mezcla el texto de la sanción con códigos de
   artículo. Separar en `sancionRaw` + `fact_sancion_articulo`.
5. **Identidad de la fila**: el hash se calcula sobre **las 38 columnas**, no
   sobre un subconjunto. Ver la sección siguiente, es la corrección más
   importante que hizo esta ingesta.

### La corrección del hash (importante)

La primera versión hasheaba nueve campos (fecha, id de partido, sancionado,
nombre, tipo, motivo, artículos, observación y club) y daba **22.292
sanciones**. Ese número estaba mal.

El problema es que esos nueve campos **no identifican una sanción**: dos actas
distintas del mismo jugador, por el mismo motivo, con los mismos artículos,
tienen los nueve campos idénticos y se fundían en una sola fila. Se perdían
los montos, los juegos, el tipo de sancionado, la incidencia y el partido.
Medido sobre la hoja: de 5.389 filas colapsadas, **5.280 diferían** en campos
que el hash no miraba, y 6.478 sanciones tienen monto o juegos que no
llegaban a la base.

Hashando la fila entera el resultado es **27.554 sanctions**, que es
exactamente el número de filas distintas de la hoja (los 125 duplicados
exactos se funden, que es lo que debe pasar). La ingesta sigue siendo
idempotente: reejecutarla actualiza las mismas filas y no crea ninguna nueva.

**Regla que queda:** si dos filas de la hoja son la misma sanción, tienen que
ser idénticas en todas las columnas. Si difieren en algún campo, son dos
sanciones distintas y ambas van a la base.

---

## Fuente 2 — CUADRO DE EXPEDIENTES

- Libro: `1Njhrbdf32k4TfAAaTh-gVYH6BaVUZ8yMh5vUs3h7PgE`
- Hoja: `gid=1385768914`
- Export CSV: `/export?format=csv&gid=1385768914` (1.972.037 bytes)

### Estructura real

**563 filas con datos, de 10.549 exportadas.** Las 9.986 restantes contienen
únicamente `$0` en la columna `Multa $`: es un artefacto de la hoja (una
formula arrastrada hacia abajo), **no son datos**. El conector debe descartar
filas cuyo `N Exp` este vacio.

Anios presentes: **2022, 2023, 2024, 2025, 2026** (5).

### La clave natural NO es `N Exp`

`N Exp` **se reutiliza cada año**: existen 142 números distintos pero
**560 combinaciones distintas de (N Exp, Año)**. El número `001` aparece en
2022, 2023, 2024, 2025 y 2026.

Por eso el schema usa `@@unique([anio, numero])` y la forma canónica es
`001/2022`. _(Un `numero @unique` habría rechazado 418 de las 563 filas.)_

Excepciones: 3 pares tienen 2 filas (`018/2022`, `008/2025`, `024/2025`). La
ingesta conserva la primera y avisa por consola, en lugar de fallar contra la
restricción de unicidad. De ahí que queden **560 expedientes y no 563**: las
3 repetidas son el mismo expediente escrito dos veces.

### Es una fila plana con TRES bloques pegados

La hoja repite encabezados (`Año` en col 1 y col 18, `Decisión` en col 21 y
col 28). No son hojas separadas: son bloques enumerados de la misma fila.

#### Bloque A — Expediente (cols 0–16)

| #   | Columna                                            | Campo                           | Notas                               |
| --- | -------------------------------------------------- | ------------------------------- | ----------------------------------- |
| 0   | `N Exp`                                            | `numero`                        | + `anio` (col 1)                    |
| 1   | `Año`                                              | `anio`                          |                                     |
| 2   | `Auto de Entrada (A.E.) o Inicio de Investigación` | `autoEntrada`                   | 63 filas = `S/N`                    |
| 3   | `Fecha Auto de Entrada`                            | `fechaAutoEntrada`              | → también `fechaRecepcion`          |
| 4   | `Motivo `                                          | `motivo`                        | 438 distintos, texto libre          |
| 5   | `Asunto de Exp`                                    | `nombre`                        | 19 distintos, 52 con valor          |
| 6   | `Parte demandante`                                 | `fact_expediente_parte` orden 1 | 45 con valor                        |
| 7   | `Parte demandada`                                  | `fact_expediente_parte` orden 2 | 43 con valor                        |
| 8   | `Torneo o Categoria`                               | `ligaTorneo`                    | 130 distintos                       |
| 9   | `Equipos`                                          | `equipos`                       | 238 filas con formato "A Vs. B"     |
| 10  | `Trámite`                                          | `tramiteRaw`                    | 16 distintos, 558 con valor         |
| 11  | `Modalidad`                                        | `modalidad`                     | Físico 373 / Mixto 101 / Digital 84 |
| 12  | `ASIGNADO`                                         | `asignado`                      | 29 juez(es), separados por coma     |
| 13  | `STATUS`                                           | `estatus` + `estado`            | 30 distintos, **433 filas vacías**  |
| 14  | `FECHA DE ASIGNACIÓN`                              | `fechaAsignacion`               | solo 8 con valor                    |
| 15  | `FECHA DE SEGUIMIENTO `                            | `fechaSeguimiento`              | **columna vacía**                   |
| 16  | `ALERTA`                                           | `alerta`                        | **columna vacía**                   |

#### Bloque B — Auto / Decisión principal (cols 17–21)

| #   | Columna                      | Campo                                                    |
| --- | ---------------------------- | -------------------------------------------------------- |
| 17  | `Fecha de Auto y/o Decisión` | `fechaResolucion` (y `dim_fecha`)                        |
| 18  | `Año`                        | derivado de la fecha                                     |
| 19  | `Mes`                        | derivado de la fecha                                     |
| 20  | `Nº Auto y/o Decisión`       | `numeroDecision` + `fact_expediente_movimiento.codigo`   |
| 21  | `Decisión`                   | `fact_expediente_movimiento.descripcion` (316 distintos) |

#### Bloque C — Reconsideración (cols 22–28)

| #   | Columna                      | Campo                               |
| --- | ---------------------------- | ----------------------------------- |
| 22  | `Nº de usurpación y Fecha`   | movimiento tipo `OTRO`              |
| 23  | `Segunda Decisión`           | movimiento tipo `SEGUNDA_INSTANCIA` |
| 24  | `Ejercieron Reconsideración` | movimiento tipo `RECONSIDERACION`   |
| 25  | `FECHA R.R.`                 | `movimiento.fecha`                  |
| 26  | `Nro. Decisión`              | `movimiento.codigo`                 |
| 27  | `Fecha de emisión`           | `movimiento.fecha`                  |
| 28  | `Decisión`                   | `movimiento.descripcion`            |

#### Bloque D — Resultado y cumplimiento (cols 29–35)

| #   | Columna                       | Campo                  | Con dato                                 |
| --- | ----------------------------- | ---------------------- | ---------------------------------------- |
| 29  | `Observaciones`               | `notas`                | 16                                       |
| 30  | `Sanción`                     | `sancionRaw`           | 29                                       |
| 31  | `Sancionado`                  | `sancionadoRaw`        | 73                                       |
| 32  | `Multa UCFVF`                 | `multaUc`              | 157 (67 con valor > 0)                   |
| 33  | `Multa $`                     | `multaUsd`             | 10.538 (**9.986 son el artefacto `$0`**) |
| 34  | `CUMPLIMIENTO DE LA DECISIÓN` | `cumplimientoDecision` | 15 (SI 12 / NO 2 / FALTA PAGO 1)         |
| 35  | `MOTIVO`                      | `motivoCumplimiento`   | 18                                       |

Columnas 36–39: sin nombre y **sin datos**. Se ignoran.

---

## Normalización requerida en la ingesta

### 1. Fechas

Dos formatos conviven: **D/M/YYYY** con barras (494+533+19 ocurrencias) y
**DD-MM-YYYY** con guiones (2). Venezolano = dia primero, y el caso `23-06-2025`
(primer componente > 12) lo confirma. `parseFecha()` cubre ambos.

Riesgo: 212 fechas como `9/3/2022` son ambiguas (dia y mes <= 12). Se
interpretan como dia/mes, que es la convención del Consejo.

### 2. `estado` (enum de 8 valores)

`STATUS` viene con 30 valores libres y **433 de 563 filas lo traen vacío**.
Regla de normalización:

| Estado        | Originales                                                             |
| ------------- | ---------------------------------------------------------------------- |
| `RESUELTO`    | Decidido, Decidido Totalmente, Parcialmente Decidido, ARIETE           |
| `ARCHIVADO`   | Cierre, CERRADO                                                        |
| `DESESTIMADO` | INADMISIBLE, Inadmisible                                               |
| `NOTIFICADO`  | Levantamiento Provisional, Prohibición de fichaje…                     |
| `EN_CURSO`    | Pendiente, Trámite, En Proyecto, EN PROYECTO, En Instrucción, Revisión |
| `EN_ESTUDIO`  | Sin Ref. de Inicio,-status sin clasificar                              |
| `REMITIDO`    | Remisión Juez Único                                                    |
| `ARCHIVADO`   | PARALIZADO*, PARALIZADO SIN DECISIÓN                                   |

Fallback cuando `STATUS` viene vacío: derivar de `Trámite` (col 10, que sí
tiene 558 filas con valor). Si tampoco se puede, `RECIBIDO`.

`estatus` siempre conserva el texto original para auditoría.

### 3. Monto de multa -> tasa

Solo **103 de 157** multas son coherentes con `USD ≈ UC × 3`; 54 no lo son.
**No asumir una tasa fija.** Calcular `tasaUsd = multaUsd / multaUc` por fila
y alimentar `dim_tasa_uc`, que ya está modelada con vigencia por fecha.

### 4. Vínculo expediente ↔ sanción

Solo 73 expedientes traen `Sancionado`. El vínculo automático por nombre es
poco fiable; el modelo ya lo soporta con
`fact_sancion_expediente.vinculo = 'AUTOMATICO' | 'MANUAL'` y `confianza`.
El resto queda para confirmación humana en la UI.

**La tabla está vacía y así se espera**: ningún script la escribe todavía.

Alerta al usar `--limpio`: las tablas hijas están en `ON DELETE CASCADE` desde
`fact_expediente`, incluida `fact_sancion_expediente`. Vaciar expedientes borra
esos vínculos en cascada, y la ingesta de expedientes no sabe reconstruirlos
porque los produce la de competencias. Hoy no da problema porque la tabla está
vacía; el script `npm run ingesta -- expedientes --limpio` lo comprueba y
**aborta** si encuentra vínculos, para que no se pierdan en silencio. Si algún
día se puebla, hay que cambiar la FK a `ON DELETE SET NULL` o respaldar y
repoblar la tabla.

### 5. Vínculo expediente ↔ partido

`Equipos` con formato "A Vs. B" (238 filas) permite resolver `local` y
`visitante` contra `dim_club` y enlazar con `fact_partido`. Registrar el
partido en `fact_expediente_partido`.

### 6. Vínculo expediente ↔ persona

La hoja no trae cédula en los expedientes, así que las partes se guardan con su
nombre tal cual (`fact_expediente_parte.nombre`). El modelo admite
`personaId1/personaId2` para cuando haya un match fiable; se deja `null`
mientras tanto, porque enlazar por nombre sin cédula produce falsos positivos.

### 7. `sancionado_raw`: NO canonicalizar

`sancionado_raw` y `fact_expediente_parte.nombre` son texto libre de la hoja.
Da la tentación "limpiarlo", y **es un error**. Ejemplo real:

| Valor               | Qué es              |
| ------------------- | ------------------- |
| `DEPORTIVO TACHIRA` | Club                |
| `TACHIRA`           | Selección de estado |

Son **entidades distintas**, no dos maneras de escribir la misma. Unirlas
fundiría el club con la selección, que es justo lo que el modelo debe evitar.
Es el mismo error que asignar un artículo de las NR a su equivalente del RD.

| Normalización                                                         | Permitida |
| --------------------------------------------------------------------- | --------- |
| Ignorar tildes, mayúsculas, espacios y puntos (`TÁCHIRA` = `TACHIRA`) | **Sí**    |
| Quitar palabras para "unificar" (`DEPORTIVO TACHIRA` → `TACHIRA`)     | **No**    |

Por eso `getVariantesDeEscritura()` en `src/lib/datos/expedientes.ts` solo
informa de cuántas formas hay por tildes o puntuación, y **no** propone
fusionar nada. Quien quiera separar club de selección necesita un dato que la
hoja no tiene: la cédula, o un catálogo de entidades differentiate.

---

## Año del expediente vs. año de la resolución

Son **dos fechas distintas** y la hoja no las mezcla, pero cualquier reporte que
no diga cuál está usando miente.

| Año                  | Origen                                 | Significado                   |
| -------------------- | -------------------------------------- | ----------------------------- |
| Año del expediente   | `fact_expediente.anio`                 | Cuándo se abrió el expediente |
| Año de la resolución | `numero_decision` → `fecha_resolucion` | Cuándo se dictó el acto       |

El identificador oficial del acto es su número (`Res. 052/2024`), así que el año
sale de ahí y la fecha es solo el respaldo cuando el número no trae año
(`exprAnioResolucion()` en `src/types/filtros-expedientes.ts`).

### Cuánto difieren

**145 de 560 expedientes** tienen año de expediente distinto al de su
resolución. No es ruido: son expedientes ouverts en un año que se sancionó en
otro.

De los **480** números con año legible, el año del número y el de
`fecha_resolucion` coinciden en **479**. La única excepción es
`Auto 027/2023`, fechado `2024-04-05`; como el número manda, se cuenta en 2023.

### Por qué cambia el reporte

Multas en UCFVF según el año que se use como referencia:

| Año  | Por expediente | Por resolución |
| ---- | -------------- | -------------- |
| 2026 | 2.280          | 10.719,66      |
| 2025 | 16.646,33      | 10.603,34      |
| 2024 | 4.080          | 5.100          |
| 2023 | 6.153          | 2.823          |
| 2022 | 3.176,17       | 3.089,5        |

El total no cambia (32.335,5 en ambos casos), pero **2026 casi se quintuplica**
al atribuir por resolución: 22 de las 64 multas con UC positivo son de
resoluciones de 2026 sobre expedientes antiguos. El año y el mes siempre se
toman de la misma fuente (`exprAnio` y `columnaFecha`), porque elegir el año por
un lado y la fecha por otro produce filas tipo "2024 · Enero" que en realidad
son de enero de 2026.

69 expedientes no tienen decisión; de ellos, 9 tampoco tienen fecha resolutiva
y quedan como **"sin año de referencia"**. No se reparten en ningún año: se
muestran aparte, solo cuando no hay filtro de años activo.

### La vista

`/expedientes` deja elegir el criterio con el selector **Atribuir a** y muestra
los dos años a la vez en cada fila, con una nota cuando el expediente cruza de
año. Ninguno de los dos años se esconde: la diferencia es información que el
Consejo necesita.

### Dos errores que ya ocurrieron aquí

Documentados porque son los que volverían:

1. **Backslashes en un template literal.** `\s` y `\d` no son escapes válidos
   en JavaScript: valen `s` y `d`. El regex `//\s*(\d{4})/` llegó a
   PostgreSQL como `/s*(d{4})`, no casó con nada, el año salió `NULL` en todas
   las filas y el `coalesce` de respaldo tapó el fallo con la fecha. Cifras
   razonables, columna equivocada. Va como `'/\\s*(\\d{4})'`.
2. **`AND`/`OR` sin paréntesis.** `anio IN (2026) AND uc > 0 OR usd > 0` se lee
   como `(anio = 2026 AND uc > 0) OR usd > 0`: el `OR` escapa del filtro de año
   y devuelve filas de todos los años. El `OR` va siempre entre paréntesis.

Ninguno de los dos daba error; los dos devolvían números plausibles y
equivocados.

---

## Citas de normas y artículos: qué resuelve y qué no

Esto conviene entenderlo antes de tocar los catálogos.

`dim_norma` tiene **16 normas**, pero `dim_articulo` tiene **428 artículos y los
428 son del RD**. Las Normas Reguladoras (NR), que son el reglamento de las
competiciones, **no tienen un solo artículo cargado**.

| Cita                         | Ocurrencias | Qué pasa                                                           |
| ---------------------------- | ----------- | ------------------------------------------------------------------ |
| `RD-67-6`, `RD-132`, `67-UP` | ~17.000     | Resuelta contra el catálogo del RD                                 |
| `43`, `10`, `35 A`, `24-3`   | ~15.000     | Resuelta: la hoja omite el prefijo y queda claro que es RD         |
| `NR-41`, `NR-12`, `NR-24-3`  | **2.868**   | **No se puede resolver**: el catálogo no tiene artículos de las NR |
| `RD-NR-114-3`, `5YNR-12RJ`   | ~130        | Citas pegadas de dos reglamentos, ilegibles                        |
| `S/A`, `X`, `NORMA`          | ~10         | No son citas, son la hoja diciendo "no hay dato"                   |

**Decisión de diseño que hay que respetar:** un artículo de las NR **no** puede
apuntar al artículo equivalente del RD. `NR-41` y `RD-41` son artículos de
reglamentos distintos; confundirlos es peor que no tener la cita enlazada. Por
eso `idArticulo()` fuerza la búsqueda dentro de la norma que declara el
prefijo, y hay una comprobación en la base que confirma que **0** artículos de
NR apuntan al RD.

Todos los literales quedan guardados en `fact_sancion.normaRaw` y
`fact_sancion_articulo.literal`, así que el día que se cargue el texto de las
NR se pueden enlazar sin volver a la hoja.

### Pendiente: dos problemas del catálogo de artículos

1. **18 de los 428 códigos no son artículos del RD.** Son citas pegadas que se
   colaron al construir el catálogo desde la columna sucia de la hoja:
   `NR-10`, `NR-2`, `S/A`, `RJ-5Y12`, `10 NR RJ 5-12 RD 8`, `2.RJSY12 RD-NR`,
   `RD FVF`, `RGC-6-C`, `NRLFJ`… El catálogo debería reconstruirse desde el
   texto oficial del Reglamento Disciplinario, no desde la columna de la hoja.
2. **Faltan los artículos de las NR**, que son 2.868 citas sin resolver.

Ninguna de las dos cosas se arregla con código: hacen falta los textos
oficiales. Con lo que hay hoy, `S/A` y `NR-10` se filtran en vez de enlazarse
a un artículo equivocado.

---

## Cobertura final verificada

Ejecutado el 2026-10-01 sobre las dos hojas completas.

| Entidad                      | Filas      | Nota                                  |
| ---------------------------- | ---------- | ------------------------------------- |
| `fact_sancion`               | **27.554** | 27.679 filas − 125 duplicados exactos |
| `fact_sancion_flag`          | 42.765     |                                       |
| `fact_sancion_norma`         | 31.878     |                                       |
| `fact_sancion_articulo`      | 35.612     |                                       |
| `fact_expediente`            | **560**    | 563 − 3 repetidos por `(año, número)` |
| `fact_expediente_movimiento` | 1.057      |                                       |
| `fact_expediente_parte`      | 88         |                                       |
| `fact_partido`               | 1.804      |                                       |
| `dim_club`                   | 61         |                                       |
| `dim_persona`                | 6.066      |                                       |

### Claves foráneas de `fact_sancion`

100% en fecha, persona, torneo, categoría, tipo sancionado, decisión, motivo,
incidencia y detalle de incidencia.

| Clave              | Cobertura       | Motivo de los nulos        |
| ------------------ | --------------- | -------------------------- |
| `clubId`           | 27.551 / 27.554 | 3 celdas vacías en la hoja |
| `partidoId`        | 27.552 / 27.554 | 2 celdas vacías            |
| `tipoInfraccionId` | 13.962 / 27.554 | 13.592 celdas con `#NAME?` |

Los nulos son de la fuente, no de la ingesta: **0 personas huérfanas**.

### Distribución por año

| Año  | Sanciones |
| ---- | --------- |
| 2021 | 10        |
| 2022 | 38        |
| 2023 | 77        |
| 2024 | 11.450    |
| 2025 | 15.979    |

### Comprobaciones de integridad

- 18 de 18 consultas del tablero devuelven filas coherentes.
- 0 artículos de NR enlazados al RD.
- 0 enlaces de `S/A` como si fuera un artículo.
- 0 personas huérfanas.
- Reejecutar la ingesta: 0 insertadas, 27.554 actualizadas, 0 filas nuevas.
