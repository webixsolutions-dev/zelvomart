import assert from "node:assert/strict";
import test from "node:test";
import { automaticRecoveryWhere, recoveryDefaults } from "./recovery";

test("automatic cart offer: on by default, only carts left 1–48 hours ago and never contacted", () => {
  assert.equal(recoveryDefaults.autoEmail, "true");
  const now = Date.parse("2026-10-30T12:00:00Z");
  const where = automaticRecoveryWhere(now);
  assert.deepEqual(where.email, { not: null });
  assert.deepEqual(where.NOT, { email: { endsWith: "joonix.net" } });
  assert.equal(where.emailSentAt, null);
  assert.equal(where.convertedAt, null);
  assert.equal(where.lostAt, null);
  assert.equal(where.followedUpAt, null);
  assert.equal(where.followedUpBy, null);
  assert.equal(where.updatedAt.lte.toISOString(), "2026-10-30T11:00:00.000Z");
  assert.equal(where.updatedAt.gte.toISOString(), "2026-10-28T12:00:00.000Z");
});
