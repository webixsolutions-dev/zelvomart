import PgBoss from "pg-boss";
import { prisma } from "./db";

let boss: PgBoss | null = null;

export async function getBoss() {
  if (!boss) {
    boss = new PgBoss({ connectionString: process.env.WORKER_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL! });
    boss.on("error", (error) => console.error("pg-boss", error));
    await boss.start();
  }
  return boss;
}

export async function dispatchJobRow(jobId: string) {
  const row = await prisma.job.findUnique({ where: { id: jobId } });
  if (!row) throw new Error(`Job log ${jobId} not found`);

  const queue = await getBoss();
  const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  await queue.createQueue(row.name);
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
