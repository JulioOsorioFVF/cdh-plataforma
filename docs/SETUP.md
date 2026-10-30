# Guia de puesta en marcha — Consejo de Honor FVF

## 1. Requisitos

| Herramienta    | Version                       | Estado en este equipo            |
| -------------- | ----------------------------- | -------------------------------- |
| Node.js        | >= 20.11 (probado en 24.14.0) | OK                               |
| npm            | >= 10                         | OK                               |
| PostgreSQL     | >= 15 (instalado 16.10)       | **OK, corriendo**                |
| Docker Desktop | cualquiera                    | **NO INSTALADO** (no hace falta) |

PostgreSQL 16.10 quedo instalado **sin privilegios de administrador** (esta
maquina no los tiene), usando las binaries sin instalador de EDB. Vive en
`%TEMP%\opencode`, asi que **no hay servicio de Windows**: hay que arrancarlo
a mano.

```powershell
.\scripts\db\local-postgres.ps1 start     # arrancar
.\scripts\db\local-postgres.ps1 status    # estado + conteos
npm run db:ping                          # comprobar la conexion
```

Como **no hay admin**, `psql` no quedo en el PATH. Los scripts de base de datos
de `package.json` usan `prisma db execute`, que no lo necesita y ademas es
portable entre Windows, Linux y macOS.

Para trabajar sobre la **nube** (Neon, Supabase, Railway) solo hay que cambiar
`DATABASE_URL` y `DIRECT_URL` en `.env`. Ver `docs/BASE-DE-DATOS.md`.

## 2. Problema conocido: `npm install` en la unidad I:

`npm install` falla en `I:\` con:

```
npm error EBADF: bad file descriptor, write
```

Es un problema de la unidad, no del proyecto. Workaround validado:

```powershell
# 1. Instalar en una carpeta de la unidad C:
$stage = "C:\Users\josorio\AppData\Local\Temp\opencode\cdh-npm"
New-Item -ItemType Directory -Path $stage -Force | Out-Null
Set-Location $stage
npm init -y
npm install

# 2. Copiar node_modules al proyecto
robocopy "$stage\node_modules" "I:\Mi unidad\CONSEJO DE HONOR\cdh-plataforma\node_modules" /E /NFL /NDL /NJH /NJS /NP

# 3. Volver al proyecto
Set-Location "I:\Mi unidad\CONSEJO DE HONOR\cdh-plataforma"
```

## 3. Nota sobre el CLI de Prisma en PowerShell

Invocar el binario con `& ".\node_modules\prisma\build\index.js"` **se queda
colgado** en este equipo. Usar siempre `node`:

```powershell
node .\node_modules\prisma\build\index.js validate
node .\node_modules\prisma\build\index.js migrate dev
```

Los scripts de `package.json` ya invocan el CLI por su nombre (`prisma`), que es
la forma recomendada y no presenta el problema.

Aun asi, `prisma migrate dev` **no es usable** en este equipo: el usuario de
PostgreSQL no tiene el permiso `CREATEDB`, asi que no puede crear la base sombra
que el comando usa para probar las migraciones. El flujo de trabajo es
`db:deploy` (aplica lo pendiente) mas `db:generate`; para cambiar el esquema a
mano, editar `schema.prisma` y escribir el `.sql` de la migracion.

## 4. Orden de instalacion (Fases 1 y 2)

PostgreSQL 16.10 ya esta instalado y corriendo. Ver `docs/BASE-DE-DATOS.md`
para arrancarlo y para migrar a una base en la nube.

```powershell
npm install
.\scripts\db\local-postgres.ps1 start    # solo si el servidor local esta apagado
npm run db:ping                          # comprueba la conexion

# Aplicar esquema (49 tablas, 9 enums, indices y claves foraneas)
npm run db:deploy

# Sembrar datos base
npm run db:seed:roles         # 4 roles + 35 permisos + 87 asignaciones
npm run db:seed:base          # catalogos base (13 sancionados, 14 decisiones, ...)
npm run db:seed:catalogos     # 16 normas, 428 articulos, 4 tipos, 102 observaciones
npm run db:seed:vistas        # 26 vistas analiticas (las 14 secciones del informe)
npm run db:seed:indices       # indices GIN, vistas materializadas, refresco

