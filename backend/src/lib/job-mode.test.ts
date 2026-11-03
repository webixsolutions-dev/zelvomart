import { test } from "node:test";
import assert from "node:assert/strict";
import { getJobMode, jobModeIsFallback, warnIfJobModeFallback } from "./job-mode";

test("JOB_MODE wins when it is set", () => {
  assert.equal(getJobMode({ JOB_MODE: "cron" }), "cron");
  assert.equal(getJobMode({ JOB_MODE: "worker", VERCEL: "1" }), "worker");
  assert.equal(getJobMode({ JOB_MODE: " CRON " }), "cron");
  assert.equal(jobModeIsFallback({ JOB_MODE: "cron" }), false);
});

test("without JOB_MODE, Vercel means cron", () => {
  assert.equal(getJobMode({ VERCEL: "1" }), "cron");
  assert.equal(jobModeIsFallback({ VERCEL: "1" }), true);
});

test("without JOB_MODE off Vercel, worker mode; an unknown value also falls back", () => {
  assert.equal(getJobMode({}), "worker");
  assert.equal(getJobMode({ JOB_MODE: "sometimes" }), "worker");
  assert.equal(getJobMode({ JOB_MODE: "sometimes", VERCEL: "1" }), "cron");
});

test("the fallback warning is logged once and only when it had to guess", () => {
  const logs: string[] = [];
  warnIfJobModeFallback({ JOB_MODE: "cron" }, (m) => logs.push(m));
  assert.equal(logs.length, 0);
  warnIfJobModeFallback({ VERCEL: "1" }, (m) => logs.push(m));
  warnIfJobModeFallback({ VERCEL: "1" }, (m) => logs.push(m));
  assert.equal(logs.length, 1);
  assert.match(logs[0], /JOB_MODE is not set; using "cron" mode/);
});
