import PgBoss from "pg-boss";
import { prisma } from "./db";
import { databaseConnection } from "./db-ssl";

let boss: PgBoss | null = null;
let sender: Promise<PgBoss> | null = null;
const knownQueues = new Set<string>();

/** The worker's full pg-boss: maintenance, schedules and its own connection pool. Started by workers/main.ts. */
export async function getBoss() {
  if (!boss) {
    boss = new PgBoss({ ...databaseConnection(process.env.WORKER_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL!) });
    boss.on("error", (error) => console.error("pg-boss", error));
    await boss.start();
  }
  return boss;
}

/**
 * Send-only pg-boss for the web functions: no maintenance, no schedules, no schema migration and a
 * pool of 2, so a checkout never waits for pg-boss to start its supervisor. The worker reuses its own.
 */
function getSender() {
  if (boss) return Promise.resolve(boss);
  sender ??= (async () => {
    const client = new PgBoss({
      ...databaseConnection(process.env.WORKER_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL!),
      supervise: false,
      schedule: false,
      migrate: false,
      max: 2,
    });
    client.on("error", (error) => console.error("pg-boss sender", error));
    await client.start();
    return client;
  })().catch((error) => {
    sender = null;
    throw error;
  });
  return sender;
}

export async function dispatchJobRow(jobId: string) {
  const row = await prisma.job.findUnique({ where: { id: jobId } });
  if (!row) throw new Error(`Job log ${jobId} not found`);

  const queue = await getSender();
  const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  if (!knownQueues.has(row.name)) {
    await queue.createQueue(row.name);
    knownQueues.add(row.name);
  }
  const externalId = await queue.send(
    row.name,
    { ...payload, jobLogId: row.id, orderId: row.orderId },
    { retryLimit: 5, retryDelay: 30, retryBackoff: true },
  );

  await prisma.job.update({
    where: { id: row.id },
    data: { externalId: externalId || undefined, status: "QUEUED" },
  });
  return row;
}

export async function enqueueJob(name: string, payload: Record<string, unknown>, orderId?: string) {
  const row = await prisma.job.create({
    data: { name, payload: payload as any, orderId },
  });
  await dispatchJobRow(row.id);
  return row;
}

export function jobResultStatus(result:unknown){return result&&typeof result==='object'&&'skipped' in result?'SKIPPED' as const:'SUCCEEDED' as const}
