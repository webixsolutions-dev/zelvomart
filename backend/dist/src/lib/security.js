"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = sha256;
exports.safeIp = safeIp;
const node_crypto_1 = __importDefault(require("node:crypto"));
function sha256(value) {
    if (!value)
        return undefined;
    return node_crypto_1.default.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}
function safeIp(headers) {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || headers.get("x-real-ip") || "0.0.0.0";
}
