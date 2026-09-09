"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";

export function svg(tag) {
  return document.createElementNS(SVG_NS, tag);
}

export function attrs(el, map) {
  Object.entries(map).forEach(([k, v]) => el.setAttribute(k, String(v)));
}

export function drawDoubleRailLine(g, x1, y1, x2, y2, color = "#c5c5c5", width = 8) {
  const base = svg("line");
  attrs(base, { x1, y1, x2, y2, stroke: "#e8e8e8", "stroke-width": width + 4, "stroke-linecap": "round" });
  g.appendChild(base);

  const rail1 = svg("line");
  const rail2 = svg("line");

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * 4;
  const oy = (dx / len) * 4;

  attrs(rail1, { x1: x1 + ox, y1: y1 + oy, x2: x2 + ox, y2: y2 + oy, stroke: color, "stroke-width": 3.2, "stroke-linecap": "round" });
  attrs(rail2, { x1: x1 - ox, y1: y1 - oy, x2: x2 - ox, y2: y2 - oy, stroke: color, "stroke-width": 3.2, "stroke-linecap": "round" });

  g.appendChild(rail1);
  g.appendChild(rail2);
}

export function drawStateSegmentLine(g, x1, y1, x2, y2, stateColor) {
  const seg = svg("line");
  attrs(seg, { x1, y1, x2, y2, stroke: stateColor, "stroke-width": 8, "stroke-linecap": "round", opacity: 0.92 });
  g.appendChild(seg);
}

export function drawTrackMarker(g, x, y, angleDeg, activeColor = "#111") {
  const m = svg("g");
  m.setAttribute("transform", `translate(${x} ${y}) rotate(${angleDeg})`);

  const bg = svg("rect");
  attrs(bg, { x: -18, y: -8, width: 36, height: 16, rx: 6, fill: "#1f1f1f" });

  const bar1 = svg("rect");
  attrs(bar1, { x: -13, y: -2, width: 26, height: 4, rx: 2, fill: activeColor });

  const capL = svg("rect");
  const capR = svg("rect");
  attrs(capL, { x: -16, y: -6, width: 4, height: 12, rx: 2, fill: "#000" });
  attrs(capR, { x: 12, y: -6, width: 4, height: 12, rx: 2, fill: "#000" });

  m.append(bg, bar1, capL, capR);
  g.appendChild(m);
}

export function drawCurveDual(g, radius, angleDeg, color = "#c5c5c5") {
  const rad = (angleDeg * Math.PI) / 180;
  const offset = 5;
  const rInner = Math.max(8, radius - offset);
  const rOuter = radius + offset;

  const angleStart = Math.PI;
  const angleEnd = Math.PI + rad;

  const pInner = svg("path");
  const sxInner = -rInner;
  const syInner = 0;
  const exInner = rInner * Math.cos(angleEnd);
  const eyInner = rInner * Math.sin(angleEnd);

  const largeArc = angleDeg > 180 ? 1 : 0;
  const sweepFlag = 1;

  attrs(pInner, {
    d: `M ${sxInner} ${syInner} A ${rInner} ${rInner} 0 ${largeArc} ${sweepFlag} ${exInner} ${eyInner}`,
    fill: "none",
    stroke: color,
    "stroke-width": 3.2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });

  const pOuter = svg("path");
  const sxOuter = -rOuter;
  const syOuter = 0;
  const exOuter = rOuter * Math.cos(angleEnd);
  const eyOuter = rOuter * Math.sin(angleEnd);

  attrs(pOuter, {
    d: `M ${sxOuter} ${syOuter} A ${rOuter} ${rOuter} 0 ${largeArc} ${sweepFlag} ${exOuter} ${eyOuter}`,
    fill: "none",
    stroke: color,
    "stroke-width": 3.2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });

  const startCap = svg("line");
  attrs(startCap, {
    x1: sxInner, y1: syInner, x2: sxOuter, y2: syOuter,
    stroke: "#c7c7c7", "stroke-width": 2.4, "stroke-linecap": "round", opacity: 1.0
  });

  const endCap = svg("line");
  attrs(endCap, {
    x1: exInner, y1: eyInner, x2: exOuter, y2: eyOuter,
    stroke: "#c7c7c7", "stroke-width": 2.4, "stroke-linecap": "round", opacity: 1.0
  });

  g.append(pInner, pOuter, startCap, endCap);
}

