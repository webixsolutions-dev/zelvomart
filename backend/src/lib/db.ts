import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { databaseConnection, databaseUsesSsl } from "./db-ssl";
import { databasePoolSettings } from "./db-pool";

const connectionString = process.env.DATABASE_URL;
// On Vercel a throw at import kills the whole function before any route can answer
// (FUNCTION_INVOCATION_FAILED), so there server.ts reports the missing variable as JSON instead.
if (!connectionString && !process.env.VERCEL) {
  throw new Error("DATABASE_URL is not configured");
}

const useSsl = databaseUsesSsl(connectionString);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaPool?: Pool };

/**
 * Pool size and idle time, from the environment (lib/db-pool.ts has the defaults):
 * - DATABASE_POOL_MAX: most open connections per running instance. Serverless (Vercel): 1–3 through the
 *   Supabase transaction pooler (port 6543). A persistent server (VPS): 5–10.
 * - DATABASE_IDLE_TIMEOUT_MS: how long an unused connection stays open. Longer = fewer new logins
 *   (each login is a pooler authentication round trip); shorter = fewer idle connections held.
 */
const poolSettings = databasePoolSettings(process.env);

// One pool and one Prisma client per process, reused by every request and job (also across hot reloads).
// TLS is verified against Supabase's root CA (lib/db-ssl.ts); it used to be encrypted but unverified.
const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    ...databaseConnection(connectionString),
    connectionTimeoutMillis: 30_000,
    keepAlive: true,
    max: poolSettings.max,
    idleTimeoutMillis: poolSettings.idleTimeoutMillis,
    ...(useSsl ? { family: 4 } : {}),
  });
if (!globalForPrisma.prismaPool) {
  // Without a listener, a dropped idle connection is an unhandled 'error' event and kills the process.
  pool.on("error", (error) => {
    console.error("[db] idle connection error:", error.message);
  });
}
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.prisma = prisma;
globalForPrisma.prismaPool = pool;

/** Connections opened by this process so far, for logs and the local benchmark. */
export function poolStats() {
  return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: poolSettings.max };
}
