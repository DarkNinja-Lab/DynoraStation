"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";

export function svg(tag) {
  return document.createElementNS(SVG_NS, tag);
}

export function attrs(el, map) {
  Object.entries(map).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") {
      el.removeAttribute(k);
      return;
    }
    el.setAttribute(k, String(v));
  });
}

export function drawDoubleRailLine(g, x1, y1, x2, y2, color = "#c5c5c5", width = 8) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * 4.5;
  const oy = (dx / len) * 4.5;

  const bed = svg("line");
  attrs(bed, { x1, y1, x2, y2, stroke: "#3c4650", "stroke-width": width + 9, "stroke-linecap": "round" });
  g.appendChild(bed);

  const sleeperCount = Math.max(3, Math.floor(len / 13));
  for (let i = 0; i <= sleeperCount; i += 1) {
    const ratio = i / sleeperCount;
    const cx = x1 + dx * ratio;
    const cy = y1 + dy * ratio;
    const sleeper = svg("line");
    attrs(sleeper, { x1: cx + ox * 1.5, y1: cy + oy * 1.5, x2: cx - ox * 1.5, y2: cy - oy * 1.5, stroke: "#77818a", "stroke-width": 2.2, "stroke-linecap": "round" });
    g.appendChild(sleeper);
  }

  const rail1 = svg("line");
  const rail2 = svg("line");

  attrs(rail1, { x1: x1 + ox, y1: y1 + oy, x2: x2 + ox, y2: y2 + oy, stroke: color, "stroke-width": 2.7, "stroke-linecap": "round" });
  attrs(rail2, { x1: x1 - ox, y1: y1 - oy, x2: x2 - ox, y2: y2 - oy, stroke: color, "stroke-width": 2.7, "stroke-linecap": "round" });

  g.appendChild(rail1);
  g.appendChild(rail2);
  const contacts = svg("line");
  attrs(contacts, { x1, y1, x2, y2, stroke: "#d8dde1", "stroke-width": 1.4, "stroke-dasharray": "1 9", "stroke-linecap": "round", opacity: .85 });
  g.appendChild(contacts);
}

export function drawStateSegmentLine(g, x1, y1, x2, y2, stateColor) {
  const seg = svg("line");
  attrs(seg, { x1, y1, x2, y2, stroke: stateColor, "stroke-width": 8, "stroke-linecap": "round", opacity: 0.92 });
  g.appendChild(seg);
}

export function drawPowerLine(g, x1, y1, x2, y2, color = "#32f29a") {
  const glow = svg("line");
  attrs(glow, { x1, y1, x2, y2, stroke: color, "stroke-width": 13, "stroke-linecap": "round", opacity: .22 });
  const core = svg("line");
  attrs(core, { x1, y1, x2, y2, stroke: color, "stroke-width": 6, "stroke-linecap": "round", opacity: .98 });
  g.append(glow, core);
}

