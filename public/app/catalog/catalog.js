"use strict";

import { state } from "../core/state.js?v=workspace-v11";
import { apiCall } from "../core/api.js?v=workspace-v11";

export async function katalogLaden() {
  try {
    const data = await apiCall("/api/track-catalog");
    state.catalog = {
      tracks: data.tracks || [],
      curves: data.curves || [],
      switches: data.switches || [],
      crossings: data.crossings || [],
      bumpers: data.bumpers || [],
      signals: data.signals || [],
      transformers: data.transformers || [],
      espSignals: data.espSignals || []
    };
  } catch (error) {
    console.warn("Katalog konnte nicht geladen werden", error);
    state.catalog = { tracks: [], curves: [], switches: [], crossings: [], bumpers: [], signals: [], transformers: [], espSignals: [] };
  }
}

