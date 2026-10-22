import "dotenv/config";
import { installErrorMonitoring } from "./instrument";
import { prisma } from "./lib/db";
import { requireAuth } from "./lib/auth";
import { reviewRouter } from "./admin-reviews";
import { orderEditRouter } from "./admin-order-edit";
import { registerRecovery } from "./recovery";
import { overviewRouter } from "./admin-overview";
import { couponRouter } from "./admin-coupons";
import { SITE_ORIGIN } from "./lib/site-url";
import express from "express";
import cors from "cors";
import { getLocalUploadDir } from "./lib/storage";
import { registerPublicRoutes } from "./routes/public";
import { registerTrackingRoutes } from "./routes/tracking";
import { registerReplayRoutes } from "./routes/replay";
import { registerCustomerAuthRoutes } from "./routes/customer-auth";
import { registerAuthRoutes } from "./routes/auth";
import { registerAdminOrdersRoutes } from "./routes/admin/orders";
import { registerAdminProductsRoutes } from "./routes/admin/products";
import { registerAdminCustomersRoutes } from "./routes/admin/customers";
import { registerAdminSettingsRoutes } from "./routes/admin/settings";
import { registerAdminReportsRoutes } from "./routes/admin/reports";
import { findStoreSession, setNoStore } from "./http/shared";

const app = express();
const port = Number(process.env.PORT || 4000);
// Without a database URL nothing can work. Answer every request with the missing variable name
// (never its value) so a misconfigured deployment explains itself instead of crashing.
if (!process.env.DATABASE_URL) {
  console.error("[config] DATABASE_URL is not set in the backend environment");
  app.use((_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ ok: false, error: "BACKEND_MISCONFIGURED", missing: ["DATABASE_URL"] });
  });
}
const frontendOrigins = [
  ...new Set([
    ...(process.env.FRONTEND_URL || "http://localhost:3000")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    SITE_ORIGIN,
    "https://zelvomart.vercel.app",
    "https://zelvomart.com",
    "https://www.zelvomart.com",
  ]),
];
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || frontendOrigins.includes(origin)) return cb(null, true);
      cb(new Error("CORS_NOT_ALLOWED"));
    },
    credentials: false,
  }),
);
app.use(
  "/uploads",
  express.static(getLocalUploadDir(), { maxAge: "365d", immutable: true, index: false, fallthrough: true }),
);
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (
    /^\/api\/(auth|customer-auth|admin|orders|checkout|reviews|events|session-replays|contact)(?:\/|$)/.test(req.path)
  )
    setNoStore(res);
  next();
});
// Routes, by area (src/routes). Express matches in registration order, so keep this order: the admin
// routers mounted below run before the admin order routes, as they always have.
//   public: storefront API, orders, reviews  · tracking: /api/events and Admin → Tracking/Jobs
//   replay: session recordings (public ingest + admin)  · customer-auth  · auth: admin sign-in, 2FA, users
//   admin/orders (dashboard, orders) · admin/products (products, categories, tabs, import, upload)
//   admin/customers · admin/settings (settings, cities, redirects, Meta marketing) · admin/reports (CRO, reports)
// Shared helpers live in src/http/shared.ts.
registerPublicRoutes(app);
registerRecovery(app, findStoreSession);
app.use("/api/admin/coupons", couponRouter);
app.use("/api/admin/orders", orderEditRouter);
app.use("/api/admin/overview", overviewRouter);
app.use("/api/admin/reviews", reviewRouter);
registerTrackingRoutes(app);
registerReplayRoutes(app);
registerCustomerAuthRoutes(app);
registerAuthRoutes(app);
registerAdminOrdersRoutes(app);
registerAdminProductsRoutes(app);
registerAdminCustomersRoutes(app);
registerAdminSettingsRoutes(app);
registerAdminReportsRoutes(app);
installErrorMonitoring(app);

app.use((err: any, req: any, res: any, _next: any) => {
  if (err?.code === "P1001" || err?.code === "P1002") {
    console.error(`[db] unreachable for ${req.method} ${req.path} - check internet/DNS and DATABASE_URL`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: "DATABASE_UNAVAILABLE" });
  }
  if (err?.message === "CORS_NOT_ALLOWED") {
    res.setHeader("Cache-Control", "no-store");
    return res
      .status(403)
      .json({ error: "CORS_NOT_ALLOWED", message: "Add this site origin to FRONTEND_URL on the backend." });
  }
  if (err?.message === "JWT_SECRET is not configured") {
    console.error("[config] JWT_SECRET is not set in the backend environment");
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: "BACKEND_MISCONFIGURED", missing: ["JWT_SECRET"] });
  }
  console.error(err);
  res
    .status(500)
    .json({ error: "SERVER_ERROR", message: process.env.NODE_ENV === "development" ? err?.message : undefined });
});
export { app };
export default app;
if (!process.env.VERCEL) app.listen(port, () => console.log(`Zelvomart backend listening on http://localhost:${port}`));
