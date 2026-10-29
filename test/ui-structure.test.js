"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Alle Editorwerkzeuge bleiben nach dem Umbau eindeutig erreichbar", () => {
  const dom = new JSDOM(read("public/index.html"));
  const document = dom.window.document;
  for (const id of ["undoButton", "redoButton", "duplicateButton", "deleteButton", "rotateLeftButton", "rotateRightButton", "disconnectButton", "saveLayoutButton", "downloadLayoutButton", "importLayoutButton", "exportPlanButton", "validatePlanButton", "applyBoardSizeButton", "clearLayoutButton"]) {
    assert.equal(document.querySelectorAll(`[id="${id}"]`).length, 1, id);
  }
  const allIds = [...document.querySelectorAll("[id]")].map(node => node.id);
  assert.equal(new Set(allIds).size, allIds.length, "Keine doppelten IDs");
  assert.equal(document.getElementById("builderLibrary").hidden, false);
  assert.equal(document.getElementById("inspector").hidden, true);
  assert.equal(document.querySelectorAll('.main-nav [data-page="builder"]').length, 1);
  dom.window.close();
});

test("Sprachwahl bietet gängige Sprachen als zugängliche Auswahl an", () => {
  const dom = new JSDOM(read("public/index.html"));
  const select = dom.window.document.getElementById("languageToggle");
  assert.equal(select.tagName, "SELECT");
  assert.equal(select.getAttribute("aria-label"), "Sprache ändern");
  assert.deepEqual([...select.options].map(option => option.value), ["de", "en", "fr", "es", "it", "nl", "pt", "pl"]);
  dom.window.close();
});

test("Locale-Auswahl normalisiert Browsercodes, setzt die Dokumentensprache und liefert Übersetzungs-Fallbacks", async () => {
  const source = read("public/app/core/i18n.js");
  const i18n = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const original = Object.fromEntries(["document", "CustomEvent", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const dispatched = [];
  const stored = {};
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: {}, dispatchEvent: event => dispatched.push(event) } });
  Object.defineProperty(globalThis, "CustomEvent", { configurable: true, value: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: (key, value) => { stored[key] = value; } } });
  try {
    assert.deepEqual(i18n.LANGUAGES.map(({ code }) => code), ["de", "en", "fr", "es", "it", "nl", "pt", "pl"]);
    assert.ok(i18n.LANGUAGES.every(({ flag }) => typeof flag === "string" && [...flag].length === 2), "Jede Sprache zeigt eine zweibuchstabige Länderflagge");
    i18n.setLanguage("en-XX");
    for (const code of ["de", "fr", "es", "it", "nl", "pt", "pl"]) {
      assert.equal(i18n.setLanguage(`${code}-XX`), code);
      assert.equal(document.documentElement.lang, code);
      assert.notEqual(i18n.t("nav.dashboard"), "nav.dashboard");
    }
    assert.equal(stored["dynora.language"], "pl");
    assert.equal(dispatched.length, i18n.LANGUAGES.length);
    assert.equal(i18n.getLocale(), "pl-PL");
    assert.equal(i18n.t("missing.translation", "Fallback"), "Fallback");
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("Artikelleiste und Eigenschaften lassen die Zeichenfläche im Layout", () => {
  const dom = new JSDOM(read("public/index.html"));
  const document = dom.window.document;
  for (const filename of ["public/style.css", "public/workspace.css"]) {
    if (!fs.existsSync(path.join(__dirname, "..", filename))) continue;
    const style = document.createElement("style");style.textContent = read(filename);document.head.appendChild(style);
  }
  const layout=document.querySelector('.builder-layout');
  const canvas=document.querySelector('.builder-canvas-area');
  const shelfResize=document.getElementById('builderShelfResize');
  assert.ok(shelfResize, 'Artikelleiste besitzt einen vertikalen Größenregler');
  assert.equal(shelfResize.getAttribute('role'), 'separator');
  for(const mode of ['library','canvas','inspector']) {
    layout.dataset.panel=mode;
    assert.equal(dom.window.getComputedStyle(layout).display,'flex');
    assert.equal(dom.window.getComputedStyle(canvas).display,'flex');
  }
  assert.equal(dom.window.getComputedStyle(document.getElementById('inspector')).position,'absolute');
  const stylesheet=read('public/style.css');
  assert.doesNotMatch(stylesheet,/builder-layout\[data-panel="inspector"\][^{]*\{[^}]*flex-direction:\s*row/,'Eigenschaften verkleinern und verschieben den Plan nicht');
  assert.ok(document.querySelector('[data-settings-section="defaults"] .defaults-guidance'));
  assert.ok(document.querySelector('[data-settings-section="rules"] .automation-guidance'));
  assert.equal(document.querySelector('.track-plan-wrapper .track-plan-overlay'),null,'Steuerung verdeckt keine Gleise');
  dom.window.close();
});

test("Operation panels collapse independently by default", () => {
  const dom = new JSDOM(read("public/index.html"));
  const document = dom.window.document;
  const sections = [...document.querySelectorAll("#page-track .operation-controls > .mobile-control-section")];
  assert.equal(sections.length, 3);
  assert.deepEqual(sections.map(section => section.querySelector(".mobile-control-toggle")?.textContent.trim()), ["Direktsteuerung", "Gleisstrom", "Anlagenlicht"]);
  assert.ok(sections.every(section => section.dataset.expanded === "false"));
  assert.ok(sections.every(section => section.querySelector(".mobile-control-toggle")?.getAttribute("aria-expanded") === "false"));
  assert.equal(new Set(sections.map(section => section.querySelector(".control-section-content")?.id)).size, 3);
  const css = read("public/style.css");
  assert.match(css, /\.mobile-control-section\[data-expanded="false"\] > \.control-section-content/);
  dom.window.close();
});

test("Plan check and status messages contain no mojibake", () => {
  for (const file of ["public/app/builder/validation.js", "public/app/track/track.js", "public/app/ui/events.js", "public/index.html"]) {
    assert.doesNotMatch(read(file), /\u00c3|\u00c2\u00b7|\u00e2\u0152/, file);
  }
});

test("USB first install guide contains WiFi and station settings", () => {
  const dom = new JSDOM(read("public/index.html"));
  const guide = [...dom.window.document.querySelectorAll("#page-settings [data-settings-section='updates'] details")].find(item => item.querySelector("summary")?.textContent.includes("Erstinstallation per USB"));
  assert.ok(guide);
  for (const id of ["wifiSsidInput", "wifiPasswordInput", "stationHostInput", "stationPortInput", "otaKeyInput", "downloadUsbSketchButton"]) assert.ok(guide.querySelector("[id='" + id + "']"), id);
  dom.window.close();
});

test("Builder und Planversionen nutzen genau ein geordnetes Stylesheet", () => {
  const dom = new JSDOM(read("public/index.html"));
  const stylesheets = [...dom.window.document.querySelectorAll('link[rel="stylesheet"]')];
  assert.equal(stylesheets.length, 1);
  assert.equal(stylesheets[0].getAttribute("href").split("?")[0], "/style.css");
  const stylesheet = read("public/style.css");
  assert.match(stylesheet, /\.plan-versions-dialog/);
  assert.match(stylesheet, /#page-builder \.editor-commandbar/);
  assert.equal(fs.existsSync(path.join(__dirname, "../public/plan-versions.css")), false);
  dom.window.close();
});
