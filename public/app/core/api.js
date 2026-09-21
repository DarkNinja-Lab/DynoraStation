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

  const timeoutMs = Math.max(500, Number(options.timeoutMs) || 8000);
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const abortFromCaller = () => timeoutController.abort();
  if (options.signal?.aborted) timeoutController.abort();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const fetchOptions = {
    method,
    headers,
    signal: timeoutController.signal,
    ...(method === "GET" ? { cache: "no-store" } : {})
  };

  if (options.body !== undefined) {
    fetchOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  let res;
  try {
    res = await fetch(url, fetchOptions);
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`Zeitüberschreitung nach ${timeoutMs} ms`);
      timeoutError.code = "REQUEST_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const msg = data?.message || data?.fehler || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}
