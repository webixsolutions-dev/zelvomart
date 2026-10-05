"use client";

const SESSION_KEY = "zm_replay_session_id";
const VISITOR_KEY = "zm_replay_visitor_id";
const SEQUENCE_KEY = "zm_replay_sequence";
const STARTED_AT_KEY = "zm_replay_started_at";
const LANDING_URL_KEY = "zm_replay_landing_url";
const OPT_OUT_KEY = "zm_session_replay_opt_out";

function getOrCreate(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  storage.setItem(key, value);
  return value;
}

/**
 * One replay id represents the whole browser-tab journey, not one page load.
 * sessionStorage survives hard reloads and normal navigations but is isolated per tab,
 * so an order can be linked back to everything the shopper did from landing to checkout.
 */
export function getReplaySessionId() {
  if (typeof window === "undefined") return undefined;
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const value = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, value);
    window.sessionStorage.setItem(SEQUENCE_KEY, "0");
    window.sessionStorage.setItem(STARTED_AT_KEY, new Date().toISOString());
    window.sessionStorage.setItem(LANDING_URL_KEY, window.location.href);
    return value;
  } catch {
    return undefined;
  }
}

export function getReplayVisitorId() {
  if (typeof window === "undefined") return undefined;
  try { return getOrCreate(window.localStorage, VISITOR_KEY); } catch { return undefined; }
}

export function getReplayStartedAt() {
  if (typeof window === "undefined") return new Date().toISOString();
  try {
    const existing = window.sessionStorage.getItem(STARTED_AT_KEY);
    if (existing) return existing;
    const value = new Date().toISOString();
    window.sessionStorage.setItem(STARTED_AT_KEY, value);
    return value;
  } catch {
    return new Date().toISOString();
  }
}

export function getReplayLandingUrl() {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(LANDING_URL_KEY);
    if (existing) return existing;
    const value = window.location.href;
    window.sessionStorage.setItem(LANDING_URL_KEY, value);
    return value;
  } catch {
    return window.location.href;
  }
}

/**
 * Claim a unique monotonically increasing chunk sequence BEFORE sending it.
 * This prevents a reload from reusing sequence 0 and overwriting the earlier page.
 * Gaps are harmless if the browser closes before a claimed chunk is delivered.
 */
export function claimReplaySequence() {
  if (typeof window === "undefined") return 0;
  try {
    const current = Math.max(0, Number(window.sessionStorage.getItem(SEQUENCE_KEY) || "0") || 0);
    window.sessionStorage.setItem(SEQUENCE_KEY, String(current + 1));
    return current;
  } catch {
    return Math.floor(performance.now());
  }
}

export function sessionReplayEnabled() {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_SESSION_REPLAY_ENABLED === "false") return false;
  try {
    if (window.localStorage.getItem(OPT_OUT_KEY) === "1") return false;
  } catch {}
  if (navigator.doNotTrack === "1") return false;
  return !navigator.webdriver;
}

export function setSessionReplayOptOut(optOut: boolean) {
  try { window.localStorage.setItem(OPT_OUT_KEY, optOut ? "1" : "0"); } catch {}
}
