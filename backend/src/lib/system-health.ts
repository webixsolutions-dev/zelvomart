import type { PrismaClient } from "../generated/prisma/client";
export type SystemHealthStore = Pick<PrismaClient, "setting" | "job">;
export const WORKER_STALE_MS = 120000;
function timestamp(value: unknown, now: number) {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const at = new Date(value).getTime();
  return Number.isFinite(at) && at <= now ? new Date(at).toISOString() : null;
}
function age(at: string | null, now: number) {
  return at ? Math.max(0, Math.floor((now - Date.parse(at)) / 1000)) : null;
}
export async function systemHealth(store: SystemHealthStore, now = new Date()) {
  const time = now.getTime(),
    since = new Date(time - 86400000);
  const [settings, queued, oldest, failed, lastEmailJob] = await Promise.all([
    store.setting.findMany({
      where: { key: { in: ["worker.heartbeat", "health.lastSuccessfulEmail"] } },
      select: { key: true, value: true },
    }),
    store.job.count({ where: { status: "QUEUED" } }),
    store.job.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    store.job.count({ where: { status: "FAILED", finishedAt: { gte: since } } }),
    store.job.findFirst({
      where: {
        status: "SUCCEEDED",
        name: { in: ["order-team-email", "customer-order-email", "customer-status-email", "daily-summary"] },
        finishedAt: { not: null },
      },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);
  const values = Object.fromEntries(settings.map((row) => [row.key, row.value]));
  const heartbeat = timestamp((values["worker.heartbeat"] as { at?: unknown } | undefined)?.at, time),
    heartbeatAge = age(heartbeat, time);
  const workerState = !heartbeat
    ? "not-running"
    : time - Date.parse(heartbeat) >= WORKER_STALE_MS
      ? "stale"
      : "running";
  const marker = timestamp((values["health.lastSuccessfulEmail"] as { at?: unknown } | undefined)?.at, time),
    jobAt = timestamp(lastEmailJob?.finishedAt, time);
  const lastEmail = marker && (!jobAt || marker >= jobAt) ? marker : jobAt;
  const oldestAt = timestamp(oldest?.createdAt, time);
  return {
    checkedAt: now.toISOString(),
    healthy: workerState === "running" && failed === 0,
    worker: { state: workerState, lastHeartbeat: heartbeat, ageSeconds: heartbeatAge },
    jobs: { queued, oldestQueuedAt: oldestAt, oldestQueuedAgeSeconds: age(oldestAt, time), failedLast24Hours: failed },
    email: {
      lastSuccessfulAt: lastEmail,
      ageSeconds: age(lastEmail, time),
      source: lastEmail ? (lastEmail === marker ? "transport" : "job") : null,
    },
  };
}
