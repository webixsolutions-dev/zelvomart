import fs from "node:fs";
import path from "node:path";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/set-db-password.mjs <password>");
  process.exit(1);
}

const enc = encodeURIComponent(password);
const envPath = path.join(import.meta.dirname, "..", ".env");
let s = fs.readFileSync(envPath, "utf8");

s = s.replace(
  /(DATABASE_URL="postgresql:\/\/)([^:]+):([^@]+)@/,
  `$1postgres:${enc}@`,
);
s = s.replace(
  /(DIRECT_URL="postgresql:\/\/)([^:]+):([^@]+)@/,
  `$1postgres:${enc}@`,
);

fs.writeFileSync(envPath, s);
console.log("Updated DATABASE_URL and DIRECT_URL password (URL-encoded).");
