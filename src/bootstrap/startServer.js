"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const { startUdpDiscovery } = require("../services/discovery/udpDiscovery");

function underSystemd() {
  return Boolean(process.env.INVOCATION_ID || process.env.JOURNAL_STREAM);
}

function launchReplacement() {
  const cwd = process.cwd();
  let command = process.execPath;
  let args = process.argv.slice(1);

  if (process.platform === "win32") {
    const runner = path.join(cwd, "run-windows.cmd");
    if (fs.existsSync(runner)) {
      command = process.env.ComSpec || "cmd.exe";
      args = ["/d", "/c", runner];
    }
  }

  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, DYNORA_RESTARTED: "1" },
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
}

function startServer({ app, env, connectionInfo, runtimeState }) {
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
  let action = "running";

  async function waitForPendingWrites() {
    const writeState = runtimeState?.writeState;
    if (!writeState || typeof writeState !== "object") return;

    // Ein Writer kann waehrend seines Laufs noch eine weitere Runde vormerken.
    // Deshalb nach jedem Abschluss erneut nach aktiven Promises schauen.
    for (let round = 0; round < 4; round += 1) {
      const pending = Object.values(writeState)
        .map((entry) => entry?.promise)
        .filter((promise) => promise && typeof promise.then === "function");
      if (!pending.length) return;
      await Promise.allSettled(pending);
    }
  }

  async function finish(actionName) {
    await waitForPendingWrites();
    if (actionName === "restart") {
      if (underSystemd()) {
        // Der mitgelieferte systemd-Dienst nutzt Restart=on-failure.
        process.exitCode = 75;
      } else {
        try {
          launchReplacement();
        } catch (error) {
          console.error("[RESTART] Neuer Prozess konnte nicht gestartet werden:", error.message);
          process.exitCode = 1;
        }
      }
    }
  }

  function stop(signal = "shutdown", actionName = "shutdown") {
    if (stopping) return false;
    stopping = true;
    action = actionName;
    if (actionName === "shutdown" && !process.exitCode) process.exitCode = 0;
    console.log(`[STOP] ${signal} · Verbindungen werden sauber beendet`);
    try { discoverySocket?.close(); } catch {}

    const forceTimer = setTimeout(() => {
      try { server.closeAllConnections?.(); } catch {}
    }, 2500);
    forceTimer.unref?.();

    server.close((error) => {
      clearTimeout(forceTimer);
      if (error) {
        console.error("[STOP] Fehler:", error.message);
        process.exitCode = 1;
        return;
      }
      finish(actionName).catch((finishError) => {
        console.error("[STOP] Abschlussfehler:", finishError?.message || finishError);
        process.exitCode = 1;
      });
    });
    return true;
  }

  function restart(signal = "restart") {
    return stop(signal, "restart");
  }

  function shutdown(signal = "shutdown") {
    return stop(signal, "shutdown");
  }

  function status() {
    return {
      state: stopping ? action : "running",
      managedBy: underSystemd() ? "systemd" : process.platform === "win32" ? "windows" : "process",
      pid: process.pid,
      uptimeSec: Math.round(process.uptime())
    };
  }

  return { server, discoverySocket, stop: shutdown, shutdown, restart, status };
}

module.exports = { startServer, underSystemd };
