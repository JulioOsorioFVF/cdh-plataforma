<#
.SYNOPSIS
  Apunta la plataforma al Postgres de Supabase sin escribir la clave en el chat.

.DESCRIPTION
  Pide la contrasena de la base de forma oculta, detecta cual de los hosts del
  pooler (aws-0 / aws-1) responde en tu red, y reescribe DATABASE_URL y
  DIRECT_URL en .env dejando una copia del archivo anterior.

  Se usa el POOLER en los dos puertos porque, en muchas redes sin IPv6, el host
  directo db.<ref>.supabase.co solo resuelve por IPv6 y no conecta.

.EXAMPLE
  .\scripts\db\configurar-supabase.ps1 -Usuario cdh

.EXAMPLE
  # Sin preguntar: util cuando ya sabes que la clave es correcta
  .\scripts\db\configurar-supabase.ps1 -Usuario cdh -Clave 'cdh2026fvf'
#>
[CmdletBinding()]
param(
  [string]$Ref = 'bxkoqgbtymuiznmtgoou',
  [string]$Region = 'us-east-1',
  [string]$BaseDatos = 'postgres',
  # Rol de Postgres a usar. 'postgres' es el de Supabase; si se crea un rol
  # propio con el SQL Editor (porque el panel no deja cambiar la clave de
  # postgres), se pasa aqui, p. ej. -Usuario cdh
  [string]$Usuario = 'postgres',
  # Si se indica, no pregunta. Si se omite, se pide de forma oculta.
  [string]$Clave
)

$ErrorActionPreference = 'Stop'

# --- Rutas -------------------------------------------------------------------
$RaizProyecto = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$EnvFile      = Join-Path $RaizProyecto '.env'

if (-not (Test-Path $EnvFile)) { throw "No encuentro $EnvFile" }

# --- Utilidades --------------------------------------------------------------
function ConvertTo-UrlSafe([string]$texto) {
  # Solo se codifican los caracteres que rompen una URL de conexion.
  $mapa = @{
    '%' = '%25'; '@' = '%40'; '/' = '%2F'; ':' = '%3A'; '?' = '%3F'
    '#' = '%23'; '&' = '%26'; '=' = '%3D'; '+' = '%2B'; ' ' = '%20'
    '[' = '%5B'; ']' = '%5D'
  }
  $sb = New-Object System.Text.StringBuilder
  foreach ($c in $texto.ToCharArray()) {
    $k = [string]$c
    if ($mapa.ContainsKey($k)) { [void]$sb.Append($mapa[$k]) } else { [void]$sb.Append($k) }
  }
  return $sb.ToString()
}

function Find-Psql {
  $posibles = @(
    (Join-Path $env:USERPROFILE 'postgresql-cdh\pgsql\bin\psql.exe'),
    (Join-Path $env:USERPROFILE 'postgresql-cdh\pg16\pgsql\bin\psql.exe'),
    (Join-Path $env:TEMP 'opencode\pg16\pgsql\bin\psql.exe'),
    (Join-Path $env:TEMP 'opencode\pgsql\bin\psql.exe')
  )
  foreach ($p in $posibles) { if (Test-Path -LiteralPath $p) { return $p } }
  return $null
}

