import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ref = "bvggyrskkwqiwvbbfsai";
const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/apply-pooler-env.mjs <password>");
  process.exit(1);
}

const regions = ["ap-south-1", "ap-southeast-1", "eu-central-1", "us-east-1"];
const prefixes = ["aws-0", "aws-1"];

let winner = null;
for (const prefix of prefixes) {
  for (const region of regions) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    for (const [port, mode] of [[6543, "transaction"], [5432, "session"]]) {
      const user = `postgres.${ref}`;
      const client = new pg.Client({
        host,
        port,
        user,
        password,
        database: "postgres",
        connectionTimeoutMillis: 12_000,
        ssl: { rejectUnauthorized: false },
      });
      try {
        await client.connect();
        await client.query("SELECT 1");
        winner = { host, port, user, mode, prefix, region };
        await client.end();
        break;
      } catch {
        await client.end().catch(() => undefined);
      }
    }
    if (winner) break;
  }
  if (winner) break;
}

if (!winner) {
  console.error("Could not connect via any pooler region. Paste URIs from Supabase dashboard.");
  process.exit(1);
}

const enc = encodeURIComponent(password);
const base = `postgresql://${winner.user}:${enc}@${winner.host}:${winner.port}/postgres`;
const databaseUrl =
  winner.port === 6543
    ? `${base}?pgbouncer=true&connection_limit=5&pool_timeout=30`
    : base;

// Prefer transaction pooler for DATABASE_URL; session/direct for DIRECT_URL
let directUrl = base;
if (winner.port === 6543) {
  const sessionHost = winner.host;
  directUrl = `postgresql://${winner.user}:${enc}@${sessionHost}:5432/postgres`;
  const sessionClient = new pg.Client({
    host: sessionHost,
    port: 5432,
    user: winner.user,
    password,
    database: "postgres",
    connectionTimeoutMillis: 12_000,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await sessionClient.connect();
    await sessionClient.query("SELECT 1");
    await sessionClient.end();
  } catch {
    await sessionClient.end().catch(() => undefined);
    directUrl = databaseUrl;
  }
}

const envPath = path.join(import.meta.dirname, "..", ".env");
let s = fs.readFileSync(envPath, "utf8");
s = s.replace(/DATABASE_URL="[^"]+"/, `DATABASE_URL="${databaseUrl}"`);
s = s.replace(/DIRECT_URL="[^"]+"/, `DIRECT_URL="${directUrl}"`);
fs.writeFileSync(envPath, s);

console.log(`Connected via ${winner.mode} ${winner.host}:${winner.port}`);
console.log("Updated backend/.env DATABASE_URL and DIRECT_URL.");
