/**
 * Re-encodes the DB password in DATABASE_URL / DIRECT_URL (fixes * and , in passwords).
 * Run from backend/: node scripts/encode-db-password.mjs
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(import.meta.dirname, "..", ".env");
let s = fs.readFileSync(envPath, "utf8");

function fixLine(key) {
  const re = new RegExp(`${key}="postgresql://([^:]+):([^@]+)@([^"]+)"`);
  const m = s.match(re);
  if (!m) {
    console.warn(`Skip ${key}: could not parse`);
    return;
  }
  const user = m[1];
  const rawPw = decodeURIComponent(m[2]);
  const enc = encodeURIComponent(rawPw);
  const rest = m[3];
  s = s.replace(re, `${key}="postgresql://${user}:${enc}@${rest}"`);
}

fixLine("DATABASE_URL");
fixLine("DIRECT_URL");
fs.writeFileSync(envPath, s);
console.log("Encoded database password in DATABASE_URL and DIRECT_URL.");
