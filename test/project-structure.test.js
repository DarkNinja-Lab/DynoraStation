"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("main enthält keine Installer- oder Release-Runtime-Artefakte", () => {
  for (const relativePath of [
    "installer",
    "release",
    "dist",
    "install.sh",
    "update.sh",
    "uninstall.sh",
    "install.ps1",
    "install-windows.cmd",
    "DynoraStation-Linux.sh",
    "DynoraStation-Windows.cmd",
  ]) {
    assert.equal(
      fs.existsSync(path.join(root, relativePath)),
      false,
      `${relativePath} ist Release-only bzw. Runtime-Artefakt und darf nicht in main liegen`,
    );
  }
});

test("main enthält keinen automatischen Release-Build für Installer", () => {
  assert.equal(fs.existsSync(path.join(root, ".github/workflows/release.yml")), false);
});

test("Release-only Installer werden durch gitignore geschützt", () => {
  const gitignore = read(".gitignore");
  assert.match(gitignore, /^installer\/$/m);
  assert.match(gitignore, /^DynoraStation-Linux\.sh$/m);
  assert.match(gitignore, /^DynoraStation-Windows\.cmd$/m);
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

test("Dokumentation beschreibt Release-only Installer und main als Updatekanal", () => {
  const readme = read("README.md");
  const technical = read("TECHNICAL.md");
  for (const source of [readme, technical]) {
    assert.match(source, /DarkNinja-Lab\/DynoraStation/);
    assert.match(source, /main/);
  }
  assert.match(readme, /ausschließlich[\s\S]*DynoraStation-Linux\.sh[\s\S]*DynoraStation-Windows\.cmd/i);
  assert.match(readme, /keine Runtime-Archive/);
});
