import express from "express";
import bcrypt from "bcryptjs";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/db";
import {
  signAdminToken,
  requireAuth,
  signTwoFactorChallenge,
  decodeTwoFactorChallenge,
  forgetAdminUser,
  passwordStamp,
  ADMIN_TOKEN_SECONDS,
  type AuthedRequest,
} from "../lib/auth";
import { generateTotpSecret, verifyTotp, totpUri } from "../lib/totp";
import QRCode from "qrcode";
import type { Express } from "express";
import { allowRequest, audit, routeParam } from "../http/shared";

/** The otpauth link and a QR code (SVG data URL) for an authenticator app. */
async function enrolmentDetails(secret: string, email: string) {
  const uri = totpUri(secret, email);
  const qr = `data:image/svg+xml;base64,${Buffer.from(await QRCode.toString(uri, { type: "svg", margin: 1, width: 220 })).toString("base64")}`;
  return { otpauthUri: uri, secret, qr };
}

/** Admin passwords: at least this many characters (sign-in, change, reset and new users). */
const ADMIN_PASSWORD_MIN = 10;

/** `stamp` is passwordStamp(passwordHash): the token stops working when the password changes. */
function sessionResponse(
  res: express.Response,
  user: { id: string; name: string; email: string; role: Role },
  stamp: string,
) {
  const identity = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.setHeader("Cache-Control", "no-store");
  return res.json({ token: signAdminToken(identity, stamp), expiresIn: ADMIN_TOKEN_SECONDS, user: identity });
}

