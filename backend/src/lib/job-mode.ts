/**
 * How background jobs (order emails, Meta/TikTok events) are sent.
 * - "cron": each job is sent right after the order by this process, and /api/cron/jobs is the retry net.
 * - "worker": jobs go to the pg-boss queue for the always-on worker (compose.worker.yml).
 * JOB_MODE decides when it is set. Without it, Vercel (no worker can run there) means "cron" and any other host
 * means "worker"; that fallback is logged once so a missing variable is visible in the logs.
 */
export type JobMode = "cron" | "worker";

export function getJobMode(env: NodeJS.ProcessEnv = process.env): JobMode {
  const set = env.JOB_MODE?.trim().toLowerCase();
  if (set === "cron" || set === "worker") return set;
  return env.VERCEL ? "cron" : "worker";
}

/** True when JOB_MODE is missing or not one of the two known values, so getJobMode had to guess. */
export function jobModeIsFallback(env: NodeJS.ProcessEnv = process.env) {
  const set = env.JOB_MODE?.trim().toLowerCase();
  return set !== "cron" && set !== "worker";
}

let warned = false;
/** Logs one warning per process when the job mode was not set explicitly. */
export function warnIfJobModeFallback(
  env: NodeJS.ProcessEnv = process.env,
  log: (message: string) => void = console.warn,
) {
  if (warned || !jobModeIsFallback(env)) return;
  warned = true;
  log(
    `[jobs] JOB_MODE is ${env.JOB_MODE ? `"${env.JOB_MODE}" (unknown)` : "not set"}; using "${getJobMode(env)}" mode. ` +
      `Set JOB_MODE=cron on Vercel or JOB_MODE=worker next to the worker.`,
  );
}
