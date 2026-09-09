"use strict";

export function showToast(message, type = "success") {
  const stack = document.getElementById("toastStack");
  if (!stack) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  const bgColor = {
    success: "#4caf50",
    error: "#f44336",
    warning: "#ff9800",
    info: "#2196F3"
  }[type] || "#4caf50";

  toast.style.cssText = `
    padding: 12px 16px;
    margin: 8px;
    background: ${bgColor};
    color: white;
    border-radius: 4px;
    font-size: 14px;
    animation: slideIn 0.3s ease;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}