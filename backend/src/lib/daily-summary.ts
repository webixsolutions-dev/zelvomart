import { prisma } from "./db";
import { getSetting } from "./settings";
import { deliverEmail, emailIdentity, emailLayout, internalEmail, orderAlertRecipients } from "./email-delivery";
import { money } from "./format";

export async function sendDailySummary(now = new Date()) {
  if (!process.env.RESEND_API_KEY) return { skipped: "RESEND_API_KEY is not configured" };
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const [orders, purchases, failedJobs] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end }, test: false, staffCreated: false },
      select: { total: true },
    }),
    prisma.eventLog.count({
      where: {
        eventName: "Purchase",
        channel: { in: ["server", "meta-server"] },
        accepted: true,
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.job.count({ where: { status: "FAILED", createdAt: { gte: start, lt: end } } }),
  ]);
  const day = start.toISOString().slice(0, 10);
  const summary = internalEmail(
    "Orders",
    orderAlertRecipients(await getSetting<unknown>("notifications.orderRecipients", null)),
    `Daily summary • ${day}`,
    `<h2>Daily summary</h2><p>${day}</p><ul><li>Orders: <b>${orders.length}</b></li><li>Revenue: <b>${money(orders.reduce((sum, order) => sum + Number(order.total), 0))}</b></li><li>Accepted Meta Purchase events: <b>${purchases}</b></li><li>Failed background jobs: <b>${failedJobs}</b></li></ul>`,
  );
  return deliverEmail(
    { ...emailIdentity("orders"), to: summary.to, subject: summary.subject, html: emailLayout(summary.html) },
    `daily-summary-${start.toISOString().slice(0, 10)}`,
  );
}
