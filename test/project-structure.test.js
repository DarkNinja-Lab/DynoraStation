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

test("Installer-Menüs reagieren auf den Installationsstatus", () => {
  const linux = read("installer/DynoraStation-Linux.sh");
  const windows = read("installer/DynoraStation-Windows.cmd");

  assert.match(linux, /is_installed\(\) \{[\s\S]*?package\.json[\s\S]*?src\/server\.js/);
  assert.match(linux, /Status: Installiert[\s\S]*?Aktualisieren[\s\S]*?Reparieren \/ darüber installieren[\s\S]*?Deinstallieren/);
  assert.match(linux, /Status: Nicht installiert[\s\S]*?Installieren[\s\S]*?Abbrechen/);
  assert.match(linux, /install_action\(\) \{[\s\S]*?if \[ -f "\$CONFIG_FILE" \]; then[\s\S]*?load_config/, "Reparatur muss gespeicherte Installationsparameter übernehmen");
  assert.match(
    linux,
    /choose_action\(\) \{[\s\S]*?\} >&2[\s\S]*?IFS= read -r choice/,
    "Linux-Menü und Prompt müssen auf stderr geschrieben werden, damit ACTION=$(choose_action) nur die Aktion einfängt"
  );

  assert.match(windows, /set "DYNORA_ARGS=menu"/);
  assert.match(windows, /function Test-DynoraInstalled[\s\S]*?package\.json[\s\S]*?src\\server\.js/);
  assert.match(windows, /Status: Installiert[\s\S]*?Aktualisieren[\s\S]*?Reparieren \/ darueber installieren[\s\S]*?Deinstallieren/);
  assert.match(windows, /Status: Nicht installiert[\s\S]*?Installieren[\s\S]*?Abbrechen/);
});


test("Installer verwenden ausschließlich das feste DynoraStation-Repository", () => {
  const linux = read("installer/DynoraStation-Linux.sh");
  const windows = read("installer/DynoraStation-Windows.cmd");
  const expectedRepo = "DarkNinja-Lab/DynoraStation";

  assert.match(linux, new RegExp(`FIXED_RELEASE_REPO="${expectedRepo}"`));
  assert.match(windows, new RegExp(`\\$ReleaseRepo = '${expectedRepo}'`));
  for (const source of [linux, windows]) {
    assert.doesNotMatch(source, /__GITHUB_REPOSITORY__|DYNORA_RELEASE_REPO|--repo|GitHub Repository \(OWNER\/REPO\)/);
  }
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
