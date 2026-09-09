"use strict";

import { state } from "../core/state.js";
import { showInspector, inspectorLeer } from "./inspect.js";
import { 
  svg, attrs, drawDoubleRailLine, drawStateSegmentLine, drawTrackMarker, 
  drawCurveDual, drawSwitchShape, drawSignalShape, drawEspSignalShape, 
  drawTransformerShape, drawLabel 
} from "./shapes.js";

export function renderCanvas() {
  const svg_elem = document.getElementById("builderSvg");
  if (!svg_elem) return;

  const elementLayer = document.getElementById("builderElementLayer");
  const connectionLayer = document.getElementById("builderConnectionLayer");
  if (!elementLayer || !connectionLayer) return;

  elementLayer.innerHTML = "";
  connectionLayer.innerHTML = "";

  const elements = state.layout.elemente || [];
  console.log(`🎨 Rendering ${elements.length} elements`);

  elements.forEach(el => {
    drawElement(el, elementLayer);
  });

  updateElementCount();
}

function drawElement(element, layer) {
  const g = svg("g");
  g.classList.add("layout-element");
  g.dataset.id = element.id;
  
  if (element.id === state.selectedElement) {
    g.classList.add("selected");
  }

  g.setAttribute("transform", `translate(${element.x}, ${element.y}) rotate(${element.rotation})`);

  // Hitbox
  const hitbox = svg("rect");
  attrs(hitbox, {
    x: -80, y: -50, width: 160, height: 100,
    fill: "transparent",
    "pointer-events": "all"
  });
  g.appendChild(hitbox);

  // Draw shape
  drawElementShape(g, element);

  // Label
  if (state.showLabels !== false) {
    drawLabel(g, element, element.rotation);
  }

  // Click handler
  g.addEventListener("click", (e) => {
    e.stopPropagation();
    state.selectedElement = element.id;
    renderCanvas();
    showInspector(element);
  });

  layer.appendChild(g);
}

function drawElementShape(g, element) {
  switch (element.typ) {
    case "track":
      drawDoubleRailLine(g, -45, 0, 45, 0, "#c7c7c7", 8);
      drawStateSegmentLine(g, -20, 0, 20, 0, getTrackColor(element));
      break;

    case "curve":
      drawCurveDual(g, 110, 30, "#c7c7c7");
      break;

    case "switch":
      drawSwitchShape(g, "left", true);
      break;

    case "crossing":
      drawDoubleRailLine(g, -50, -40, 50, 40, "#c7c7c7", 8);
      drawDoubleRailLine(g, -50, 40, 50, -40, "#c7c7c7", 8);
      break;

    case "signal":
      drawSignalShape(g, element.signalState);
      break;

    case "espSignal":
      drawEspSignalShape(g, element.espState);
      break;

    case "transformer":
      drawTransformerShape(g);
      break;
  }
}

function getTrackColor(element) {
  // Hier könnte man später Sensor-Status etc. berücksichtigen
  return "#20b24d";
}

function updateElementCount() {
  const count = document.getElementById("elementCount");
  if (count) count.textContent = state.layout.elemente?.length || 0;
}

export { inspectorLeer, showInspector };
