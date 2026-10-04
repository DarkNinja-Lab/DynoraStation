"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");
const { normalizeLayout } = require("../domain/layout/normalizeLayout");
const { validateLayoutPayload } = require("../domain/layout/validateLayoutPayload");
const { findRelayConflicts } = require("../domain/hardware/relayConflicts");
const { layoutVersion, requireVersion, preserveLiveStates, createLayoutHistory } = require("../services/storage/layoutVersions");

function createLayoutRoutes({ runtimeState, queueWriteLayout, addEvent }) {
  const router = express.Router();
  const history = createLayoutHistory(runtimeState);
  let transaction = Promise.resolve();
  const serialize = action => {
    const result = transaction.then(action);
    transaction = result.catch(() => {});
    return result;
  };
  async function save(input, expected, restored = false) {
    const err = validateLayoutPayload(input);
    if (err) throw apiError(400, "BAD_LAYOUT", err);
    requireVersion(runtimeState, expected);
    const next = normalizeLayout(input);
    // No runtime changes before the previous plan is durably backed up.
    try { await history.snapshot(runtimeState.layout); }
    catch { throw apiError(500, "SAVE_FAILED", "Die vorherige Planversion konnte nicht gesichert werden. Der Stationsplan wurde nicht geändert."); }
    requireVersion(runtimeState, expected);
    const previous = runtimeState.layout;
    preserveLiveStates(next, previous);
    runtimeState.layout = next;
    if ((await queueWriteLayout())?.ok === false) {
      if (runtimeState.layout === next) {
        preserveLiveStates(previous, next);
        runtimeState.layout = previous;
        runtimeState.revisions.layout++;
      }
      throw apiError(500, "SAVE_FAILED", "Speichern fehlgeschlagen. Der bisherige Plan bleibt aktiv; dein Entwurf ist noch nicht gespeichert.");
    }
    const relayConflicts = findRelayConflicts(runtimeState.layout);
    addEvent("LAYOUT", "SERVER", restored ? "Frühere Planversion wiederhergestellt" : "Layout gespeichert");
    const result = { ok: true, layout: JSON.parse(JSON.stringify(runtimeState.layout)), layoutVersion: layoutVersion(runtimeState), warnings: { relayConflicts } };
    await history.prune().catch(error => addEvent("IO", "SERVER", `Planarchiv konnte nicht aufgeräumt werden: ${error.message}`));
    return result;
  }

  router.get("/api/layout", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ...runtimeState.layout, _editVersion: layoutVersion(runtimeState) });
  });
  router.get("/api/layout/history", wrap(async (req, res) => {
    res.set("Cache-Control", "no-store");
    // Capture the version before any asynchronous read: a later edit must conflict.
    const version = layoutVersion(runtimeState);
    res.json({ versions: await history.list(), layoutVersion: version });
  }));
  router.post("/api/layout/history/:id/restore", wrap(async (req, res) => {
    res.json(await serialize(async () => {
      requireVersion(runtimeState, req.get("If-Match"));
      return save(await history.read(req.params.id), req.get("If-Match"), true);
    }));
  }));
  router.post("/api/layout", wrap(async (req, res) => {
    res.json(await serialize(() => save(req.body, req.get("If-Match"))));
  }));
  return router;
}
module.exports = { createLayoutRoutes };
