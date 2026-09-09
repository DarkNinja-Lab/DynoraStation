"use strict";

import { CONST } from "../core/state.js";

export function ensureCanvasGeometry() {
  const builderSvg = document.getElementById("builderSvg");
  if (builderSvg) builderSvg.setAttribute("viewBox", `0 0 ${CONST.CANVAS_WIDTH} ${CONST.CANVAS_HEIGHT}`);

  const trackSvg = document.getElementById("trackSvg");
  if (trackSvg) trackSvg.setAttribute("viewBox", `0 0 ${CONST.CANVAS_WIDTH} ${CONST.CANVAS_HEIGHT}`);
}