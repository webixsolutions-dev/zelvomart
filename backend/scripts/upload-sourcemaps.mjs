import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const env = process.env;
// Optional build step: no account, token or release means no process, network request or warning.
if (env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT && env.VERCEL_GIT_COMMIT_SHA) {
  const require = createRequire(import.meta.url);
  const cli = require.resolve("@sentry/cli/bin/sentry-cli");
  const run = (args) => execFileSync(process.execPath, [cli, ...args], { stdio: "inherit" });
  run(["sourcemaps", "inject", "dist"]);
  run(["sourcemaps", "upload", "--release", env.VERCEL_GIT_COMMIT_SHA, "dist"]);
}
