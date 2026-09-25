"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("öffentliche Installer bestehen nur aus Linux und Windows", () => {
  const installerDir = path.join(root, "installer");
  const files = fs.readdirSync(installerDir).sort();
  assert.deepEqual(files, ["DynoraStation-Linux.sh", "DynoraStation-Windows.cmd"]);
  assert.equal(fs.existsSync(path.join(root, "release")), false);
  assert.equal(fs.existsSync(path.join(root, "install-windows.cmd")), false);
});

test("keine separaten Root-Installer oder Runtime-Updater bleiben übrig", () => {
  for (const file of ["install.sh", "update.sh", "uninstall.sh", "install.ps1"]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, `${file} darf nicht mehr im Root liegen`);
  }

  const linux = read("installer/DynoraStation-Linux.sh");
  const windows = read("installer/DynoraStation-Windows.cmd");
  assert.doesNotMatch(linux, /source\/install\.sh|\/update\.sh|\/uninstall\.sh/);
  assert.match(windows, /#==DYNORA_POWERSHELL==/);
  assert.doesNotMatch(windows, /source\\install\.ps1|\\install\.ps1/);
});

test("Frontend- und Backend-Layoutversion bleiben synchron", () => {
  const backend = read("src/domain/defaults.js");
  const frontend = read("public/app/core/state.js");
  const backendVersion = Number(backend.match(/function defaultLayout\(\)[\s\S]*?version:\s*(\d+)/)?.[1]);
  const frontendVersion = Number(frontend.match(/layout:\s*\{\s*version:\s*(\d+)/)?.[1]);
  assert.equal(frontendVersion, backendVersion);
  assert.equal(backendVersion, 32);
});

test("TRUST_PROXY ist ohne expliziten Reverse Proxy standardmäßig aus", () => {
  assert.match(read(".env.example"), /^TRUST_PROXY=false$/m);
  assert.match(read("src/config/env.js"), /TRUST_PROXY\s*=\s*parseState\(process\.env\.TRUST_PROXY\s*\?\?\s*"false"\)/);
});

test("Browser-Mutationen sind bei deaktiviertem CORS Same-Origin-geschützt", () => {
  const app = read("src/app/configureApp.js");
  assert.match(app, /ORIGIN_FORBIDDEN/);
  assert.match(app, /key: \(_req, ip\) => ip/);
});

test("öffentliche Installer erzwingen SHA-256-Prüfung", () => {
  const linux = read("installer/DynoraStation-Linux.sh");
  const windows = read("installer/DynoraStation-Windows.cmd");
  assert.match(linux, /SHA-256-Prüfung des Release-Pakets fehlgeschlagen/);
  assert.match(linux, /SHA-256-Prüfung des Installers fehlgeschlagen/);
  assert.match(windows, /SHA-256-Pruefung des Release-Pakets fehlgeschlagen/);
  assert.match(linux, /SHA256SUMS\.txt/);
  assert.match(windows, /SHA256SUMS\.txt/);
});
