import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "../generated/prisma";
import { can, type Permission } from "./permissions";
import { prisma } from "./db";

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
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });

    try {
      const decoded = decodeAdminToken(token);
      const current = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, email: true, role: true, active: true },
      });

      if (!current?.active || current.email.toLowerCase() !== decoded.email.toLowerCase()) {
        return res.status(401).json({ error: "SESSION_REVOKED" });
      }

      const admin: AdminIdentity = {
        id: current.id,
        name: current.name,
        email: current.email,
        role: current.role,
      };

      if (permission && !can(admin.role, permission)) {
        return res.status(403).json({ error: "FORBIDDEN" });
      }

      req.admin = admin;
      next();
    } catch {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
  };
}
