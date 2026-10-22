import { privateSafeUrl } from "../lib/url-privacy";
import {
  storeReplayChunk,
  replayChunkUrl,
  replayStorageConfigured,
  deleteReplayChunks,
  readReplayChunk,
  prepareReplayChunk,
} from "../lib/replay-storage";
import { ingestReplayChunk, startReplaySession } from "../lib/replay-ingest";
import { createMemoryRateLimiter } from "../lib/rate-limit-store";
import { requestIp } from "../lib/rate-limit";
import express from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import type { Express } from "express";
import {
  audit,
  maybeCleanupOldSessionReplays,
  normalizeTrafficSource,
  routeParam,
  setNoStore,
  upload,
} from "../http/shared";

const limitReplayTraffic = createMemoryRateLimiter();
function allowReplayTraffic(req: express.Request, res: express.Response, namespace: string, limit: number) {
  const result = limitReplayTraffic(`${namespace}:${requestIp(req)}`, limit, 60000);
  if (result.allowed) return true;
  res.setHeader("Retry-After", String(result.retryAfterSeconds));
  res.status(429).json({ error: "RATE_LIMITED", retryAfterSeconds: result.retryAfterSeconds });
  return false;
}

// Privacy-safe customer session replay ingestion. Input values are masked in the browser before these events arrive.
// Recording events are stored only in the private R2 bucket; Postgres keeps metadata (storageKey, counts, timestamps).
// Without R2 nothing is recorded: these routes answer 503 before touching the database.
function replayStorageMissing(res: express.Response) {
  if (replayStorageConfigured()) return false;
  res.status(503).json({ error: "REPLAY_STORAGE_NOT_CONFIGURED" });
  return true;
}

