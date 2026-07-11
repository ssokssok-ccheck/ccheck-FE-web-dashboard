export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") === "true";
export const SHOW_TEST_PANEL = (import.meta.env.VITE_SHOW_TEST_PANEL ?? "true") === "true";
export const POLL_INTERVAL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS || 5000);
