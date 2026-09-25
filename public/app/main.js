
const DYNORA_BUILD = "mobile-v5-cachefix";

async function clearLegacyFrontendCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {}
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => /dynora/i.test(name)).map((name) => caches.delete(name)));
    }
  } catch {}
}

clearLegacyFrontendCaches();
console.info(`[DynoraStation] Build ${DYNORA_BUILD}`);

import { startApp } from "./bootstrap.js?v=mobile-v5-cachefix";

document.addEventListener("DOMContentLoaded", startApp);