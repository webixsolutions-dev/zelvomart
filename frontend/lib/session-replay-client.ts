"use client";

const SESSION_KEY = "zm_replay_session_id";
const VISITOR_KEY = "zm_replay_visitor_id";
const OPT_OUT_KEY = "zm_session_replay_opt_out";

function getOrCreate(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  storage.setItem(key, value);
  return value;
}

export function getReplaySessionId() {
  if (typeof window === "undefined") return undefined;
  try { return getOrCreate(window.sessionStorage, SESSION_KEY); } catch { return undefined; }
}

export function getReplayVisitorId() {
  if (typeof window === "undefined") return undefined;
  try { return getOrCreate(window.localStorage, VISITOR_KEY); } catch { return undefined; }
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
