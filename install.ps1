[CmdletBinding()]
param(
    [string]$InstallDir = "$env:ProgramData\DynoraStation",
    [ValidateRange(1, 65535)]
    [int]$Port = 8181,
    [ValidateRange(1, 65535)]
    [int]$DiscoveryPort = 8182,
    [switch]$NoAutostart
)

$ErrorActionPreference = 'Stop'
$TaskName = 'DynoraStation'
$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step([string]$Message) {
    Write-Host "[Dynora] $Message" -ForegroundColor Cyan
}
function Write-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}
function Fail([string]$Message) {
    Write-Host "[FEHLER] $Message" -ForegroundColor Red
    exit 1
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-NodePath {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $default = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (Test-Path $default) { return $default }
    return $null
}

if (-not (Test-Administrator)) {
    Write-Host 'Administratorrechte werden benoetigt. PowerShell wird neu gestartet...' -ForegroundColor Yellow
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$($MyInvocation.MyCommand.Path)`"")
    if ($PSBoundParameters.ContainsKey('InstallDir')) { $arguments += @('-InstallDir', "`"$InstallDir`"") }
    if ($PSBoundParameters.ContainsKey('Port')) { $arguments += @('-Port', $Port) }
    if ($PSBoundParameters.ContainsKey('DiscoveryPort')) { $arguments += @('-DiscoveryPort', $DiscoveryPort) }
    if ($NoAutostart) { $arguments += '-NoAutostart' }
    Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
    exit
}

if (-not (Test-Path (Join-Path $SourceDir 'package.json'))) { Fail 'package.json nicht gefunden.' }
if (-not (Test-Path (Join-Path $SourceDir 'src\server.js'))) { Fail 'src\server.js nicht gefunden.' }

$NodePath = Get-NodePath
if (-not $NodePath) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Step 'Node.js LTS fehlt. Installiere Node.js mit winget...'
        & $winget.Source install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
        $NodePath = Get-NodePath
    }
}
if (-not $NodePath) {
    Fail 'Node.js 18+ wurde nicht gefunden. Installiere Node.js LTS und starte install.ps1 erneut.'
}

$nodeMajor = [int](& $NodePath -p 'Number(process.versions.node.split(".")[0])')
if ($nodeMajor -lt 18) { Fail "Node.js 18+ ist erforderlich. Gefunden: $(& $NodePath --version)" }
$npmPath = Join-Path (Split-Path $NodePath -Parent) 'npm.cmd'
if (-not (Test-Path $npmPath)) { Fail 'npm.cmd wurde neben node.exe nicht gefunden.' }
Write-Ok "Node.js $(& $NodePath --version) gefunden"

Write-Step "Installiere DynoraStation nach $InstallDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'data') | Out-Null

# Robocopy ist auf unterstuetzten Windows-Versionen standardmaessig vorhanden.
# /MIR aktualisiert den Programmteil; data und .env bleiben bewusst unangetastet.
$roboArgs = @(
    $SourceDir,
    $InstallDir,
    '/MIR',
    '/R:2',
    '/W:1',
    '/NFL', '/NDL', '/NJH', '/NJS', '/NP',
    '/XD', '.git', 'node_modules', 'data',
    '/XF', '.env', 'install.sh~'
)
& robocopy.exe @roboArgs | Out-Null
$roboCode = $LASTEXITCODE
if ($roboCode -gt 7) { Fail "Projektdateien konnten nicht kopiert werden (robocopy Exitcode $roboCode)." }

