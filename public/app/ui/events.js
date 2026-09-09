"use strict";

import { state } from "../core/state.js";

export function eventsRegistrieren() {
  console.log("🔧 Events registrieren...");
  
  // Main navigation buttons (sidebar)
  const navButtons = document.querySelectorAll(".nav-button");
  console.log(`  Found ${navButtons.length} nav buttons`);
  
  navButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const pageName = btn.dataset.page;
      console.log(`📍 Nav Click: ${pageName}`);
      switchPage(pageName);
    });
  });

  // Quick action buttons (page links)
  const pageLinks = document.querySelectorAll("[data-page-link]");
  console.log(`  Found ${pageLinks.length} page links`);
  
  pageLinks.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const pageName = btn.dataset.pageLink;
      console.log(`📍 Page Link Click: ${pageName}`);
      switchPage(pageName);
    });
  });

  // Mobile menu button
  const mobileMenuBtn = document.getElementById("mobileMenuButton");
  const sidebar = document.getElementById("sidebar");
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener("click", (e) => {
      console.log("📱 Mobile menu toggled");
      sidebar.classList.toggle("mobile-open");
    });
  }

  // Emergency button
  const emergencyBtn = document.getElementById("emergencyButton");
  if (emergencyBtn) {
    emergencyBtn.addEventListener("click", async (e) => {
      console.log("🚨 EMERGENCY STOP!");
      if (confirm("Wirklich NOT-AUS aktivieren?")) {
        try {
          const response = await fetch("/api/emergency-stop", { method: "POST" });
          if (response.ok) {
            console.log("✅ Emergency stop sent");
          }
        } catch (err) {
          console.error("❌ Emergency stop failed:", err);
        }
      }
    });
  }

  console.log("✅ Events registered successfully");
}

function switchPage(pageName) {
  console.log(`\n🔄 Switching to page: ${pageName}`);
  
  // Hide all pages
  const allPages = document.querySelectorAll(".page");
  allPages.forEach(page => {
    page.classList.remove("active");
  });

  // Show selected page
  const selectedPage = document.getElementById(`page-${pageName}`);
  if (selectedPage) {
    selectedPage.classList.add("active");
    console.log(`  ✅ Page shown: page-${pageName}`);

    // Update nav buttons
    document.querySelectorAll(".nav-button").forEach(btn => {
      const isActive = btn.dataset.page === pageName;
      btn.classList.toggle("active", isActive);
    });

    // Update page title
    const titleMap = {
      dashboard: "Übersicht",
      builder: "Gleisbild-Editor",
      track: "Gleisbild",
      settings: "Einstellungen",
      rules: "Regeln",
      events: "Ereignisse"
    };
    
    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle) {
      pageTitle.textContent = titleMap[pageName] || "Seite";
    }
  } else {
    console.warn(`  ❌ Page NOT found: page-${pageName}`);
  }

  // Close mobile menu
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.remove("mobile-open");
}