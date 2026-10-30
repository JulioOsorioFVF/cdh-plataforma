# Plataforma Consejo de Honor FVF

Sistema de gestión disciplinaria y análisis de datos del Consejo de Honor de la
Federación Venezolana de Fútbol. Convierte las actas de COMPETENCIAS y el CUADRO
DE EXPEDIENTES en una base PostgreSQL consultable, con tablero analítico, control
de acceso por roles y trazabilidad de la ingesta.

**Estado:** Fase 4 cerrada — esquema, ingesta, autenticación, RBAC y tablero operativos.

---

## Stack

| Pieza | Versión |
| --- | --- |
| Next.js (App Router) | 15.5 |
| React | 19 |
| TypeScript | 5.7 |
| PostgreSQL | 16 local / 17 en Supabase |
| Prisma | 6.19 |
| Tailwind CSS | 4 |

La autenticación es propia: contraseñas con `scrypt` (`node:crypto`) y sesión en
cookie `httpOnly` firmada con HMAC-SHA256. No usa servicios externos de identidad.

---

## Requisitos

- Node.js >= 20.11
- PostgreSQL >= 15 (local o en la nube)
- npm >= 10

---

## Puesta en marcha

```bash
git clone https://github.com/JulioOsorioFVF/cdh-plataforma.git
cd cdh-plataforma
npm install

cp .env.example .env      # completar DATABASE_URL, DIRECT_URL y AUTH_SECRET
npm run db:ping           # comprobar la conexion antes de seguir

npm run db:setup          # migraciones + roles + catalogos + vistas + indices
npm run ingesta           # sanciones y expedientes desde Google Sheets
npm run db:refresh        # vistas materializadas
npm run db:seed:usuario   # cuenta administradora inicial

npm run dev               # http://localhost:3000
```

Rutas principales:

```
/           portada publica
/ingresar   inicio de sesion
/dashboard  tablero (requiere sesion)
```

Cualquier ruta protegida responde `307` hacia `/ingresar?next=<ruta>` y, tras
autenticarse, devuelve al usuario exactamente a donde iba.

---

## Variables de entorno

Se copian de `.env.example`. El `.env` real **nunca** se versiona.

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `DATABASE_URL` | sí | conexión de la aplicación (con pooler en la nube) |
| `DIRECT_URL` | sí | conexión directa, la usan `migrate`, `db push` y studio |
| `AUTH_SECRET` | sí | firma de la cookie de sesión (`openssl rand -base64 32`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOMBRE` | sí | cuenta inicial de `db:seed:usuario` |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL` | no | textos y enlaces absolutos |
| `GOOGLE_SHEETS_COMPETENCIAS_URL`, `..._GID` | no | origen de la ingesta de sanciones |
| `GOOGLE_SHEETS_EXPEDIENTES_CSV_URL`, `..._GID` | no | origen de la ingesta de expedientes |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | no | alternativa a los CSV públicos |
| `ANTHROPIC_API_KEY`, `GOOGLE_CLOUD_PROJECT` | no | OCR de actas |
| `STORAGE_PATH` | no | carpeta de documentos subidos |

En la nube `DATABASE_URL` apunta al **pooler** (6543 en Supabase) y `DIRECT_URL`
a la conexión directa o al session pooler (5432). Confundirlas es la causa número
uno de fallos al desplegar.

---

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | servidor de desarrollo (Turbopack) |
| `npm run build` / `start` | build y ejecución en producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint sin tolerancia a warnings |
| `npm run db:ping` | prueba la conexión e informa versión, SSL y tablas |
| `npm run db:deploy` | aplica las migraciones pendientes |
| `npm run db:setup` | cliente + migraciones + todos los seeds |
| `npm run ingesta` | carga COMPETENCIAS y EXPEDIENTES (idempotente) |
| `npm run db:refresh` | refresca las vistas materializadas |
| `npm run db:probar` | 18 consultas del tablero, como prueba de humo |
| `npm run db:clave` | fija la clave de un usuario (`--email`, `--clave`) |
| `npm run db:studio` | Prisma Studio |

`db:deploy` es el camino normal para migrar. `db:migrate` (migrate dev) necesita
permiso `CREATEDB` para crear la base sombra y falla en entornos restringidos.

---

## Estructura

```
src/
  app/            rutas: portada, (auth) y (dashboard)
  components/     UI de tablero y expedientes
  lib/            prisma, auth (password/token/reglas), datos, navegación
  server/auth/    sesión y server actions de login
  middleware.ts   protección de rutas
prisma/
  schema.prisma   49 tablas, 9 enums
  migrations/     SQL versionado
  seeds/          roles, catálogos, vistas analíticas, índices
scripts/
  ingesta/        conectores de Google Sheets y normalización
  db/             ping, refresco, pruebas y utilidades
docs/             setup, modelo de datos y mapeo de la ingesta
```

---

## Modelo de datos

Esquema en estrella: dimensiones (`dim_persona`, `dim_club`, `dim_norma`,
`dim_articulo`, `dim_fecha`, …) y hechos (`fact_sancion`, `fact_expediente`,
`fact_partido`, …). Encima, 26 vistas analíticas que alimentan las secciones del
informe y 3 vistas materializadas (`mv_kpi_mensual`, `mv_ranking_clubes`,
`mv_matriz_jornadas`) que se refrescan con `npm run db:refresh`.

La ingesta es **idempotente**: cada fila lleva un hash de su contenido, de modo
que reejecutarla actualiza en lugar de duplicar. Cada corrida deja rastro en
`ingesta_log`.

---

## Roles

| Rol | Alcance |
| --- | --- |
| `ADMINISTRADOR` | todos los permisos, incluido borrado y gestión de usuarios |
| `JUEZ` | resuelve expedientes y aplica sanciones; no borra ni administra |
| `SECRETARIA` | registra y edita; aprueba OCR; no borra |
| `CONSULTA` | solo lectura |

4 roles, 35 permisos y 87 asignaciones, sembrados por `db:seed:roles`.
`requierePermiso(codigo)` aplica el permiso en el servidor.

---

## Despliegue

En Vercel basta importar el repositorio y cargar las variables de entorno. En
producción:

1. `AUTH_SECRET` distinto del de desarrollo.
2. HTTPS: la cookie pasa a `secure` sola con `NODE_ENV=production`.
3. Aplicar migraciones con `npm run db:deploy` **antes** de desplegar, no durante
   el build.

---

## Seguridad

- `.env` está en `.gitignore`. Nunca se versiona.
- No se guarda copia recuperable de las contraseñas: solo el hash `scrypt`.
- Cambiar la contraseña invalida al instante las demás sesiones abiertas.
- Las claves de servicio de proveedores (Supabase `sb_secret_…`, API keys) no
  deben aparecer en archivos del repositorio. GitHub Push Protection bloquea el
  push si las detecta.

---

## Documentación

- [`docs/SETUP.md`](docs/SETUP.md) — puesta en marcha, autenticación y deuda técnica
- [`docs/BASE-DE-DATOS.md`](docs/BASE-DE-DATOS.md) — local, nube y migraciones
- [`docs/MAPEO_DATOS.md`](docs/MAPEO_DATOS.md) — cómo se transforman las hojas
