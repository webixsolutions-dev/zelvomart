import { prisma } from "@/lib/db";

export async function enforceRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
) {
  const now = new Date();
  const row = await prisma.rateLimitBucket.findUnique({ where: { bucketKey } });

  if (!row || now.getTime() - row.windowStart.getTime() >= windowMs) {
    await prisma.rateLimitBucket.upsert({
      where: { bucketKey },
      update: { count: 1, windowStart: now },
      create: { bucketKey, count: 1, windowStart: now },
    });
    return;
  }

  if (row.count >= limit) {
    throw new Error("RATE_LIMITED");
  }

  await prisma.rateLimitBucket.update({
    where: { bucketKey },
    data: { count: { increment: 1 } },
  });
}