export function drawSwitchShape(g, handed = "left", isGerade = true) {
  const sign = handed === "right" ? 1 : -1;
  const straightCol = isGerade ? "#22b24d" : "#df3b3b";
  const branchCol = isGerade ? "#df3b3b" : "#22b24d";

  drawDoubleRailLine(g, -110, 0, 110, 0, "#c7c7c7", 8);

  const branchBg = svg("path");
  attrs(branchBg, {
    d: `M -110 0 C -30 0, 15 ${-8 * sign}, 62 ${-42 * sign} C 84 ${-57 * sign}, 98 ${-66 * sign}, 110 ${-72 * sign}`,
    fill: "none",
    stroke: "#e8e8e8",
    "stroke-width": 12,
    "stroke-linecap": "round"
  });
  g.appendChild(branchBg);

  const branchRail1 = svg("path");
  const branchRail2 = svg("path");
  attrs(branchRail1, {
    d: `M -110 -3 C -30 -3, 15 ${(-8 * sign) - 3}, 62 ${(-42 * sign) - 3} C 84 ${(-57 * sign) - 3}, 98 ${(-66 * sign) - 3}, 110 ${(-72 * sign) - 3}`,
    fill: "none",
    stroke: "#c7c7c7",
    "stroke-width": 3.2,
    "stroke-linecap": "round"
  });
  attrs(branchRail2, {
    d: `M -110 3 C -30 3, 15 ${(-8 * sign) + 3}, 62 ${(-42 * sign) + 3} C 84 ${(-57 * sign) + 3}, 98 ${(-66 * sign) + 3}, 110 ${(-72 * sign) + 3}`,
    fill: "none",
    stroke: "#c7c7c7",
    "stroke-width": 3.2,
    "stroke-linecap": "round"
  });
  g.append(branchRail1, branchRail2);

  drawStateSegmentLine(g, -8, 0, 30, 0, straightCol);

  const branchSeg = svg("path");
  attrs(branchSeg, {
    d: `M -4 0 C 18 ${-2 * sign}, 42 ${-16 * sign}, 68 ${-34 * sign}`,
    fill: "none",
    stroke: branchCol,
    "stroke-width": 8,
    "stroke-linecap": "round"
  });
  g.appendChild(branchSeg);

  const tip = svg("line");
  if (isGerade) {
    attrs(tip, { x1: 86, y1: 0, x2: 108, y2: 0, stroke: "#22b24d", "stroke-width": 8, "stroke-linecap": "round" });
  } else {
    attrs(tip, { x1: 91, y1: -58 * sign, x2: 110, y2: -72 * sign, stroke: "#22b24d", "stroke-width": 8, "stroke-linecap": "round" });
  }
  g.appendChild(tip);
}

export function drawSignalShape(g, state = "halt") {
  const halt = state !== "fahrt";
  const rect = svg("rect");
  attrs(rect, { width: 20, height: 50, x: -10, y: -25, fill: "none", stroke: "#888", "stroke-width": 1 });
  g.appendChild(rect);

  const circle1 = svg("circle");
  attrs(circle1, { cx: 0, cy: -15, r: 5, fill: halt ? "#ff4444" : "#bcbcbc" });
  g.appendChild(circle1);

  const circle2 = svg("circle");
  attrs(circle2, { cx: 0, cy: 0, r: 5, fill: "#ffff44" });
  g.appendChild(circle2);

  const circle3 = svg("circle");
  attrs(circle3, { cx: 0, cy: 15, r: 5, fill: halt ? "#bcbcbc" : "#44ff44" });
  g.appendChild(circle3);
}

export function drawEspSignalShape(g, state = "halt") {
  const halt = state !== "fahrt";
  const rect = svg("rect");
  attrs(rect, { width: 30, height: 40, x: -15, y: -20, fill: "#001100", stroke: "#00ff00", "stroke-width": 2 });
  g.appendChild(rect);

  const redLed = svg("circle");
  attrs(redLed, { cx: -8, cy: -8, r: 4, fill: halt ? "#ff5252" : "#333" });
  g.appendChild(redLed);

  const greenLed = svg("circle");
  attrs(greenLed, { cx: 8, cy: -8, r: 4, fill: halt ? "#333" : "#22b24d" });
  g.appendChild(greenLed);
}

export function drawTransformerShape(g) {
  const rect = svg("rect");
  attrs(rect, { width: 40, height: 30, x: -20, y: -15, fill: "#CC6633", stroke: "#884422", "stroke-width": 2 });
  g.appendChild(rect);

  const text = svg("text");
  attrs(text, { x: 0, y: 6, "text-anchor": "middle", fill: "#fff", "font-size": 16, "font-weight": "bold" });
  text.textContent = "T";
  g.appendChild(text);
}

export function drawLabel(g, element, rotationDeg) {
  const name = String(element.name || "").trim();
  if (!name) return;

  const wrap = svg("g");
  wrap.setAttribute("transform", `rotate(${-rotationDeg})`);

  const t = svg("text");
  t.textContent = name;
  attrs(t, {
    x: 0,
    y: 28,
    fill: "#e8e8e8",
    "font-size": 12,
    "font-family": "Segoe UI, Arial, sans-serif",
    "text-anchor": "middle",
    "pointer-events": "none"
  });

  wrap.appendChild(t);
  g.appendChild(wrap);
}