export function drawUncouplerShape(g, geometry = {}, active = false, occupied = false) {
  const half = Math.max(30, Number(geometry.length || 90) * .25);
  const railColor = occupied ? "#ff5f69" : "#d5dbe0";
  drawDoubleRailLine(g, -half, 0, half, 0, railColor, 8);

  const plate = svg("rect");
  attrs(plate, {
    x: -13, y: -12, width: 26, height: 24, rx: 5,
    fill: active ? "#2d8f68" : "#202b34",
    stroke: active ? "#71edba" : "#83919d",
    "stroke-width": 1.8
  });
  const ramp = svg("path");
  attrs(ramp, {
    d: "M -8 5 L 0 -6 L 8 5 M 0 -6 V 8",
    fill: "none",
    stroke: active ? "#eafff4" : "#c7d0d6",
    "stroke-width": 2.2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });
  const coil = svg("circle");
  attrs(coil, { cx: 0, cy: 0, r: 16, fill: "none", stroke: active ? "#32f29a" : "#536675", "stroke-width": active ? 2.4 : 1.4, opacity: active ? .9 : .7 });
  g.append(coil, plate, ramp);
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
  const r = Math.max(35, Number(radius) || 180);
  const angle = Math.max(2, Math.min(90, Number(angleDeg) || 30));
  const chord = 2 * r * Math.sin((angle * Math.PI / 180) / 2);
  const x1 = -chord / 2;
  const x2 = chord / 2;
  const centerPath = `M ${x1} 0 A ${r} ${r} 0 0 1 ${x2} 0`;
  const bed = svg("path");
  attrs(bed, { d: centerPath, fill: "none", stroke: "#3c4650", "stroke-width": 17, "stroke-linecap": "round" });
  const outer = svg("path");
  attrs(outer, { d: `M ${x1} -4.5 A ${r + 4.5} ${r + 4.5} 0 0 1 ${x2} -4.5`, fill: "none", stroke: color, "stroke-width": 2.7, "stroke-linecap": "round" });
  const inner = svg("path");
  attrs(inner, { d: `M ${x1} 4.5 A ${Math.max(12, r - 4.5)} ${Math.max(12, r - 4.5)} 0 0 1 ${x2} 4.5`, fill: "none", stroke: color, "stroke-width": 2.7, "stroke-linecap": "round" });
  const contacts = svg("path");
  attrs(contacts, { d: centerPath, fill: "none", stroke: "#d8dde1", "stroke-width": 1.4, "stroke-dasharray": "1 9", "stroke-linecap": "round" });
  g.append(bed, outer, inner, contacts);
}

export function drawPowerCurve(g, radius, angleDeg, color = "#32f29a") {
  const r = Math.max(35, Number(radius) || 180);
  const angle = Math.max(2, Math.min(90, Number(angleDeg) || 30));
  const chord = 2 * r * Math.sin((angle * Math.PI / 180) / 2);
  const pathData = `M ${-chord / 2} 0 A ${r} ${r} 0 0 1 ${chord / 2} 0`;
  const glow = svg("path");
  attrs(glow, { d: pathData, fill: "none", stroke: color, "stroke-width": 13, "stroke-linecap": "round", opacity: .22 });
  const core = svg("path");
  attrs(core, { d: pathData, fill: "none", stroke: color, "stroke-width": 6, "stroke-linecap": "round", opacity: .98 });
  g.append(glow, core);
}

function curvedRoutePath(startX, radius, angle, sign, offset = 0) {
  const adjustedRadius = Math.max(20, radius - sign * offset);
  const endX = startX + adjustedRadius * Math.sin(angle);
  const endY = offset + sign * adjustedRadius * (1 - Math.cos(angle));
  const sweep = sign > 0 ? 1 : 0;
  return `M ${startX} ${offset} A ${adjustedRadius} ${adjustedRadius} 0 0 ${sweep} ${endX} ${endY}`;
}

function drawCurvedTurnoutRoute(g, startX, radius, angle, sign, railColor) {
  const centerPath = curvedRoutePath(startX, radius, angle, sign);
  const bed = svg("path");
  attrs(bed, { d: centerPath, fill: "none", stroke: "#3c4650", "stroke-width": 18, "stroke-linecap": "round" });
  g.appendChild(bed);

  const sleepers = Math.max(8, Math.round(radius * angle / 13));
  for (let index = 0; index <= sleepers; index += 1) {
    const t = angle * index / sleepers;
    const cx = startX + radius * Math.sin(t);
    const cy = sign * radius * (1 - Math.cos(t));
    const nx = Math.sin(t);
    const ny = -sign * Math.cos(t);
    const sleeper = svg("line");
    attrs(sleeper, {
      x1: cx - nx * 8, y1: cy - ny * 8,
      x2: cx + nx * 8, y2: cy + ny * 8,
      stroke: "#77818a", "stroke-width": 2.1, "stroke-linecap": "round"
    });
    g.appendChild(sleeper);
  }

  [-4.5, 4.5].forEach((offset) => {
    const rail = svg("path");
    attrs(rail, { d: curvedRoutePath(startX, radius, angle, sign, offset), fill: "none", stroke: railColor, "stroke-width": 2.7, "stroke-linecap": "round" });
    g.appendChild(rail);
  });
  const contacts = svg("path");
  attrs(contacts, { d: centerPath, fill: "none", stroke: "#d8dde1", "stroke-width": 1.4, "stroke-dasharray": "1 9", "stroke-linecap": "round", opacity: .86 });
  g.appendChild(contacts);
  return centerPath;
}

