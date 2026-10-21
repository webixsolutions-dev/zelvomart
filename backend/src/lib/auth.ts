import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "../generated/prisma/client";
import { prisma } from "./db";
import { can, type Permission } from "./permissions";

export type AdminIdentity = { id: string; name: string; email: string; role: Role };
export type AuthedRequest = Request & { admin?: AdminIdentity; adminPasswordStamp?: string };

/** How long an admin session token lives. The admin proxy refreshes it while the admin keeps working. */
export const ADMIN_TOKEN_SECONDS = 2 * 60 * 60;
/** Between password and code: the short-lived proof that the password step passed. */
const CHALLENGE_SECONDS = 5 * 60;
/** How long requireAuth trusts its last database read of a user's active flag and role. */
const USER_CHECK_MS = 60_000;

const ISSUER = "zelvomart-backend";
const AUDIENCE = "zelvomart-admin";
const CHALLENGE_AUDIENCE = "zelvomart-admin-2fa";

function secret() {
  const value = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!value) throw new Error("JWT_SECRET is not configured");
  return value;
}

/**
 * A short fingerprint of the stored password hash, carried in every admin token. Changing or resetting the
 * password changes it, so every session signed in with the old password stops working.
 */
export function passwordStamp(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

export function signAdminToken(user: AdminIdentity, stamp: string) {
  const { id, name, email, role } = user;
  return jwt.sign({ id, name, email, role, pv: stamp }, secret(), {
    expiresIn: ADMIN_TOKEN_SECONDS,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function decodeAdminToken(token: string): AdminIdentity & { exp?: number; pv?: string } {
  return jwt.verify(token, secret(), { issuer: ISSUER, audience: AUDIENCE }) as AdminIdentity & {
    exp?: number;
    pv?: string;
  };
}

export type ChallengePurpose = "verify" | "enroll";

/** Issued after a correct password when a code is still needed; only /api/auth/login/verify accepts it. */
export function signTwoFactorChallenge(userId: string, purpose: ChallengePurpose) {
  return jwt.sign({ sub: userId, purpose }, secret(), {
    expiresIn: CHALLENGE_SECONDS,
    issuer: ISSUER,
    audience: CHALLENGE_AUDIENCE,
  });
}

export function decodeTwoFactorChallenge(token: string): { sub: string; purpose: ChallengePurpose } {
  const value = jwt.verify(token, secret(), { issuer: ISSUER, audience: CHALLENGE_AUDIENCE }) as {
    sub?: string;
    purpose?: string;
  };
  if (!value.sub || (value.purpose !== "verify" && value.purpose !== "enroll")) throw new Error("INVALID_CHALLENGE");
  return { sub: value.sub, purpose: value.purpose };
}

type UserCheck = { at: number; user: (AdminIdentity & { active: boolean; stamp: string }) | null };
const userChecks = new Map<string, UserCheck>();

/** Forget the cached state of a user, so a change made in Admin → Users applies to their next request. */
export function forgetAdminUser(userId: string) {
  userChecks.delete(userId);
}

async function currentUser(userId: string) {
  const cached = userChecks.get(userId);
  if (cached && Date.now() - cached.at < USER_CHECK_MS) return cached.user;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, active: true, passwordHash: true },
  });
  const user = row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        active: row.active,
        stamp: passwordStamp(row.passwordHash),
      }
    : null;
  userChecks.set(userId, { at: Date.now(), user });
  if (userChecks.size > 500) userChecks.delete(userChecks.keys().next().value as string);
  return user;
}

/**
 * The token proves who signed in; the database decides what they may do now. A deactivated user or a lowered role
 * applies within a minute (immediately on the instance that made the change), and so does a password change. Two-factor is optional: it is asked
 * for at sign-in only by accounts that turned it on.
 */
export function requireAuth(permission?: Permission) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });
    let claims: AdminIdentity & { pv?: string };
    try {
      claims = decodeAdminToken(token);
    } catch {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    let user: UserCheck["user"];
    try {
      user = await currentUser(claims.id);
    } catch {
      return res.status(503).json({ error: "AUTH_CHECK_UNAVAILABLE" });
    }
    if (!user || !user.active) return res.status(401).json({ error: "UNAUTHORIZED" });
    // Signed in before the last password change (or before tokens carried the stamp): sign in again.
    if (claims.pv !== user.stamp) return res.status(401).json({ error: "UNAUTHORIZED" });
    if (permission && !can(user.role, permission)) return res.status(403).json({ error: "FORBIDDEN" });
    req.admin = { id: user.id, name: user.name, email: user.email, role: user.role };
    req.adminPasswordStamp = user.stamp;
    next();
  };
}
