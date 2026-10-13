/**
 * Paste full connection strings from Supabase (URI tab → Copy).
 * Usage:
 *   node scripts/paste-supabase-uri.mjs --database "postgresql://..." --direct "postgresql://..."
 */
import fs from "node:fs";
import path from "node:path";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

const database = arg("--database");
const direct = arg("--direct") ?? database;
if (!database?.startsWith("postgresql://")) {
  console.error('Provide --database "postgresql://..." from Supabase (Transaction pooler, port 6543).');
  process.exit(1);
}

const envPath = path.join(import.meta.dirname, "..", ".env");
let s = fs.readFileSync(envPath, "utf8");
s = s.replace(/DATABASE_URL="[^"]+"/, `DATABASE_URL="${database}"`);
s = s.replace(/DIRECT_URL="[^"]+"/, `DIRECT_URL="${direct}"`);
fs.writeFileSync(envPath, s);
console.log("Saved DATABASE_URL and DIRECT_URL from Supabase copy/paste.");
