import bcrypt from "bcryptjs";
import type { Express } from "express";
import {
  allowRequest,
  bearerToken,
  createStoreSession,
  findStoreSession,
  publicStoreUser,
  storeDb,
  storeTokenHash,
} from "../http/shared";

export function registerCustomerAuthRoutes(app: Express) {
  app.post("/api/customer-auth/signup", async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    if (!(await allowRequest(req, res, "store-signup", 5, 15 * 60 * 1000, email))) return;
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "INVALID_NAME" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190)
      return res.status(400).json({ error: "INVALID_EMAIL" });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "PASSWORD_REQUIREMENTS" });
    const existing = await storeDb.storeUser.findUnique({ where: { email }, select: { id: true } });
    if (existing) return res.status(409).json({ error: "EMAIL_IN_USE" });
    const user = await storeDb.storeUser.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12) },
    });
    const session = await createStoreSession(req, user.id);
    return res.status(201).json({ token: session.token, expiresAt: session.expiresAt, user: publicStoreUser(user) });
  });

  app.post("/api/customer-auth/login", async (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    if (!(await allowRequest(req, res, "store-login", 10, 15 * 60 * 1000, email))) return;
    const user = email ? await storeDb.storeUser.findUnique({ where: { email } }) : null;
    if (!user?.active || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    const session = await createStoreSession(req, user.id);
    return res.json({ token: session.token, expiresAt: session.expiresAt, user: publicStoreUser(user) });
  });

  app.get("/api/customer-auth/me", async (req, res) => {
    const session = await findStoreSession(req);
    if (!session) return res.status(401).json({ error: "UNAUTHORIZED" });
    return res.json({ user: publicStoreUser(session.user), expiresAt: session.expiresAt });
  });

  app.post("/api/customer-auth/logout", async (req, res) => {
    const token = bearerToken(req);
    if (token) await storeDb.storeSession.deleteMany({ where: { tokenHash: storeTokenHash(token) } });
    return res.json({ ok: true });
  });
}
