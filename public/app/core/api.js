"use strict";

import { CONST } from "./state.js";

export async function api(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONST.API_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err && err.name === "AbortError") throw new Error("Zeitüberschreitung bei Serveranfrage");
    throw new Error("Netzwerkfehler");
  }

  clearTimeout(timeout);

  let data = {};
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const hint = data?.details?.hint ? ` [${data.details.hint}]` : "";
    const code = data?.code ? ` (${data.code})` : "";
    throw new Error((data?.fehler || "Serverfehler") + code + hint);
  }

  return data;
}