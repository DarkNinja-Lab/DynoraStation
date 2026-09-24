"use strict";

const dgram = require("dgram");

const DISCOVERY_REQUEST = "DYNORA_DISCOVER_V1";

function startUdpDiscovery({ discoveryPort, serverPort, protocolVersion }) {
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("error", (error) => {
    console.warn(`[DISCOVERY] UDP ${discoveryPort} nicht verfügbar: ${error.message}`);
  });

  socket.on("message", (message, remote) => {
    if (String(message).trim() !== DISCOVERY_REQUEST) return;
    const reply = Buffer.from(`DYNORA_STATION_V1|${serverPort}|${protocolVersion}`);
    socket.send(reply, remote.port, remote.address);
  });

  socket.bind(discoveryPort, "0.0.0.0", () => {
    socket.setBroadcast(true);
    console.log(`[DISCOVERY] ESP-Autofind aktiv · UDP ${discoveryPort}`);
  });

  return socket;
}

module.exports = { DISCOVERY_REQUEST, startUdpDiscovery };