function turnout5141Geometry(geometry, sign) {
  const scale = .5;
  const innerRadius = Math.max(250, Number(geometry.radius) || 360) * scale;
  const outerRadius = Math.max(innerRadius, Math.max(250, Number(geometry.branchRadius) || 437.4) * scale);
  const innerAngleDeg = Math.max(10, Math.min(40, Number(geometry.angleDeg) || 30));
  const outerAngleDeg = Math.max(innerAngleDeg + 4, Math.min(48, Number(geometry.branchAngleDeg) || 38));
  const innerAngle = innerAngleDeg * Math.PI / 180;
  const outerAngle = outerAngleDeg * Math.PI / 180;
  const outerSpan = outerRadius * Math.sin(outerAngle);
  const startX = -outerSpan / 2;
  return {
    startX, innerRadius, outerRadius, innerAngle, outerAngle,
    innerEnd: { x: startX + innerRadius * Math.sin(innerAngle), y: sign * innerRadius * (1 - Math.cos(innerAngle)), angle: sign * innerAngleDeg },
    outerEnd: { x: startX + outerSpan, y: sign * outerRadius * (1 - Math.cos(outerAngle)), angle: sign * outerAngleDeg }
  };
}

function draw5141Turnout(g, sign, isGerade, railColor, activeRoute, passiveRoute, geometry) {
  const layout = turnout5141Geometry(geometry, sign);
  const innerPath = drawCurvedTurnoutRoute(g, layout.startX, layout.innerRadius, layout.innerAngle, sign, railColor);
  const outerPath = drawCurvedTurnoutRoute(g, layout.startX, layout.outerRadius, layout.outerAngle, sign, railColor);

  [{ path: innerPath, active: !isGerade }, { path: outerPath, active: isGerade }].forEach((route) => {
    const stateRoute = svg("path");
    attrs(stateRoute, { d: route.path, fill: "none", stroke: route.active ? activeRoute : passiveRoute, "stroke-width": route.active ? 4.6 : 2.6, "stroke-linecap": "round", opacity: route.active ? .96 : .65 });
    g.appendChild(stateRoute);
  });

  const splitX = layout.startX + layout.innerRadius * Math.sin(layout.innerAngle * .42);
  const splitY = sign * layout.innerRadius * (1 - Math.cos(layout.innerAngle * .42));
  const blade = svg("path");
  attrs(blade, { d: `M ${layout.startX + 12} ${sign * 1.8} Q ${layout.startX + 31} ${sign * 3.5} ${splitX} ${splitY}`, fill: "none", stroke: "#eef1f2", "stroke-width": 2.2, "stroke-linecap": "round" });
  const frog = svg("path");
  attrs(frog, { d: `M ${splitX - 5} ${splitY} L ${splitX + 10} ${splitY + sign * 7} M ${splitX} ${splitY + sign * 7} L ${splitX + 14} ${splitY + sign * 1}`, fill: "none", stroke: "#e4e7e8", "stroke-width": 2, "stroke-linecap": "round" });
  const lanternX = layout.startX + 20;
  const lanternY = sign * 22;
  const lanternBase = svg("circle");
  attrs(lanternBase, { cx: lanternX, cy: lanternY, r: 8, fill: "#171a1c", stroke: "#9d7339", "stroke-width": 1.5 });
  const marker = svg("path");
  attrs(marker, { d: "M -5 -4 L 5 0 L -5 4 Z", transform: `translate(${lanternX} ${lanternY}) rotate(${isGerade ? sign * 18 : sign * 36})`, fill: "#fff4d2", stroke: "#a56a11", "stroke-width": 1.2 });
  g.append(blade, frog, lanternBase, marker);
}

