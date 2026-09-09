"use strict";

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiCall(path, options = {}) {
  const url = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;

  const method = options.method || "GET";
  const headers = {
    "Accept": "application/json",
    ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  const fetchOptions = {
    method,
    headers
  };

  if (options.body !== undefined) {
    fetchOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const msg = data?.message || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}