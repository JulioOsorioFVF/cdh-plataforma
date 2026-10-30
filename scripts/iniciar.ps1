<#
.SYNOPSIS
  Levanta todo el entorno del Consejo de Honor: base de datos + aplicacion.

.DESCRIPTION
  En este equipo hay tres piezas independientes y ninguna arranca sola:
    1. PostgreSQL 16.10, instalado sin permisos de administrador, SIN servicio
       de Windows (ver scripts\db\local-postgres.ps1).
    2. Next.js en el puerto 3000.
    3. Apache de XAMPP, que hace de proxy inverso en el puerto 8080 para poder
       abrir la plataforma desde el navegador sin teclear el puerto.

  IMPORTANTE: el proyecto esta en C:, no en I:. La unidad I: es FAT32 y
  npm no puede escribir ahi (los archivos quedan de 0 bytes), por eso Next.js
  no arranca desde ahi.

.EXAMPLE
  .\scripts\iniciar.ps1            # base de datos + aplicacion
  .\scripts\iniciar.ps1 -ConProxy  # ademas reinicia Apache (puerto 8080)
#>
[CmdletBinding()]
param(
  [switch]$ConProxy,
  [switch]$Reinstalar
)

$ErrorActionPreference = 'Stop'
$Proyecto = Split-Path (Split-Path $PSCommandPath -Parent) -Parent
$Apache   = 'C:\xampp\apache\bin\httpd.exe'

function Esperar-Puerto([int]$Puerto, [int]$Segundos = 60) {
  for ($i = 0; $i -lt $Segundos * 2; $i++) {
    Start-Sleep -Milliseconds 500
    if (Get-NetTCPConnection -State Listen -LocalPort $Puerto -ErrorAction SilentlyContinue) {
      return $true
    }
  }
  return $false
}

function Ejecutar-Npm([string[]]$Argumentos, [string]$Etiqueta = '') {
  # Con `$ErrorActionPreference = 'Stop'`, cualquier escritura en stderr de un
  # proceso nativo se convierte en un error que corta el script. Eso pasa con
  # `httpd -t` (escribe "Syntax OK" en stderr) y con npm, que escribe avisos por
  # ahi. Se relaja la preferencia solo durante la llamada y se comprueba el
  # codigo de salida, que es lo que dice si la orden funciono de verdad.
  $Previo = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & npm.cmd @Argumentos 2>&1 | ForEach-Object {
      $t = "$_"
      if ($t -and $t -notmatch '^npm (notice|warn)') {
        "  $t"
      }
    }
    $codigo = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $Previo
  }
  if ($codigo -ne 0) {
    throw "$Etiqueta fallo con codigo de salida $codigo."
  }
  return $codigo
}

function Comprobar-Apache([string]$Ejecutable) {
  # Igual que arriba: la salida de `httpd -t` va a stderr y "Syntax OK" no es un
  # fallo, asi que se captura en un archivo y se mira el codigo de salida.
  $salida = Join-Path $env:TEMP 'cdh-httpd-test.txt'
  $Previo = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $proceso = Start-Process -FilePath $Ejecutable -ArgumentList '-t' `
      -NoNewWindow -Wait -PassThru -RedirectStandardOutput $salida `
      -RedirectStandardError "$salida.err"
    $codigo = $proceso.ExitCode
  }
  finally {
    $ErrorActionPreference = $Previo
  }
  $texto = @()
  foreach ($f in @($salida, "$salida.err")) {
    if (Test-Path $f) { $texto += (Get-Content $f -Raw -ErrorAction SilentlyContinue) }
  }
  $resumen = (($texto -join "`n") -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 3) -join ' | '
  return [pscustomobject]@{ Codigo = $codigo; Resumen = $resumen }
}

Write-Host "`n=== 1. Base de datos (PostgreSQL 16.10) ===" -ForegroundColor Cyan
& (Join-Path $Proyecto 'scripts\db\local-postgres.ps1') start
if (-not (Esperar-Puerto 5432 30)) { throw 'PostgreSQL no arranco.' }
Write-Host "  PostgreSQL escuchando en 5432`n"

Write-Host "=== 2. Comprobacion de conexion ===" -ForegroundColor Cyan
Push-Location $Proyecto
try { Ejecutar-Npm @('run', 'db:ping') } finally { Pop-Location }

Write-Host "`n=== 3. Aplicacion (Next.js) ===" -ForegroundColor Cyan
$YaEsta = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue
if ($YaEsta) {
  Write-Host '  Next.js ya estaba corriendo en 3000.'
} else {
  if ($Reinstalar) {
    Write-Host '  Instalando dependencias...'
    Push-Location $Proyecto
    try { npm install --no-audit --no-fund } finally { Pop-Location }
  }
  $Log = Join-Path $Proyecto 'dev-servidor.log'
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' `
    -WorkingDirectory $Proyecto `
    -RedirectStandardOutput $Log `
    -RedirectStandardError (Join-Path $Proyecto 'dev-servidor.err') `
    -WindowStyle Hidden
  if (-not (Esperar-Puerto 3000 90)) { throw "Next.js no arranco. Revisa $Log" }
  Write-Host '  Next.js escuchando en 3000'
}

if ($ConProxy) {
  Write-Host "`n=== 4. Proxy de Apache (puerto 8080) ===" -ForegroundColor Cyan
  if (-not (Test-Path $Apache)) {
    Write-Warning "No encontre Apache en $Apache. El puerto 8080 no quedara activo; puedes usar el 3000 directamente."
  }
  else {
    $prueba = Comprobar-Apache $Apache
    if ($prueba.Codigo -ne 0) {
      throw "La configuracion de Apache no es valida: $($prueba.Resumen)"
    }
    Write-Host "  Configuracion de Apache correcta ($($prueba.Resumen))"

    if (Get-Process httpd -ErrorAction SilentlyContinue) {
      # `httpd -k restart` es mas limpio que matarlo a la fuerza: recarga la
      # configuracion sin cortar las peticiones en curso.
      $Previo2 = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      try { & (Join-Path 'C:\xampp\apache\bin' 'httpd.exe') -k restart 2>&1 | Out-Null }
      finally { $ErrorActionPreference = $Previo2 }
      Start-Sleep -Seconds 3
    }
    else {
      Start-Process -FilePath $Apache -WindowStyle Hidden
    }

    if (Esperar-Puerto 8080 20) {
      Write-Host '  Apache escuchando en 80 (XAMPP) y 8080 (proxy a la plataforma)'
    }
    else {
      Write-Warning '  Apache arranco, pero el puerto 8080 no responde. Revisa C:\xampp\apache\logs\error.log'
    }
  }
}

Write-Host "`n=====================================================" -ForegroundColor Green
Write-Host '  Plataforma:  http://localhost:8080/dashboard' -ForegroundColor Green
Write-Host '  Directo:     http://localhost:3000/dashboard'
Write-Host '  Base datos:  cdh:cdh_dev_2026 @ localhost:5432/cdh_plataforma'
Write-Host '  XAMPP:       http://localhost/  (sigue igual)' -ForegroundColor DarkGray
Write-Host "=====================================================`n" -ForegroundColor Green
