"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? files(name) : name.endsWith(".js") ? [name] : [];
  });
}
const sources = ["src", "public/app", "scripts", "test"].flatMap(directory => files(path.join(root, directory)));
for (const file of sources) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) { process.stderr.write(result.stderr || String(result.error)); process.exit(1); }
}
console.log(`Syntax OK: ${sources.length} JavaScript-Dateien`);
