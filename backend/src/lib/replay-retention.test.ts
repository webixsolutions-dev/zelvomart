import { test } from "node:test";
import assert from "node:assert/strict";
import { REPLAY_FILE_LIFETIME_DAYS, replayCutoff, replayRetentionDays } from "./replay-retention";

test("replay metadata is kept 14 days by default, the same as the R2 lifecycle rule on the files", () => {
  assert.equal(REPLAY_FILE_LIFETIME_DAYS, 14);
  assert.equal(replayRetentionDays(null, undefined), 14);
  assert.equal(replayRetentionDays(undefined, ""), 14);
});

test("the admin setting wins, then the env variable; never longer than the files live", () => {
  assert.equal(replayRetentionDays(7, "30"), 7);
  assert.equal(replayRetentionDays("10", "30"), 10);
  // Today's stored value (30) and env (30) both stop at 14, so no row outlives its files.
  assert.equal(replayRetentionDays(30, "30"), 14);
  assert.equal(replayRetentionDays(null, "30"), 14);
  assert.equal(replayRetentionDays(null, "5"), 5);
});

test("missing, zero, negative or garbage values fall through to the next source", () => {
  for (const bad of [0, -3, "abc", Number.NaN, ""]) {
    assert.equal(replayRetentionDays(bad, "9"), 9);
    assert.equal(replayRetentionDays(bad, bad), 14);
  }
  assert.equal(replayRetentionDays(3.9, undefined), 3);
});

test("the cutoff is exactly that many days before now", () => {
  const now = Date.UTC(2026, 10, 20, 0, 0, 0);
  assert.equal(replayCutoff(14, now).toISOString(), "2026-11-06T00:00:00.000Z");
});
