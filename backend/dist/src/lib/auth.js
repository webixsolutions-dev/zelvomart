"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAdminToken = signAdminToken;
exports.decodeAdminToken = decodeAdminToken;
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const permissions_1 = require("./permissions");
function secret() {
    const value = process.env.JWT_SECRET || process.env.AUTH_SECRET;
    if (!value)
        throw new Error("JWT_SECRET is not configured");
    return value;
}
function signAdminToken(user) {
    return jsonwebtoken_1.default.sign(user, secret(), { expiresIn: "8h", issuer: "zelvomart-backend", audience: "zelvomart-admin" });
}
function decodeAdminToken(token) {
    return jsonwebtoken_1.default.verify(token, secret(), { issuer: "zelvomart-backend", audience: "zelvomart-admin" });
}
function requireAuth(permission) {
    return (req, res, next) => {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!token)
            return res.status(401).json({ error: "UNAUTHORIZED" });
        try {
            const admin = decodeAdminToken(token);
            if (permission && !(0, permissions_1.can)(admin.role, permission))
                return res.status(403).json({ error: "FORBIDDEN" });
            req.admin = admin;
            next();
        }
        catch {
            return res.status(401).json({ error: "UNAUTHORIZED" });
        }
    };
}
