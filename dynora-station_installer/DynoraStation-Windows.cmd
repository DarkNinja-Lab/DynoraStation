@echo off
setlocal EnableExtensions
set "DYNORA_INSTALLER_CMD=%~f0"
set "DYNORA_PAUSE_AFTER=0"

if "%~1"=="" (
  set "DYNORA_ARGS=menu"
  set "DYNORA_PAUSE_AFTER=1"
) else (
  set "DYNORA_ARGS=%*"
)

set "DYNORA_EMBEDDED_PS=%TEMP%\DynoraStation-Installer-%RANDOM%%RANDOM%.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $raw=[IO.File]::ReadAllText($env:DYNORA_INSTALLER_CMD,[Text.Encoding]::UTF8); $marker='#==DYNORA_POWERSHELL=='; $i=$raw.LastIndexOf($marker); if($i -lt 0){throw 'Eingebettete PowerShell-Logik fehlt.'}; $body=$raw.Substring($i+$marker.Length).TrimStart([char]13,[char]10); [IO.File]::WriteAllText($env:DYNORA_EMBEDDED_PS,$body,(New-Object Text.UTF8Encoding($false)))"
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
$ProjectRepo = 'DarkNinja-Lab/DynoraStation'
$SourceBranch = 'main'
$InstallDirSet = $false
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

Ohne Aktion erscheint ein zustandsabhaengiges Menue.
  -h, --help             Hilfe anzeigen


Install-Optionen:
  --install-dir PFAD     Installationsordner
  --port PORT            Web/API-Port (Standard: 8181)
  --discovery-port PORT  UDP-Discovery-Port (Standard: 8182)
  --no-autostart         keinen Autostart-Task anlegen
  --yes                  Rueckfragen ueberspringen

Update-Optionen:
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
        '^(?i:menu)$' { $Action = 'Menu'; continue }
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

function Write-GlobalConfig([bool]$AutostartDisabled) {
    New-Item -ItemType Directory -Force -Path $GlobalConfigDir | Out-Null
    $obj = [ordered]@{
        installDir = $InstallDir
        noAutostart = $AutostartDisabled
        sourceBranch = $SourceBranch
        sourceId = $script:SourceId
        sourceCommit = $script:SourceCommit
        sourceSha256 = $script:ArchiveSha
        updatedAt = (Get-Date).ToString('o')
    }
    Set-Utf8NoBom $GlobalConfigFile (($obj | ConvertTo-Json -Depth 3) + "`r`n")
}

$globalConfig = Read-GlobalConfig
if (-not $InstallDirSet -and $null -ne $globalConfig -and $globalConfig.installDir) { $InstallDir = [string]$globalConfig.installDir }

function Test-DynoraInstalled {
    return (Test-Path (Join-Path $InstallDir 'package.json')) -and (Test-Path (Join-Path $InstallDir 'src\server.js'))
}

function Select-ActionFromMenu {
    $installed = Test-DynoraInstalled
    Write-Host ''
    Write-Host 'DynoraStation fuer Windows'
    Write-Host '-------------------------'
    if ($installed) {
        Write-Host 'Status: Installiert'
        Write-Host "Pfad:   $InstallDir"
        Write-Host ''
        Write-Host '  [1] Aktualisieren'
        Write-Host '  [2] Reparieren / darueber installieren'
        Write-Host '  [3] Deinstallieren'
        Write-Host '  [4] Abbrechen'
        $choice = Read-Host 'Auswahl [1]'
        switch ($choice) {
            { [string]::IsNullOrWhiteSpace($_) -or $_ -eq '1' } { $script:Action = 'Update'; break }
            '2' { $script:Action = 'Install'; break }
            '3' { $script:Action = 'Uninstall'; break }
            '4' { exit 0 }
            default { Fail 'Ungueltige Auswahl.' }
        }
    } else {
        Write-Host 'Status: Nicht installiert'
        Write-Host ''
        Write-Host '  [1] Installieren'
        Write-Host '  [2] Abbrechen'
        $choice = Read-Host 'Auswahl [1]'
        switch ($choice) {
            { [string]::IsNullOrWhiteSpace($_) -or $_ -eq '1' } { $script:Action = 'Install'; break }
            '2' { exit 0 }
            default { Fail 'Ungueltige Auswahl.' }
        }
    }
    $script:OriginalArgs = @($script:Action.ToLowerInvariant())
}

if ($Action -eq 'Menu') { Select-ActionFromMenu }

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
        sourceBranch = $SourceBranch
        sourceId = $script:SourceId
        sourceCommit = $script:SourceCommit
        sourceSha256 = $script:ArchiveSha
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

