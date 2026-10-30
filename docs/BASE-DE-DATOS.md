# Base de datos: local y en la nube

La plataforma usa **dos** conexiones distintas, y confundirlas es la causa
numero uno de fallos al desplegar:

| Variable       | Para que se usa                       | En la nube                        |
| -------------- | ------------------------------------- | --------------------------------- |
| `DATABASE_URL` | La aplicacion en caliente             | Endpoint **con pooler**           |
| `DIRECT_URL`   | Migraciones, `db push`, Prisma Studio | Endpoint **directo** (sin pooler) |

Definidas en `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Prisma elige `DIRECT_URL` automaticamente para `migrate`, `db push` y
`studio`. Las migraciones necesitan DDL y una sesion estable, asi que **nunca**
deben correr sobre un pooler transaccional.

---

## 1. Estado actual: PostgreSQL local

Instalado y funcionando.

|            |                                                      |
| ---------- | ---------------------------------------------------- |
| Version    | PostgreSQL 16.10 (x64)                               |
| Puerto     | 5432                                                 |
| Base       | `cdh_plataforma`                                     |
| Usuario    | `cdh` (propietario, sin superusuario)                |
| Contraseña | `cdh_dev_2026`                                       |
| Binarios   | `%TEMP%\opencode\pg16\pgsql`                         |
| Datos      | `%TEMP%\opencode\pgdata`                             |
| Config     | `postgresql.conf`, `pg_hba.conf` con `scram-sha-256` |

### Por que quedo instalado "raro"

En esta maquina **no hay permisos de administrador**, asi que el instalador
normal de PostgreSQL (que pide elevacion y registra un servicio de Windows) no
se podia usar. Se instalo la distribucion "binaries without installer" de EDB,
que no necesita elevacion.

Dos consecuencias practicas:

1. **No hay servicio de Windows.** No arranca solo al reiniciar la maquina.
2. **Vive en `%TEMP%`**, que Windows puede limpiar. Si te pasa, ejecuta
   `.\scripts\db\local-postgres.ps1 relocate` para moverlo a
   `%USERPROFILE%\postgresql-cdh`.

### Comandos

```powershell
.\scripts\db\local-postgres.ps1 start     # arrancar
.\scripts\db\local-postgres.ps1 status    # estado + conteos
.\scripts\db\local-postgres.ps1 stop      # detener
.\scripts\db\local-postgres.ps1 info      # ver rutas
```

O desde el raiz del proyecto, que ademas levanta la aplicacion:

```powershell
.\scripts\iniciar.ps1              # PostgreSQL + Next.js en 3000
.\scripts\iniciar.ps1 -ConProxy    # ademas el proxy de Apache en 8080
```

Para trabajar con datos a mano, `psql` esta en
`%TEMP%\opencode\pg16\pgsql\bin\psql.exe` (no quedo en el PATH):

```powershell
$env:PGPASSWORD = 'cdh_dev_2026'
& "$env:TEMP\opencode\pg16\pgsql\bin\psql.exe" -h 127.0.0.1 -U cdh -d cdh_plataforma
```

### El usuario no tiene CREATEDB

`cdh` es propietario de `cdh_plataforma` pero **no es superusuario**, asi que
`prisma migrate dev` no puede crear la base sombra que usa para detectar
derive y falla con `P3014`. No es un problema del proyecto:

- `npm run db:deploy` (que es `prisma migrate deploy`) **si funciona** y es lo
  que hay que usar.
- Para una migracion nueva, escribir el SQL en
  `prisma/migrations/<marca>/migration.sql` y aplicar con `db:deploy`.
- Si se aplico a mano y Prisma se queja, registrarla con
  `prisma migrate resolve --applied <nombre>`.

### Carga inicial

```bash
npm run db:setup
```

Aplica, en orden: cliente Prisma -> migracion -> roles y permisos ->
catalogos base (SQL) -> catalogos del Excel (TS) -> vistas -> indices y
materializadas.

### Datos cargados a 2026-10-01

| Tabla                        | Filas              |
| ---------------------------- | ------------------ |
| `fact_sancion`               | 27.554             |
| `fact_sancion_flag`          | 42.765             |
| `fact_sancion_norma`         | 31.878             |
| `fact_sancion_articulo`      | 35.612             |
| `fact_expediente`            | 560                |
| `fact_expediente_movimiento` | 1.057              |
| `fact_expediente_parte`      | 88                 |
| `fact_partido`               | 1.804              |
| `dim_club`                   | 61                 |
| `dim_persona`                | 6.066              |
| `dim_torneo`                 | 118                |
| `dim_fecha`                  | 272                |
| `dim_norma`                  | 16                 |
| `dim_articulo`               | 428 (todos del RD) |

Para volver a comprobarlos:

```powershell
npm run ingesta            # idempotente: no crea filas nuevas
npm run db:probar          # 18 consultas del tablero
```

El detalle de por que son esas cifras, y no otras, esta en
`docs/MAPEO_DATOS.md`.

---

## 2. Ir a una base en la nube

Solo se cambian dos variables de `.env`. **No hay que tocar codigo.**

### Neon (recomendado para este caso)

Neon da dos URLs distintas para el mismo proyecto:

```
DATABASE_URL="postgresql://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASS@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require"
```

Lo que distingue a una de otra es el hosts: el **pooler** lleva el sufijo
`-pooler.` y pasa por PgBouncer.Neon tambien **duerme** la base cuando no hay
actividad: la primera conexion tras varias horas puede tardar unos segundos o
fallar. Si eso molesta, hay que reactivar el proyecto por su API o pedir un
plan que no suspenda.

### Supabase

El pooler esta en el puerto **6543** y el acceso directo en el **5432**:

```
DATABASE_URL="postgresql://postgres.xxxx:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres.xxxx:PASS@aws-0-REGION.supabase.com:5432/postgres?sslmode=require"
```

### Railway / Render / Fly / cualquier Postgres gestionado

Una sola URL, usada en las dos variables:

```
DATABASE_URL="postgresql://USER:PASS@HOST:5432/DB?sslmode=require"
DIRECT_URL="postgresql://USER:PASS@HOST:5432/DB?sslmode=require"
```

La excepcion es Railway, que tambien publica un pooler; ahi conviene apuntar
`DATABASE_URL` al puerto del pooler y `DIRECT_URL` al puerto normal.

### Validar antes de migrar

```bash
npm run db:ping                                    # usa .env
npm run db:ping -- "postgresql://..."              # prueba un DSN puntual
```

Imprime version del servidor, base, usuario, si hay SSL y cuantas tablas hay.
Si falla aqui, fallara igual en `migrate deploy`, pero mejor antes y con un
mensaje claro.

### Migrar los datos de local a la nube

1. Crear la base vacia en el proveedor.
2. `DATABASE_URL` y `DIRECT_URL` -> las URLs de la nube.
3. `npm run db:deploy` (crea las 49 tablas).
4. `npm run db:setup` es **todo en uno**: si la base ya esta migrada, corre
   solo la parte de seeds con los comandos `db:seed:*`.
5. Exportar e importar los datos que falten (hoy la base esta vacia de fatos:
   `fact_sancion` y `fact_expediente` los llena la ingesta de Sheets).

```bash
# Volcar local
pg_dump --format=custom --file=cdh_local.dump "postgresql://cdh:cdh_dev_2026@localhost:5432/cdh_plataforma"
# Restaurar en la nube
pg_restore --clean --if-exists --no-owner --dbname="postgresql://.../db?sslmode=require" cdh_local.dump
```

---

## 3. Reglas para trabajar contra la nube

- **`sslmode=require` es obligatorio.** Casi ningun proveedor acepta conexiones
  sin TLS. Sin el, el error es críptico ("connection closed unexpectedly").
- **El pooler agota las conexiones si se abre una por peticion.** Por eso
  Prisma gestiona su propio pool. Si el proveedor usa PgBouncer en modo
  _transaccion_, añadir `&statement_cache_size=0` a `DATABASE_URL` para evitar
  fallos de "prepared statement does not exist".
- **La IP puede estar bloqueada.** Netlify/Vercel y algunos proveedores exigen
  permitir list las IPs de salida, o dejar el firewall abierto a `0.0.0.0/0`.
- **Migrar siempre con `db:deploy`, no con `db:migrate`.** `migrate dev` pide
  confirmacion interactiva y genera migraciones; en produccion se usa
  `migrate deploy`, que solo aplica lo existente.
- **`psql` no es requisito.** Los scripts de `package.json` usan
  `prisma db execute`, que es portable entre Windows, Linux y macOS y ademas
  usa exactamente la misma conexion que la aplicacion.

---

## 4. Problemas frecuentes

| Sintoma                                                           | Causa probable                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Can't reach database server`                                     | Servidor local apagado, o host/region equivocados en la nube                                      |
| `Connection closed unexpectedly`                                  | Falta `sslmode=require`, o base dormida (Neon)                                                    |
| `the password authentication failed`                              | Contrasena con caracteres especiales sin codificar: usar `%40` en vez de `@`, `%2F` en vez de `/` |
| `too many connections`                                            | Se creo un pool por peticion; apuntar `DATABASE_URL` al pooler                                    |
| `must be owner of schema` / `permission denied for schema public` | El usuario de la nube no es propietario; usar el usuario que creo la base                         |
| `Prepared statement does not exist`                               | PgBouncer en modo transaccion; agregar `statement_cache_size=0`                                   |
| Migraciones fallan contra la nube pero no en local                | `DATABASE_URL` y `DIRECT_URL` apuntando al mismo pooler                                           |
