"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

export function ensureCanvasGeometry() {
  const svg = document.getElementById("builderSvg");
  if (svg && !svg.viewBox.baseVal.width) {
    svg.setAttribute("viewBox", "0 0 1600 900");
  }
  const trackSvg = document.getElementById("trackSvg");
  if (trackSvg && !trackSvg.viewBox.baseVal.width) {
    trackSvg.setAttribute("viewBox", "0 0 1600 900");
  }
}

export function setupBuilderButtons() {
  console.log("🔧 Setup Builder Buttons...");

  if (!state.layout.elemente) {
    state.layout.elemente = [];
  }
  if (!state.layout.verbindungen) {
    state.layout.verbindungen = [];
  }

  // Add element buttons
  document.querySelectorAll(".add-element-button").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const type = btn.dataset.add;
      
      // Hole den ausgewählten Wert aus dem Select
      let label = type;
      if (type === "track") {
        const select = document.getElementById("trackTypeSelect");
        label = select?.value || "5107";
      } else if (type === "curve") {
        const select = document.getElementById("curveTypeSelect");
        label = select?.value || "5100";
      } else if (type === "switch") {
        const select = document.getElementById("switchTypeSelect");
        label = select?.value || "5202 links";
      } else if (type === "crossing") {
        const select = document.getElementById("xTrackTypeSelect");
        label = select?.value || "5128 Kreuzungsgleis";
      }
      
      console.log(`📦 Adding element: ${type} (${label})`);
      addElement(type, label);
    });
  });

  // Save Layout
  const saveBtn = document.getElementById("saveLayoutButton");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      console.log("💾 Saving layout...");
      try {
        await apiCall("/layout/save", {
          method: "POST",
          body: state.layout
        });
        showToast("✅ Layout gespeichert!");
      } catch (e) {
        console.error(e);
        showToast("❌ Fehler beim Speichern!", "error");
      }
    });
  }

  // Clear Layout
  const clearBtn = document.getElementById("clearLayoutButton");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("Wirklich leeren?")) {
        state.layout.elemente = [];
        state.layout.verbindungen = [];
        renderCanvas();
        showToast("🗑️ Layout geleert");
      }
    });
  }

  console.log("✅ Builder Buttons ready");
}

function addElement(type, label) {
  if (!state.layout.elemente) {
    state.layout.elemente = [];
  }

  const id = "elem_" + Math.random().toString(36).substr(2, 9);
  const newElement = {
    id,
    type,
    label,
    x: 400 + Math.random() * 200,
    y: 300 + Math.random() * 200,
    rotation: 0,
    properties: {}
  };

  state.layout.elemente.push(newElement);
  renderCanvas();
  showToast(`✅ ${label} hinzugefügt`);
  console.log(`Element added:`, newElement);
}

function renderCanvas() {
  const svg = document.getElementById("builderSvg");
  if (!svg) return;

  const elementLayer = document.getElementById("builderElementLayer");
  if (!elementLayer) return;

  elementLayer.innerHTML = "";

  const elements = state.layout.elemente || [];
  console.log(`Rendering ${elements.length} elements`);

  elements.forEach(el => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("data-id", el.id);
    g.setAttribute("transform", `translate(${el.x}, ${el.y}) rotate(${el.rotation})`);
    g.classList.add("element", `element-${el.type}`);
    g.style.cursor = "pointer";

    // Zeichne Gleiselemente in H0-ähnlicher Form
    drawTrackElement(g, el.type, el.label);

    g.addEventListener("click", (e) => {
      e.stopPropagation();
      selectElement(el.id);
    });

    elementLayer.appendChild(g);
  });

  updateElementCount();
}

