import { dispatchJobRow } from "./jobs";
import { processJobRow } from "./job-processor";
import { getJobMode } from "./job-mode";

/**
 * Sends saved Job rows now instead of waiting for the next cron call.
 * - Cron mode (getJobMode(): JOB_MODE=cron, or Vercel without JOB_MODE): each row is processed here with the same atomic claim
 *   the cron uses, so a cron run at the same moment cannot send it twice.
 * - Worker mode: each row goes to the pg-boss queue for the worker.
 * A failure is logged and leaves the row FAILED; the cron (or worker) retries it. It never throws.
 */
export async function runJobsNow(jobIds: string[]) {
  const results = await Promise.allSettled(
    jobIds.map(async (id) => {
      await dispatchJobRow(id);
      if (getJobMode() === "cron") await processJobRow(id);
    }),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected")
      console.error(
        `[jobs] ${jobIds[index]} left for the cron retry:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
  });
  return results.filter((result) => result.status === "fulfilled").length;
}
