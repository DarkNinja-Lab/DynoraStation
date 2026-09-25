#!/bin/sh
set -eu

APP_NAME="DynoraStation"
SERVICE_NAME="dynorastation"
SERVICE_USER="dynorastation"
DEFAULT_INSTALL_DIR="/opt/dynorastation"
DEFAULT_SERVER_PORT="8181"
DEFAULT_DISCOVERY_PORT="8182"
PUBLIC_REPO="${DYNORA_RELEASE_REPO:-__GITHUB_REPOSITORY__}"
ASSET_NAME="dynorastation-linux.tar.gz"
INSTALLER_ASSET="DynoraStation-Linux.sh"
CHECKSUM_NAME="SHA256SUMS.txt"
CONFIG_DIR="/etc/dynorastation"
CONFIG_FILE="$CONFIG_DIR/installer.conf"
STATE_FILE="$CONFIG_DIR/update-state"
BACKUP_DIR="/var/backups/dynorastation"
MANAGER_DIR="/usr/local/lib/dynorastation"
MANAGER_FILE="$MANAGER_DIR/DynoraStation-Linux.sh"
SELF=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/$(basename -- "$0")

QUIET=0
TMP_DIR=""

log()  { [ "$QUIET" = "1" ] || printf '\033[1;34m[Dynora]\033[0m %s\n' "$*"; }
ok()   { [ "$QUIET" = "1" ] || printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[FEHLER]\033[0m %s\n' "$*" >&2; exit 1; }

cleanup() {
  [ -z "$TMP_DIR" ] || rm -rf "$TMP_DIR"
}
trap cleanup EXIT HUP INT TERM

usage() {
  cat <<'USAGE'
DynoraStation Linux-Installer

Verwendung:
  ./DynoraStation-Linux.sh [install|update|uninstall] [Optionen]

Ohne Aktion erscheint ein Menü.

Install-Optionen:
  --install-dir PFAD   Installationsordner (Standard: /opt/dynorastation)
  --port PORT          Web/API-Port (Standard: 8181)
  --discovery-port P   UDP-Discovery-Port (Standard: 8182)
  --with-nginx         nginx Reverse Proxy aktivieren
  --no-nginx           nginx nicht konfigurieren
  --repo OWNER/REPO    GitHub-Repository für Releases
  --auto-update        tägliche automatische Updates aktivieren
  --no-auto-update     automatische Updates deaktivieren
  --replace-env        vorhandene .env neu erzeugen
  --non-interactive    keine Fragen stellen

Update-Optionen:
  --repo OWNER/REPO    Release-Repository überschreiben
  --check              nur prüfen, ob ein Update vorhanden ist
  --force              dieselbe Version erneut installieren
  --yes, -y            Rückfrage überspringen
  --quiet, -q          nur Warnungen/Fehler ausgeben

Uninstall-Optionen:
  --keep-data          data/ und .env behalten (Standard)
  --purge              auch Nutzerdaten, .env und Backups löschen
  --yes, -y            Rückfragen überspringen

  -h, --help           Hilfe anzeigen
USAGE
}

choose_action() {
  if [ ! -t 0 ]; then printf 'install\n'; return; fi
  {
    printf '\nDynoraStation für Linux\n'
    printf '%s\n' '-----------------------'
    printf '  1) Installieren / darüber installieren\n'
    printf '  2) Aktualisieren\n'
    printf '  3) Deinstallieren\n'
    printf '  4) Abbrechen\n'
    printf 'Auswahl [1]: '
  } >&2
  IFS= read -r choice || choice=""
  case "$choice" in
    ''|1) printf 'install\n' ;;
    2) printf 'update\n' ;;
    3) printf 'uninstall\n' ;;
    4) printf 'cancel\n' ;;
    *) die "Ungültige Auswahl." ;;
  esac
}

ask_yes_no() {
  prompt=$1
  default=$2
  if [ "$default" = "1" ]; then suffix='[J/n]'; else suffix='[j/N]'; fi
  while :; do
    printf '%s %s: ' "$prompt" "$suffix" >&2
    IFS= read -r reply || reply=""
    case "$reply" in
      '') printf '%s\n' "$default"; return 0 ;;
      j|J|ja|JA|Ja|y|Y|yes|YES|Yes) printf '1\n'; return 0 ;;
      n|N|nein|NEIN|Nein|no|NO|No) printf '0\n'; return 0 ;;
      *) printf 'Bitte j oder n eingeben.\n' >&2 ;;
    esac
  done
}

