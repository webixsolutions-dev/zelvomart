import { prisma } from "./db";
import { getSetting } from "./settings";
import { deliverEmail, emailIdentity, emailLayout } from "./email-delivery";
import { money } from "./format";

export async function sendDailySummary(now = new Date()) {
  if (!process.env.RESEND_API_KEY) return { skipped: "RESEND_API_KEY is not configured" };
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const [orders, purchases, failedJobs] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: start, lt: end }, test: false, staffCreated: false }, select: { total: true } }),
    prisma.eventLog.count({ where: { eventName: "Purchase", channel: { in: ["server", "meta-server"] }, accepted: true, createdAt: { gte: start, lt: end } } }),
    prisma.job.count({ where: { status: "FAILED", createdAt: { gte: start, lt: end } } }),
  ]);
  const recipients = await getSetting<string[]>(
    "notifications.orderRecipients",
    (process.env.ORDER_ALERT_RECIPIENTS || "support@zelvomart.com").split(",").map((x) => x.trim()).filter(Boolean),
  );
  return deliverEmail(
    {
      ...emailIdentity("orders"),
      to: recipients,
      subject: `Zelvomart daily summary • ${start.toISOString().slice(0, 10)}`,
      html: emailLayout(`<h2>Daily summary</h2><p>${start.toISOString().slice(0, 10)}</p><ul><li>Orders: <b>${orders.length}</b></li><li>Revenue: <b>${money(orders.reduce((sum, order) => sum + Number(order.total), 0))}</b></li><li>Accepted Meta Purchase events: <b>${purchases}</b></li><li>Failed background jobs: <b>${failedJobs}</b></li></ul>`),
    },
    `daily-summary-${start.toISOString().slice(0, 10)}`,
  );
}