export function drawSwitchShape(g, handed = "left", isGerade = true, geometry = {}, occupied = false) {
  const sign = handed === "right" ? 1 : -1;
  const scale = .5;
  const length = Math.max(120, Number(geometry.length) || 180) * scale;
  const radius = Math.max(250, Number(geometry.radius) || 437.4) * scale;
  const angle = Math.max(10, Math.min(40, Number(geometry.angleDeg) || 24.2833));
  const half = length / 2;
  const a = angle * Math.PI / 180;
  const branchX = -half + radius * Math.sin(a);
  const branchY = sign * radius * (1 - Math.cos(a));
  const activeRoute = "#f6b94c";
  const passiveRoute = "#566675";
  const straightCol = isGerade ? activeRoute : passiveRoute;
  const branchCol = isGerade ? passiveRoute : activeRoute;
  const railColor = occupied ? "#ff5f69" : "#c7c7c7";

  if (geometry.switchStyle === "curved") {
    if (geometry.switchGeometry === "5141") {
      draw5141Turnout(g, sign, isGerade, railColor, activeRoute, passiveRoute, geometry);
      return;
    }
    const outerRadius = Math.max(radius, (Number(geometry.branchRadius) || 437.4) * scale);
    const startX = -(outerRadius * Math.sin(a)) / 2;
    const innerY = sign * radius * (1 - Math.cos(a));
    const outerY = sign * outerRadius * (1 - Math.cos(a));
    const innerPath = drawCurvedTurnoutRoute(g, startX, radius, a, sign, railColor);
    const outerPath = drawCurvedTurnoutRoute(g, startX, outerRadius, a, sign, railColor);
    [{ path: innerPath, active: isGerade }, { path: outerPath, active: !isGerade }].forEach((route) => {
      const stateRoute = svg("path");
      attrs(stateRoute, { d: route.path, fill: "none", stroke: route.active ? activeRoute : passiveRoute, "stroke-width": route.active ? 4.8 : 2.8, "stroke-linecap": "round", opacity: route.active ? .96 : .72 });
      g.appendChild(stateRoute);
    });
    const lanternBase = svg("circle");
    attrs(lanternBase, { cx: startX + 26, cy: sign * 18, r: 8, fill: "#171a1c", stroke: "#9d7339", "stroke-width": 1.5 });
    const marker = svg("path");
    attrs(marker, { d: "M -5 -4 L 5 0 L -5 4 Z", transform: `translate(${startX + 26} ${sign * 18}) rotate(${isGerade ? sign * angle * .28 : sign * angle * .7})`, fill: "#fff4d2", stroke: "#a56a11", "stroke-width": 1.2 });
    g.append(lanternBase, marker);
    return;
  }

  drawDoubleRailLine(g, -half, 0, half, 0, railColor, 7);

  const branchBed = svg("path");
  attrs(branchBed, {
    d: `M ${-half} 0 Q ${-half + length * .58} 0 ${branchX} ${branchY}`,
    fill: "none", stroke: "#3c4650", "stroke-width": 16, "stroke-linecap": "round"
  });
  const branchRail1 = svg("path");
  const branchRail2 = svg("path");
  attrs(branchRail1, { d: `M ${-half} -4.5 Q ${-half + length * .58} -4.5 ${branchX} ${branchY - 4.5}`, fill: "none", stroke: railColor, "stroke-width": 2.7, "stroke-linecap": "round" });
  attrs(branchRail2, { d: `M ${-half} 4.5 Q ${-half + length * .58} 4.5 ${branchX} ${branchY + 4.5}`, fill: "none", stroke: railColor, "stroke-width": 2.7, "stroke-linecap": "round" });
  g.append(branchBed, branchRail1, branchRail2);

  drawStateSegmentLine(g, -10, 0, Math.min(half - 4, 22), 0, straightCol);
  const branchState = svg("path");
  attrs(branchState, {
    d: `M -10 0 Q ${length * .12} 0 ${Math.min(branchX - 5, length * .28)} ${branchY * .65}`,
    fill: "none", stroke: branchCol, "stroke-width": 7, "stroke-linecap": "round"
  });
  g.appendChild(branchState);

  const positionMarker = svg("path");
  const markerX = isGerade ? 16 : Math.min(branchX - 5, length * .24);
  const markerY = isGerade ? 0 : branchY * .55;
  const markerRotation = isGerade ? 0 : sign * angle * .65;
  attrs(positionMarker, {
    d: "M -5 -5 L 4 0 L -5 5 Z",
    transform: `translate(${markerX} ${markerY}) rotate(${markerRotation})`,
    fill: "#fff4d2", stroke: "#a56a11", "stroke-width": 1.2,
    "pointer-events": "none"
  });
  g.appendChild(positionMarker);
}

