"use strict";

export function icon(name, className = "ui-icon") {
  return `<svg class="${className}" aria-hidden="true" focusable="false"><use href="/assets/icons.svg?v=2#icon-${name}"></use></svg>`;
}
