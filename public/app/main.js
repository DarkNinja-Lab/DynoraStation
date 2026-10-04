
const DYNORA_BUILD = "workspace-v11";

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

import { startApp } from "./bootstrap.js?v=workspace-v11";

document.addEventListener("DOMContentLoaded", () => {
  startApp().catch(error => {
    console.error("DynoraStation konnte nicht starten", error);
    const message = document.createElement("div");
    message.className = "startup-error";
    message.setAttribute("role", "alert");
    message.textContent = "Start fehlgeschlagen. Bitte Station prüfen und Seite neu laden. ";
    const retry = document.createElement("button");
    retry.textContent = "Neu laden";
    retry.addEventListener("click", () => location.reload());
    message.appendChild(retry);
    document.body.appendChild(message);
  });
});