function Test-Conexion([string]$psql, [string]$hostName, [string]$clave) {
  if (-not $psql) { return $null }
  $env:PGPASSWORD = $clave
  $env:PGCONNECT_TIMEOUT = '10'
  # cmd /c: asi el stderr de psql llega como texto y no como ErrorRecord de
  # PowerShell (que ensuciaba la salida con un bloque rojo).
  $linea = '"{0}" -h {1} -p 5432 -U "{2}.{3}" -d {4} -w -t -A -c "select ''ok''" 2>&1' -f `
    $psql, $hostName, $Usuario, $Ref, $BaseDatos
  $salida = (& cmd.exe /c $linea | Out-String).Trim()
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  $ok = ($salida -match '^ok$')
  return [pscustomobject]@{ Ok = $ok; Salida = $salida }
}

# --- 1. Contrasena de la base ------------------------------------------------
Write-Host ''
Write-Host '=== Conectar la plataforma con Supabase ===' -ForegroundColor Cyan
Write-Host "Proyecto : $Ref"
Write-Host "Region   : $Region"
Write-Host "Usuario  : $Usuario.$Ref"
Write-Host ''

$psql  = Find-Psql
$hosts = @("aws-0-$Region.pooler.supabase.com", "aws-1-$Region.pooler.supabase.com")
$elegido = $null
$intento = 0

while (-not $elegido -and $intento -lt 3) {
  $intento++

  if ($Clave) {
    $clave = $Clave
  } else {
    Write-Host 'Pega la contrasena de la base. No se vera al escribirla.' -ForegroundColor Yellow
    $segura = Read-Host "Contrasena de $Usuario"
    $clave  = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura))
  }

  if ([string]::IsNullOrWhiteSpace($clave)) {
    Write-Host 'La contrasena esta vacia.' -ForegroundColor Red
    if ($Clave) { throw 'Clave vacia.' }
    continue
  }

  if ($psql) {
    Write-Host ''
    Write-Host "Probando hosts del pooler (intento $intento)... (clave de $($clave.Length) caracteres)" -ForegroundColor Cyan
    $falloAuth = $false
    foreach ($h in $hosts) {
      $r = Test-Conexion $psql $h $clave
      if ($r.Ok) { Write-Host "  OK  $h" -ForegroundColor Green; $elegido = $h; break }
      Write-Host "  --  $h" -ForegroundColor DarkGray
      Write-Host "      $($r.Salida)" -ForegroundColor DarkGray
      if ($r.Salida -match 'password authentication failed') { $falloAuth = $true }
    }
    if (-not $elegido) {
      Write-Host ''
      if ($falloAuth) {
        Write-Host 'El servidor respondio (red y rol correctos): solo la clave no coincide.' -ForegroundColor Yellow
        Write-Host "Vuelve a fijarla en el SQL Editor de Supabase:" -ForegroundColor Yellow
        Write-Host "  alter role $Usuario with password 'cdh2026fvf';" -ForegroundColor White
        Write-Host ''
      } else {
        Write-Host 'No hubo respuesta del pooler. Revisa:' -ForegroundColor Red
        Write-Host '  - que el proyecto no este pausado'
        Write-Host '  - que la region sea la correcta'
      }
      if ($Clave) { throw 'Sin conexion al pooler.' }
      Write-Host "Te quedan $([math]::Max(0, 3 - $intento)) intento(s)." -ForegroundColor DarkGray
      $clave = $null
    }
  } else {
    # Sin psql: se usa aws-0 y se valida despues con npm run db:ping
    $elegido = $hosts[0]
    Write-Host ''
    Write-Host "No hay psql a mano; se usara $elegido y se valida con 'npm run db:ping'." -ForegroundColor Yellow
  }
}

if (-not $elegido) { throw 'Sin conexion al pooler.' }

# --- 2. Reescribir .env -------------------------------------------------------
$marca    = Get-Date -Format 'yyyyMMdd-HHmmss'
$respaldo = "$EnvFile.bak-$marca"
Copy-Item -LiteralPath $EnvFile -Destination $respaldo

$claveUrl   = ConvertTo-UrlSafe $clave
$usuario    = "$Usuario.$Ref"
$poolerUrl  = "postgresql://${usuario}:${claveUrl}@${elegido}:6543/${BaseDatos}?pgbouncer=true&connection_limit=1&sslmode=require"
$directaUrl = "postgresql://${usuario}:${claveUrl}@${elegido}:5432/${BaseDatos}?sslmode=require"

$lineas = Get-Content -LiteralPath $EnvFile
$nuevas = foreach ($linea in $lineas) {
  if ($linea -match '^\s*DATABASE_URL\s*=') { "DATABASE_URL=`"$poolerUrl`"" }
  elseif ($linea -match '^\s*DIRECT_URL\s*=') { "DIRECT_URL=`"$directaUrl`"" }
  else { $linea }
}
# Sin BOM: Prisma lee el .env tal cual y un BOM inicial estorba.
[System.IO.File]::WriteAllLines($EnvFile, [string[]]$nuevas, (New-Object System.Text.UTF8Encoding($false)))

# --- 3. Resumen ---------------------------------------------------------------
Write-Host ''
Write-Host "Escrito en $EnvFile" -ForegroundColor Green
Write-Host "Copia del anterior: $(Split-Path $respaldo -Leaf)"
Write-Host ''
Write-Host '  DATABASE_URL -> pooler 6543 (aplicacion)'
Write-Host '  DIRECT_URL   -> pooler 5432 (migraciones)'
Write-Host "  host         : $elegido"
Write-Host "  usuario      : $usuario"
Write-Host ''
Write-Host 'Siguiente paso:  npm run db:ping' -ForegroundColor Cyan