$envFile = Join-Path $InstallDir '.env'
if (-not (Test-Path $envFile)) {
    $envExample = Join-Path $InstallDir '.env.example'
    if (-not (Test-Path $envExample)) { Fail '.env.example fehlt.' }
    Copy-Item $envExample $envFile

    $lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        Sort-Object InterfaceMetric |
        Select-Object -First 1 -ExpandProperty IPAddress
    if (-not $lanIp) { $lanIp = '127.0.0.1' }

    $content = Get-Content $envFile -Raw
    $content = $content -replace '(?m)^SERVER_IP=.*$', "SERVER_IP=$lanIp"
    $content = $content -replace '(?m)^SERVER_PORT=.*$', "SERVER_PORT=$Port"
    $content = $content -replace '(?m)^DISCOVERY_PORT=.*$', "DISCOVERY_PORT=$DiscoveryPort"
    if ($content -match '(?m)^NODE_ENV=') {
        $content = $content -replace '(?m)^NODE_ENV=.*$', 'NODE_ENV=production'
    } else {
        $content += "`r`nNODE_ENV=production`r`n"
    }
    Set-Content -Path $envFile -Value $content -Encoding UTF8
    Write-Ok 'Konfiguration aus .env.example erstellt'
} else {
    Write-Host "[WARN] Vorhandene .env bleibt unveraendert: $envFile" -ForegroundColor Yellow
}

Write-Step 'Installiere Node-Abhaengigkeiten'
Push-Location $InstallDir
try {
    if (Test-Path (Join-Path $InstallDir 'package-lock.json')) {
        & $npmPath ci --omit=dev --no-audit --no-fund
    } else {
        & $npmPath install --omit=dev --no-audit --no-fund
    }
    if ($LASTEXITCODE -ne 0) { Fail "npm ist mit Exitcode $LASTEXITCODE fehlgeschlagen." }
} finally {
    Pop-Location
}
Write-Ok 'Node-Abhaengigkeiten installiert'

$runner = Join-Path $InstallDir 'run-windows.cmd'
$logFile = Join-Path $InstallDir 'data\dynorastation.log'
@"
@echo off
cd /d "$InstallDir"
"$NodePath" "$InstallDir\src\server.js" >> "$logFile" 2>&1
"@ | Set-Content -Path $runner -Encoding ASCII

if (-not $NoAutostart) {
    Write-Step 'Richte automatischen Start ueber die Windows-Aufgabenplanung ein'
    $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/d /c `"$runner`"" -WorkingDirectory $InstallDir
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Write-Ok "Autostart '$TaskName' eingerichtet"
} else {
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/d', '/c', "`"$runner`"" -WindowStyle Hidden
    Write-Ok 'DynoraStation ohne Autostart gestartet'
}

# Firewallregeln fuer LAN-Zugriff und ESP-Discovery.
Get-NetFirewallRule -DisplayName 'DynoraStation Web' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'DynoraStation Web' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
Get-NetFirewallRule -DisplayName 'DynoraStation ESP Discovery' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'DynoraStation ESP Discovery' -Direction Inbound -Action Allow -Protocol UDP -LocalPort $DiscoveryPort | Out-Null
Write-Ok 'Windows-Firewallregeln eingerichtet'

Write-Step 'Pruefe DynoraStation'
$healthOk = $false
for ($i = 0; $i -lt 15; $i++) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/healthz" -TimeoutSec 1
        if ($response.StatusCode -eq 200) { $healthOk = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}

if ($healthOk) {
    Write-Ok 'DynoraStation antwortet auf /healthz'
} else {
    Write-Host "[WARN] Healthcheck fehlgeschlagen. Log: $logFile" -ForegroundColor Yellow
}

$lanIpFinal = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress
if (-not $lanIpFinal) { $lanIpFinal = '127.0.0.1' }

Write-Host ''
Write-Host 'Installation abgeschlossen.' -ForegroundColor Green
Write-Host "  DynoraStation: http://$lanIpFinal`:$Port/"
Write-Host "  Lokal:         http://localhost:$Port/"
Write-Host "  Installation:  $InstallDir"
Write-Host "  Konfiguration: $envFile"
Write-Host "  Log:           $logFile"
if (-not $NoAutostart) {
    Write-Host "  Autostart:     Aufgabenplanung -> $TaskName"
}
