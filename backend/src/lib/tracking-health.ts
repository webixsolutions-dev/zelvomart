import { prisma } from "./db";
import { getSettings } from "./settings";
export async function trackingHealth() {
  const since = new Date(Date.now() - 86400000),
    stuckBefore = new Date(Date.now() - 5 * 60000);
  const [settings, failed, skipped, stuck, orders, accepted] = await Promise.all([
    getSettings([
      "worker.heartbeat",
      "tracking.metaCapiToken",
      "tracking.metaCapiEnabled",
      "tracking.metaPixelId",
      "tracking.tiktokEventsApiToken",
      "tracking.tiktokAccessToken",
      "tracking.tiktokPixelId",
      "tracking.tiktokEventsApiEnabled",
    ]),
    prisma.job.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    prisma.job.count({ where: { status: "SKIPPED", createdAt: { gte: since } } }),
    prisma.job.count({ where: { status: { in: ["QUEUED", "RUNNING"] }, createdAt: { lt: stuckBefore } } }),
    prisma.order.findMany({
      where: { createdAt: { gte: since }, test: false, staffCreated: false, blocklistedAtOrder: false },
      select: { orderNumber: true },
    }),
    prisma.eventLog.findMany({
      where: {
        eventName: "Purchase",
        accepted: true,
        createdAt: { gte: since },
        channel: { in: ["server", "tiktok-server"] },
      },
      select: { eventId: true, channel: true },
    }),
  ]);
  const heartbeat = (settings["worker.heartbeat"] as any)?.at || null;
  const workerHealthy = !!heartbeat && Date.now() - new Date(heartbeat).getTime() < 120000;
  const platforms = {
    meta: {
      enabled: settings["tracking.metaCapiEnabled"] !== false && settings["tracking.metaCapiEnabled"] !== "false",
      configured:
        !!(settings["tracking.metaPixelId"] || process.env.META_PIXEL_ID) &&
        !!(settings["tracking.metaCapiToken"] || process.env.META_CAPI_TOKEN),
      channel: "server",
    },
    tiktok: {
      enabled:
        settings["tracking.tiktokEventsApiEnabled"] !== false &&
        settings["tracking.tiktokEventsApiEnabled"] !== "false",
      configured:
        !!(settings["tracking.tiktokPixelId"] || process.env.TIKTOK_PIXEL_ID) &&
        !!(
          settings["tracking.tiktokEventsApiToken"] ||
          settings["tracking.tiktokAccessToken"] ||
          process.env.TIKTOK_EVENTS_API_TOKEN ||
          process.env.TIKTOK_ACCESS_TOKEN
        ),
      channel: "tiktok-server",
    },
  };
  const coverage = Object.fromEntries(
    Object.entries(platforms).map(([name, p]) => {
      const ids = new Set(accepted.filter((e) => e.channel === p.channel).map((e) => e.eventId));
      const count = orders.filter((o) => ids.has(o.orderNumber)).length;
      return [
        name,
        {
          enabled: p.enabled,
          configured: p.configured,
          accepted: count,
          orders: orders.length,
          percent: orders.length ? (count / orders.length) * 100 : null,
        },
      ];
    }),
  );
  const issues: string[] = [];
  if (!workerHealthy) issues.push("Background worker heartbeat is missing or stale.");
  if (stuck) issues.push(`${stuck} jobs have been queued/running for more than 5 minutes.`);
  if (failed) issues.push(`${failed} jobs failed in the last 24 hours.`);
  if (skipped) issues.push(`${skipped} jobs were skipped in the last 24 hours.`);
  for (const [name, p] of Object.entries(coverage) as [string, any][]) {
    if (p.enabled && !p.configured) issues.push(`${name} server tracking is enabled but credentials are missing.`);
    if (p.enabled && p.percent !== null && p.percent < 95) issues.push(`${name} Purchase coverage is below 95%.`);
  }
  return {
    healthy: issues.length === 0,
    issues,
    worker: { healthy: workerHealthy, lastHeartbeat: heartbeat },
    failed,
    skipped,
    stuck,
    coverage,
  };
}