function drawTrackElement(g, type, label) {
  const stroke = "#888";
  const strokeWidth = "2";

  if (type === "track") {
    // Gerades Gleis - zwei Schienen
    const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line1.setAttribute("x1", "-40");
    line1.setAttribute("y1", "-8");
    line1.setAttribute("x2", "40");
    line1.setAttribute("y2", "-8");
    line1.setAttribute("stroke", stroke);
    line1.setAttribute("stroke-width", strokeWidth);
    g.appendChild(line1);

    const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line2.setAttribute("x1", "-40");
    line2.setAttribute("y1", "8");
    line2.setAttribute("x2", "40");
    line2.setAttribute("y2", "8");
    line2.setAttribute("stroke", stroke);
    line2.setAttribute("stroke-width", strokeWidth);
    g.appendChild(line2);

    addLabel(g, label || "track");
  } else if (type === "curve") {
    // Kurve - bogenförmig
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M -35,-8 A 40,40 0 0,0 -8,35");
    path.setAttribute("stroke", stroke);
    path.setAttribute("stroke-width", strokeWidth);
    path.setAttribute("fill", "none");
    g.appendChild(path);

    const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path2.setAttribute("d", "M -35,8 A 40,40 0 0,0 8,35");
    path2.setAttribute("stroke", stroke);
    path2.setAttribute("stroke-width", strokeWidth);
    path2.setAttribute("fill", "none");
    g.appendChild(path2);

    addLabel(g, "↻");
  } else if (type === "switch") {
    // Weiche - Y-Form
    const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line1.setAttribute("x1", "-40");
    line1.setAttribute("y1", "-8");
    line1.setAttribute("x2", "0");
    line1.setAttribute("y2", "0");
    line1.setAttribute("stroke", stroke);
    line1.setAttribute("stroke-width", strokeWidth);
    g.appendChild(line1);

    const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line2.setAttribute("x1", "0");
    line2.setAttribute("y1", "0");
    line2.setAttribute("x2", "30");
    line2.setAttribute("y2", "-15");
    line2.setAttribute("stroke", stroke);
    line2.setAttribute("stroke-width", strokeWidth);
    g.appendChild(line2);

    const line3 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line3.setAttribute("x1", "0");
    line3.setAttribute("y1", "0");
    line3.setAttribute("x2", "30");
    line3.setAttribute("y2", "15");
    line3.setAttribute("stroke", stroke);
    line3.setAttribute("stroke-width", strokeWidth);
    g.appendChild(line3);

    addLabel(g, "⑂");
  } else if (type === "crossing") {
    // Kreuzungsweiche - X-Form
    const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line1.setAttribute("x1", "-35");
    line1.setAttribute("y1", "-8");
    line1.setAttribute("x2", "35");
    line1.setAttribute("y2", "8");
    line1.setAttribute("stroke", stroke);
    line1.setAttribute("stroke-width", strokeWidth);
    g.appendChild(line1);

    const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line2.setAttribute("x1", "-35");
    line2.setAttribute("y1", "8");
    line2.setAttribute("x2", "35");
    line2.setAttribute("y2", "-8");
    line2.setAttribute("stroke", stroke);
    line2.setAttribute("stroke-width", strokeWidth);
    g.appendChild(line2);

    addLabel(g, "✕");
  } else if (type === "signal") {
    // Hauptsignal - Ampel-Symbol
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "20");
    rect.setAttribute("height", "50");
    rect.setAttribute("x", "-10");
    rect.setAttribute("y", "-25");
    rect.setAttribute("fill", "none");
    rect.setAttribute("stroke", stroke);
    rect.setAttribute("stroke-width", "1");
    g.appendChild(rect);

    const circle1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle1.setAttribute("cx", "0");
    circle1.setAttribute("cy", "-15");
    circle1.setAttribute("r", "5");
    circle1.setAttribute("fill", "#ff4444");
    g.appendChild(circle1);

    const circle2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle2.setAttribute("cx", "0");
    circle2.setAttribute("cy", "0");
    circle2.setAttribute("r", "5");
    circle2.setAttribute("fill", "#ffff44");
    g.appendChild(circle2);

    const circle3 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle3.setAttribute("cx", "0");
    circle3.setAttribute("cy", "15");
    circle3.setAttribute("r", "5");
    circle3.setAttribute("fill", "#44ff44");
    g.appendChild(circle3);

    addLabel(g, "🚦");
  } else if (type === "espSignal") {
    // ESP Signal - LED-Stripe
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "30");
    rect.setAttribute("height", "40");
    rect.setAttribute("x", "-15");
    rect.setAttribute("y", "-20");
    rect.setAttribute("fill", "#001100");
    rect.setAttribute("stroke", "#00ff00");
    rect.setAttribute("stroke-width", "2");
    g.appendChild(rect);

    addLabel(g, "💡");
  } else if (type === "transformer") {
    // Trafo - Spule-Symbol
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "40");
    rect.setAttribute("height", "30");
    rect.setAttribute("x", "-20");
    rect.setAttribute("y", "-15");
    rect.setAttribute("fill", "#CC6633");
    rect.setAttribute("stroke", "#884422");
    rect.setAttribute("stroke-width", "2");
    g.appendChild(rect);

    addLabel(g, "⚡");
  }
}

function addLabel(g, label) {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dy", "30");
  text.setAttribute("fill", "#fff");
  text.setAttribute("font-size", "11");
  text.setAttribute("font-weight", "bold");
  text.textContent = String(label).substring(0, 8);
  g.appendChild(text);
}

function selectElement(id) {
  state.selectedElement = id;
  const inspector = document.getElementById("inspector");
  if (!inspector) return;

  const el = (state.layout.elemente || []).find(e => e.id === id);
  if (!el) return;

  inspector.innerHTML = `
    <div class="inspector-content" style="padding: 12px;">
      <strong>${el.type.toUpperCase()}</strong>
      <div style="margin-top: 8px; font-size: 12px; color: #aaa;">
        <p><strong>Label:</strong> ${el.label}</p>
        <p><strong>ID:</strong> ${el.id}</p>
        <p><strong>Position:</strong> X: ${el.x.toFixed(0)}, Y: ${el.y.toFixed(0)}</p>
        <p><strong>Rotation:</strong> ${el.rotation}°</p>
      </div>
      <button class="delete-button" style="width: 100%; margin-top: 10px; padding: 6px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">⌫ Löschen</button>
    </div>
  `;

  inspector.querySelector(".delete-button").addEventListener("click", () => {
    state.layout.elemente = (state.layout.elemente || []).filter(e => e.id !== id);
    renderCanvas();
    inspectorLeer();
  });
}

function updateElementCount() {
  const count = document.getElementById("elementCount");
  if (count) count.textContent = (state.layout.elemente || []).length;
}

function showToast(message, type = "success") {
  const stack = document.getElementById("toastStack");
  if (!stack) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    padding: 12px 16px;
    margin: 8px;
    background: ${type === "error" ? "#f44336" : "#4caf50"};
    color: white;
    border-radius: 4px;
    font-size: 14px;
    animation: slideIn 0.3s ease;
  `;
  stack.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

export function inspectorLeer() {
  const inspector = document.getElementById("inspector");
  if (inspector) {
    inspector.innerHTML = `
      <div class="inspector-empty">
        <div class="inspector-empty-icon">◇</div>
        <strong>Kein Element ausgewählt</strong>
        <span>Klicke ein Element an zum Bearbeiten.</span>
      </div>
    `;
  }
}