export function registerAuthRoutes(app: Express) {
  // Step 1: email + password. An account that turned 2FA on gets a 5-minute challenge instead of a session.
  app.post("/api/auth/login", async (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    if (!(await allowRequest(req, res, "admin-login", 8, 15 * 60 * 1000, email))) return;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.active || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    res.setHeader("Cache-Control", "no-store");

    if (user.twoFactorReady && user.totpSecret)
      return res.json({ twoFactor: "verify", challenge: signTwoFactorChallenge(user.id, "verify") });
    return sessionResponse(res, user, passwordStamp(user.passwordHash));
  });

  // Step 2: the 6-digit code from the authenticator app. Completes enrolment the first time.
  app.post("/api/auth/login/verify", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    let challenge: { sub: string; purpose: "verify" | "enroll" };
    try {
      challenge = decodeTwoFactorChallenge(String(req.body.challenge || ""));
    } catch {
      return res.status(401).json({ error: "CHALLENGE_EXPIRED" });
    }
    if (!(await allowRequest(req, res, "admin-2fa", 6, 15 * 60 * 1000, challenge.sub))) return;
    const user = await prisma.user.findUnique({ where: { id: challenge.sub } });
    if (!user?.active || !user.totpSecret) return res.status(401).json({ error: "CHALLENGE_EXPIRED" });
    if (challenge.purpose === "verify" && !user.twoFactorReady)
      return res.status(401).json({ error: "CHALLENGE_EXPIRED" });
    if (!verifyTotp(user.totpSecret, String(req.body.code || "")))
      return res.status(401).json({ error: "INVALID_CODE" });
    if (!user.twoFactorReady) {
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorReady: true } });
      await prisma.auditLog.create({
        data: { userId: user.id, action: "enable_2fa", entity: "User", entityId: user.id },
      });
      forgetAdminUser(user.id);
    }
    return sessionResponse(res, user, passwordStamp(user.passwordHash));
  });

  // A fresh 2-hour token for an admin who is still signed in (the admin proxy calls this near expiry).
  app.post("/api/auth/refresh", requireAuth(), async (req: AuthedRequest, res) =>
    sessionResponse(res, req.admin!, req.adminPasswordStamp!),
  );

  // 2FA is optional for every role: turned on (and off) from a signed-in session in Admin → Security.
  app.post("/api/auth/2fa/setup", requireAuth(), async (req: AuthedRequest, res) => {
    res.setHeader("Cache-Control", "no-store");
    const user = await prisma.user.findUnique({ where: { id: req.admin!.id } });
    if (!user) return res.status(401).json({ error: "UNAUTHORIZED" });
    if (user.twoFactorReady) return res.status(409).json({ error: "TWO_FACTOR_ALREADY_ON" });
    const secret = user.totpSecret || generateTotpSecret();
    if (!user.totpSecret) await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
    res.json(await enrolmentDetails(secret, user.email));
  });
  app.post("/api/auth/2fa/confirm", requireAuth(), async (req: AuthedRequest, res) => {
    if (!(await allowRequest(req, res, "admin-2fa", 6, 15 * 60 * 1000, req.admin!.id))) return;
    const user = await prisma.user.findUnique({ where: { id: req.admin!.id } });
    if (!user?.totpSecret) return res.status(400).json({ error: "SETUP_FIRST" });
    if (!verifyTotp(user.totpSecret, String(req.body.code || "")))
      return res.status(401).json({ error: "INVALID_CODE" });
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorReady: true } });
    await audit(req, "enable_2fa", "User", user.id);
    forgetAdminUser(user.id);
    res.json({ ok: true });
  });

  // Turn 2FA off for your own account. Asks for the current password, so an unattended open session cannot do it.
  app.post("/api/auth/2fa/disable", requireAuth(), async (req: AuthedRequest, res) => {
    if (!(await allowRequest(req, res, "admin-password", 5, 15 * 60 * 1000, req.admin!.id))) return;
    const user = await prisma.user.findUnique({ where: { id: req.admin!.id } });
    if (!user) return res.status(401).json({ error: "UNAUTHORIZED" });
    if (!(await bcrypt.compare(String(req.body.password || ""), user.passwordHash)))
      return res.status(401).json({ error: "WRONG_PASSWORD" });
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: null, twoFactorReady: false } });
    await audit(req, "disable_2fa", "User", user.id);
    forgetAdminUser(user.id);
    res.json({ ok: true });
  });

  // Change your own password. Every other session of this account ends (their tokens carry the old stamp);
  // this one gets a fresh token, which the admin proxy stores as the session cookie.
  app.post("/api/auth/password", requireAuth(), async (req: AuthedRequest, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!(await allowRequest(req, res, "admin-password-change", 5, 15 * 60 * 1000, req.admin!.id))) return;
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const user = await prisma.user.findUnique({ where: { id: req.admin!.id } });
    if (!user) return res.status(401).json({ error: "UNAUTHORIZED" });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
      return res.status(401).json({ error: "WRONG_PASSWORD" });
    if (newPassword.length < ADMIN_PASSWORD_MIN)
      return res.status(400).json({ error: `The new password needs at least ${ADMIN_PASSWORD_MIN} characters.` });
    if (newPassword.length > 200) return res.status(400).json({ error: "The new password is too long." });
    if (newPassword === currentPassword)
      return res.status(400).json({ error: "Choose a password different from the current one." });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const row = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await audit(req, "change_password", "User", user.id);
    forgetAdminUser(user.id);
    return sessionResponse(res, row, passwordStamp(passwordHash));
  });

  app.get("/api/auth/me", requireAuth(), async (req: AuthedRequest, res) => {
    const row = await prisma.user.findUnique({ where: { id: req.admin!.id }, select: { twoFactorReady: true } });
    res.json({ user: req.admin, twoFactorReady: Boolean(row?.twoFactorReady) });
  });

  app.get("/api/admin/users", requireAuth("users.write"), async (_req, res) =>
    res.json(
      await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          twoFactorReady: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ),
  );
  app.post("/api/admin/users", requireAuth("users.write"), async (req: AuthedRequest, res) => {
    const password = String(req.body.password || "");
    if (password.length < ADMIN_PASSWORD_MIN || password.length > 200)
      return res.status(400).json({ error: `The password needs ${ADMIN_PASSWORD_MIN} to 200 characters.` });
    const row = await prisma.user.create({
      data: {
        name: String(req.body.name),
        email: String(req.body.email).toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        role: (req.body.role || "ORDER_AGENT") as Role,
        active: req.body.active !== false,
      },
    });
    await audit(req, "create", "User", row.id);
    res.status(201).json({ id: row.id, name: row.name, email: row.email, role: row.role, active: row.active });
  });
  app.patch("/api/admin/users/:id", requireAuth("users.write"), async (req: AuthedRequest, res) => {
    const data: any = {};
    for (const k of ["name", "email", "role", "active"]) if (k in req.body) data[k] = req.body[k];
    if (req.body.password) {
      const nextPassword = String(req.body.password);
      if (nextPassword.length < ADMIN_PASSWORD_MIN || nextPassword.length > 200)
        return res.status(400).json({ error: `The password needs ${ADMIN_PASSWORD_MIN} to 200 characters.` });
      data.passwordHash = await bcrypt.hash(nextPassword, 12);
    }
    if (req.body.resetTwoFactor === true) {
      data.totpSecret = null;
      data.twoFactorReady = false;
    }
    const row = await prisma.user.update({ where: { id: routeParam(req, "id") }, data });
    forgetAdminUser(row.id);
    await audit(
      req,
      req.body.resetTwoFactor === true ? "reset_2fa" : data.passwordHash ? "reset_password" : "update",
      "User",
      row.id,
    );
    res.json({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      active: row.active,
      twoFactorReady: row.twoFactorReady,
    });
  });
}