export function drawBumperShape(g, geometry = {}, occupied = false) {
  const length = Math.max(45, Number(geometry.length) || 70) * .5;
  const half = length / 2;
  drawDoubleRailLine(g, -half, 0, half - 5, 0, occupied ? "#ff5f69" : "#d5dbe0", 8);
  const beam = svg("rect");
  attrs(beam, { x: half - 8, y: -16, width: 7, height: 32, rx: 2, fill: "#f2c14e", stroke: "#171c20", "stroke-width": 2 });
  const stopA = svg("line");
  const stopB = svg("line");
  attrs(stopA, { x1: half - 5, y1: -11, x2: half - 18, y2: -4, stroke: "#aeb8bf", "stroke-width": 4, "stroke-linecap": "round" });
  attrs(stopB, { x1: half - 5, y1: 11, x2: half - 18, y2: 4, stroke: "#aeb8bf", "stroke-width": 4, "stroke-linecap": "round" });
  g.append(stopA, stopB, beam);
}

export function drawCrossingShape(g, geometry = {}, xState = "gerade", occupied = false) {
  const scale = .5;
  const length = Math.max(120, Number(geometry.length) || 193) * scale;
  const angle = Math.max(10, Math.min(60, Number(geometry.crossingAngleDeg) || 30));
  const half = length / 2;
  const rise = Math.tan((angle / 2) * Math.PI / 180) * half;
  const active = "#f6b94c";
  const inactive = "#566675";

  const railColor = occupied ? "#ff5f69" : "#d5dbe0";
  drawDoubleRailLine(g, -half, -rise, half, rise, railColor, 7);
  drawDoubleRailLine(g, -half, rise, half, -rise, railColor, 7);

  if (xState === "abzweig") {
    const curve1 = svg("path");
    const curve2 = svg("path");
    attrs(curve1, { d: `M ${-half} ${-rise} Q 0 ${-rise * .15} ${half} ${-rise}`, fill: "none", stroke: active, "stroke-width": 7, "stroke-linecap": "round" });
    attrs(curve2, { d: `M ${-half} ${rise} Q 0 ${rise * .15} ${half} ${rise}`, fill: "none", stroke: active, "stroke-width": 7, "stroke-linecap": "round" });
    const diag1 = svg("line");
    const diag2 = svg("line");
    attrs(diag1, { x1: -half * .35, y1: -rise * .35, x2: half * .35, y2: rise * .35, stroke: inactive, "stroke-width": 6, "stroke-linecap": "round" });
    attrs(diag2, { x1: -half * .35, y1: rise * .35, x2: half * .35, y2: -rise * .35, stroke: inactive, "stroke-width": 6, "stroke-linecap": "round" });
    g.append(diag1, diag2, curve1, curve2);
  } else {
    const diag1 = svg("line");
    const diag2 = svg("line");
    attrs(diag1, { x1: -half * .55, y1: -rise * .55, x2: half * .55, y2: rise * .55, stroke: active, "stroke-width": 7, "stroke-linecap": "round" });
    attrs(diag2, { x1: -half * .55, y1: rise * .55, x2: half * .55, y2: -rise * .55, stroke: active, "stroke-width": 7, "stroke-linecap": "round" });
    g.append(diag1, diag2);
  }

  const positionMarker = svg("path");
  attrs(positionMarker, {
    d: "M 0 -6 L 6 0 L 0 6 L -6 0 Z", fill: "#fff4d2", stroke: "#a56a11",
    "stroke-width": 1.2, "pointer-events": "none"
  });
  g.appendChild(positionMarker);
}

