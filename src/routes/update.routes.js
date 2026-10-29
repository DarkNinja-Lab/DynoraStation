"use strict";

const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const { wrap } = require("../utils/errors");

const REPOSITORY = "DarkNinja-Lab/DynoraStation";
const VERSION_URL = `https://raw.githubusercontent.com/${REPOSITORY}/main/version.txt`;
const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;

function normalizeVersion(value) {
  return String(value || "").trim();
}

function compareVersions(left, right) {
  const parse = value => {
    const version = normalizeVersion(value);
    if (!/^\d+(?:\.\d+)*$/.test(version)) throw new TypeError("Versions must contain only dot-separated numbers, for example 1.0.");
    return version.split(".").map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x === y) continue;
    return x > y ? 1 : -1;
  }
  return 0;
}

function createUpdateRoutes({ runtimeState, stationControl }) {
  const router = express.Router();

  router.get("/api/update/status", wrap(async (_req, res) => {
    let localVersion;
    try {
      localVersion = fs.readFileSync(path.join(runtimeState.paths.PROJECT_DIR, "version.txt"), "utf8").trim();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      localVersion = "0.0"; // Older installs predate the marker and should be offered the 1.0 baseline.
    }
    if (!/^\d+(?:\.\d+)*$/.test(localVersion)) throw new Error("Die lokale version.txt muss eine numerische Version wie 1.0 enthalten.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let remoteVersion = "";
    let checkError = "";
    try {
      const response = await fetch(VERSION_URL, {
        headers: { "User-Agent": "DynoraStation-Update-Check", Accept: "text/plain" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`GitHub antwortet mit HTTP ${response.status}`);
      remoteVersion = (await response.text()).trim().split(/\r?\n/, 1)[0];
      if (!/^\d+(?:\.\d+)*$/.test(remoteVersion) || remoteVersion.length > 40) throw new Error("Die version.txt auf GitHub muss eine numerische Version wie 1.0 enthalten.");
    } catch (error) {
      checkError = error.name === "AbortError" ? "Zeitüberschreitung beim Abruf von GitHub." : error.message;
    } finally {
      clearTimeout(timer);
    }
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      localVersion,
      remoteVersion,
      updateAvailable: Boolean(remoteVersion) && compareVersions(remoteVersion, localVersion) > 0,
      repositoryUrl: REPOSITORY_URL,
      sourceBranch: "main",
      managedBy: typeof stationControl?.status === "function" ? stationControl.status().managedBy : "unknown",
      checkedAt: Date.now(),
      checkError
    });
  }));

  return router;
}

module.exports = { createUpdateRoutes, normalizeVersion, compareVersions };
