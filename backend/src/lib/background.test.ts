import assert from "node:assert/strict";
import test from "node:test";
import { runInBackground } from "./background";

test("background work: runs, and a failure is logged instead of thrown", async () => {
  let ran = false;
  await runInBackground("ok", async () => {
    ran = true;
  });
  assert.equal(ran, true);
  const logged: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => logged.push(args.join(" "));
  try {
    await runInBackground("broken", () => Promise.reject(new Error("boom")));
    await runInBackground("sync throw", () => {
      throw new Error("sync boom");
    });
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 2);
  assert.match(String(logged[0]), /broken failed: boom/);
});
