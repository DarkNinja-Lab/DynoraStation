"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { compareVersions, normalizeVersion } = require("../src/routes/update.routes");

test("Station update versions use plain dot-separated numbers", () => {
  assert.equal(normalizeVersion(" 1.0\n"), "1.0");
  assert.equal(compareVersions("1.1", "1.0"), 1);
  assert.equal(compareVersions("1.0.1", "1.0"), 1);
  assert.equal(compareVersions("1.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0", "1.2"), -1);
  assert.throws(() => compareVersions("1.1-beta", "1.0"), /dot-separated numbers/);
  assert.equal(normalizeVersion("1.0"), "1.0");
});

test("Station update page and overview link are present separately from ESP firmware", () => {
  const fs = require("node:fs");
  const html = fs.readFileSync(require("node:path").join(__dirname, "../public/index.html"), "utf8");
  assert.match(html, /data-settings-section="station-updates"/);
  assert.match(html, /data-settings-view="station-updates"/);
  assert.match(html, /data-settings-section="updates"[\s\S]*?<h2>ESP-Firmware<\/h2>/);
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM(html);
  assert.ok(dom.window.document.getElementById("dashboardUpdateStatus").closest(".overview-statusline"));
  assert.equal(dom.window.document.querySelectorAll("#page-dashboard .operations-grid > .operation-card").length, 5);
  dom.window.close();
  assert.match(fs.readFileSync(require("node:path").join(__dirname, "../version.txt"), "utf8"), /^1\.0\s*$/);
  assert.match(fs.readFileSync(require("node:path").join(__dirname, "../Dockerfile"), "utf8"), /COPY version\.txt \.\//);
});
