<#
.SYNOPSIS
  Controla el PostgreSQL local del Consejo de Honor.

.DESCRIPTION
  PostgreSQL quedo instalado SIN privilegios de administrador (no hay permisos
  en esta maquina), asi que vive fuera de "Archivos de programa", en una carpeta
  de usuario. Por eso no hay servicio de Windows que lo arranque solo: se
  arranca a mano con este script.

.EXAMPLE
  .\scripts\db\local-postgres.ps1 start
  .\scripts\db\local-postgres.ps1 status
  .\scripts\db\local-postgres.ps1 stop
  .\scripts\db\local-postgres.ps1 relocate
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'restart', 'status', 'relocate', 'info')]
  [string]$Accion = 'status'
)

$ErrorActionPreference = 'Stop'

# --- Rutas -------------------------------------------------------------------
# Instalacion permanente en el perfil del usuario (fuera de %TEMP%).
$Base    = Join-Path $env:USERPROFILE 'postgresql-cdh'
$PgHome  = if (Test-Path (Join-Path $Base 'pgsql')) { Join-Path $Base 'pgsql' } else { Join-Path $Base 'pg16\pgsql' }
$PgBin   = Join-Path $PgHome  'bin'
$PgData  = Join-Path $Base 'pgdata'
$Puerto  = 5432

function Test-Prisma { Test-Path -LiteralPath (Join-Path $PgBin 'pg_isready.exe') }

switch ($Accion) {

  'info' {
    Write-Host "PGHOME : $PgHome"
    Write-Host "PGDATA : $PgData"
    Write-Host "puerto : $Puerto"
    Write-Host "instalado : $(Test-Prisma)"
  }

  'relocate' {
    # Mueve la instalacion y los datos fuera de %TEMP%, que Windows puede limpiar.
    $Destino = Join-Path $env:USERPROFILE 'postgresql-cdh'
    if (-not (Test-Prisma)) { throw "No hay una instalacion en $PgHome." }
    if (Test-Path $Destino) { throw "$Destino ya existe." }

    Write-Host "Deteniendo el servidor..."
    & (Join-Path $PgBin 'pg_ctl.exe') -D $PgData stop -m fast | Out-Null

    Write-Host "Copiando a $Destino (puede tardar)..."
    Copy-Item -LiteralPath $Base -Destination $Destino -Recurse -Force

    Write-Host ""
    Write-Host "Listo. Actualiza la variable `$Base de este script:"
    Write-Host "  `$Base = '$Destino'"
    Write-Host "Luego:  .\scripts\db\local-postgres.ps1 start"
    Write-Host "Las credenciales de .env no cambian (localhost:$Puerto, cdh / cdh_dev_2026)."
  }

  'start' {
    if (-not (Test-Prisma)) { throw "PostgreSQL no esta instalado en $PgHome." }
    & (Join-Path $PgBin 'pg_isready.exe') -h 127.0.0.1 -p $Puerto *> $null
    if ($LASTEXITCODE -eq 0) { Write-Host 'Ya estaba en marcha.'; return }

    # Start-Process y no pg_ctl: pg_ctl deja el proceso hijo unido a esta
    # consola y se muere al cerrarse.
    Start-Process -FilePath (Join-Path $PgBin 'postgres.exe') `
      -ArgumentList '-D', $PgData `
      -RedirectStandardOutput (Join-Path $PgData 'out.log') `
      -RedirectStandardError  (Join-Path $PgData 'err.log') `
      -WindowStyle Hidden

    for ($i = 0; $i -lt 30; $i++) {
      Start-Sleep -Milliseconds 500
      & (Join-Path $PgBin 'pg_isready.exe') -h 127.0.0.1 -p $Puerto *> $null
      if ($LASTEXITCODE -eq 0) {
        Write-Host "PostgreSQL en marcha en localhost:$Puerto"
        return
      }
    }
    Write-Error "No arranco. Revisa $PgData\err.log"
  }

  'stop' {
    if (-not (Test-Prisma)) { throw "PostgreSQL no esta instalado en $PgHome." }
    & (Join-Path $PgBin 'pg_ctl.exe') -D $PgData stop -m fast
  }

  'restart' {
    & $PSCommandPath stop   -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    & $PSCommandPath start
  }

  'status' {
    if (-not (Test-Prisma)) { throw "PostgreSQL no esta instalado en $PgHome." }
    & (Join-Path $PgBin 'pg_isready.exe') -h 127.0.0.1 -p $Puerto
    if ($LASTEXITCODE -eq 0) {
      $env:PGPASSWORD = 'cdh_dev_2026'
      & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Puerto -U cdh -d cdh_plataforma -q -c @'
SELECT current_database() AS base,
       count(*) FILTER (WHERE table_type='BASE TABLE') AS tablas,
       (SELECT count(*) FROM v_expedientes) AS expedientes,
       (SELECT count(*) FROM fact_sancion) AS sanciones
FROM   information_schema.tables
WHERE  table_schema = 'public';
'@
    }
  }
}
