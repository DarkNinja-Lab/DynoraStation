"use strict";

const API_BASE = "/api";

export async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Call Failed (${endpoint}):`, error);
    throw error;
  }
}

export function getApiUrl(endpoint) {
  return `${API_BASE}${endpoint}`;
}
