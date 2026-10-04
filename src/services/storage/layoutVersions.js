"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { apiError } = require("../../utils/errors");

const LIVE_FIELDS = ["powerState", "switchState", "signalState", "xState", "ledState", "espState"];
const LIMIT = 20;
function structure(layout) {
  const copy = JSON.parse(JSON.stringify(layout));
  delete copy._editVersion;
  for (const item of copy.elemente || []) for (const key of LIVE_FIELDS) delete item[key];
  for (const item of copy.stromkreise || []) delete item.state;
  return copy;
}
function layoutVersion(runtimeState) {
  return `${runtimeState.instanceId}:${createHash("sha256").update(JSON.stringify(structure(runtimeState.layout))).digest("hex")}`;
}
function requireVersion(runtimeState, expected) {
  if (!expected) throw apiError(428, "LAYOUT_VERSION_REQUIRED", "Bitte die Seite neu laden: Dieser Client unterstützt den Speicherschutz noch nicht.");
  if (expected !== layoutVersion(runtimeState)) throw apiError(409, "LAYOUT_CONFLICT", "Der Stationsplan wurde inzwischen geändert. Dein Entwurf bleibt erhalten. Lade den aktuellen Stationsplan, bevor du erneut speicherst.");
}
// Saving a plan must not rewind states already confirmed by the hardware.
function preserveLiveStates(next, current) {
  const elements = new Map((current.elemente || []).map(item => [item.id, item]));
  for (const item of next.elemente || []) {
    const previous = elements.get(item.id);
    if (!previous || previous.typ !== item.typ || previous.module !== item.module) continue;
    for (const key of LIVE_FIELDS) if (Object.hasOwn(previous, key)) item[key] = previous[key];
  }
  const circuits = new Map((current.stromkreise || []).map(item => [item.id, item]));
  for (const item of next.stromkreise || []) {
    const previous = circuits.get(item.id);
    if (previous && previous.module === item.module && previous.relay === item.relay) item.state = previous.state;
  }
}
function createLayoutHistory(runtimeState) {
  const directory = path.join(runtimeState.paths.DATA_DIR, "layout-history");
  const fileFor = id => {
    if (!/^\d{13}-[a-f0-9-]{36}$/.test(id)) throw apiError(400, "BAD_VERSION_ID", "Ungültige Planversion.");
    return path.join(directory, `${id}.json`);
  };
  async function list() {
    let names;
    try { names = await fs.readdir(directory); } catch (err) { if (err.code === "ENOENT") return []; throw err; }
    const versions = [];
    for (const name of names.filter(n => /^\d{13}-[a-f0-9-]{36}\.json$/.test(n)).sort().reverse()) {
      try {
        const data = JSON.parse(await fs.readFile(path.join(directory, name), "utf8"));
        versions.push({ id: name.slice(0, -5), savedAt: data.savedAt, name: data.layout.metadaten?.name || "Anlagenplan", elements: data.layout.elemente.length });
      } catch { /* A damaged backup must not hide the remaining versions. */ }
    }
    return versions;
  }
  async function snapshot(layout) {
    await fs.mkdir(directory, { recursive: true });
    const savedAt = Date.now(), id = `${savedAt}-${randomUUID()}`;
    const file = fileFor(id), temp = `${file}.tmp`;
    try {
      await fs.writeFile(temp, JSON.stringify({ savedAt, layout }, null, 2), { encoding: "utf8", flag: "wx" });
      await fs.rename(temp, file);
    } finally { await fs.unlink(temp).catch(() => {}); }
    return id;
  }
  async function prune() {
    for (const item of (await list()).slice(LIMIT)) await fs.unlink(fileFor(item.id));
  }
  async function read(id) {
    try { return JSON.parse(await fs.readFile(fileFor(id), "utf8")).layout; }
    catch (err) { if (err.code === "ENOENT") throw apiError(404, "VERSION_NOT_FOUND", "Diese Planversion ist nicht mehr vorhanden."); throw err; }
  }
  return { list, snapshot, prune, read };
}
module.exports = { layoutVersion, requireVersion, preserveLiveStates, createLayoutHistory };