export function localConnectionPorts(element, catalogItem = {}) {
  const type = element.typ === "xtrack" ? "crossing" : element.typ;
  if (type === "track") {
    const half = Math.max(12, Number(catalogItem.length || 180) * .25);
    return [{ x: -half, y: 0, angle: 180 }, { x: half, y: 0, angle: 0 }];
  }
  if (type === "curve") {
    const radius = Math.max(35, Number(catalogItem.radius || 360) * .5);
    const angle = Math.max(2, Math.min(90, Number(catalogItem.angleDeg) || 30));
    const chord = 2 * radius * Math.sin((angle * Math.PI / 180) / 2);
    return [{ x: -chord / 2, y: 0, angle: 180 - angle / 2 }, { x: chord / 2, y: 0, angle: angle / 2 }];
  }
  if (type === "switch") {
    const sign = (catalogItem.handed || "left") === "right" ? 1 : -1;
    const length = Math.max(120, Number(catalogItem.length) || 180) * .5;
    const radius = Math.max(250, Number(catalogItem.radius) || 437.4) * .5;
    const angle = Math.max(10, Math.min(40, Number(catalogItem.angleDeg) || 24.2833));
    const a = angle * Math.PI / 180;
    const half = length / 2;
    if (catalogItem.switchStyle === "curved") {
      if (catalogItem.switchGeometry === "5141") {
        const layout = turnout5141Geometry(catalogItem, sign);
        return [
          { x: layout.startX, y: 0, angle: 180 },
          layout.outerEnd,
          layout.innerEnd
        ];
      }
      const outerRadius = Math.max(radius, Math.max(250, Number(catalogItem.branchRadius) || 437.4) * .5);
      const startX = -(outerRadius * Math.sin(a)) / 2;
      const innerY = sign * radius * (1 - Math.cos(a));
      const outerY = sign * outerRadius * (1 - Math.cos(a));
      return [
        { x: startX, y: 0, angle: 180 },
        { x: startX + radius * Math.sin(a), y: innerY, angle: sign * angle },
        { x: startX + outerRadius * Math.sin(a), y: outerY, angle: sign * angle }
      ];
    }
    return [
      { x: -half, y: 0, angle: 180 },
      { x: half, y: 0, angle: 0 },
      { x: -half + radius * Math.sin(a), y: sign * radius * (1 - Math.cos(a)), angle: sign * angle }
    ];
  }
  if (type === "bumper") {
    const length = Math.max(45, Number(catalogItem.length) || 70) * .5;
    return [{ x: -length / 2, y: 0, angle: 180 }];
  }
  if (type === "crossing") {
    const length = Math.max(120, Number(catalogItem.length) || 193) * .5;
    const angle = Math.max(10, Math.min(60, Number(catalogItem.crossingAngleDeg) || 30));
    const half = length / 2;
    const rise = Math.tan((angle / 2) * Math.PI / 180) * half;
    return [
      { x: -half, y: -rise, angle: 180 + angle / 2 },
      { x: half, y: rise, angle: angle / 2 },
      { x: -half, y: rise, angle: 180 - angle / 2 },
      { x: half, y: -rise, angle: -angle / 2 }
    ];
  }
  return [{ x: 0, y: 0, angle: 0 }];
}

export function worldConnectionPort(element, port) {
  const rotation = Number(element.rotation ?? element.winkel ?? 0);
  const rad = rotation * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: Number(element.x || 0) + port.x * cos - port.y * sin,
    y: Number(element.y || 0) + port.x * sin + port.y * cos,
    angle: ((port.angle + rotation) % 360 + 360) % 360
  };
}

export function drawSignalShape(g, state = "halt") {
  const halt = state !== "fahrt";
  const mast = svg("path"); attrs(mast, { d: "M -2 22 L -2 58 L -14 58 L -14 63 L 14 63 L 14 58 L 2 58 L 2 22", fill: "#8b9096", stroke: "#202327", "stroke-width": 1.5 });
  const head = svg("rect"); attrs(head, { x: -15, y: -29, width: 30, height: 53, rx: 11, fill: "#16191d", stroke: "#aeb4bb", "stroke-width": 2 });
  const red = svg("circle"); attrs(red, { cx: 0, cy: -13, r: 7, fill: halt ? "#ff2b32" : "#3d1517", stroke: "#080808", "stroke-width": 2, filter: halt ? "url(#builderGlow)" : "" });
  const green = svg("circle"); attrs(green, { cx: 0, cy: 11, r: 7, fill: halt ? "#12341d" : "#28dc60", stroke: "#080808", "stroke-width": 2, filter: halt ? "" : "url(#builderGlow)" });
  g.append(mast, head, red, green);
}

