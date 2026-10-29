import { SITE_ORIGIN, isStorefrontUrl } from "../lib/site-url";
import { privateSafeUrl } from "../lib/url-privacy";
import { replayStorageConfigured } from "../lib/replay-storage";
import { sendTikTokServerEvent } from "../lib/tiktok";
import { trackingHealth } from "../lib/tracking-health";
import { randomBytes } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { getSetting, getSettings } from "../lib/settings";
import { sendMetaServerEvent } from "../lib/meta";
import { eventsRateRule, requestIp, isLikelyBot } from "../lib/rate-limit";
import { dispatchJobRow } from "../lib/jobs";
import { processJobRow } from "../lib/job-processor";
import { waitUntil } from "@vercel/functions";
import type { Express } from "express";
import { META_EVENT_NAMES, allowRules, audit, routeParam } from "../http/shared";

export function registerTrackingRoutes(app: Express) {
  app.post("/api/events", async (req, res) => {
    const userAgent = req.get("user-agent") || undefined;
    if (isLikelyBot(userAgent)) return res.json({ ok: true, ignored: "bot" });
    // Per visitor when the browser sends its visitor id, else per IP (1,200/min). The browser ignores a 429 here.
    if (!(await allowRules(res, [eventsRateRule(requestIp(req), req.body?.visitorId)]))) return;

    const eventName = String(req.body.eventName || "");
    const eventId = String(req.body.eventId || "");
    const replayId = String(req.body.replaySessionId || "");
    const sessionReplayId = /^[0-9a-f-]{36}$/i.test(replayId) ? replayId : null;
    if (
      (!META_EVENT_NAMES.has(eventName) && !["ReplayRageClick", "ReplayError"].includes(eventName)) ||
      !eventId ||
      eventId.length > 160
    )
      return res.status(400).json({ error: "INVALID_EVENT" });

    if (await prisma.eventLog.findFirst({ where: { channel: "browser", eventId, eventName }, select: { id: true } }))
      return res.json({ ok: true, duplicate: true });
    const sourceUrl = privateSafeUrl(String(req.body.sourceUrl || "")).slice(0, 4000) || null;
    const params =
      req.body.params && typeof req.body.params === "object" && !Array.isArray(req.body.params)
        ? (req.body.params as Record<string, unknown>)
        : {};
    const row = await prisma.eventLog.create({
      data: { eventName, eventId, sessionReplayId, channel: "browser", sourceUrl, payload: req.body || {} },
    });

    if (sessionReplayId) {
      const now = new Date(),
        flags = {
          ...(eventName === "AddToCart" ? { reachedCart: true } : {}),
          ...(eventName === "InitiateCheckout" ? { reachedCheckout: true } : {}),
        };
      // Analytics can annotate an existing replay, but only /start registers a recording.
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${sessionReplayId}))`;
        await tx.sessionReplay.updateMany({
          where: { id: sessionReplayId },
          data: { lastSeenAt: now, lastUrl: sourceUrl || "", ...flags },
        });
      });
    }

    // Purchase is dispatched from the order transaction. Meta events are attempted
    // immediately; failures remain durable for the cron retry sweeper.
    const productionEvent = isStorefrontUrl(sourceUrl || "");
    if (eventName !== "Purchase" && !eventName.startsWith("Replay") && productionEvent) {
      const job = await prisma.job.create({
        data: {
          name: "meta-event",
          payload: {
            eventName,
            eventId,
            sourceUrl,
            userAgent,
            eventTime: Math.floor(Date.now() / 1000),
            visitorId: req.body.visitorId || null,
            ip: requestIp(req),
            fbp: req.body.fbp || null,
            fbc: req.body.fbc || null,
            customData: params,
          } as Prisma.InputJsonValue,
        },
      });
      waitUntil(processJobRow(job.id).catch(() => undefined));

      const ttJob = await prisma.job.create({
        data: {
          name: "tiktok-event",
          payload: {
            eventName,
            eventId,
            sourceUrl,
            userAgent,
            eventTime: Math.floor(Date.now() / 1000),
            visitorId: req.body.visitorId || null,
            ip: requestIp(req),
            ttp: req.body.ttp || null,
            ttclid: req.body.ttclid || null,
            customData: params,
          } as Prisma.InputJsonValue,
        },
      });
      dispatchJobRow(ttJob.id).catch(() => undefined);
    }

    res.json({ ok: true, id: row.id });
  });

  app.get("/api/admin/tracking/health", requireAuth("reports.read"), async (_req, res) =>
    res.json(await trackingHealth()),
  );
  app.post("/api/admin/jobs/:id/retry", requireAuth("settings.write"), async (req: AuthedRequest, res) => {
    const job = await prisma.job.findUnique({ where: { id: routeParam(req, "id") } });
    if (!job) return res.status(404).json({ error: "NOT_FOUND" });
    if (
      !["FAILED", "SKIPPED"].includes(job.status) &&
      !(job.status === "QUEUED" && Date.now() - job.createdAt.getTime() > 300000)
    )
      return res.status(409).json({ error: "JOB_NOT_RETRYABLE" });
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "QUEUED", externalId: null, error: null, finishedAt: null },
    });
    await dispatchJobRow(job.id);
    await audit(req, "retry", "Job", job.id);
    res.json({ ok: true });
  });
  app.post("/api/admin/tracking/test/:platform", requireAuth("settings.write"), async (req: AuthedRequest, res) => {
    const platform = routeParam(req, "platform");
    if (!["meta", "tiktok"].includes(platform)) return res.status(400).json({ error: "INVALID_PLATFORM" });
    const testKey = platform === "meta" ? "tracking.metaTestEventCode" : "tracking.tiktokTestEventCode";
    const testEventCode = String(
      (await getSetting(
        testKey,
        process.env[platform === "meta" ? "META_TEST_EVENT_CODE" : "TIKTOK_TEST_EVENT_CODE"] || "",
      )) || "",
    ).trim();
    if (!testEventCode) return res.status(400).json({ error: "Save a platform test event code first." });
    try {
      const event = {
        eventName: "PageView",
        eventId: `admin-test-${randomBytes(12).toString("hex")}`,
        sourceUrl: `${SITE_ORIGIN}/`,
        customData: { test: true },
        testEventCode,
      };
      const result = platform === "meta" ? await sendMetaServerEvent(event) : await sendTikTokServerEvent(event);
      await audit(req, "test_event", "Tracking", platform);
      res.json({ platform, result });
    } catch (error: any) {
      res.status(502).json({ error: error.message || "TEST_EVENT_FAILED" });
    }
  });
  app.get("/api/admin/jobs", requireAuth("reports.read"), async (req, res) => {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(10, Math.floor(Number(req.query.limit) || 50)));
    const [items, total] = await Promise.all([
      prisma.job.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count(),
    ]);
    res.json({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  });
  app.get("/api/admin/tracking", requireAuth("reports.read"), async (_req, res) => {
    const since = new Date(Date.now() - 7 * 86400000);
    const [events, grouped, orders, settings] = await Promise.all([
      prisma.eventLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 3000 }),
      prisma.eventLog.groupBy({
        by: ["eventName", "channel"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: since }, test: false, staffCreated: false } }),
      getSettings([
        "tracking.metaPixelEnabled",
        "tracking.metaPixelId",
        "tracking.metaCapiEnabled",
        "tracking.metaCapiToken",
        "tracking.metaTestEventCode",
        "tracking.tiktokPixelEnabled",
        "tracking.tiktokPixelId",
        "tracking.tiktokEventsApiEnabled",
        "tracking.tiktokEventsApiToken",
        "tracking.tiktokAccessToken",
        "tracking.tiktokTestEventCode",
        "tracking.sessionReplayEnabled",
        "tracking.sessionReplayRetentionDays",
      ]),
    ]);
    const browser: Record<string, number> = {};
    const server: Record<string, number> = {};
    const tiktokServer: Record<string, number> = {};
    for (const row of grouped) {
      if (row.channel === "tiktok-server") {
        tiktokServer[row.eventName] = (tiktokServer[row.eventName] || 0) + row._count._all;
      } else if (row.channel === "server" || row.channel === "meta-server") {
        server[row.eventName] = (server[row.eventName] || 0) + row._count._all;
      } else {
        browser[row.eventName] = (browser[row.eventName] || 0) + row._count._all;
      }
    }

    const browserIds = new Set(events.filter((e) => e.channel === "browser").map((e) => `${e.eventName}:${e.eventId}`));
    const metaServerIds = new Set(
      events
        .filter((e) => (e.channel === "server" || e.channel === "meta-server") && e.accepted === true)
        .map((e) => `${e.eventName}:${e.eventId}`),
    );
    const tiktokServerIds = new Set(
      events
        .filter((e) => e.channel === "tiktok-server" && e.accepted === true)
        .map((e) => `${e.eventName}:${e.eventId}`),
    );

    const pairEligibleIds = [...browserIds].filter((id) => !id.startsWith("Purchase:"));
    const pairEligible = pairEligibleIds.length;

    // Meta deduplication metrics
    const paired = pairEligibleIds.filter((id) => metaServerIds.has(id)).length;
    const dedupeCoverage = pairEligible ? Math.round((paired / pairEligible) * 1000) / 10 : 100;
    const acceptedPurchases = events.filter(
      (e) =>
        (e.channel === "server" || e.channel === "meta-server") && e.eventName === "Purchase" && e.accepted === true,
    ).length;
    const purchaseCoverage = orders ? Math.round((acceptedPurchases / orders) * 1000) / 10 : 100;

    // TikTok deduplication metrics
    const tiktokPaired = pairEligibleIds.filter((id) => tiktokServerIds.has(id)).length;
    const tiktokDedupeCoverage = pairEligible ? Math.round((tiktokPaired / pairEligible) * 1000) / 10 : 100;
    const tiktokAcceptedPurchases = events.filter(
      (e) => e.channel === "tiktok-server" && e.eventName === "Purchase" && e.accepted === true,
    ).length;
    const tiktokPurchaseCoverage = orders ? Math.round((tiktokAcceptedPurchases / orders) * 1000) / 10 : 100;

    // Tracking integration statuses
    const metaPixelEnabled =
      settings["tracking.metaPixelEnabled"] !== false && settings["tracking.metaPixelEnabled"] !== "false";
    const metaPixelId = String(settings["tracking.metaPixelId"] || process.env.META_PIXEL_ID || "");
    const metaPixelConfigured = Boolean(metaPixelId);

    const metaCapiEnabled =
      settings["tracking.metaCapiEnabled"] !== false && settings["tracking.metaCapiEnabled"] !== "false";
    const metaCapiConfigured = Boolean(settings["tracking.metaCapiToken"] || process.env.META_CAPI_TOKEN);
    const metaTestEventCodeConfigured = Boolean(
      settings["tracking.metaTestEventCode"] || process.env.META_TEST_EVENT_CODE,
    );

    const tiktokPixelEnabled =
      settings["tracking.tiktokPixelEnabled"] !== false && settings["tracking.tiktokPixelEnabled"] !== "false";
    const tiktokPixelId = String(settings["tracking.tiktokPixelId"] || process.env.TIKTOK_PIXEL_ID || "");
    const tiktokPixelConfigured = Boolean(tiktokPixelId);

    const tiktokEventsApiEnabled =
      settings["tracking.tiktokEventsApiEnabled"] !== false && settings["tracking.tiktokEventsApiEnabled"] !== "false";
    const tiktokEventsApiConfigured = Boolean(
      settings["tracking.tiktokEventsApiToken"] ||
        settings["tracking.tiktokAccessToken"] ||
        process.env.TIKTOK_EVENTS_API_TOKEN ||
        process.env.TIKTOK_ACCESS_TOKEN,
    );
    const tiktokTestEventCodeConfigured = Boolean(
      settings["tracking.tiktokTestEventCode"] || process.env.TIKTOK_TEST_EVENT_CODE,
    );

    const sessionReplayEnabled =
      settings["tracking.sessionReplayEnabled"] !== false && settings["tracking.sessionReplayEnabled"] !== "false";
    const sessionReplayRetentionDays = Number(
      settings["tracking.sessionReplayRetentionDays"] || process.env.SESSION_REPLAY_RETENTION_DAYS || 30,
    );

    const metaLastSuccess =
      events.find((e) => (e.channel === "server" || e.channel === "meta-server") && e.accepted === true)?.createdAt ||
      null;
    const tiktokLastSuccess =
      events.find((e) => e.channel === "tiktok-server" && e.accepted === true)?.createdAt || null;
    const serverErrors = events
      .filter(
        (e) =>
          (e.channel === "server" || e.channel === "meta-server" || e.channel === "tiktok-server") &&
          (e.error || e.accepted === false),
      )
      .slice(0, 100);

    res.json({
      browser,
      server,
      tiktokServer,
      orders,
      // Meta default / backward-compatible properties
      acceptedPurchases,
      purchaseCoverage,
      paired,
      pairEligible,
      dedupeCoverage,
      lastSuccess: metaLastSuccess,
      errors: serverErrors,

      // Dedicated Meta & TikTok metrics blocks
      meta: {
        server,
        acceptedPurchases,
        purchaseCoverage,
        paired,
        pairEligible,
        dedupeCoverage,
        lastSuccess: metaLastSuccess,
      },
      tiktok: {
        server: tiktokServer,
        acceptedPurchases: tiktokAcceptedPurchases,
        purchaseCoverage: tiktokPurchaseCoverage,
        paired: tiktokPaired,
        pairEligible,
        dedupeCoverage: tiktokDedupeCoverage,
        lastSuccess: tiktokLastSuccess,
      },

      // Integration status summary
      integrations: {
        metaPixel: { enabled: metaPixelEnabled, configured: metaPixelConfigured, id: metaPixelId },
        metaCapi: {
          enabled: metaCapiEnabled,
          configured: metaCapiConfigured,
          testEventCodeConfigured: metaTestEventCodeConfigured,
        },
        tiktokPixel: { enabled: tiktokPixelEnabled, configured: tiktokPixelConfigured, id: tiktokPixelId },
        tiktokEventsApi: {
          enabled: tiktokEventsApiEnabled,
          configured: tiktokEventsApiConfigured,
          testEventCodeConfigured: tiktokTestEventCodeConfigured,
        },
        sessionReplay: {
          enabled: sessionReplayEnabled,
          configured: replayStorageConfigured(),
          retentionDays: sessionReplayRetentionDays,
        },
      },

      config: {
        pixelId: metaPixelId,
        capiConfigured: metaCapiConfigured,
        testEventCodeConfigured: metaTestEventCodeConfigured,
        appEnv: process.env.APP_ENV || "development",
        metaPixel: { enabled: metaPixelEnabled, configured: metaPixelConfigured, id: metaPixelId },
        metaCapi: {
          enabled: metaCapiEnabled,
          configured: metaCapiConfigured,
          testEventCodeConfigured: metaTestEventCodeConfigured,
        },
        tiktokPixel: { enabled: tiktokPixelEnabled, configured: tiktokPixelConfigured, id: tiktokPixelId },
        tiktokEventsApi: {
          enabled: tiktokEventsApiEnabled,
          configured: tiktokEventsApiConfigured,
          testEventCodeConfigured: tiktokTestEventCodeConfigured,
        },
        sessionReplay: {
          enabled: sessionReplayEnabled,
          configured: replayStorageConfigured(),
          retentionDays: sessionReplayRetentionDays,
        },
      },
    });
  });
}
