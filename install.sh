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
  apt-get update
  apt-get install -y --no-install-recommends "$@"
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  install_apt_packages nodejs npm || die "Node.js/npm fehlen. Bitte Node.js 18+ installieren."
fi

NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0')
case "$NODE_MAJOR" in ''|*[!0-9]*) NODE_MAJOR=0 ;; esac
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18 oder neuer ist erforderlich. Gefunden: $(node --version 2>/dev/null || printf unbekannt)"
ok "Node.js $(node --version) und npm $(npm --version) gefunden"

if ! getent passwd "$SERVICE_USER" >/dev/null 2>&1; then
  log "Lege Systembenutzer '$SERVICE_USER' an"
  useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

log "Installiere DynoraStation nach $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Nutzerdaten und .env behalten, den Rest aktualisieren.
find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 \
  ! -name data \
  ! -name .env \
  -exec rm -rf -- {} +

tar \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./data' \
  --exclude='./.env' \
  --exclude='./install.sh~' \
  -cf - -C "$SOURCE_DIR" . | tar -xf - -C "$INSTALL_DIR"

mkdir -p "$INSTALL_DIR/data"

LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
[ -n "$LAN_IP" ] || LAN_IP="127.0.0.1"

if [ ! -f "$INSTALL_DIR/.env" ]; then
  [ -f "$INSTALL_DIR/.env.example" ] || die ".env.example fehlt."
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  sed -i -E "s|^SERVER_IP=.*$|SERVER_IP=${LAN_IP}|" "$INSTALL_DIR/.env"
  sed -i -E "s|^SERVER_PORT=.*$|SERVER_PORT=${SERVER_PORT}|" "$INSTALL_DIR/.env"
  sed -i -E "s|^DISCOVERY_PORT=.*$|DISCOVERY_PORT=${DISCOVERY_PORT}|" "$INSTALL_DIR/.env"
  if grep -q '^NODE_ENV=' "$INSTALL_DIR/.env"; then
    sed -i -E 's|^NODE_ENV=.*$|NODE_ENV=production|' "$INSTALL_DIR/.env"
  else
    printf '\nNODE_ENV=production\n' >> "$INSTALL_DIR/.env"
  fi
  ok "Konfiguration aus .env.example erstellt"
else
  warn "Vorhandene .env bleibt unveraendert: $INSTALL_DIR/.env"
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chmod 750 "$INSTALL_DIR"
chmod 640 "$INSTALL_DIR/.env"

log "Installiere Node-Abhaengigkeiten"
if [ -f "$INSTALL_DIR/package-lock.json" ]; then
  runuser -u "$SERVICE_USER" -- sh -c "cd \"$INSTALL_DIR\" && npm ci --omit=dev --no-audit --no-fund"
else
  runuser -u "$SERVICE_USER" -- sh -c "cd \"$INSTALL_DIR\" && npm install --omit=dev --no-audit --no-fund"
fi
ok "Node-Abhaengigkeiten installiert"

NODE_BIN=$(command -v node)
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
log "Richte systemd-Service ein"
cat > "$SERVICE_FILE" <<UNIT
[Unit]
Description=DynoraStation Maerklin M-Gleis Steuerung
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
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
systemctl restart "$SERVICE_NAME"

if [ "$INSTALL_NGINX" = "1" ]; then
  if ! command -v nginx >/dev/null 2>&1; then
    install_apt_packages nginx || die "nginx konnte nicht installiert werden."
  fi

  NGINX_AVAILABLE="/etc/nginx/sites-available/dynorastation"
  NGINX_ENABLED="/etc/nginx/sites-enabled/dynorastation"
  log "Richte nginx-Reverse-Proxy ein"
  cat > "$NGINX_AVAILABLE" <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

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
  rm -f /etc/nginx/sites-enabled/default
  ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  nginx -t
  systemctl enable nginx >/dev/null
  systemctl reload nginx
  ok "nginx ist aktiv"
fi

log "Pruefe DynoraStation"
HEALTH_OK=0
COUNT=0
while [ "$COUNT" -lt 15 ]; do
  if "$NODE_BIN" -e '
    const http=require("http");
    const port=Number(process.argv[1]);
    const req=http.get({host:"127.0.0.1",port,path:"/healthz",timeout:700},res=>{process.exit(res.statusCode===200?0:1)});
    req.on("error",()=>process.exit(1));
    req.on("timeout",()=>{req.destroy();process.exit(1)});
  ' "$SERVER_PORT" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  COUNT=$((COUNT + 1))
  sleep 1
done

if [ "$HEALTH_OK" -eq 1 ]; then
  ok "DynoraStation antwortet auf /healthz"
else
  warn "Healthcheck fehlgeschlagen. Status pruefen mit: systemctl status $SERVICE_NAME"
fi

HOSTNAME_SHORT=$(hostname -s 2>/dev/null || hostname)
if [ "$INSTALL_NGINX" = "1" ]; then
  ACCESS_URL="http://${LAN_IP}/"
  HOST_URL="http://${HOSTNAME_SHORT}.local/"
else
  ACCESS_URL="http://${LAN_IP}:${SERVER_PORT}/"
  HOST_URL="http://${HOSTNAME_SHORT}.local:${SERVER_PORT}/"
fi

cat <<DONE

Installation abgeschlossen.

  DynoraStation:  ${ACCESS_URL}
  Hostname:       ${HOST_URL}
  Service:        systemctl status ${SERVICE_NAME}
  Neustart:       systemctl restart ${SERVICE_NAME}
  Logs:           journalctl -u ${SERVICE_NAME} -f
  Konfiguration:  ${INSTALL_DIR}/.env
  Nutzerdaten:    ${INSTALL_DIR}/data

ESP-Discovery verwendet UDP-Port ${DISCOVERY_PORT}; die Web/API-Steuerung laeuft intern auf TCP-Port ${SERVER_PORT}.
DONE
