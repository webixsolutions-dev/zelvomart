import assert from "node:assert/strict";
import test from "node:test";
import { decideReplaySample, replaySampleRate } from "../lib/session-replay-client";
import {
  REPLAY_CLIENT_MAX_CHUNKS,
  REPLAY_HIDDEN_STOP_MS,
  REPLAY_MAX_SESSION_MS,
  replayChunkSize,
  replayStopReason,
} from "../lib/replay-timing";

test("sample rate: default 0.25, clamped to 0..1, bad values fall back", () => {
  assert.equal(replaySampleRate(undefined), 0.25);
  assert.equal(replaySampleRate(""), 0.25);
  assert.equal(replaySampleRate("0.5"), 0.5);
  assert.equal(replaySampleRate("0"), 0);
  assert.equal(replaySampleRate("3"), 1);
  assert.equal(replaySampleRate("-1"), 0);
  assert.equal(replaySampleRate("abc"), 0.25);
});

test("the sample decision is made once per session and then remembered", () => {
  assert.deepEqual(decideReplaySample(null, 0.25, () => 0.1), { sampled: true, store: "1" });
  assert.deepEqual(decideReplaySample(null, 0.25, () => 0.9), { sampled: false, store: "0" });
  // Once stored, the rate or the dice no longer matter: nothing is re-rolled.
  assert.deepEqual(decideReplaySample("1", 0, () => 0.99), { sampled: true, store: null });
  assert.deepEqual(decideReplaySample("0", 1, () => 0), { sampled: false, store: null });
  assert.equal(decideReplaySample(null, 0, () => 0).sampled, false);
  assert.equal(decideReplaySample(null, 1, () => 0.999).sampled, true);
  let sampled = 0;
  for (let i = 0; i < 10000; i++) if (decideReplaySample(null, 0.25, Math.random).sampled) sampled++;
  assert.ok(sampled > 2200 && sampled < 2800, `about a quarter sampled (${sampled})`);
});

test("chunks: up to 500 events, and a keepalive chunk stays under its byte budget", () => {
  const events = Array.from({ length: 1200 }, (_, i) => ({ type: 3, timestamp: i, data: { x: "y".repeat(200) } }));
  assert.equal(replayChunkSize(events), 500);
  const count = replayChunkSize(events, 500, 55_000);
  assert.ok(count > 0 && count < 500);
  assert.ok(JSON.stringify(events.slice(0, count)).length <= 55_000);
  assert.equal(replayChunkSize([{ big: "z".repeat(100_000) }], 500, 55_000), 1, "one oversized event still moves on");
  assert.equal(replayChunkSize([], 500), 0);
});

test("a recording stops at 10 minutes, after a minute hidden, or at the chunk limit", () => {
  const now = 1_000_000_000;
  assert.equal(replayStopReason({ startedAt: now - 60_000, now }), null);
  assert.equal(replayStopReason({ startedAt: now - REPLAY_MAX_SESSION_MS, now }), "max-duration");
  assert.equal(replayStopReason({ startedAt: now, hiddenSince: now - REPLAY_HIDDEN_STOP_MS, now }), null);
  assert.equal(replayStopReason({ startedAt: now, hiddenSince: now - REPLAY_HIDDEN_STOP_MS - 1, now }), "hidden");
  assert.equal(replayStopReason({ startedAt: now, sequence: REPLAY_CLIENT_MAX_CHUNKS - 1, now }), null);
  assert.equal(replayStopReason({ startedAt: now, sequence: REPLAY_CLIENT_MAX_CHUNKS, now }), "max-chunks");
  assert.equal(replayStopReason({ startedAt: Number.NaN, now }), null);
});
