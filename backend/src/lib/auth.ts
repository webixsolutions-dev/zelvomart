import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { can, type Permission } from "./permissions";

export type AdminIdentity = { id: string; name: string; email: string; role: Role };
export type AuthedRequest = Request & { admin?: AdminIdentity };

function secret() {
  const value = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!value) throw new Error("JWT_SECRET is not configured");
  return value;
}

export function signAdminToken(user: AdminIdentity) {
  return jwt.sign(user, secret(), { expiresIn: "8h", issuer: "zelvomart-backend", audience: "zelvomart-admin" });
}

export function decodeAdminToken(token: string): AdminIdentity {
  return jwt.verify(token, secret(), { issuer: "zelvomart-backend", audience: "zelvomart-admin" }) as AdminIdentity;
}

export function requireAuth(permission?: Permission) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });
    try {
      const admin = decodeAdminToken(token);
      if (permission && !can(admin.role, permission)) return res.status(403).json({ error: "FORBIDDEN" });
      req.admin = admin;
      next();
    } catch {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
  };
}