prompt_text() {
  prompt=$1
  default=$2
  if [ -n "$default" ]; then printf '%s [%s]: ' "$prompt" "$default" >&2; else printf '%s: ' "$prompt" >&2; fi
  IFS= read -r reply || reply=""
  if [ -n "$reply" ]; then printf '%s\n' "$reply"; else printf '%s\n' "$default"; fi
}

is_valid_port() {
  case "$1" in ''|*[!0-9]*) return 1 ;; esac
  [ "$1" -ge 1 ] 2>/dev/null && [ "$1" -le 65535 ] 2>/dev/null
}

validate_install_dir() {
  case "$1" in
    /*) ;;
    *) die "Installationsordner muss ein absoluter Pfad sein: $1" ;;
  esac
  case "$1" in *[!A-Za-z0-9_./-]*) die "Installationsordner enthält nicht unterstützte Sonderzeichen: $1" ;; esac
  case "$1" in
    /|/bin|/boot|/dev|/etc|/home|/lib|/lib64|/media|/mnt|/opt|/proc|/root|/run|/sbin|/srv|/sys|/tmp|/usr|/var)
      die "Unsicherer Installationsordner: $1" ;;
  esac
}

shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

normalize_repo() {
  repo=$1
  repo=$(printf '%s' "$repo" | sed -e 's#^https://github.com/##' -e 's#^http://github.com/##' -e 's#^git@github.com:##' -e 's#\.git$##' -e 's#/*$##')
  printf '%s\n' "$repo" | grep -Eq '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' || return 1
  printf '%s\n' "$repo"
}

resolve_repo() {
  candidate=${1:-}
  [ -n "$candidate" ] || candidate=$PUBLIC_REPO
  if [ "$candidate" = "__GITHUB_REPOSITORY__" ] || [ -z "$candidate" ]; then
    if [ -t 0 ]; then
      candidate=$(prompt_text "GitHub Repository (OWNER/REPO)" "")
    else
      die "GitHub Repository fehlt. Verwende --repo OWNER/REPO oder DYNORA_RELEASE_REPO."
    fi
  fi
  normalize_repo "$candidate" 2>/dev/null || die "Repository muss OWNER/REPO oder eine github.com-URL sein."
}

download_file() {
  url=$1
  target=$2
  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 3 --connect-timeout 15 -o "$target" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --tries=3 --timeout=20 -O "$target" "$url"
  else
    die "curl oder wget wird benötigt."
  fi
}

sha256_file() {
  file=$1
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$file" | awk '{print $1}'; return; fi
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$file" | awk '{print $1}'; return; fi
  return 1
}

checksum_for() {
  file=$1
  list=$2
  awk -v n="$file" '$2==n || (substr($2,1,1)=="*" && substr($2,2)==n) {print $1; exit}' "$list"
}

ensure_root() {
  action=$1
  shift
  [ "$(id -u)" -eq 0 ] && return 0
  if command -v sudo >/dev/null 2>&1; then
    case "$INVOKED_AS" in
      dynora-update|dynora-uninstall) exec sudo "$SELF" "$@" ;;
      *) exec sudo "$SELF" "$action" "$@" ;;
    esac
  fi
  die "Bitte als root ausführen oder sudo installieren."
}

install_apt_packages() {
  command -v apt-get >/dev/null 2>&1 || return 1
  log "Installiere fehlende Systempakete: $*"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends "$@"
}

load_config() {
  if [ -f "$CONFIG_FILE" ]; then
    # shellcheck disable=SC1090
    . "$CONFIG_FILE"
  fi
}

write_installer_config() {
  mkdir -p "$CONFIG_DIR"
  umask 022
  {
    printf 'INSTALL_DIR=%s\n' "$(shell_quote "$INSTALL_DIR")"
    printf 'SERVICE_NAME=%s\n' "$(shell_quote "$SERVICE_NAME")"
    printf 'SERVICE_USER=%s\n' "$(shell_quote "$SERVICE_USER")"
    printf 'SERVER_PORT=%s\n' "$(shell_quote "$SERVER_PORT")"
    printf 'DISCOVERY_PORT=%s\n' "$(shell_quote "$DISCOVERY_PORT")"
    printf 'INSTALL_NGINX=%s\n' "$(shell_quote "$INSTALL_NGINX")"
    printf 'RELEASE_REPO=%s\n' "$(shell_quote "$RELEASE_REPO")"
    printf 'AUTO_UPDATE=%s\n' "$(shell_quote "$AUTO_UPDATE")"
  } > "$CONFIG_FILE"
  chmod 644 "$CONFIG_FILE"
}

write_update_state() {
  version=$1
  sha=$2
  mkdir -p "$CONFIG_DIR"
  {
    printf 'LAST_VERSION=%s\n' "$(shell_quote "$version")"
    printf 'LAST_SHA256=%s\n' "$(shell_quote "$sha")"
  } > "$STATE_FILE"
  chmod 644 "$STATE_FILE"
}

install_manager() {
  installer_source=$1
  [ -f "$installer_source" ] || die "Installer-Datei für System-Manager fehlt."
  mkdir -p "$MANAGER_DIR"
  install -m 755 "$installer_source" "$MANAGER_FILE"
  ln -sfn "$MANAGER_FILE" /usr/local/sbin/dynora-update
  ln -sfn "$MANAGER_FILE" /usr/local/sbin/dynora-uninstall
}

write_update_timer() {
  update_service="/etc/systemd/system/${SERVICE_NAME}-update.service"
  update_timer="/etc/systemd/system/${SERVICE_NAME}-update.timer"

  if [ "$AUTO_UPDATE" = "1" ] && [ -n "$RELEASE_REPO" ]; then
    cat > "$update_service" <<UNIT
[Unit]
Description=DynoraStation Update
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${MANAGER_FILE} update --yes --quiet
UNIT

    cat > "$update_timer" <<TIMER
[Unit]
Description=DynoraStation tägliche Update-Prüfung

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=2h

[Install]
WantedBy=timers.target
TIMER

    systemctl daemon-reload
    systemctl enable --now "${SERVICE_NAME}-update.timer" >/dev/null
    ok "Automatische Updates sind aktiviert"
  else
    systemctl disable --now "${SERVICE_NAME}-update.timer" >/dev/null 2>&1 || true
    rm -f "$update_service" "$update_timer"
    systemctl daemon-reload
  fi
}

fetch_release() {
  repo=$1
  TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/dynora-installer.XXXXXX")
  base="https://github.com/${repo}/releases/latest/download"
  archive="$TMP_DIR/$ASSET_NAME"
  checksums="$TMP_DIR/$CHECKSUM_NAME"
  latest_installer="$TMP_DIR/$INSTALLER_ASSET"

  log "Lade neueste DynoraStation-Version von $repo"
  download_file "$base/$CHECKSUM_NAME" "$checksums" || die "Release-Prüfsummen konnten nicht geladen werden."
  download_file "$base/$ASSET_NAME" "$archive" || die "Release-Paket konnte nicht geladen werden."
  download_file "$base/$INSTALLER_ASSET" "$latest_installer" || die "Aktueller Linux-Installer konnte nicht geladen werden."

  expected_archive=$(checksum_for "$ASSET_NAME" "$checksums")
  expected_installer=$(checksum_for "$INSTALLER_ASSET" "$checksums")
  [ -n "$expected_archive" ] || die "Für $ASSET_NAME fehlt die SHA-256-Prüfsumme."
  [ -n "$expected_installer" ] || die "Für $INSTALLER_ASSET fehlt die SHA-256-Prüfsumme."

  ARCHIVE_SHA=$(sha256_file "$archive" 2>/dev/null || true)
  installer_sha=$(sha256_file "$latest_installer" 2>/dev/null || true)
  [ -n "$ARCHIVE_SHA" ] && [ -n "$installer_sha" ] || die "Für die Integritätsprüfung wird sha256sum oder shasum benötigt."
  [ "$expected_archive" = "$ARCHIVE_SHA" ] || die "SHA-256-Prüfung des Release-Pakets fehlgeschlagen."
  [ "$expected_installer" = "$installer_sha" ] || die "SHA-256-Prüfung des Installers fehlgeschlagen."
  ok "Release-Prüfsummen stimmen"

  SOURCE_DIR="$TMP_DIR/source"
  mkdir -p "$SOURCE_DIR"
  tar -xzf "$archive" -C "$SOURCE_DIR"
  [ -f "$SOURCE_DIR/package.json" ] || die "Release enthält keine package.json."
  [ -f "$SOURCE_DIR/src/server.js" ] || die "Release enthält keine src/server.js."
  INSTALLER_SOURCE="$latest_installer"
}

ensure_node() {
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    install_apt_packages nodejs npm || die "Node.js/npm fehlen. Bitte Node.js 18+ installieren."
  fi
  NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0')
  case "$NODE_MAJOR" in ''|*[!0-9]*) NODE_MAJOR=0 ;; esac
  [ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18 oder neuer ist erforderlich. Gefunden: $(node --version 2>/dev/null || printf unbekannt)"
  if ! command -v runuser >/dev/null 2>&1; then install_apt_packages util-linux || die "runuser wurde nicht gefunden."; fi
  NODE_BIN=$(command -v node)
  ok "Node.js $(node --version) und npm $(npm --version) gefunden"
}

install_dependencies() {
  dir=$1
  user=$2
  if [ -f "$dir/package-lock.json" ]; then
    runuser -u "$user" -- sh -c "cd \"$dir\" && npm ci --omit=dev --no-audit --no-fund"
  else
    runuser -u "$user" -- sh -c "cd \"$dir\" && npm install --omit=dev --no-audit --no-fund"
  fi
}

healthcheck() {
  port=$1
  count=0
  while [ "$count" -lt 20 ]; do
    if "$NODE_BIN" -e '
      const http=require("http");
      const port=Number(process.argv[1]);
      const req=http.get({host:"127.0.0.1",port,path:"/healthz",timeout:800},res=>{process.exit(res.statusCode===200?0:1)});
      req.on("error",()=>process.exit(1));
      req.on("timeout",()=>{req.destroy();process.exit(1)});
    ' "$port" >/dev/null 2>&1; then return 0; fi
    count=$((count + 1))
    sleep 1
  done
  return 1
}

create_backup() {
  [ -f "$INSTALL_DIR/package.json" ] || return 0
  mkdir -p "$BACKUP_DIR"
  stamp=$(date '+%Y%m%d-%H%M%S')
  BACKUP_FILE="$BACKUP_DIR/before-update-$stamp.tar.gz"
  log "Erstelle Backup: $BACKUP_FILE"
  tar --exclude='./data' --exclude='./node_modules' --exclude='./.env' -czf "$BACKUP_FILE" -C "$INSTALL_DIR" .
}

restore_backup() {
  [ -n "${BACKUP_FILE:-}" ] && [ -f "$BACKUP_FILE" ] || return 1
  warn "Stelle vorherige Version wieder her."
  systemctl stop "$SERVICE_NAME" >/dev/null 2>&1 || true
  find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 ! -name data ! -name .env -exec rm -rf -- {} +
  tar -xzf "$BACKUP_FILE" -C "$INSTALL_DIR"
  chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
  install_dependencies "$INSTALL_DIR" "$SERVICE_USER" || true
  systemctl daemon-reload || true
  systemctl restart "$SERVICE_NAME" || true
}

trim_backups() {
  backup_list=$(ls -1t "$BACKUP_DIR"/before-update-*.tar.gz 2>/dev/null || true)
  [ -z "$backup_list" ] || printf '%s\n' "$backup_list" | awk 'NR > 10' | while IFS= read -r old_backup; do [ -z "$old_backup" ] || rm -f "$old_backup"; done
}

configure_service() {
  SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
  cat > "$SERVICE_FILE" <<UNIT
[Unit]
Description=DynoraStation Märklin M-Gleis Steuerung
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=-${INSTALL_DIR}/.env
ExecStart=${NODE_BIN} ${INSTALL_DIR}/src/server.js
Restart=on-failure
RestartSec=3
TimeoutStopSec=15
NoNewPrivileges=true
PrivateTmp=true
UMask=0027

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null
}

configure_nginx() {
  NGINX_AVAILABLE="/etc/nginx/sites-available/dynorastation"
  NGINX_ENABLED="/etc/nginx/sites-enabled/dynorastation"
  if [ "$INSTALL_NGINX" = "1" ]; then
    if ! command -v nginx >/dev/null 2>&1; then install_apt_packages nginx || die "nginx konnte nicht installiert werden."; fi
    log "Richte nginx-Reverse-Proxy ein"
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
    cat > "$NGINX_AVAILABLE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name dynora.local _;

    location / {
        proxy_pass http://127.0.0.1:${SERVER_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 75s;
    }
}
NGINX
    ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
    nginx -t
    systemctl enable nginx >/dev/null
    systemctl reload nginx
    ok "nginx ist aktiv"
  else
    if [ -e "$NGINX_ENABLED" ] || [ -e "$NGINX_AVAILABLE" ]; then
      rm -f "$NGINX_ENABLED" "$NGINX_AVAILABLE"
      if command -v nginx >/dev/null 2>&1 && nginx -t >/dev/null 2>&1; then systemctl reload nginx >/dev/null 2>&1 || true; fi
    fi
  fi
}

copy_runtime() {
  find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 ! -name data ! -name .env -exec rm -rf -- {} +
  tar --exclude='./node_modules' --exclude='./data' --exclude='./.env' --exclude='./dist' --exclude='./installer' -cf - -C "$SOURCE_DIR" . | tar -xf - -C "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR/data"
}

sync_ports_from_env() {
  env_file="$INSTALL_DIR/.env"
  [ -f "$env_file" ] || return 0
  configured_server=$(awk -F= '$1=="SERVER_PORT" {value=$0; sub(/^[^=]*=/,"",value); print value; exit}' "$env_file" | tr -d '\r "' || true)
  configured_discovery=$(awk -F= '$1=="DISCOVERY_PORT" {value=$0; sub(/^[^=]*=/,"",value); print value; exit}' "$env_file" | tr -d '\r "' || true)
  if [ -n "$configured_server" ]; then
    if is_valid_port "$configured_server"; then SERVER_PORT=$configured_server; else warn "Ungültiger SERVER_PORT in .env; verwende $SERVER_PORT."; fi
  fi
  if [ -n "$configured_discovery" ]; then
    if is_valid_port "$configured_discovery"; then DISCOVERY_PORT=$configured_discovery; else warn "Ungültiger DISCOVERY_PORT in .env; verwende $DISCOVERY_PORT."; fi
  fi
}

ensure_env() {
  if [ ! -f "$INSTALL_DIR/.env" ] || [ "$REPLACE_ENV" = "1" ]; then
    [ -f "$INSTALL_DIR/.env.example" ] || die ".env.example fehlt."
    LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    [ -n "$LAN_IP" ] || LAN_IP="127.0.0.1"
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    sed -i -E "s|^SERVER_IP=.*$|SERVER_IP=${LAN_IP}|" "$INSTALL_DIR/.env"
    sed -i -E "s|^SERVER_PORT=.*$|SERVER_PORT=${SERVER_PORT}|" "$INSTALL_DIR/.env"
    sed -i -E "s|^DISCOVERY_PORT=.*$|DISCOVERY_PORT=${DISCOVERY_PORT}|" "$INSTALL_DIR/.env"
    if [ "$INSTALL_NGINX" = "1" ]; then trust_proxy=true; else trust_proxy=false; fi
    if grep -q '^TRUST_PROXY=' "$INSTALL_DIR/.env"; then sed -i -E "s|^TRUST_PROXY=.*$|TRUST_PROXY=${trust_proxy}|" "$INSTALL_DIR/.env"; else printf '\nTRUST_PROXY=%s\n' "$trust_proxy" >> "$INSTALL_DIR/.env"; fi
    if grep -q '^NODE_ENV=' "$INSTALL_DIR/.env"; then sed -i -E 's|^NODE_ENV=.*$|NODE_ENV=production|' "$INSTALL_DIR/.env"; else printf '\nNODE_ENV=production\n' >> "$INSTALL_DIR/.env"; fi
    ok "Konfiguration aus .env.example erstellt"
  else
    warn "Vorhandene .env bleibt unverändert: $INSTALL_DIR/.env"
  fi
}

install_action() {
  INSTALL_DIR="${DYNORA_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
  SERVER_PORT="${DYNORA_PORT:-$DEFAULT_SERVER_PORT}"
  DISCOVERY_PORT="${DYNORA_DISCOVERY_PORT:-$DEFAULT_DISCOVERY_PORT}"
  INSTALL_NGINX="${DYNORA_INSTALL_NGINX:-0}"
  AUTO_UPDATE="${DYNORA_AUTO_UPDATE:-0}"
  RELEASE_REPO="${DYNORA_RELEASE_REPO:-}"
  NON_INTERACTIVE=0
  REPLACE_ENV=0

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --install-dir) [ "$#" -ge 2 ] || die "--install-dir benötigt einen Pfad."; INSTALL_DIR=$2; shift 2 ;;
      --port) [ "$#" -ge 2 ] || die "--port benötigt eine Portnummer."; SERVER_PORT=$2; shift 2 ;;
      --discovery-port) [ "$#" -ge 2 ] || die "--discovery-port benötigt eine Portnummer."; DISCOVERY_PORT=$2; shift 2 ;;
      --with-nginx) INSTALL_NGINX=1; shift ;;
      --no-nginx) INSTALL_NGINX=0; shift ;;
      --repo) [ "$#" -ge 2 ] || die "--repo benötigt OWNER/REPO."; RELEASE_REPO=$2; shift 2 ;;
      --auto-update) AUTO_UPDATE=1; shift ;;
      --no-auto-update) AUTO_UPDATE=0; shift ;;
      --replace-env) REPLACE_ENV=1; shift ;;
      --non-interactive|--yes|-y) NON_INTERACTIVE=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unbekannte Install-Option: $1" ;;
    esac
  done

  validate_install_dir "$INSTALL_DIR"
  is_valid_port "$SERVER_PORT" || die "Ungültiger Port: $SERVER_PORT"
  is_valid_port "$DISCOVERY_PORT" || die "Ungültiger Discovery-Port: $DISCOVERY_PORT"
  RELEASE_REPO=$(resolve_repo "$RELEASE_REPO")

  if [ "$NON_INTERACTIVE" = "0" ] && [ -t 0 ]; then
    printf '\nDynoraStation Linux-Installation\n%s\n' '--------------------------------'
    INSTALL_DIR=$(prompt_text "Installationsordner" "$INSTALL_DIR")
    validate_install_dir "$INSTALL_DIR"
    while :; do SERVER_PORT=$(prompt_text "Web/API-Port" "$SERVER_PORT"); is_valid_port "$SERVER_PORT" && break; warn "Ungültiger Port."; done
    while :; do DISCOVERY_PORT=$(prompt_text "UDP-Discovery-Port" "$DISCOVERY_PORT"); is_valid_port "$DISCOVERY_PORT" && break; warn "Ungültiger Port."; done
    INSTALL_NGINX=$(ask_yes_no "nginx als Reverse Proxy auf Port 80 einrichten?" "$INSTALL_NGINX")
    AUTO_UPDATE=$(ask_yes_no "Updates automatisch täglich installieren?" "$AUTO_UPDATE")
    if [ -f "$INSTALL_DIR/.env" ]; then keep_env=$(ask_yes_no "Vorhandene Konfiguration $INSTALL_DIR/.env behalten?" 1); [ "$keep_env" = "1" ] || REPLACE_ENV=1; fi
    printf '\nInstallation: %s\nWeb/API-Port: %s\nUDP-Discovery: %s\nRepository: %s\n\n' "$INSTALL_DIR" "$SERVER_PORT" "$DISCOVERY_PORT" "$RELEASE_REPO"
    confirm=$(ask_yes_no "Installation jetzt starten?" 1)
    [ "$confirm" = "1" ] || { printf 'Abgebrochen.\n'; exit 0; }
  fi

  fetch_release "$RELEASE_REPO"
  ensure_node
  command -v systemctl >/dev/null 2>&1 || die "systemd wurde nicht gefunden."

  if ! getent passwd "$SERVICE_USER" >/dev/null 2>&1; then
    log "Lege Systembenutzer '$SERVICE_USER' an"
    NOLOGIN=$(command -v nologin 2>/dev/null || printf '/usr/sbin/nologin')
    useradd --system --user-group --home-dir "$INSTALL_DIR" --shell "$NOLOGIN" "$SERVICE_USER"
  fi
  SERVICE_GROUP=$(id -gn "$SERVICE_USER")
  BACKUP_FILE=""
  create_backup

  systemctl stop "$SERVICE_NAME" >/dev/null 2>&1 || true
  log "Installiere DynoraStation nach $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  copy_runtime
  ensure_env
  sync_ports_from_env
  chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
  chmod 750 "$INSTALL_DIR"
  chmod 640 "$INSTALL_DIR/.env"

  if ! install_dependencies "$INSTALL_DIR" "$SERVICE_USER"; then
    [ -z "$BACKUP_FILE" ] || restore_backup || true
    die "Node-Abhängigkeiten konnten nicht installiert werden."
  fi

  configure_service
  configure_nginx
  write_installer_config
  install_manager "$INSTALLER_SOURCE"
  write_update_timer
  systemctl restart "$SERVICE_NAME"

  if ! healthcheck "$SERVER_PORT"; then
    if [ -n "$BACKUP_FILE" ]; then restore_backup || true; fi
    die "Healthcheck auf Port $SERVER_PORT ist fehlgeschlagen."
  fi
  ok "DynoraStation antwortet auf /healthz"

  SOURCE_VERSION=$(node -p "require('$INSTALL_DIR/package.json').version" 2>/dev/null || printf 'unbekannt')
  write_update_state "$SOURCE_VERSION" "$ARCHIVE_SHA"
  trim_backups

  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
  [ -n "$LAN_IP" ] || LAN_IP="127.0.0.1"
  printf '\nInstallation abgeschlossen.\n'
  if [ "$INSTALL_NGINX" = "1" ]; then printf '  DynoraStation: http://%s/\n' "$LAN_IP"; else printf '  DynoraStation: http://%s:%s/\n' "$LAN_IP" "$SERVER_PORT"; fi
  printf '  Lokal:         http://127.0.0.1:%s/\n' "$SERVER_PORT"
  printf '  Installation:  %s\n' "$INSTALL_DIR"
  printf '  Update:        sudo dynora-update\n'
  printf '  Entfernen:     sudo dynora-uninstall\n'
}

update_action() {
  ASSUME_YES=0
  FORCE=0
  CHECK_ONLY=0
  REPO_OVERRIDE=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --repo) [ "$#" -ge 2 ] || die "--repo benötigt OWNER/REPO."; REPO_OVERRIDE=$2; shift 2 ;;
      --check) CHECK_ONLY=1; shift ;;
      --force) FORCE=1; shift ;;
      --yes|-y) ASSUME_YES=1; shift ;;
      --quiet|-q) QUIET=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unbekannte Update-Option: $1" ;;
    esac
  done

  [ -f "$CONFIG_FILE" ] || die "Installer-Konfiguration fehlt: $CONFIG_FILE"
  load_config
  INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}
  SERVICE_NAME=${SERVICE_NAME:-dynorastation}
  SERVICE_USER=${SERVICE_USER:-dynorastation}
  SERVER_PORT=${SERVER_PORT:-$DEFAULT_SERVER_PORT}
  DISCOVERY_PORT=${DISCOVERY_PORT:-$DEFAULT_DISCOVERY_PORT}
  INSTALL_NGINX=${INSTALL_NGINX:-0}
  AUTO_UPDATE=${AUTO_UPDATE:-0}
  if [ -n "$REPO_OVERRIDE" ]; then RELEASE_REPO=$REPO_OVERRIDE; fi
  RELEASE_REPO=$(resolve_repo "${RELEASE_REPO:-}")
  validate_install_dir "$INSTALL_DIR"
  [ -f "$INSTALL_DIR/package.json" ] || die "Installation nicht gefunden: $INSTALL_DIR"
  [ -f "$INSTALL_DIR/.env" ] || die "Konfiguration fehlt: $INSTALL_DIR/.env"
  sync_ports_from_env

  fetch_release "$RELEASE_REPO"
  ensure_node
  SERVICE_GROUP=$(id -gn "$SERVICE_USER")
  REMOTE_VERSION=$(node -p "require('$SOURCE_DIR/package.json').version" 2>/dev/null || printf 'unbekannt')
  LOCAL_VERSION=$(node -p "require('$INSTALL_DIR/package.json').version" 2>/dev/null || printf 'unbekannt')
  LAST_SHA256=""
  if [ -f "$STATE_FILE" ]; then . "$STATE_FILE"; LAST_SHA256=${LAST_SHA256:-}; fi

  if [ "$FORCE" != "1" ] && [ "$REMOTE_VERSION" = "$LOCAL_VERSION" ] && [ "$ARCHIVE_SHA" = "$LAST_SHA256" ]; then
    ok "Bereits aktuell (Version $LOCAL_VERSION)"
    install_manager "$INSTALLER_SOURCE"
    exit 0
  fi
  if [ "$CHECK_ONLY" = "1" ]; then printf 'Update verfügbar: %s -> %s\n' "$LOCAL_VERSION" "$REMOTE_VERSION"; exit 0; fi

  if [ "$ASSUME_YES" != "1" ] && [ ! -t 0 ]; then die "Ohne interaktives Terminal muss --yes angegeben werden."; fi
  if [ "$ASSUME_YES" != "1" ]; then
    printf 'Installierte Version: %s\nNeues Release:         %s\nQuelle:                 %s\n' "$LOCAL_VERSION" "$REMOTE_VERSION" "$RELEASE_REPO"
    confirm=$(ask_yes_no "Update installieren?" 1)
    [ "$confirm" = "1" ] || { printf 'Abgebrochen.\n'; exit 0; }
  fi

  log "Prüfe Update-Dateien"
  for root in "$SOURCE_DIR/src" "$SOURCE_DIR/public/app"; do
    [ -d "$root" ] || continue
    find "$root" -type f -name '*.js' -print | while IFS= read -r jsfile; do node --check "$jsfile" >/dev/null || exit 1; done || die "JavaScript-Syntaxprüfung fehlgeschlagen."
  done

  BACKUP_FILE=""
  create_backup
  systemctl stop "$SERVICE_NAME"
  copy_runtime
  chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
  chmod 750 "$INSTALL_DIR"
  chmod 640 "$INSTALL_DIR/.env"

  if ! install_dependencies "$INSTALL_DIR" "$SERVICE_USER"; then restore_backup || true; die "Update fehlgeschlagen; vorherige Version wurde wiederhergestellt."; fi
  log "Führe Tests aus"
  if ! runuser -u "$SERVICE_USER" -- sh -c "cd \"$INSTALL_DIR\" && npm test"; then restore_backup || true; die "Update verworfen; vorherige Version wurde wiederhergestellt."; fi

  configure_service
  configure_nginx
  install_manager "$INSTALLER_SOURCE"
  write_installer_config
  write_update_timer
  systemctl restart "$SERVICE_NAME"

  if ! healthcheck "$SERVER_PORT"; then
    warn "Neue Version antwortet nicht auf /healthz. Rollback wird gestartet."
    restore_backup || true
    if healthcheck "$SERVER_PORT"; then warn "Rollback erfolgreich; alte Version läuft wieder."; else warn "Auch nach Rollback ist der Healthcheck fehlgeschlagen."; fi
    die "Update fehlgeschlagen."
  fi

  write_update_state "$REMOTE_VERSION" "$ARCHIVE_SHA"
  trim_backups
  ok "Update abgeschlossen: $LOCAL_VERSION -> $REMOTE_VERSION"
  log "Backup: $BACKUP_FILE"
}

uninstall_action() {
  KEEP_DATA=1
  ASSUME_YES=0
  PURGE_SET=0
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --keep-data) KEEP_DATA=1; PURGE_SET=1 ;;
      --purge) KEEP_DATA=0; PURGE_SET=1 ;;
      --yes|-y) ASSUME_YES=1 ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unbekannte Uninstall-Option: $1" ;;
    esac
    shift
  done

  INSTALL_DIR=$DEFAULT_INSTALL_DIR
  SERVICE_NAME=dynorastation
  SERVICE_USER=dynorastation
  load_config
  validate_install_dir "$INSTALL_DIR"

  if [ "$ASSUME_YES" != "1" ] && [ -t 0 ]; then
    printf '\nDynoraStation entfernen\n%s\n' '-----------------------'
    if [ "$PURGE_SET" = "0" ]; then KEEP_DATA=$(ask_yes_no "Nutzerdaten (data/) und .env behalten?" 1); fi
    if [ "$KEEP_DATA" = "1" ]; then printf 'Programmdateien werden entfernt; data/ und .env bleiben unter %s erhalten.\n' "$INSTALL_DIR"; else printf 'ACHTUNG: DynoraStation inklusive data/ und .env wird vollständig gelöscht.\n'; fi
    confirm=$(ask_yes_no "Wirklich entfernen?" 0)
    [ "$confirm" = "1" ] || { printf 'Abgebrochen.\n'; exit 0; }
  fi

  log "Stoppe und deaktiviere Dienste"
  systemctl disable --now "${SERVICE_NAME}-update.timer" >/dev/null 2>&1 || true
  systemctl disable --now "$SERVICE_NAME" >/dev/null 2>&1 || true
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}-update.service" "/etc/systemd/system/${SERVICE_NAME}-update.timer"

  if [ -e /etc/nginx/sites-enabled/dynorastation ] || [ -e /etc/nginx/sites-available/dynorastation ]; then
    rm -f /etc/nginx/sites-enabled/dynorastation /etc/nginx/sites-available/dynorastation
    if command -v nginx >/dev/null 2>&1 && nginx -t >/dev/null 2>&1; then systemctl reload nginx >/dev/null 2>&1 || true; fi
  fi

  if [ -d "$INSTALL_DIR" ]; then
    if [ "$KEEP_DATA" = "1" ]; then
      find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 ! -name data ! -name .env -exec rm -rf -- {} +
      warn "Behalten: $INSTALL_DIR/data und $INSTALL_DIR/.env"
    else
      rm -rf "$INSTALL_DIR"
    fi
  fi

  rm -rf "$CONFIG_DIR"
  if [ "$KEEP_DATA" = "0" ]; then rm -rf "$BACKUP_DIR"; fi
  systemctl daemon-reload

  if [ "$KEEP_DATA" = "0" ] && getent passwd "$SERVICE_USER" >/dev/null 2>&1; then userdel "$SERVICE_USER" >/dev/null 2>&1 || true; fi
  rm -f /usr/local/sbin/dynora-update /usr/local/sbin/dynora-uninstall
  rm -rf "$MANAGER_DIR"
  ok "DynoraStation wurde entfernt."
  [ "$KEEP_DATA" = "0" ] || printf 'Nutzerdaten/Konfiguration wurden nicht gelöscht.\n'
}

INVOKED_AS=$(basename -- "$0")
ACTION=""
case "$INVOKED_AS" in
  dynora-update) ACTION=update ;;
  dynora-uninstall) ACTION=uninstall ;;
esac

if [ -z "$ACTION" ]; then
  case "${1:-}" in
    install|update|uninstall) ACTION=$1; shift ;;
    -h|--help) usage; exit 0 ;;
    '') ACTION=$(choose_action) ;;
    *) ACTION=install ;;
  esac
fi

[ "$ACTION" = "cancel" ] && exit 0
ensure_root "$ACTION" "$@"

case "$ACTION" in
  install) install_action "$@" ;;
  update) update_action "$@" ;;
  uninstall) uninstall_action "$@" ;;
  *) die "Unbekannte Aktion: $ACTION" ;;
esac
