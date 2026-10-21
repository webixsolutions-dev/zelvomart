import fs from "node:fs";
import path from "node:path";

const envPath = path.join(import.meta.dirname, "..", ".env");
const s = fs.readFileSync(envPath, "utf8");

function parse(key) {
  const m = s.match(new RegExp(`${key}="postgresql://([^:]+):([^@]+)@([^:/"]+):(\\d+)/postgres`));
  if (!m) return null;
  return { user: m[1], host: m[3], port: m[4] };
}

const db = parse("DATABASE_URL");
const direct = parse("DIRECT_URL");

let ok = true;
function warn(msg) {
  ok = false;
  console.error("!", msg);
}

if (!db) warn("DATABASE_URL is missing or not a valid postgresql URI.");
if (!direct) warn("DIRECT_URL is missing or not a valid postgresql URI.");

if (db?.host.startsWith("db.") && db.port === "5432") {
  warn(
    "DATABASE_URL uses direct host :5432 — often times out on Windows. Use Transaction pooler (6543) from Supabase.",
  );
}
if (db?.host.startsWith("db.") && db.port === "6543" && db.user === "postgres") {
  console.warn(
    "? DATABASE_URL uses db.*.supabase.co:6543. If you still get timeouts, copy the full URI from Supabase (pooler host aws-0-….pooler.supabase.com, user postgres.<project-ref>).",
  );
}
if (db?.user === "postgres" && db.host.includes("pooler.supabase.com")) {
  warn("Pooler URLs usually need user postgres.<project-ref>, not postgres.");
}

if (ok && db)
  console.log(
    "Env shape looks parseable. If connection fails, reset DB password in Supabase and paste both URIs again.",
  );
process.exitCode = ok ? 0 : 1;