function Get-MainSource {
    $script:TempRoot = Join-Path $env:TEMP "DynoraStation-Main-$PID-$(Get-Random)"
    $extractRoot = Join-Path $script:TempRoot 'extracted'
    $archive = Join-Path $script:TempRoot 'DynoraStation-main.zip'
    New-Item -ItemType Directory -Force -Path $script:TempRoot, $extractRoot | Out-Null

    $script:SourceCommit = $null
    try {
        $branchInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$ProjectRepo/branches/$SourceBranch" -Headers @{ 'User-Agent' = 'DynoraStation-Installer' }
        $candidateSha = [string]$branchInfo.commit.sha
        if ($candidateSha -match '^[0-9a-fA-F]{40}$') { $script:SourceCommit = $candidateSha.ToLowerInvariant() }
    } catch {
        Write-Warn "GitHub-Branchmetadaten konnten nicht geladen werden: $($_.Exception.Message)"
    }

    if ($script:SourceCommit) {
        $url = "https://github.com/$ProjectRepo/archive/$($script:SourceCommit).zip"
        $script:SourceId = $script:SourceCommit
        $shortSourceId = $script:SourceCommit.Substring(0, 12)
        Write-Step "Lade $ProjectRepo main @ $shortSourceId"
    } else {
        $url = "https://github.com/$ProjectRepo/archive/refs/heads/${SourceBranch}.zip"
        Write-Warn 'Verwende main-Archiv als Fallback fuer die Update-Erkennung.'
        Write-Step "Lade aktuellen Projektstand von $ProjectRepo ($SourceBranch)"
    }

    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archive
    $script:ArchiveSha = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if (-not $script:SourceCommit) {
        $script:SourceId = "archive:$($script:ArchiveSha)"
        $shortSourceId = $script:ArchiveSha.Substring(0, [Math]::Min(12, $script:ArchiveSha.Length))
    }

    Expand-Archive -LiteralPath $archive -DestinationPath $extractRoot -Force
    $candidate = Get-ChildItem -LiteralPath $extractRoot -Directory | Where-Object {
        (Test-Path (Join-Path $_.FullName 'package.json')) -and
        (Test-Path (Join-Path $_.FullName 'src\server.js'))
    } | Select-Object -First 1
    if (-not $candidate) { Fail "Der $SourceBranch-Stand enthaelt kein gueltiges DynoraStation-Projekt." }
    $script:SourceDir = $candidate.FullName
    Write-Ok "Projektstand geladen (Snapshot $shortSourceId)"
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
    Get-MainSource

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

    $existingConfig = Read-InstallerConfig
    $localSourceId = $null
    if ($null -ne $existingConfig -and $existingConfig.sourceId) { $localSourceId = [string]$existingConfig.sourceId }
    elseif ($null -ne $globalConfig -and $globalConfig.sourceId) { $localSourceId = [string]$globalConfig.sourceId }

    if ($Action -eq 'Update' -and -not $Force -and $localSourceId -and $script:SourceId -eq $localSourceId) {
        if ($CheckOnly) { Write-Ok "Bereits aktuell (main, Version $localVersion)." }
        else { Write-Ok "Bereits aktuell (main, Version $localVersion). Fuer eine Reparatur 'install' oder update --force verwenden." }
        exit 0
    }
    if ($Action -eq 'Update' -and $CheckOnly) {
        Write-Host "Update verfuegbar: aktueller main-Stand unterscheidet sich von der Installation (Version $localVersion -> $sourceVersion)."
        exit 0
    }
    if ($Action -eq 'Update' -and -not $Yes) {
        $answer = Read-Host "Aktuellen main-Stand installieren (Version $localVersion -> $sourceVersion)? [J/n]"
        if ($answer -match '^(n|nein|no)$') { Write-Host 'Abgebrochen.'; exit 0 }
    }

    $autostartDisabled = if ($NoAutostart) {
        $true
    } elseif ($null -ne $existingConfig -and $null -ne $existingConfig.noAutostart) {
        [bool]$existingConfig.noAutostart
    } elseif ($null -ne $globalConfig -and $null -ne $globalConfig.noAutostart) {
        [bool]$globalConfig.noAutostart
    } else {
        $false
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

        $effectivePort = [int](Get-EnvValue (Join-Path $InstallDir '.env') 'SERVER_PORT' ([string]$Port))
        $effectiveDiscoveryPort = [int](Get-EnvValue (Join-Path $InstallDir '.env') 'DISCOVERY_PORT' ([string]$DiscoveryPort))

        Remove-FirewallRules
        New-NetFirewallRule -DisplayName 'DynoraStation Web' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $effectivePort | Out-Null
        New-NetFirewallRule -DisplayName 'DynoraStation ESP Discovery' -Direction Inbound -Action Allow -Protocol UDP -LocalPort $effectiveDiscoveryPort | Out-Null

        Write-Step 'Starte DynoraStation'
        Start-Dynora -NodePath $NodePath -AutostartDisabled $autostartDisabled
        if (-not (Test-Health $effectivePort)) { throw "Healthcheck auf Port $effectivePort ist fehlgeschlagen." }
        Write-Ok 'DynoraStation antwortet auf /healthz'
        Write-InstallerConfig -AutostartDisabled $autostartDisabled
        Write-GlobalConfig -AutostartDisabled $autostartDisabled

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
