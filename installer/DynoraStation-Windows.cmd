@echo off
setlocal EnableExtensions
set "DYNORA_INSTALLER_CMD=%~f0"
set "DYNORA_PAUSE_AFTER=0"

if "%~1"=="" (
  echo.
  echo DynoraStation fuer Windows
  echo -------------------------
  echo   [I] Installieren / darueber installieren
  echo   [U] Aktualisieren
  echo   [D] Deinstallieren
  echo   [A] Abbrechen
  choice /C IUDA /N /M "Auswahl: "
  if errorlevel 4 exit /b 0
  if errorlevel 3 (
    set "DYNORA_ARGS=uninstall"
  ) else if errorlevel 2 (
    set "DYNORA_ARGS=update"
  ) else (
    set "DYNORA_ARGS=install"
  )
  set "DYNORA_PAUSE_AFTER=1"
) else (
  set "DYNORA_ARGS=%*"
)

set "DYNORA_EMBEDDED_PS=%TEMP%\DynoraStation-Installer-%RANDOM%%RANDOM%.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $raw=[IO.File]::ReadAllText($env:DYNORA_INSTALLER_CMD,[Text.Encoding]::UTF8); $marker='#==DYNORA_POWERSHELL=='; $i=$raw.IndexOf($marker); if($i -lt 0){throw 'Eingebettete PowerShell-Logik fehlt.'}; $body=$raw.Substring($i+$marker.Length).TrimStart([char]13,[char]10); [IO.File]::WriteAllText($env:DYNORA_EMBEDDED_PS,$body,(New-Object Text.UTF8Encoding($false)))"
if errorlevel 1 (
  echo [FEHLER] Installer-Logik konnte nicht vorbereitet werden.
  if "%DYNORA_PAUSE_AFTER%"=="1" pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%DYNORA_EMBEDDED_PS%" %DYNORA_ARGS%
set "RC=%ERRORLEVEL%"
del /q "%DYNORA_EMBEDDED_PS%" >nul 2>&1
if not "%RC%"=="0" echo [FEHLER] Aktion fehlgeschlagen. Exitcode %RC%.
if "%DYNORA_PAUSE_AFTER%"=="1" pause
exit /b %RC%

#==DYNORA_POWERSHELL==
$ErrorActionPreference = 'Stop'

$Action = 'Install'
$InstallDir = "$env:ProgramData\DynoraStation"
$Port = 8181
$DiscoveryPort = 8182
$NoAutostart = $false
$Purge = $false
$Yes = $false
$Force = $false
$CheckOnly = $false
$Repo = if ($env:DYNORA_RELEASE_REPO) { $env:DYNORA_RELEASE_REPO } else { '__GITHUB_REPOSITORY__' }
$InstallDirSet = $false
$RepoSet = $false
$OriginalArgs = @($args)

function Fail([string]$Message) { Write-Host "[FEHLER] $Message" -ForegroundColor Red; exit 1 }
function Write-Step([string]$Message) { Write-Host "[Dynora] $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }

function Show-Usage {
@'
DynoraStation Windows-Installer

Verwendung:
  DynoraStation-Windows.cmd [install|update|uninstall] [Optionen]

Install-Optionen:
  --install-dir PFAD     Installationsordner
  --port PORT            Web/API-Port (Standard: 8181)
  --discovery-port PORT  UDP-Discovery-Port (Standard: 8182)
  --no-autostart         keinen Autostart-Task anlegen
  --repo OWNER/REPO      GitHub-Repository fuer Releases
  --yes                  Rueckfragen ueberspringen

Update-Optionen:
  --repo OWNER/REPO      Release-Repository ueberschreiben
  --check                nur auf ein Update pruefen
  --force                dieselbe Version erneut installieren
  --yes                  Rueckfrage ueberspringen

Uninstall-Optionen:
  --purge                auch data/, .env und Backups loeschen
  --yes                  Rueckfrage ueberspringen
'@ | Write-Host
}

function Need-Value([int]$Index, [string]$Name) {
    if ($Index + 1 -ge $OriginalArgs.Count) { Fail "$Name benoetigt einen Wert." }
    return $OriginalArgs[$Index + 1]
}

for ($i = 0; $i -lt $OriginalArgs.Count; $i++) {
    $arg = [string]$OriginalArgs[$i]
    switch -Regex ($arg) {
        '^(?i:install)$' { $Action = 'Install'; continue }
        '^(?i:update)$' { $Action = 'Update'; continue }
        '^(?i:uninstall)$' { $Action = 'Uninstall'; continue }
        '^(?i:--install-dir|-installdir)$' { $InstallDir = Need-Value $i $arg; $InstallDirSet = $true; $i++; continue }
        '^(?i:--port|-port)$' { $Port = [int](Need-Value $i $arg); $i++; continue }
        '^(?i:--discovery-port|-discoveryport)$' { $DiscoveryPort = [int](Need-Value $i $arg); $i++; continue }
        '^(?i:--no-autostart|-noautostart)$' { $NoAutostart = $true; continue }
        '^(?i:--purge|-purge)$' { $Purge = $true; continue }
        '^(?i:--yes|-yes|-y)$' { $Yes = $true; continue }
        '^(?i:--force|-force)$' { $Force = $true; continue }
        '^(?i:--check|-check)$' { $CheckOnly = $true; continue }
        '^(?i:--repo|-repo)$' { $Repo = Need-Value $i $arg; $RepoSet = $true; $i++; continue }
        '^(?i:--help|-help|-h|/\?)$' { Show-Usage; exit 0 }
        default { Fail "Unbekanntes Argument: $arg" }
    }
}

if ($Port -lt 1 -or $Port -gt 65535) { Fail 'Port muss zwischen 1 und 65535 liegen.' }
if ($DiscoveryPort -lt 1 -or $DiscoveryPort -gt 65535) { Fail 'Discovery-Port muss zwischen 1 und 65535 liegen.' }

$TaskName = 'DynoraStation'
$BackupRoot = Join-Path $env:ProgramData 'DynoraStation-backups'
$GlobalConfigDir = Join-Path $env:ProgramData 'DynoraStation-installer'
$GlobalConfigFile = Join-Path $GlobalConfigDir 'config.json'
$AssetName = 'dynorastation-windows.zip'
$ChecksumName = 'SHA256SUMS.txt'
$ScriptPath = $MyInvocation.MyCommand.Path

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Quote-Argument([string]$Value) {
    return '"' + ($Value -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
}

function Restart-Elevated {
    $parts = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Quote-Argument $ScriptPath))
    foreach ($item in $OriginalArgs) { $parts += (Quote-Argument ([string]$item)) }
    $process = Start-Process powershell.exe -Verb RunAs -ArgumentList ($parts -join ' ') -Wait -PassThru
    exit $process.ExitCode
}

function Set-Utf8NoBom([string]$Path, [string]$Content) {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Read-GlobalConfig {
    if (-not (Test-Path $GlobalConfigFile)) { return $null }
    try { return Get-Content $GlobalConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
}

function Write-GlobalConfig([string]$ReleaseRepo, [bool]$AutostartDisabled) {
    New-Item -ItemType Directory -Force -Path $GlobalConfigDir | Out-Null
    $obj = [ordered]@{
        installDir = $InstallDir
        repo = $ReleaseRepo
        noAutostart = $AutostartDisabled
        updatedAt = (Get-Date).ToString('o')
    }
    Set-Utf8NoBom $GlobalConfigFile (($obj | ConvertTo-Json -Depth 3) + "`r`n")
}

$globalConfig = Read-GlobalConfig
if (-not $InstallDirSet -and $null -ne $globalConfig -and $globalConfig.installDir) { $InstallDir = [string]$globalConfig.installDir }
if (-not $RepoSet -and $null -ne $globalConfig -and $globalConfig.repo) { $Repo = [string]$globalConfig.repo }

function Normalize-Repo([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    $normalized = $Value.Trim() -replace '^https?://github\.com/', '' -replace '^git@github\.com:', '' -replace '\.git$', '' -replace '/+$', ''
    if ($normalized -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { return $null }
    return $normalized
}

function Resolve-Repo {
    if ($Repo -eq '__GITHUB_REPOSITORY__' -or [string]::IsNullOrWhiteSpace($Repo)) {
        if ($Yes) { Fail 'GitHub Repository fehlt. Verwende --repo OWNER/REPO oder DYNORA_RELEASE_REPO.' }
        $script:Repo = Read-Host 'GitHub Repository (OWNER/REPO)'
    }
    $normalized = Normalize-Repo $Repo
    if (-not $normalized) { Fail 'Repository muss OWNER/REPO oder eine github.com-URL sein.' }
    $script:Repo = $normalized
}

function Get-NodePath {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $default = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (Test-Path $default) { return $default }
    return $null
}

function Get-EnvValue([string]$Path, [string]$Name, [string]$Fallback) {
    if (-not (Test-Path $Path)) { return $Fallback }
    $line = Get-Content $Path | Where-Object { $_ -match "^$([Regex]::Escape($Name))=" } | Select-Object -Last 1
    if (-not $line) { return $Fallback }
    $value = ($line -split '=', 2)[1].Trim()
    if ([string]::IsNullOrWhiteSpace($value)) { return $Fallback }
    return $value
}

function Stop-Dynora {
    try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
    try {
        $needle = [Regex]::Escape((Join-Path $InstallDir 'src\server.js'))
        Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -and $_.CommandLine -match $needle } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    } catch {}
}

function Remove-FirewallRules {
    Get-NetFirewallRule -DisplayName 'DynoraStation Web' -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
    Get-NetFirewallRule -DisplayName 'DynoraStation ESP Discovery' -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
}

function Remove-ProgramFiles([switch]$KeepData) {
    if (-not (Test-Path $InstallDir)) { return }
    if (-not $KeepData) {
        Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        return
    }
    Get-ChildItem -LiteralPath $InstallDir -Force | Where-Object { $_.Name -notin @('data', '.env') } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

function New-ProgramBackup {
    if (-not (Test-Path (Join-Path $InstallDir 'package.json'))) { return $null }
    New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $stage = Join-Path $env:TEMP "DynoraStation-Backup-$stamp-$PID"
    $archive = Join-Path $BackupRoot "before-update-$stamp.zip"
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    try {
        $copyArgs = @($InstallDir, $stage, '/MIR', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XD', 'node_modules', 'data', '/XF', '.env')
        & robocopy.exe @copyArgs | Out-Null
        if ($LASTEXITCODE -gt 7) { throw "robocopy Exitcode $LASTEXITCODE" }
        Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -CompressionLevel Optimal -Force
        return $archive
    } finally {
        Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Restore-ProgramBackup([string]$Archive, [string]$NpmPath) {
    if (-not $Archive -or -not (Test-Path $Archive)) { return }
    Write-Warn 'Update fehlgeschlagen; stelle die vorherige Version wieder her.'
    Stop-Dynora
    Remove-ProgramFiles -KeepData
    Expand-Archive -LiteralPath $Archive -DestinationPath $InstallDir -Force
    Push-Location $InstallDir
    try {
        if (Test-Path (Join-Path $InstallDir 'package-lock.json')) { & $NpmPath ci --omit=dev --no-audit --no-fund }
        else { & $NpmPath install --omit=dev --no-audit --no-fund }
    } catch {
        Write-Warn "Abhaengigkeiten konnten beim Rollback nicht vollstaendig wiederhergestellt werden: $($_.Exception.Message)"
    } finally { Pop-Location }
}

function Write-InstallerConfig([bool]$AutostartDisabled) {
    $config = [ordered]@{
        installDir = $InstallDir
        taskName = $TaskName
        noAutostart = $AutostartDisabled
        repo = $Repo
        updatedAt = (Get-Date).ToString('o')
    }
    $path = Join-Path $InstallDir 'data\installer-config.json'
    Set-Utf8NoBom $path (($config | ConvertTo-Json -Depth 3) + "`r`n")
}

function Read-InstallerConfig {
    $path = Join-Path $InstallDir 'data\installer-config.json'
    if (-not (Test-Path $path)) { return $null }
    try { return Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
}

function Start-Dynora([string]$NodePath, [bool]$AutostartDisabled) {
    $runner = Join-Path $InstallDir 'run-windows.cmd'
    $logFile = Join-Path $InstallDir 'data\dynorastation.log'
    @"
@echo off
cd /d "$InstallDir"
"$NodePath" "$InstallDir\src\server.js" >> "$logFile" 2>&1
"@ | Set-Content -Path $runner -Encoding Default

    if (-not $AutostartDisabled) {
        $actionObj = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/d /c `"$runner`"" -WorkingDirectory $InstallDir
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
        Register-ScheduledTask -TaskName $TaskName -Action $actionObj -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
        Start-ScheduledTask -TaskName $TaskName
    } else {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        Start-Process -FilePath 'cmd.exe' -ArgumentList '/d', '/c', "`"$runner`"" -WindowStyle Hidden
    }
}

function Test-Health([int]$HealthPort) {
    for ($i = 0; $i -lt 20; $i++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$HealthPort/healthz" -TimeoutSec 1
            if ($response.StatusCode -eq 200) { return $true }
        } catch {}
        Start-Sleep -Seconds 1
    }
    return $false
}

function Get-ReleaseSource {
    Resolve-Repo
    $script:TempRoot = Join-Path $env:TEMP "DynoraStation-Release-$PID-$(Get-Random)"
    $script:SourceDir = Join-Path $script:TempRoot 'source'
    $archive = Join-Path $script:TempRoot $AssetName
    $checksums = Join-Path $script:TempRoot $ChecksumName
    New-Item -ItemType Directory -Force -Path $script:TempRoot, $script:SourceDir | Out-Null
    $base = "https://github.com/$Repo/releases/latest/download"

    Write-Step "Lade neueste DynoraStation-Version von $Repo"
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$ChecksumName" -OutFile $checksums
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$AssetName" -OutFile $archive

    $line = Get-Content $checksums | Where-Object { $_ -match "\s+\*?$([Regex]::Escape($AssetName))$" } | Select-Object -First 1
    if (-not $line) { Fail "Fuer $AssetName fehlt die SHA-256-Pruefsumme." }
    $expected = ($line -split '\s+')[0].ToLowerInvariant()
    $script:ArchiveSha = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expected -ne $script:ArchiveSha) { Fail 'SHA-256-Pruefung des Release-Pakets fehlgeschlagen.' }
    Write-Ok 'Release-Pruefsumme stimmt.'

    Expand-Archive -LiteralPath $archive -DestinationPath $script:SourceDir -Force
    if (-not (Test-Path (Join-Path $script:SourceDir 'package.json'))) { Fail 'Release enthaelt keine package.json.' }
    if (-not (Test-Path (Join-Path $script:SourceDir 'src\server.js'))) { Fail 'Release enthaelt keine src\server.js.' }
}

function Cleanup-Temp {
    if ($script:TempRoot -and (Test-Path $script:TempRoot)) { Remove-Item -LiteralPath $script:TempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

if (-not (Test-Administrator)) {
    Write-Host 'Administratorrechte werden benoetigt. Windows fragt gleich nach Bestaetigung...' -ForegroundColor Yellow
    Restart-Elevated
}

if ($Action -eq 'Uninstall') {
    $existing = Test-Path $InstallDir
    if (-not $existing) { Write-Ok "DynoraStation ist unter $InstallDir nicht installiert."; if ($Purge) { Remove-Item $GlobalConfigDir -Recurse -Force -ErrorAction SilentlyContinue }; exit 0 }
    if (-not $Yes) {
        $mode = if ($Purge) { 'inklusive data/ und .env' } else { 'Programmdateien; data/ und .env bleiben erhalten' }
        $answer = Read-Host "DynoraStation entfernen ($mode)? [j/N]"
        if ($answer -notmatch '^(j|ja|y|yes)$') { Write-Host 'Abgebrochen.'; exit 0 }
    }
    Write-Step 'Stoppe DynoraStation und entferne Autostart/Firewallregeln'
    Stop-Dynora
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Remove-FirewallRules
    Remove-ProgramFiles -KeepData:(-not $Purge)
    if ($Purge) {
        Remove-Item $BackupRoot -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $GlobalConfigDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Ok 'DynoraStation inklusive Nutzerdaten wurde entfernt.'
    } else {
        Write-Ok "DynoraStation wurde entfernt; data/ und .env bleiben unter $InstallDir erhalten."
    }
    exit 0
}

try {
    Get-ReleaseSource

    $NodePath = Get-NodePath
    if (-not $NodePath) {
        $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
        if ($winget) {
            Write-Step 'Node.js LTS fehlt. Installiere Node.js mit winget...'
            & $winget.Source install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
            $NodePath = Get-NodePath
        }
    }
    if (-not $NodePath) { Fail 'Node.js 18+ wurde nicht gefunden. Installiere Node.js LTS und starte den Installer erneut.' }
    $nodeMajor = [int](& $NodePath -p 'Number(process.versions.node.split(".")[0])')
    if ($nodeMajor -lt 18) { Fail "Node.js 18+ ist erforderlich. Gefunden: $(& $NodePath --version)" }
    $npmPath = Join-Path (Split-Path $NodePath -Parent) 'npm.cmd'
    if (-not (Test-Path $npmPath)) { Fail 'npm.cmd wurde neben node.exe nicht gefunden.' }
    Write-Ok "Node.js $(& $NodePath --version) gefunden"

    if ($Action -eq 'Update' -and -not (Test-Path (Join-Path $InstallDir 'package.json'))) { Fail "Keine vorhandene Installation unter $InstallDir gefunden." }

    $sourceVersion = (Get-Content (Join-Path $SourceDir 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
    $localVersion = $null
    if (Test-Path (Join-Path $InstallDir 'package.json')) {
        try { $localVersion = (Get-Content (Join-Path $InstallDir 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version } catch {}
    }

    if ($Action -eq 'Update' -and -not $Force -and $sourceVersion -and $sourceVersion -eq $localVersion) {
        if ($CheckOnly) { Write-Ok "Bereits aktuell (Version $localVersion)." }
        else { Write-Ok "Bereits aktuell (Version $localVersion). Fuer eine Reparatur 'install' oder update --force verwenden." }
        exit 0
    }
    if ($Action -eq 'Update' -and $CheckOnly) {
        Write-Host "Update verfuegbar: $localVersion -> $sourceVersion"
        exit 0
    }
    if ($Action -eq 'Update' -and -not $Yes) {
        $answer = Read-Host "Update $localVersion -> $sourceVersion installieren? [J/n]"
        if ($answer -match '^(n|nein|no)$') { Write-Host 'Abgebrochen.'; exit 0 }
    }

    $existingConfig = Read-InstallerConfig
    $autostartDisabled = if ($Action -eq 'Update' -and $null -ne $existingConfig -and $null -ne $existingConfig.noAutostart) {
        [bool]$existingConfig.noAutostart
    } elseif ($null -ne $globalConfig -and $null -ne $globalConfig.noAutostart -and $Action -eq 'Update') {
        [bool]$globalConfig.noAutostart
    } else {
        [bool]$NoAutostart
    }

    $backup = $null
    if (Test-Path (Join-Path $InstallDir 'package.json')) {
        Write-Step 'Erstelle Sicherheitskopie der vorhandenen Programmversion'
        $backup = New-ProgramBackup
        if ($backup) { Write-Ok "Backup: $backup" }
    }

    try {
        Stop-Dynora
        Write-Step "Kopiere DynoraStation nach $InstallDir"
        New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
        New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'data') | Out-Null

        $roboArgs = @(
            $SourceDir, $InstallDir, '/MIR', '/R:2', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP',
            '/XD', '.git', '.github', 'node_modules', 'data', 'dist', 'installer',
            '/XF', '.env'
        )
        & robocopy.exe @roboArgs | Out-Null
        $roboCode = $LASTEXITCODE
        if ($roboCode -gt 7) { throw "Projektdateien konnten nicht kopiert werden (robocopy Exitcode $roboCode)." }

        $envFile = Join-Path $InstallDir '.env'
        if (-not (Test-Path $envFile)) {
            $envExample = Join-Path $InstallDir '.env.example'
            if (-not (Test-Path $envExample)) { throw '.env.example fehlt.' }
            $content = Get-Content $envExample -Raw -Encoding UTF8
            $lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
                Sort-Object InterfaceMetric |
                Select-Object -First 1 -ExpandProperty IPAddress
            if (-not $lanIp) { $lanIp = '127.0.0.1' }
            $content = $content -replace '(?m)^SERVER_IP=.*$', "SERVER_IP=$lanIp"
            $content = $content -replace '(?m)^SERVER_PORT=.*$', "SERVER_PORT=$Port"
            $content = $content -replace '(?m)^DISCOVERY_PORT=.*$', "DISCOVERY_PORT=$DiscoveryPort"
            $content = $content -replace '(?m)^TRUST_PROXY=.*$', 'TRUST_PROXY=false'
            if ($content -match '(?m)^NODE_ENV=') { $content = $content -replace '(?m)^NODE_ENV=.*$', 'NODE_ENV=production' }
            else { $content += "`r`nNODE_ENV=production`r`n" }
            Set-Utf8NoBom $envFile $content
            Write-Ok 'Konfiguration aus .env.example erstellt'
        } else {
            Write-Warn "Vorhandene .env bleibt unveraendert: $envFile"
        }

        Write-Step 'Installiere Node-Abhaengigkeiten'
        Push-Location $InstallDir
        try {
            if (Test-Path (Join-Path $InstallDir 'package-lock.json')) { & $npmPath ci --omit=dev --no-audit --no-fund }
            else { & $npmPath install --omit=dev --no-audit --no-fund }
            if ($LASTEXITCODE -ne 0) { throw "npm ist mit Exitcode $LASTEXITCODE fehlgeschlagen." }

            if ($Action -eq 'Update') {
                Write-Step 'Fuehre Tests vor dem Neustart aus'
                & $npmPath test
                if ($LASTEXITCODE -ne 0) { throw "Tests sind mit Exitcode $LASTEXITCODE fehlgeschlagen." }
            }
        } finally { Pop-Location }

        Write-InstallerConfig -AutostartDisabled $autostartDisabled
        Write-GlobalConfig -ReleaseRepo $Repo -AutostartDisabled $autostartDisabled

        $effectivePort = [int](Get-EnvValue (Join-Path $InstallDir '.env') 'SERVER_PORT' ([string]$Port))
        $effectiveDiscoveryPort = [int](Get-EnvValue (Join-Path $InstallDir '.env') 'DISCOVERY_PORT' ([string]$DiscoveryPort))

        Remove-FirewallRules
        New-NetFirewallRule -DisplayName 'DynoraStation Web' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $effectivePort | Out-Null
        New-NetFirewallRule -DisplayName 'DynoraStation ESP Discovery' -Direction Inbound -Action Allow -Protocol UDP -LocalPort $effectiveDiscoveryPort | Out-Null

        Write-Step 'Starte DynoraStation'
        Start-Dynora -NodePath $NodePath -AutostartDisabled $autostartDisabled
        if (-not (Test-Health $effectivePort)) { throw "Healthcheck auf Port $effectivePort ist fehlgeschlagen." }
        Write-Ok 'DynoraStation antwortet auf /healthz'

        $lanIpFinal = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
            Sort-Object InterfaceMetric |
            Select-Object -First 1 -ExpandProperty IPAddress
        if (-not $lanIpFinal) { $lanIpFinal = '127.0.0.1' }

        $verb = if ($Action -eq 'Update') { 'aktualisiert' } elseif ($backup) { 'repariert/aktualisiert' } else { 'installiert' }
        Write-Host ''
        Write-Host "DynoraStation wurde $verb." -ForegroundColor Green
        Write-Host "  DynoraStation: http://$lanIpFinal`:$effectivePort/"
        Write-Host "  Lokal:         http://localhost:$effectivePort/"
        Write-Host "  Installation:  $InstallDir"
        Write-Host "  Konfiguration: $envFile"
        Write-Host "  Autostart:     $(if ($autostartDisabled) { 'nein' } else { "Aufgabenplanung -> $TaskName" })"
    } catch {
        $message = $_.Exception.Message
        if ($backup) {
            try {
                Restore-ProgramBackup -Archive $backup -NpmPath $npmPath
                $config = Read-InstallerConfig
                $rollbackNoAutostart = if ($null -ne $config -and $null -ne $config.noAutostart) { [bool]$config.noAutostart } else { $autostartDisabled }
                Start-Dynora -NodePath $NodePath -AutostartDisabled $rollbackNoAutostart
                Write-Warn 'Rollback wurde durchgefuehrt.'
            } catch {
                Write-Warn "Rollback ist ebenfalls fehlgeschlagen: $($_.Exception.Message)"
            }
        }
        Fail $message
    }

    if (Test-Path $BackupRoot) {
        Get-ChildItem $BackupRoot -Filter 'before-update-*.zip' -File | Sort-Object LastWriteTime -Descending | Select-Object -Skip 10 |
            Remove-Item -Force -ErrorAction SilentlyContinue
    }
} finally {
    Cleanup-Temp
}
