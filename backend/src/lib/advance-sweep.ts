import { prisma } from "./db";
import { loadAdvanceSettings } from "./advance-payment";

type Db = Pick<typeof prisma, "order" | "job">;

/**
 * Runs with /api/cron/jobs (every 5 minutes) and the worker's schedule, before the queue is sent:
 * - reminder: one "advance-reminder-email" job per order still AWAITING_PAYMENT `reminderHours` after it was placed
 *   (only for customers who gave an email; the Job row itself is the "already reminded" mark);
 * - expiry: AWAITING_PAYMENT orders older than `expiryHours` become EXPIRED. The order is never cancelled
 *   automatically: it stays On hold for the team, and the customer can still pay or switch to COD.
 * An idle store costs two indexed queries per run (Order has an index on paymentMethod, paymentStatus, createdAt).
 */
export async function runAdvanceSweep(now = Date.now(), db: Db = prisma, limit = 20) {
  const { reminderHours, expiryHours } = await loadAdvanceSettings();
  const expiredBefore = new Date(now - expiryHours * 3_600_000);
  const expired = await db.order.updateMany({
    where: { paymentMethod: "ADVANCE_EASYPAISA", paymentStatus: "AWAITING_PAYMENT", createdAt: { lte: expiredBefore } },
    data: { paymentStatus: "EXPIRED" },
  });

  const due = await db.order.findMany({
    where: {
      paymentMethod: "ADVANCE_EASYPAISA",
      paymentStatus: "AWAITING_PAYMENT",
      createdAt: { lte: new Date(now - reminderHours * 3_600_000), gt: expiredBefore },
      email: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true },
  });
  if (!due.length) return { expired: expired.count, reminders: 0 };
  const reminded = await db.job.findMany({
    where: { name: "advance-reminder-email", orderId: { in: due.map((order) => order.id) } },
    select: { orderId: true },
  });
  const skip = new Set(reminded.map((job) => job.orderId));
  const todo = due.filter((order) => !skip.has(order.id)).slice(0, limit);
  if (todo.length)
    await db.job.createMany({
      data: todo.map(({ id }) => ({ name: "advance-reminder-email", orderId: id, payload: { orderId: id } })),
    });
  return { expired: expired.count, reminders: todo.length };
}
