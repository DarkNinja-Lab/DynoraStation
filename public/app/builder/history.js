"use strict";

import { state } from "../core/state.js?v=mobile-v5-cachefix";

const undoStack = [];
const redoStack = [];

function snapshot() { return JSON.stringify(state.layout); }
function restore(value) { state.layout = JSON.parse(value); state.selectedElement = null; state.connectFrom = null; state.layoutDirty = true; }

export function resetHistory() { undoStack.length = 0; redoStack.length = 0; updateHistoryButtons(); }
export function recordHistory() {
  const value = snapshot();
  if (undoStack[undoStack.length - 1] !== value) undoStack.push(value);
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
  updateHistoryButtons();
}
export function undoHistory() {
  if (!undoStack.length) return false;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  updateHistoryButtons();
  return true;
}
export function redoHistory() {
  if (!redoStack.length) return false;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  updateHistoryButtons();
  return true;
}
export function updateHistoryButtons() {
  const undo = document.getElementById("undoButton");
  const redo = document.getElementById("redoButton");
  if (undo) undo.disabled = !undoStack.length;
  if (redo) redo.disabled = !redoStack.length;
}
