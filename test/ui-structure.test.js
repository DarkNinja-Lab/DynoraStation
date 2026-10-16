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

test("Artikelleiste und Eigenschaften lassen die Zeichenfläche im Layout", () => {
  const dom = new JSDOM(read("public/index.html"));
  const document = dom.window.document;
  for (const filename of ["public/style.css", "public/workspace.css"]) {
    if (!fs.existsSync(path.join(__dirname, "..", filename))) continue;
    const style = document.createElement("style");style.textContent = read(filename);document.head.appendChild(style);
  }
  const layout=document.querySelector('.builder-layout');
  const canvas=document.querySelector('.builder-canvas-area');
  for(const mode of ['library','canvas','inspector']) {
    layout.dataset.panel=mode;
    assert.equal(dom.window.getComputedStyle(layout).display,'flex');
    assert.equal(dom.window.getComputedStyle(canvas).display,'flex');
  }
  assert.equal(dom.window.getComputedStyle(document.getElementById('inspector')).position,'absolute');
  assert.equal(document.querySelector('.track-plan-wrapper .track-plan-overlay'),null,'Steuerung verdeckt keine Gleise');
  dom.window.close();
});
