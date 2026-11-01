/**
 * Database pool limits. Defaults: serverless (VERCEL set) max 3 connections per instance kept 60 s;
 * a persistent server max 10 kept 5 minutes. DATABASE_POOL_MAX and DATABASE_IDLE_TIMEOUT_MS override them.
 * Invalid or out-of-range values fall back to the default instead of breaking the app.
 */
export function databasePoolSettings(env: Record<string, string | undefined>) {
  const serverless = Boolean(env.VERCEL);
  const intIn = (value: string | undefined, min: number, max: number, fallback: number) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  return {
    max: intIn(env.DATABASE_POOL_MAX, 1, 50, serverless ? 3 : 10),
    idleTimeoutMillis: intIn(env.DATABASE_IDLE_TIMEOUT_MS, 1_000, 3_600_000, serverless ? 60_000 : 300_000),
  };
}