# O todo en un comando:
npm run db:setup

# Crear la cuenta de acceso inicial (ver seccion 7.c)
npm run db:seed:usuario
```

Los archivos SQL se aplican en orden numerico con `prisma db execute`
(portable, no depende de `psql`):
`prisma/seeds/01_roles_permisos.sql` → `02_catalogos_base.sql` →
`03_vistas_analiticas.sql` → `04_indices_y_materializadas.sql`.

Todas las columnas se crean en `snake_case` (`@map` en `schema.prisma`), de
modo que el SQL de vistas, indices e ingesta se escribe sin comillas.

## 5. Variables de entorno

`.env` esta en `.gitignore`. `.env.example` es la plantilla. Claves esenciales:

```
DATABASE_URL=postgresql://cdh:cdh_dev_2026@localhost:5432/cdh_plataforma?schema=public
DIRECT_URL=<igual a DATABASE_URL en local; endpoint directo en la nube>
AUTH_SECRET=<openssl rand -base64 32>
ADMIN_EMAIL=julio.osorio@fvf.com.ve
ADMIN_PASSWORD=<contrasena de la cuenta inicial>
GOOGLE_SHEETS_COMPETENCIAS_URL=<csv publico>
GOOGLE_SHEETS_COMPETENCIAS_GID=1639745222
GOOGLE_SHEETS_EXPEDIENTES_CSV_URL=<csv del CUADRO DE EXPEDIENTES>
GOOGLE_SHEETS_EXPEDIENTES_GID=1385768914
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
ANTHROPIC_API_KEY=
GOOGLE_CLOUD_PROJECT=
```

## 6. Vistas que replican el informe

`prisma/seeds/03_vistas_analiticas.sql` crea:

| Vista                                               | Seccion del informe                  |
| --------------------------------------------------- | ------------------------------------ |
| `v_sancion`                                         | vista base enrichmentada             |
| `v_kpi_general`                                     | Panel de control                     |
| `v_sancionados_por_funcion`                         | Sancionados por funcion              |
| `v_tipos_decision`                                  | Tipos de decisiones                  |
| `v_motivos_infraccion`                              | Motivos de infraccion                |
| `v_normativas_afectadas`, `v_articulos_infringidos` | Normativa                            |
| `v_clubes_sancionados`                              | Clubes con mayor sancion             |
| `v_suspendidos`                                     | Analisis de suspendidos              |
| `v_multas_por_club`                                 | Multas por club                      |
| `v_incidencias_por_club`                            | Incidencias de licencia              |
| `v_matriz_tarjetas_jornada`                         | Matriz de tarjetas por jornada       |
| `v_sanciones_organismos`                            | Sanciones a ligas/comisiones         |
| `v_detalle_tarjetas`                                | Detalle de tarjetas                  |
| `v_expedientes`, `v_expedientes_resumen`            | Expedientes                          |
| `v_expedientes_cumplimiento`                        | Cumplimiento de decisiones con multa |
| `v_expedientes_modalidad`                           | Modalidad del tramite                |
| `v_expedientes_carga`                               | Carga de trabajo por juez            |
| `v_admin_multas`, `v_admin_saldos`                  | Administracion y finanzas            |
| `v_kpi_avance`, `v_pilar_avance`                    | Contenido inspiracional              |
| `v_evolucion_mensual`                               | Series de tiempo                     |
| `v_calidad_datos`                                   | Cobertura de ingesta                 |

Vistas materializadas (`04_indices_y_materializadas.sql`): `mv_kpi_mensual`,
`mv_ranking_clubes`, `mv_matriz_jornadas`. Se refrescan con:

```powershell
npm run db:refresh
```

## 7. Comandos de desarrollo

```powershell
npm run dev         # Next.js en modo desarrollo
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run db:studio   # Prisma Studio
```

## 7.b. Ingesta de datos

```powershell
npm run ingesta                            # COMPETENCIAS + EXPEDIENTES
npm run ingesta -- competencias            # solo COMPETENCIAS
npm run ingesta -- expedientes             # solo EXPEDIENTES
npm run ingesta -- competencias --limpio   # vacia y reconstruye
npm run db:probar                          # 18 consultas del tablero
```

La ingesta es **idempotente**: cada fila lleva un hash de su contenido, y
reejecutarla actualiza las mismas filas sin crear ninguna nueva. Con
`--limpio` se vacian primero las tablas de hechos y se reconstruyen.

Los CSV se cachean en `%TEMP%\opencode\datos\`, asi que se puede trabajar
contra una copia local sin volver a golpear Google Sheets.

Cada corrida deja su rastro en la tabla `ingesta_log` (fuente, documento,
filas leidas / insertadas / omitidas y el error si hubo). Es la forma de
auditar que hay cargado dentro de la base.

Detalles del mapeo, incluyendo por que el hash se calcula sobre la fila entera
y que citas quedan sin resolver: `docs/MAPEO_DATOS.md`.

## 7.c Acceso a la plataforma (Fase 4)

La aplicacion tiene inicio de sesion. El camino para entrar:

```
/            -> portada publica
/ingresar    -> formulario de acceso
/dashboard   -> primera pagina protegida
```

Cualquier ruta sin sesion valida responde `307` hacia
`/ingresar?next=<ruta>`, y al ingresar se vuelve exactamente ahi.

### Crear la cuenta de acceso

```powershell
npm run db:seed:usuario
```

Lee `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NOMBRE` de `.env`, crea (o
actualiza) esa cuenta con el rol `ADMINISTRADOR` y le aplica el hash de la
contrasena indicada. Es idempotente.

Para **restablecer** una clave perdida:

```powershell
npm run db:seed:usuario -- --reset
```

### Como funciona la clave

| Situacion                              | Que pasa                                                              |
| -------------------------------------- | --------------------------------------------------------------------- |
| Seed inicial o reset del administrador | Clave = `PASSWORD_ESTANDAR` y `debe_cambiar_password = true`          |
| El usuario ingresa                     | El sistema lo manda a `/cambiar-password` y no lo deja ver nada mas   |
| El usuario elige su clave              | Se guarda el hash, se limpia la bandera, se emite sesion nueva        |
| El usuario olvida su clave             | El administrador hace reset; quedan invalidadas las sesiones abiertas |

Las contrasenas se guardan con **scrypt** (`node:crypto`, sin dependencias
extra) en formato `scrypt$N$r$p$sal$hash`. Los parametros viajan dentro del
hash, asi que endurecerlos mas adelante no invalida las claves ya guardadas.
**No hay ninguna copia recuperable de una clave.**

La sesion es una cookie `httpOnly` firmada con HMAC-SHA256 usando
`AUTH_SECRET`. Ademas de la firma lleva la version de la clave del usuario, de
modo que cambiar la contrasena cierra al instante las demas sesiones abiertas.
Duracion: 8 horas.

El RBAC ya esta sembrado (4 roles, 35 permisos). `requierePermiso(codigo)`
aplica el permiso en el servidor; `tienePermiso(sesion, codigo)` para lo que
necesite la vista.

| Rol             | Alcance                                                             |
| --------------- | ------------------------------------------------------------------- |
| `ADMINISTRADOR` | Todos los permisos, incluidos borrado fisico y gestion de usuarios  |
| `JUEZ`          | Resolver expedientes y aplicar sanciones; sin borrar ni administrar |
| `SECRETARIA`    | Registrar y editar; aprueba OCR; sin borrar                         |
| `CONSULTA`      | Solo lectura                                                        |

### En produccion

1. `AUTH_SECRET` con `openssl rand -base64 32` (el valor de ejemplo NO sirve).
2. `ADMIN_PASSWORD` y `AUTH_SECRET` fuera de `.env`; el `.env` esta en
   `.gitignore`.
3. HTTPS: la cookie pasa a `secure` automaticamente con `NODE_ENV=production`.
4. Cambiar la clave estandar de `src/lib/auth/reglas.ts` si el Consejo define
   otra.

## 8. Deuda tecnica conocida al cerrar la Fase 3

| Tema                                  | Estado                                                                                              | Donde                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Identidad de la fila en COMPETENCIAS  | **Resuelto**: el hash se calcula sobre las 38 columnas. Antes fundia 5.262 sanciones distintas      | `scripts/ingesta/competencias.ts`       |
| Atribucion de articulo a norma        | **Parcial**: los 428 articulos son del RD; falta el catalogo de las NR (2.868 citas sin resolver)   | `docs/MAPEO_DATOS.md`                   |
| Codigos basura en `dim_articulo`      | **Abierto**: 18 de 428 codigos no son articulos del RD, se colaron desde la columna sucia           | `docs/MAPEO_DATOS.md`                   |
| `TIPO_DE_INFRACCION` con `#NAME?`     | 13.592 celdas del origen; el resto se resuelve desde el catalogo                                    | `dim_tipo_infraccion`                   |
| `dim_articulo.descripcion` / `.texto` | Vacio; falta cargar el texto oficial                                                                | `dim_articulo`                          |
| Vinculo expediente-persona            | Sin cedula en la hoja; `personaId1/2` quedan nulas a proposito                                      | `fact_expediente_parte`                 |
| Tasa de multa BCV                     | 54 expedientes no cuadran con `USD = UC x 3`: la tasa **no es fija**, falta `dim_tasa_uc`           | Seccion 9                               |
| **Autenticacion**                     | **Resuelto (Fase 4)**: login, sesion firmada, RBAC aplicado y clave estandar con cambio obligatorio | `docs/SETUP.md` 7.c, `src/server/auth/` |
| Rutas declaradas en la navegacion     | `/expedientes` ya existe; las otras 9 dan 404 (`/sanciones` es la siguiente)                        | `src/lib/nav.ts`                        |
| Sin gestor de usuarios                | La tabla `usuario` solo la puebla el seed; falta la pantalla `/usuarios`                            | `docs/SETUP.md` 7.c                     |
| Vistas materializadas                 | **Resuelto**: primer `REFRESH` hecho, las 3 tienen datos                                            | `npm run db:refresh`                    |
| `dim_detalle_incidencia`              | **Resuelto**: 93 detalles cargados. La unicidad es por par `(incidencia, nombre)`, no global        | migracion `20260102000000`              |
| SQL nunca ejecutado                   | **Resuelto**: los 4 archivos corrieron en PostgreSQL 16.10 sin errores                              | `prisma/seeds/`                         |
| Paquetes de tipos ausentes            | **Resuelto**: `@types/node`, `@types/react`, `@types/react-dom` agregados                           | `package.json`                          |
| `prisma migrate dev`                  | No usable: falta `CREATEDB`; usar `db:deploy`                                                       | Seccion 3                               |
| `npm install` / `next build` en `I:`  | **Mitigado**: `I:` es FAT32 de red y falla con escrituras concurrentes. Compilar en copia local     | Seccion 2                               |

## 9. Informacion pendiente de solicitar

- ~~Correo del usuario administrador inicial~~ -> resuelto:
  `julio.osorio@fvf.com.ve` (`ADMIN_EMAIL` en `.env`).
- **ID real del libro COMPETENCIAS**: la URL publicada lo oculta tras
  `2PACX-...`. Hace falta para leerlo con Service Account.
- Tabla de tasas BCV (U.C. → USD). Las 54 multas de expedientes que no cuadran
  con `USD = UC × 3` indican que la tasa **no es fija**: hay que registrarla
  por fecha en `dim_tasa_uc`.
- Correo del Service Account de Google con acceso de lectura a ambos libros.
- API keys de Claude y Google Document AI.
- Criterio para los 3 expedientes duplicados (`018/2022`, `008/2025`,
  `024/2025`): ¿dos autos legitimos o duplicado de captura?
- Confirmar si la contrasena estandar `FVF123456*` es la definitiva o solo
  la de arranque (`src/lib/auth/reglas.ts`).
