import "dotenv/config";
import { prisma } from "../src/lib/db";
import { MAX_BACKLOG_AGE_MS } from "../src/lib/launch-jobs";

async function main() {
  const cutoff = new Date(Date.now() - MAX_BACKLOG_AGE_MS);
  const pending = { status: { in: ["QUEUED", "FAILED"] as ("QUEUED" | "FAILED")[] } };
  const [counts, expired, recent] = await Promise.all([
    prisma.job.groupBy({ by: ["name", "status"], where: pending, _count: true }),
    prisma.job.count({ where: { ...pending, createdAt: { lt: cutoff } } }),
    prisma.job.count({ where: { ...pending, createdAt: { gte: cutoff } } }),
  ]);
  console.log(JSON.stringify({ dryRun: !process.argv.includes("--apply"), cutoff, counts, expired, recent }, null, 2));
  if (process.argv.includes("--apply")) {
    const result = await prisma.job.updateMany({
      where: { ...pending, createdAt: { lt: cutoff } },
      data: {
        status: "SKIPPED",
        error: "STALE_BACKLOG: cancelled before worker launch; older than seven days.",
        finishedAt: new Date(),
      },
    });
    console.log(`Skipped ${result.count} expired jobs. Recent jobs still require review before starting the worker.`);
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
