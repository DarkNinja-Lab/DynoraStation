"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

test("Kurvengleise zeichnen parallele Schienen mit konstantem Abstand", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousDocument = global.document;
  global.document = dom.window.document;
  try {
    const { drawCurveDual } = await import("../public/app/builder/shapes.js");
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    drawCurveDual(group, 180, 30);
    const paths = [...group.querySelectorAll("path")];
    const railPaths = paths.filter((path) => path.getAttribute("stroke-width") === "2.7");
    assert.equal(railPaths.length, 2);
    const halfAngle = Math.PI / 12;
    const expected = [184.5, 175.5];
    railPaths.forEach((path, index) => {
      const match = path.getAttribute("d").match(/^M\s*(-?[\d.]+)\s*(-?[\d.]+)\s+A\s+([\d.]+)\s+\3\s+0\s+0\s+1\s+([\d.]+)\s+(-?[\d.]+)$/);
      assert.ok(match, path.getAttribute("d"));
      const [, rawStartX, rawStartY, rawRadius, rawEndX, rawEndY] = match;
      const [startX, startY, radius, endX, endY] = [rawStartX, rawStartY, rawRadius, rawEndX, rawEndY].map(Number);
      assert.ok(Math.abs(radius - expected[index]) < 1e-6);
      assert.ok(Math.abs(startX + radius * Math.sin(halfAngle)) < 1e-6);
      assert.ok(Math.abs(endX - radius * Math.sin(halfAngle)) < 1e-6);
      assert.ok(Math.abs(startY - endY) < 1e-6);
      const expectedOffset = (180 - radius) * Math.cos(halfAngle);
      assert.ok(Math.abs(startY - expectedOffset) < 1e-6);
    });
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
    dom.window.close();
  }
});