export function drawEspSignalShape(g, state = "halt", aspectMode = "rg") {
  const active = ["halt", "warnung", "fahrt"].includes(state) ? state : "halt";
  const threeAspect = aspectMode === "rgy";
  const mast = svg("path"); attrs(mast, { d: `M -2 ${threeAspect ? 31 : 22} L -2 61 L -13 61 L -13 66 L 13 66 L 13 61 L 2 61 L 2 ${threeAspect ? 31 : 22}`, fill: "#67717a", stroke: "#15181b", "stroke-width": 1.5 });
  const head = svg("rect"); attrs(head, { x: -16, y: threeAspect ? -37 : -29, width: 32, height: threeAspect ? 70 : 53, rx: 12, fill: "#10151a", stroke: "#a86f32", "stroke-width": 2 });
  const colors = threeAspect
    ? { halt: ["#ff2e38", "#371216", -22], warnung: ["#ffd42a", "#3a3210", 0], fahrt: ["#28df62", "#10351b", 22] }
    : { halt: ["#ff2e38", "#371216", -13], fahrt: ["#28df62", "#10351b", 11] };
  const lamps = Object.entries(colors).map(([aspect, values]) => { const lamp = svg("circle"); attrs(lamp, { cx: 0, cy: values[2], r: 7, fill: active === aspect ? values[0] : values[1], stroke: "#050607", "stroke-width": 2, filter: active === aspect ? "url(#builderGlow)" : "" }); return lamp; });
  g.append(mast, head, ...lamps);
}

export function drawTransformerShape(g) {
  const body = svg("rect"); attrs(body, { width: 90, height: 62, x: -45, y: -31, rx: 8, fill: "#d7d3c5", stroke: "#69675f", "stroke-width": 2 });
  const face = svg("rect"); attrs(face, { width: 80, height: 42, x: -40, y: -25, rx: 5, fill: "#e7e3d5", stroke: "#aaa697" });
  const dial = svg("circle"); attrs(dial, { cx: 0, cy: -4, r: 17, fill: "#bd2029", stroke: "#651017", "stroke-width": 3 });
  const knob = svg("path"); attrs(knob, { d: "M 0 -17 L 4 -5 L 0 1 L -4 -5 Z", fill: "#f3d2d4" });
  const label = svg("text"); attrs(label, { x: 0, y: 26, "text-anchor": "middle", fill: "#313131", "font-size": 10, "font-weight": "700" }); label.textContent = "MÄRKLIN 6631";
  g.append(body, face, dial, knob, label);
}

export function drawLabel(g, element, rotationDeg) {
  const article = element.trackCode || element.curveCode || element.switchCode || element.xTrackCode || element.bumperCode || element.catalogCode || "";
  const name = String(element.name || article || "").trim();
  if (!name) return;

  const wrap = svg("g");
  wrap.setAttribute("transform", `rotate(${-rotationDeg})`);

  const t = svg("text");
  t.textContent = name;
  const type = element.typ === "ledSignal" || element.typ === "espSignal" ? "espSignal" : element.typ;
  const labelY = type === "signal" ? 82 : type === "espSignal" ? 88 : type === "transformer" ? 52 : type === "bumper" ? 34 : 28;
  attrs(t, {
    x: 0,
    y: labelY,
    fill: "#f3f6f8",
    stroke: "#0a1118",
    "stroke-width": 3,
    "paint-order": "stroke",
    "stroke-linejoin": "round",
    "font-size": 12,
    "font-weight": 600,
    "font-family": "Segoe UI, Arial, sans-serif",
    "text-anchor": "middle",
    "pointer-events": "none"
  });

  wrap.appendChild(t);
  g.appendChild(wrap);
}
