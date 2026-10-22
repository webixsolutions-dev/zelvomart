import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
test("optional backend source maps step does nothing without credentials/release", () => {
  const result = execFileSync(process.execPath, ["scripts/upload-sourcemaps.mjs"], {
    encoding: "utf8",
    env: { ...process.env, SENTRY_AUTH_TOKEN: "", SENTRY_ORG: "", SENTRY_PROJECT: "", VERCEL_GIT_COMMIT_SHA: "" },
  });
  assert.equal(result, "");
});
