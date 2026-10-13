/**
 * Use Supabase pooler port 6543 on db.*.host (works when direct :5432 times out on Windows).
 * Run after pasting the password from Supabase. Then reset password in dashboard if auth still fails.
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(import.meta.dirname, "..", ".env");
let s = fs.readFileSync(envPath, "utf8");

function fix(key, withPgbouncer) {
  const re = new RegExp(`${key}="postgresql://postgres:([^@]+)@([^:/"]+):(\\d+)/postgres([^"]*)"`);
  const m = s.match(re);
  if (!m) return;
  const pw = m[1];
  const host = m[2];
  const suffix = withPgbouncer
    ? "?pgbouncer=true&connection_limit=5&pool_timeout=30"
    : "";
  s = s.replace(re, `${key}="postgresql://postgres:${pw}@${host}:6543/postgres${suffix}"`);
}

fix("DATABASE_URL", true);
fix("DIRECT_URL", false);
fs.writeFileSync(envPath, s);
console.log("Set DATABASE_URL and DIRECT_URL to port 6543 on your Supabase host.");
