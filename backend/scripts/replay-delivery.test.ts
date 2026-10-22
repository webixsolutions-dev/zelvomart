import { test } from "node:test";
import assert from "node:assert/strict";
import { createReplayDelivery, replayDeliveryResult } from "../../frontend/lib/replay-delivery";

test("failed registration buffers the chunk until registration succeeds", async () => {
  let starts = 0,
    uploads = 0,
    stops = 0;
  const delivery = createReplayDelivery({
    register: async () => ({ ok: ++starts > 1 }),
    upload: async () => {
      uploads++;
      return { ok: true };
    },
    stop: () => {
      stops++;
    },
  });
  assert.equal(await delivery.upload({ sequence: 0 }), false);
  assert.equal(uploads, 0);
  assert.equal(await delivery.upload({ sequence: 0 }), true);
  assert.equal(starts, 2);
  assert.equal(uploads, 1);
  assert.equal(stops, 0);
  assert.equal(await delivery.upload({ sequence: 1 }), true);
  assert.equal(starts, 2);
});

test("parallel flushes share registration, unknown sessions register again, temporary throttles retry", async () => {
  let starts = 0,
    uploads = 0;
  const delivery = createReplayDelivery({
    register: async () => {
      starts++;
      await new Promise((resolve) => setImmediate(resolve));
      return { ok: true };
    },
    upload: async () =>
      replayDeliveryResult(++uploads === 1 ? 409 : 200, uploads === 1 ? "REPLAY_SESSION_NOT_STARTED" : undefined),
    stop: () => {
      throw new Error("transient failure stopped recording");
    },
  });
  await Promise.all([delivery.register(), delivery.register(), delivery.register()]);
  assert.equal(starts, 1);
  assert.equal(await delivery.upload(1), false);
  assert.equal(await delivery.upload(1), true);
  assert.equal(starts, 2);
  assert.equal(delivery.observe(replayDeliveryResult(429, "RATE_LIMITED")), false);
  assert.equal(delivery.stopped, false);
  assert.equal(await delivery.upload(2), true);
});

test("durable quotas stop recording once and prevent further uploads or registration", async () => {
  for (const error of ["REPLAY_SESSION_LIMIT", "REPLAY_DAILY_START_LIMIT", "REPLAY_STORAGE_NOT_CONFIGURED"]) {
    let stops = 0,
      starts = 0,
      uploads = 0;
    const delivery = createReplayDelivery({
      register: async () => {
        starts++;
        return { ok: true };
      },
      upload: async () => {
        uploads++;
        return replayDeliveryResult(429, error);
      },
      stop: () => {
        stops++;
      },
    });
    assert.equal(await delivery.upload(0), false);
    assert.equal(delivery.stopped, true);
    assert.equal(await delivery.upload(1), false);
    assert.equal(await delivery.register(), false);
    delivery.observe(replayDeliveryResult(429, error));
    assert.deepEqual({ stops, starts, uploads }, { stops: 1, starts: 1, uploads: 1 });
  }
});
