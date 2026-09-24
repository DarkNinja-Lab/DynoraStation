"use strict";

export function showToast(message, type = "success") {
  const stack = document.getElementById("toastStack");
  if (!stack) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  toast.classList.add(`toast-${type}`);

  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}