export function registerReplayRoutes(app: Express) {
  app.post("/api/session-replays/start", async (req, res) => {
    if (replayStorageMissing(res)) return;
    void maybeCleanupOldSessionReplays();
    if (!allowReplayTraffic(req, res, "replay-start", 60)) return;
    const sessionId = String(req.body.sessionId || "").trim();
    const visitorId = String(req.body.visitorId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !/^[0-9a-f-]{36}$/i.test(visitorId))
      return res.status(400).json({ error: "INVALID_SESSION" });
    const source = req.body.source && typeof req.body.source === "object" ? req.body.source : {};
    const sourceName = normalizeTrafficSource(
      (source as any).source ||
        (source as any).utm_source ||
        (source as any).lastTouch?.utm_source ||
        (source as any).firstTouch?.utm_source ||
        "direct",
    );
    const startedAt = new Date(req.body.startedAt || Date.now());
    const landingUrl = privateSafeUrl(String(req.body.landingUrl || req.body.currentUrl || "")).slice(0, 4000);
    const lastUrl = privateSafeUrl(String(req.body.currentUrl || landingUrl)).slice(0, 4000);
    const now = new Date();
    const medium = String((source as any).medium || (source as any).utm_medium || "").slice(0, 120) || null;
    const campaign = String((source as any).campaign || (source as any).utm_campaign || "").slice(0, 240) || null;
    const pageView = req.body.pageView === true;
    const metadata = {
      firstTouch: (source as any).firstTouch || null,
      lastTouch: (source as any).lastTouch || null,
    } as Prisma.InputJsonValue;
    const updateData: Prisma.SessionReplayUpdateInput = {
      visitorId,
      source: sourceName,
      medium,
      campaign,
      lastSeenAt: now,
      lastUrl,
      referrer: req.body.referrer ? String(req.body.referrer).slice(0, 4000) : undefined,
      device: req.body.device ? String(req.body.device).slice(0, 40) : undefined,
      viewport: req.body.viewport ? String(req.body.viewport).slice(0, 40) : undefined,
      status: "ACTIVE",
      metadata,
      ...(pageView ? { pageViews: { increment: 1 } } : {}),
    };
    const result = await startReplaySession(
      prisma,
      requestIp(req),
      {
        id: sessionId,
        visitorId,
        source: sourceName,
        medium,
        campaign,
        landingUrl,
        lastUrl,
        referrer: req.body.referrer ? String(req.body.referrer).slice(0, 4000) : null,
        device: req.body.device ? String(req.body.device).slice(0, 40) : null,
        viewport: req.body.viewport ? String(req.body.viewport).slice(0, 40) : null,
        status: "ACTIVE",
        startedAt: Number.isNaN(startedAt.getTime()) ? now : startedAt,
        lastSeenAt: now,
        metadata,
      },
      updateData,
    );
    if (result.status !== 200) {
      if (result.retryAfterSeconds) res.setHeader("Retry-After", String(result.retryAfterSeconds));
      return res.status(result.status).json({ error: result.error, retryAfterSeconds: result.retryAfterSeconds });
    }
    res.json({ ok: true });
  });

  app.post("/api/session-replays/chunk", async (req, res) => {
    if (replayStorageMissing(res)) return;
    if (!allowReplayTraffic(req, res, "replay-chunks", 180)) return;
    const sessionId = String(req.body.sessionId || ""),
      sequence = Number(req.body.sequence),
      events = Array.isArray(req.body.events) ? req.body.events : [];
    if (
      !/^[0-9a-f-]{36}$/i.test(sessionId) ||
      !Number.isSafeInteger(sequence) ||
      sequence < 0 ||
      sequence > 2147483647 ||
      events.length < 1 ||
      events.length > 100
    )
      return res.status(400).json({ error: "INVALID_REPLAY_CHUNK" });
    if (
      events.some(
        (e: any) =>
          !e ||
          !Number.isFinite(e.timestamp) ||
          e.timestamp < Date.now() - 90 * 86400000 ||
          e.timestamp > Date.now() + 60000,
      )
    )
      return res.status(400).json({ error: "INVALID_REPLAY_TIMESTAMP" });
    const currentUrl = privateSafeUrl(String(req.body.currentUrl || "")).slice(0, 4000);
    const firstTimestamp = Math.min(...events.map((e: any) => e.timestamp)),
      lastTimestamp = Math.max(...events.map((e: any) => e.timestamp));
    const input = {
      sessionId,
      sequence,
      currentUrl,
      firstTimestamp,
      lastTimestamp,
      eventCount: events.length,
      hasSnapshot: events.some((e: any) => e.type === 2),
      body: prepareReplayChunk(events),
    };
    let storageFailed = false;
    const result = await ingestReplayChunk(prisma, input, async (...args) => {
      try {
        return await storeReplayChunk(...args);
      } catch {
        storageFailed = true;
        return null;
      }
    });
    if (result.status !== 200)
      return res.status(result.status).json({
        error: storageFailed ? "REPLAY_STORAGE_UNAVAILABLE" : result.error,
      });
    res.json({ ok: true, ...(result.duplicate ? { duplicate: true } : {}) });
  });

  app.post("/api/session-replays/end", async (req, res) => {
    if (replayStorageMissing(res)) return;
    const sessionId = String(req.body.sessionId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return res.status(400).json({ error: "INVALID_SESSION" });
    const endedAt = new Date(req.body.endedAt || Date.now());
    await prisma.sessionReplay.updateMany({
      where: { id: sessionId },
      data: {
        status: "ENDED",
        endedAt: Number.isNaN(endedAt.getTime()) ? new Date() : endedAt,
        lastSeenAt: new Date(),
        lastUrl: privateSafeUrl(String(req.body.currentUrl || "")).slice(0, 4000),
      },
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/session-replays", requireAuth("reports.read"), async (req, res) => {
    if (
      req.query.minDuration !== undefined &&
      (!Number.isFinite(Number(req.query.minDuration)) || Number(req.query.minDuration) < 0)
    )
      return res.status(400).json({ error: "INVALID_DURATION" });
    const q = String(req.query.q || "").trim(),
      source = String(req.query.source || ""),
      outcome = String(req.query.outcome || "all");
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1)),
      limit = Math.min(100, Math.max(10, Math.floor(Number(req.query.limit) || 20)));
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00+05:00`) : new Date(Date.now() - 30 * 86400000),
      to = req.query.to ? new Date(`${req.query.to}T23:59:59.999+05:00`) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to)
      return res.status(400).json({ error: "INVALID_DATE_RANGE" });
    const where: Prisma.SessionReplayWhereInput = {
      startedAt: { gte: from, lte: to },
      hasSnapshot: true,
      eventCount: { gte: 2 },
      durationMs: { gte: Math.max(10000, Number(req.query.minDuration || 10) * 1000) },
      ...(source && source !== "all" ? { source } : {}),
      ...(req.query.device ? { device: String(req.query.device) } : {}),
      ...(req.query.campaign ? { campaign: { contains: String(req.query.campaign), mode: "insensitive" } } : {}),
      ...(req.query.product
        ? {
            OR: [
              { landingUrl: { contains: String(req.query.product), mode: "insensitive" } },
              { lastUrl: { contains: String(req.query.product), mode: "insensitive" } },
            ],
          }
        : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { landingUrl: { contains: q, mode: "insensitive" } },
                  { lastUrl: { contains: q, mode: "insensitive" } },
                  { campaign: { contains: q, mode: "insensitive" } },
                  { visitorId: { contains: q } },
                ],
              },
            ],
          }
        : {}),
      ...(req.query.visitor ? { visitorId: String(req.query.visitor) } : {}),
      ...(outcome === "ordered"
        ? { ordered: true }
        : outcome === "no-order"
          ? { ordered: false }
          : outcome === "cart-no-order"
            ? { reachedCart: true, ordered: false }
            : outcome === "checkout-no-order"
              ? { reachedCheckout: true, ordered: false }
              : outcome === "live"
                ? { status: "ACTIVE", lastSeenAt: { gte: new Date(Date.now() - 60000) } }
                : {}),
    };
    if (["product-no-cart", "visitor-no-product"].includes(outcome)) {
      const viewed = await prisma.eventLog.findMany({
        where: {
          eventName: "ViewContent",
          channel: "browser",
          createdAt: { gte: from, lte: to },
          sessionReplayId: { not: null },
        },
        distinct: ["sessionReplayId"],
        select: { sessionReplayId: true },
      });
      where.id =
        outcome === "product-no-cart"
          ? { in: viewed.map((e) => e.sessionReplayId!) }
          : { notIn: viewed.map((e) => e.sessionReplayId!) };
      where.ordered = false;
      if (outcome === "product-no-cart") where.reachedCart = false;
    }
    if (outcome === "cart-no-checkout") {
      where.reachedCart = true;
      where.reachedCheckout = false;
      where.ordered = false;
    }
    const [sessions, total, sourceGroups] = await Promise.all([
      prisma.sessionReplay.findMany({
        where,
        orderBy:
          req.query.sort === "oldest"
            ? { startedAt: "asc" }
            : req.query.sort === "duration"
              ? { durationMs: "desc" }
              : { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sessionReplay.count({ where }),
      prisma.sessionReplay.groupBy({
        by: ["source"],
        where: { startedAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
    ]);
    const orders = await prisma.order.findMany({
      where: { replaySessionId: { in: sessions.map((s) => s.id) } },
      select: { id: true, orderNumber: true, replaySessionId: true, total: true, createdAt: true, city: true },
      orderBy: { createdAt: "desc" },
    });
    const orderMap = new Map(orders.map((o) => [o.replaySessionId, o]));
    res.json({
      storageConfigured: replayStorageConfigured(),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      items: sessions.map((s) => ({
        ...s,
        orderDestination: orderMap.get(s.id)?.city || null,
        order: orderMap.has(s.id) ? { ...orderMap.get(s.id), total: Number(orderMap.get(s.id)!.total) } : null,
      })),
      stats: {
        last30: total,
        ordered30: await prisma.sessionReplay.count({ where: { startedAt: { gte: from, lte: to }, ordered: true } }),
        sources: Object.fromEntries(sourceGroups.map((s) => [s.source, s._count._all])),
      },
    });
  });
  app.get("/api/admin/session-replays/:id/chunks/:sequence", requireAuth("reports.read"), async (req, res) => {
    if (!Number.isInteger(Number(routeParam(req, "sequence"))) || Number(routeParam(req, "sequence")) < 0)
      return res.status(400).json({ error: "INVALID_SEQUENCE" });
    const chunk = await prisma.sessionReplayChunk.findUnique({
      where: {
        sessionId_sequence: { sessionId: routeParam(req, "id"), sequence: Number(routeParam(req, "sequence")) },
      },
      select: { storageKey: true },
    });
    if (!chunk) return res.status(404).json({ error: "NOT_FOUND" });
    setNoStore(res);
    if (!chunk.storageKey) return res.status(410).json({ error: "RECORDING_FILE_EXPIRED" });
    if (!replayStorageConfigured()) return res.status(503).json({ error: "REPLAY_STORAGE_NOT_CONFIGURED" });
    {
      if (req.query.download === "1") {
        try {
          return res.json({ events: await readReplayChunk(chunk.storageKey) });
        } catch (error: any) {
          if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404)
            return res.status(410).json({ error: "RECORDING_FILE_EXPIRED" });
          return res.status(503).json({ error: "REPLAY_STORAGE_UNAVAILABLE" });
        }
      }
      return res.json({ url: await replayChunkUrl(chunk.storageKey) });
    }
  });
  app.get("/api/admin/session-replays/:id", requireAuth("reports.read"), async (req, res) => {
    const id = routeParam(req, "id");
    const checkpoint =
      req.query.live === "1"
        ? await prisma.sessionReplayChunk.findFirst({
            where: { sessionId: id, hasSnapshot: true },
            select: { sequence: true },
            orderBy: { sequence: "desc" },
          })
        : null;
    const [session, order, markers, chunks] = await Promise.all([
      prisma.sessionReplay.findUnique({ where: { id } }),
      prisma.order.findFirst({
        where: { replaySessionId: id },
        select: { id: true, orderNumber: true, total: true, createdAt: true },
      }),
      prisma.eventLog.findMany({
        where: { sessionReplayId: id, channel: "browser" },
        orderBy: { createdAt: "asc" },
        take: 1000,
      }),
      prisma.sessionReplayChunk.findMany({
        where: { sessionId: id, ...(checkpoint ? { sequence: { gte: checkpoint.sequence } } : {}) },
        select: {
          sequence: true,
          eventCount: true,
          hasSnapshot: true,
          storageKey: true,
          byteSize: true,
          firstTimestamp: true,
          lastTimestamp: true,
        },
        orderBy: { sequence: "asc" },
      }),
    ]);
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });
    setNoStore(res);
    const [width, height] = String(session.viewport || "1280x720")
      .split("x")
      .map(Number);
    const first = chunks[0]?.firstTimestamp;
    const bootstrap = first
      ? {
          type: 4,
          timestamp: first - 1,
          data: {
            href: privateSafeUrl(session.landingUrl),
            width: Number.isFinite(width) && width > 0 ? width : 1280,
            height: Number.isFinite(height) && height > 0 ? height : 720,
          },
        }
      : undefined;
    res.json({
      replayVersion: 2,
      session,
      order: order ? { ...order, total: Number(order.total) } : null,
      markers,
      chunks,
      bootstrap,
      storage: replayStorageConfigured() ? "private-r2" : "not-configured",
    });
  });

  app.delete("/api/admin/session-replays/:id", requireAuth("reports.read"), async (req: AuthedRequest, res) => {
    const id = routeParam(req, "id");
    const chunks = await prisma.sessionReplayChunk.findMany({
      where: { sessionId: id, storageKey: { not: null } },
      select: { storageKey: true },
    });
    await deleteReplayChunks(chunks.map((c) => c.storageKey!));
    await prisma.$transaction([
      prisma.order.updateMany({ where: { replaySessionId: id }, data: { replaySessionId: null } }),
      prisma.eventLog.deleteMany({ where: { sessionReplayId: id } }),
      prisma.sessionReplay.deleteMany({ where: { id } }),
    ]);
    await audit(req, "delete", "SessionReplay", id);
    res.json({ ok: true });
  });
}
