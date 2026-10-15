"use strict";

export function showToast(message, type = "success") {
  const stack = document.getElementById("toastStack");
  if (!stack) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  while (stack.children.length >= 4) stack.firstElementChild.remove();
  
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), type === "error" ? 4500 : 1800);
}
