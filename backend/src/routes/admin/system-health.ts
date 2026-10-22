import { Router, type RequestHandler } from "express";
import type { AuthedRequest } from "../../lib/auth";
import { systemHealth, type SystemHealthStore } from "../../lib/system-health";
export function createSystemHealthRouter({
  authenticate,
  store,
  now = () => new Date(),
  reportError = () => {},
}: {
  authenticate: RequestHandler;
  store: SystemHealthStore;
  now?: () => Date;
  reportError?: (error: unknown) => void;
}) {
  const router = Router();
  router.get("/", authenticate, async (req: AuthedRequest, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    if (req.admin?.role !== "OWNER" && req.admin?.role !== "MANAGER")
      return res.status(403).json({ error: "FORBIDDEN" });
    try {
      return res.json(await systemHealth(store, now()));
    } catch (error) {
      reportError(error);
      return res.status(503).json({ error: "SYSTEM_HEALTH_UNAVAILABLE" });
    }
  });
  return router;
}
