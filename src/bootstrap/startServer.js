"use strict";

const http = require("http");
const { startUdpDiscovery } = require("../services/discovery/udpDiscovery");

function startServer({ app, env, connectionInfo }) {
  const server = http.createServer(app);
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 15000;
  server.listen(env.SERVER_PORT, "0.0.0.0", () => {
    console.log(`[START] DynoraStation ${env.APP_VERSION} · Märklin M-Gleis`);
    console.log(`[START] Lokal: http://127.0.0.1:${env.SERVER_PORT}`);
    connectionInfo.lanAddresses.forEach((address) => console.log(`[START] LAN: http://${address}:${env.SERVER_PORT}`));
    if (!connectionInfo.lanAddresses.length) console.log(`[START] LAN-Konfiguration: http://${env.SERVER_IP}:${env.SERVER_PORT}`);
  });

  const discoverySocket = env.ENABLE_UDP_DISCOVERY
    ? startUdpDiscovery({ discoveryPort: env.DISCOVERY_PORT, serverPort: env.SERVER_PORT, protocolVersion: env.PROTOCOL_VERSION })
    : null;
  let stopping = false;
  function stop(signal = "shutdown") {
    if (stopping) return;
    stopping = true;
    console.log(`[STOP] ${signal} · Verbindungen werden sauber beendet`);
    discoverySocket?.close();
    server.close((error) => {
      if (error) { console.error("[STOP] Fehler:", error.message); process.exitCode = 1; }
    });
  }
  return { server, discoverySocket, stop };
}

module.exports = { startServer };
