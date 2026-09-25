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

