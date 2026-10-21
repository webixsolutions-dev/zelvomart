import { validateSettingsUpdate, validateCitySettings } from "../../lib/settings-validation";
import { prisma } from "../../lib/db";
import { requireAuth, type AuthedRequest } from "../../lib/auth";
import { validAdminBody, redirectSchema } from "../../lib/admin-validators";
import { setSetting } from "../../lib/settings";
import { getMetaMarketingConfig, testMetaMarketingConnection } from "../../lib/meta-marketing";
import { invalidateFrontendCache } from "../../lib/cache-invalidation";
import type { Express } from "express";
import { audit, isSensitiveSettingKey, routeParam } from "../../http/shared";

export function registerAdminSettingsRoutes(app: Express) {
  app.get("/api/admin/settings", requireAuth("settings.write"), async (_req, res) => {
    const [settings, cities] = await Promise.all([
      prisma.setting.findMany(),
      prisma.city.findMany({ orderBy: { name: "asc" } }),
    ]);
    const safeSettings: Record<string, unknown> = {};
    for (const s of settings) {
      if (s.key === "tracking.metaCapiToken" || s.key === "tracking.tiktokEventsApiToken") {
        safeSettings[s.key] = s.value ? "••••••••" : "";
      } else if (!isSensitiveSettingKey(s.key)) {
        safeSettings[s.key] = s.value;
      }
    }
    res.json({ settings: safeSettings, cities });
  });
  app.put("/api/admin/settings", requireAuth("settings.write"), async (req: AuthedRequest, res) => {
    let values: Record<string, unknown>;
    try {
      values = validateSettingsUpdate(req.body);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid settings." });
    }
    const entries = Object.entries(values).filter(
      ([key, value]) => !(/Token$|accessToken$/.test(key) && (!value || value === "••••••••")),
    );
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: value as any },
          create: { key, value: value as any },
        }),
      ),
    );
    await audit(req, "update", "Settings", undefined, { keys: Object.keys(req.body || {}) });
    await invalidateFrontendCache(["settings", "store", "products", "setting:store.bundleDefaultDiscountPercent"]);
    res.json({ ok: true });
  });
  app.put("/api/admin/cities", requireAuth("settings.write"), async (req: AuthedRequest, res) => {
    let cities: ReturnType<typeof validateCitySettings>;
    try {
      cities = validateCitySettings(req.body.cities);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid cities." });
    }
    await prisma.$transaction([
      prisma.city.updateMany({ where: { name: { notIn: cities.map((c) => c.name) } }, data: { active: false } }),
      ...cities.map((c) => prisma.city.upsert({ where: { name: c.name }, update: c, create: c })),
    ]);
    await audit(req, "update", "Cities");
    await invalidateFrontendCache(["cities"]);
    res.json({ ok: true });
  });

  app.get("/api/admin/redirects", requireAuth("settings.write"), async (_req, res) =>
    res.json(await prisma.redirect.findMany({ orderBy: { sourcePath: "asc" } })),
  );
  app.post("/api/admin/redirects", requireAuth("settings.write"), async (req: AuthedRequest, res) => {
    if (!validAdminBody(redirectSchema, req.body, res)) return;
    const row = await prisma.redirect.upsert({
      where: { sourcePath: String(req.body.sourcePath) },
      update: { destination: String(req.body.destination), permanent: req.body.permanent !== false },
      create: {
        sourcePath: String(req.body.sourcePath),
        destination: String(req.body.destination),
        permanent: req.body.permanent !== false,
      },
    });
    await audit(req, "upsert", "Redirect", row.id);
    await invalidateFrontendCache(["redirects"]);
    res.json(row);
  });
  app.delete("/api/admin/redirects/:id", requireAuth("settings.write"), async (req: AuthedRequest, res) => {
    await prisma.redirect.delete({ where: { id: routeParam(req, "id") } });
    await audit(req, "delete", "Redirect", routeParam(req, "id"));
    await invalidateFrontendCache(["redirects"]);
    res.json({ ok: true });
  });
  app.put("/api/admin/marketing/meta", requireAuth("settings.write"), async (req: AuthedRequest, res) => {
    const b = req.body || {};
    const updates: Record<string, unknown> = {
      "tracking.metaPixelId": String(b.pixelId || "").trim(),
      "marketing.meta.adAccountId": String(b.adAccountId || "").trim(),
      "marketing.meta.pageId": String(b.pageId || "").trim(),
      "marketing.meta.instagramAccountId": String(b.instagramAccountId || "").trim(),
    };
    if (String(b.accessToken || "").trim()) updates["marketing.meta.accessToken"] = String(b.accessToken).trim();
    for (const [key, value] of Object.entries(updates)) await setSetting(key, value);
    await audit(req, "update", "MetaMarketing", undefined, {
      keys: Object.keys(updates).filter((key) => !isSensitiveSettingKey(key)),
    });
    await invalidateFrontendCache(["settings", "store"]);
    res.json({
      ok: true,
      accessTokenConfigured: Boolean(
        String(b.accessToken || "").trim() || (await getMetaMarketingConfig()).accessToken,
      ),
    });
  });
  app.post("/api/admin/marketing/meta/test", requireAuth("settings.write"), async (_req, res) => {
    try {
      res.json({ ok: true, details: await testMetaMarketingConnection() });
    } catch (error: any) {
      res.status(400).json({ error: "META_CONNECTION_FAILED", message: error?.message || "Unable to connect to Meta" });
    }
  });
}
