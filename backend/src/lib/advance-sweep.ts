import { prisma } from "./db";
import { loadAdvanceSettings } from "./advance-payment";

type Db = Pick<typeof prisma, "order" | "job">;

/**
 * Runs with /api/cron/jobs (every 5 minutes) and the worker's schedule, before the queue is sent:
 * - first reminder ("Complete your payment"): one "advance-first-reminder-email" job per order still
 *   AWAITING_PAYMENT `firstReminderMinutes` after it was placed. Advance orders get no email at checkout, so this is
 *   their first email. Skipped once the second reminder is due (the customer gets one email, not two at once);
 * - second reminder: one "advance-reminder-email" job `reminderHours` after the order;
 * - expiry: AWAITING_PAYMENT orders older than `expiryHours` become EXPIRED. The order is never cancelled
 *   automatically: it stays On hold for the team, and the customer can still pay or switch to COD.
 * Only customers who gave an email; the Job row itself is the "already sent" mark.
 * An idle store costs a few indexed queries per run (Order has an index on paymentMethod, paymentStatus, createdAt).
 */
export async function runAdvanceSweep(now = Date.now(), db: Db = prisma, limit = 20) {
  const { firstReminderMinutes, reminderHours, expiryHours } = await loadAdvanceSettings();
  const expiredBefore = new Date(now - expiryHours * 3_600_000);
  const secondDueBefore = new Date(now - reminderHours * 3_600_000);
  const firstDueBefore = new Date(now - firstReminderMinutes * 60_000);
  const expired = await db.order.updateMany({
    where: { paymentMethod: "ADVANCE_EASYPAISA", paymentStatus: "AWAITING_PAYMENT", createdAt: { lte: expiredBefore } },
    data: { paymentStatus: "EXPIRED" },
  });

  const queue = async (name: string, from: Date, to: Date, max: number) => {
    if (max <= 0 || from >= to) return 0;
    const due = await db.order.findMany({
      where: {
        paymentMethod: "ADVANCE_EASYPAISA",
        paymentStatus: "AWAITING_PAYMENT",
        createdAt: { lte: to, gt: from },
        email: { not: null },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true },
    });
    if (!due.length) return 0;
    const sent = await db.job.findMany({
      where: { name, orderId: { in: due.map((order) => order.id) } },
      select: { orderId: true },
    });
    const skip = new Set(sent.map((job) => job.orderId));
    const todo = due.filter((order) => !skip.has(order.id)).slice(0, max);
    if (todo.length)
      await db.job.createMany({ data: todo.map(({ id }) => ({ name, orderId: id, payload: { orderId: id } })) });
    return todo.length;
  };

  const reminders = await queue("advance-reminder-email", expiredBefore, secondDueBefore, limit);
  const firstReminders = await queue(
    "advance-first-reminder-email",
    secondDueBefore,
    firstDueBefore,
    limit - reminders,
  );
  return { expired: expired.count, reminders, firstReminders };
}
