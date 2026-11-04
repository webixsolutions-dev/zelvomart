import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./db";
import { processJobRow } from "./job-processor";
import { ADVANCE_JOB_NAMES } from "./advance-email";

/** Job types the HTTP cron sends (everything an order, a status change or a tracked event creates). */
export const CRON_JOB_NAMES = [
  "order-team-email",
  "customer-order-email",
  "customer-status-email",
  "meta-event",
  "meta-purchase",
  "tiktok-event",
  "tiktok-purchase",
  ...ADVANCE_JOB_NAMES,
];

const LIMITS = { take: 25, deadlineMs: 20_000, reserveMs: 15_000, staleMs: 10 * 60_000, retryMs: 60_000 };

type Db = Pick<typeof prisma, "job">;

/**
 * One run of POST /api/cron/jobs: the retry and clean-up net behind the instant sending (lib/job-runner.ts).
 * - A RUNNING row older than 10 minutes (its function died) is marked FAILED, so a later run retries it.
 * - Up to 25 due rows: QUEUED, or FAILED at least 60 s ago, fewer than 5 attempts, created in the last 7 days.
 * - Stops starting new rows 15 s before the 20 s deadline (one provider call has a 15 s timeout).
 * An idle store costs exactly one indexed query per run.
 */
export async function runCronQueue(now = Date.now(), db: Db = prisma) {
  const staleBefore = new Date(now - LIMITS.staleMs);
  const due: Prisma.JobWhereInput = {
    name: { in: CRON_JOB_NAMES },
    externalId: null,
    attempts: { lt: 5 },
    createdAt: { gte: new Date(now - 7 * 86_400_000) },
    OR: [{ status: "QUEUED" }, { status: "FAILED", updatedAt: { lte: new Date(now - LIMITS.retryMs) } }],
  };
  const rows = await db.job.findMany({
    where: { OR: [due, { status: "RUNNING", startedAt: { lt: staleBefore } }] },
    orderBy: { createdAt: "asc" },
    take: LIMITS.take,
    select: { id: true, status: true },
  });
  const result = { processed: 0, succeeded: 0, failed: 0, skipped: 0, recovered: 0, remaining: 0 };
  if (!rows.length) return result;

  const stale = rows.filter((row) => row.status === "RUNNING").map((row) => row.id);
  if (stale.length) {
    const recovered = await db.job.updateMany({
      where: { id: { in: stale }, status: "RUNNING", startedAt: { lt: staleBefore } },
      data: { status: "FAILED", error: "Worker lease expired after ten minutes.", finishedAt: new Date(now) },
    });
    result.recovered = recovered.count;
  }
  const ready = rows.filter((row) => row.status !== "RUNNING");
  const deadline = Date.now() + LIMITS.deadlineMs;
  for (const { id } of ready) {
    if (Date.now() + LIMITS.reserveMs >= deadline) break;
    try {
      const outcome = await processJobRow(id);
      if (outcome && typeof outcome === "object" && "skipped" in outcome) result.skipped++;
      else result.succeeded++;
    } catch {
      result.failed++;
    }
    result.processed++;
  }
  // Count what is left only when this run may not have reached everything.
  if (rows.length >= LIMITS.take || result.processed < ready.length)
    result.remaining = await db.job.count({ where: due });
  return result;
}
