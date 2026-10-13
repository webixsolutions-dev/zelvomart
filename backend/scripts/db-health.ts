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
  const results: boolean[] = [];
  for (const [name, fn] of [
    ["database connection", async () => prisma.$queryRaw`SELECT 1`],
    ["orders table", async () => prisma.order.count()],
    ["event log table", async () => prisma.eventLog.count()],
    ["session replay table", async () => prisma.sessionReplay.count()],
    ["session replay chunks table", async () => prisma.sessionReplayChunk.count()],
    ["experiments table", async () => prisma.experiment.count()],
    ["rate limit table", async () => prisma.rateLimitBucket.count()],
  ] as const) {
    results.push(await check(name, fn));
  }
  await prisma.$disconnect();
  if (results.some((ok) => !ok)) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
