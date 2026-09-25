#!/bin/sh
set -eu

APP_NAME="DynoraStation"
SERVICE_NAME="dynorastation"
SERVICE_USER="dynorastation"
INSTALL_DIR="${DYNORA_INSTALL_DIR:-/opt/dynorastation}"
SERVER_PORT="${DYNORA_PORT:-8181}"
DISCOVERY_PORT="${DYNORA_DISCOVERY_PORT:-8182}"
INSTALL_NGINX="${DYNORA_INSTALL_NGINX:-0}"
SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

log()  { printf '\033[1;34m[Dynora]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[FEHLER]\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<USAGE
${APP_NAME} Installer fuer Linux

Verwendung:
  sudo ./install.sh [Optionen]

Optionen:
  --install-dir PFAD   Installationsordner (Standard: /opt/dynorastation)
  --port PORT          Web/API-Port (Standard: 8181)
  --discovery-port P   UDP-Discovery-Port (Standard: 8182)
  --with-nginx         nginx als Reverse Proxy auf Port 80 einrichten
  --no-nginx           nginx nicht konfigurieren (Standard)
  -h, --help           Hilfe anzeigen
USAGE
}

is_valid_port() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$1" -ge 1 ] 2>/dev/null && [ "$1" -le 65535 ] 2>/dev/null
}

# Erst die Rechte erhoehen, dann Optionen parsen. Dadurch funktioniert auch
# "./install.sh" ohne vorheriges sudo.
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    exec sudo "$0" "$@"
  fi
  die "Bitte als root ausfuehren oder sudo installieren."
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-dir)
      [ "$#" -ge 2 ] || die "--install-dir benoetigt einen Pfad."
      INSTALL_DIR=$2
      shift 2
      ;;
    --port)
      [ "$#" -ge 2 ] || die "--port benoetigt eine Portnummer."
      SERVER_PORT=$2
      shift 2
      ;;
    --discovery-port)
      [ "$#" -ge 2 ] || die "--discovery-port benoetigt eine Portnummer."
      DISCOVERY_PORT=$2
      shift 2
      ;;
    --with-nginx)
      INSTALL_NGINX=1
      shift
      ;;
    --no-nginx)
      INSTALL_NGINX=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unbekannte Option: $1"
      ;;
  esac
done

is_valid_port "$SERVER_PORT" || die "Ungueltiger Port: $SERVER_PORT"
is_valid_port "$DISCOVERY_PORT" || die "Ungueltiger Discovery-Port: $DISCOVERY_PORT"

[ -f "$SOURCE_DIR/package.json" ] || die "package.json nicht gefunden. Starte install.sh aus dem DynoraStation-Projekt."
[ -f "$SOURCE_DIR/src/server.js" ] || die "src/server.js nicht gefunden."
command -v systemctl >/dev/null 2>&1 || die "systemd wurde nicht gefunden. Dieser Installer ist fuer systemd-basierte Linux-Systeme gedacht."

install_apt_packages() {
  command -v apt-get >/dev/null 2>&1 || return 1
  log "Installiere fehlende Systempakete: $*"
  export DEBIAN_FRONTEND=noninteractive

