import assert from "node:assert/strict";
import test from "node:test";
import { databasePoolSettings } from "./db-pool";

test("pool: small on serverless, larger on a persistent server, env overrides", () => {
  assert.deepEqual(databasePoolSettings({ VERCEL: "1" }), { max: 3, idleTimeoutMillis: 60_000 });
  assert.deepEqual(databasePoolSettings({}), { max: 10, idleTimeoutMillis: 300_000 });
  assert.deepEqual(databasePoolSettings({ VERCEL: "1", DATABASE_POOL_MAX: "1", DATABASE_IDLE_TIMEOUT_MS: "120000" }), {
    max: 1,
    idleTimeoutMillis: 120_000,
  });
  // Nonsense values keep the default rather than breaking the app.
  assert.deepEqual(databasePoolSettings({ DATABASE_POOL_MAX: "0", DATABASE_IDLE_TIMEOUT_MS: "soon" }), {
    max: 10,
    idleTimeoutMillis: 300_000,
  });
});
