import { test } from "node:test";
import assert from "node:assert/strict";
import express, { type RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { systemHealth, type SystemHealthStore } from "./system-health";
import { createSystemHealthRouter } from "../routes/admin/system-health";
import type { AuthedRequest } from "./auth";
const NOW = new Date("2026-10-22T12:00:00Z");
function store({
  heartbeat = null,
  queued = 0,
  oldest = null,
  failed = 0,
  email = null,
  lastEmailJob = null,
}: {
  heartbeat?: unknown;
  queued?: number;
  oldest?: Date | null;
  failed?: number;
  email?: string | null;
  lastEmailJob?: Date | null;
} = {}) {
  return {
    setting: {
      findMany: async () => [
        { key: "worker.heartbeat", value: heartbeat ? { at: heartbeat } : null },
        { key: "health.lastSuccessfulEmail", value: email ? { at: email } : null },
      ],
    },
    job: {
      count: async (args: any) => {
        if (args.where.status === "FAILED") {
          assert.equal(args.where.finishedAt.gte.toISOString(), "2026-10-21T12:00:00.000Z");
          return failed;
        }
        return queued;
      },
      findFirst: async (args: any) =>
        args.where.status === "QUEUED"
          ? oldest
            ? { createdAt: oldest }
            : null
          : lastEmailJob
            ? { finishedAt: lastEmailJob }
            : null,
    },
  } as unknown as SystemHealthStore;
}
test("missing/stale heartbeat, queue age, failures and email markers are reported without raw payloads", async () => {
  const missing = await systemHealth(store({ queued: 1069, oldest: new Date("2026-10-20T12:00:00Z") }), NOW);
  assert.equal(missing.healthy, false);
  assert.equal(missing.worker.state, "not-running");
  assert.equal(missing.worker.ageSeconds, null);
  assert.equal(missing.jobs.queued, 1069);
  assert.equal(missing.jobs.oldestQueuedAgeSeconds, 172800);
  assert.equal(missing.email.lastSuccessfulAt, null);
  for (const heartbeat of ["bad timestamp", "2099-01-01T00:00:00Z"])
    assert.equal((await systemHealth(store({ heartbeat }), NOW)).worker.state, "not-running");
  const stale = await systemHealth(store({ heartbeat: "2026-10-22T11:58:00Z", failed: 3 }), NOW);
  assert.equal(stale.worker.state, "stale");
  assert.equal(stale.worker.ageSeconds, 120);
  assert.equal(stale.jobs.failedLast24Hours, 3);
  const healthy = await systemHealth(
    store({
      heartbeat: "2026-10-22T11:59:45Z",
      email: "2026-10-22T11:00:00Z",
      lastEmailJob: new Date("2026-10-22T10:00:00Z"),
    }),
    NOW,
  );
  assert.equal(healthy.healthy, true);
  assert.equal(healthy.email.source, "transport");
  assert.equal(healthy.email.ageSeconds, 3600);
  const fallback = await systemHealth(store({ lastEmailJob: new Date("2026-10-22T11:30:00Z") }), NOW);
  assert.equal(fallback.email.source, "job");
  assert.equal(fallback.email.ageSeconds, 1800);
  assert.ok(!JSON.stringify(healthy).includes("payload"));
});
test("health HTTP endpoint permits only OWNER/MANAGER, disables caching and isolates storage failure", async () => {
  let reads = 0;
  const data = store({ heartbeat: "2026-10-22T11:59:45Z" }),
    find = data.setting.findMany;
  data.setting.findMany = (async (...args: any[]) => {
    reads++;
    return (find as any)(...args);
  }) as any;
  const authenticate: RequestHandler = (req: AuthedRequest, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ error: "UNAUTHORIZED" });
    req.admin = { id: "test", name: "Test", email: "test@example.invalid", role: role as any };
    next();
  };
  const app = express();
  app.use("/api/admin/system-health", createSystemHealthRouter({ store: data, authenticate, now: () => NOW }));
  let reported = 0;
  const failed = store();
  failed.setting.findMany = (async () => {
    throw new Error("private database details");
  }) as any;
  app.use(
    "/failing",
    createSystemHealthRouter({
      store: failed,
      authenticate,
      reportError: () => {
        reported++;
      },
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(base + "/api/admin/system-health")).status, 401);
    for (const role of ["ORDER_AGENT", "MARKETER"])
      assert.equal((await fetch(base + "/api/admin/system-health", { headers: { "x-test-role": role } })).status, 403);
    assert.equal(reads, 0);
    for (const role of ["OWNER", "MANAGER"]) {
      const res = await fetch(base + "/api/admin/system-health", { headers: { "x-test-role": role } });
      assert.equal(res.status, 200);
      assert.match(res.headers.get("cache-control")!, /no-store/);
      assert.equal((await res.json()).worker.state, "running");
    }
    const res = await fetch(base + "/failing", { headers: { "x-test-role": "OWNER" } });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "SYSTEM_HEALTH_UNAVAILABLE" });
    assert.equal(reported, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
