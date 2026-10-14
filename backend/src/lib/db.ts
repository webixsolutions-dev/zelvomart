import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
// On Vercel a throw at import kills the whole function before any route can answer
// (FUNCTION_INVOCATION_FAILED), so there server.ts reports the missing variable as JSON instead.
if (!connectionString && !process.env.VERCEL) {
  throw new Error("DATABASE_URL is not configured");
}

const useSsl =
  process.env.DATABASE_SSL === "true" ||
  /supabase\.co/i.test(connectionString || "");

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
  ...(useSsl ? { ssl: { rejectUnauthorized: false }, family: 4 } : {}),
});
// Without a listener, a dropped idle connection is an unhandled 'error' event and kills the process.
pool.on("error", (error) => {
  console.error("[db] idle connection error:", error.message);
});
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
