

    printf '\nNODE_ENV=production\n' >> "$INSTALL_DIR/.env"
  fi
  ok "Konfiguration aus .env.example erstellt"
else
  warn "Vorhandene .env bleibt unverändert: $INSTALL_DIR/.env"
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chmod 750 "$INSTALL_DIR"
chmod 640 "$INSTALL_DIR/.env"

log "Installiere Node-Abhängigkeiten"
if [[ -f "$INSTALL_DIR/package-lock.json" ]]; then
  runuser -u "$SERVICE_USER" -- bash -lc "cd '$INSTALL_DIR' && npm ci --omit=dev --no-audit --no-fund"
else
  runuser -u "$SERVICE_USER" -- bash -lc "cd '$INSTALL_DIR' && npm install --omit=dev --no-audit --no-fund"
fi
ok "Node-Abhängigkeiten installiert"

NODE_BIN="$(command -v node)"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
log "Richte systemd-Service ein"
cat > "$SERVICE_FILE" <<UNIT
[Unit]
Description=DynoraStation Märklin M-Gleis Steuerung
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

if [[ "$INSTALL_NGINX" == "1" ]]; then
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

log "Prüfe DynoraStation"
HEALTH_OK=0
for _ in {1..15}; do
  if "$NODE_BIN" -e '
    const http=require("http");
    const port=Number(process.argv[1]);
    const req=http.get({host:"127.0.0.1",port,path:"/healthz",timeout:700},res=>{process.exit(res.statusCode===200?0:1)});
    req.on("error",()=>process.exit(1)); req.on("timeout",()=>{req.destroy();process.exit(1)});
  ' "$SERVER_PORT" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  sleep 1
done

if (( HEALTH_OK == 1 )); then
  ok "DynoraStation antwortet auf /healthz"
else
  warn "Healthcheck fehlgeschlagen. Status prüfen mit: systemctl status $SERVICE_NAME"
fi

HOSTNAME_SHORT="$(hostname -s 2>/dev/null || hostname)"
if [[ "$INSTALL_NGINX" == "1" ]]; then
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

ESP-Discovery verwendet UDP-Port ${DISCOVERY_PORT}; die Web/API-Steuerung läuft intern auf TCP-Port ${SERVER_PORT}.
DONE