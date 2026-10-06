import "dotenv/config";
import { prisma } from "../src/lib/db";

async function check(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`[OK] ${name}`);
    return true;
  } catch (error: any) {
    console.error(`[FAIL] ${name}:`, error?.code || error?.message || error);
    return false;
  }
}

async function main() {
  const results = await Promise.all([
    check("database connection", async () => prisma.$queryRaw`SELECT 1`),
    check("orders table", async () => prisma.order.count()),
    check("event log table", async () => prisma.eventLog.count()),
    check("session replay table", async () => prisma.sessionReplay.count()),
    check("session replay chunks table", async () => prisma.sessionReplayChunk.count()),
    check("experiments table", async () => prisma.experiment.count()),
    check("rate limit table", async () => prisma.rateLimitBucket.count()),
  ]);
  await prisma.$disconnect();
  if (results.some((ok) => !ok)) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
