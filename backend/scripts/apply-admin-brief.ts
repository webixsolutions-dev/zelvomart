import "dotenv/config";
import { databaseConnection } from "../src/lib/db-ssl";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
async function main() {
  const pool = new Pool({ ...databaseConnection(process.env.DATABASE_URL), connectionTimeoutMillis: 15000, family: 4 });
  try {
    const existing = await pool.query(
      `SELECT column_name::text FROM information_schema.columns WHERE table_name='Order' AND column_name='couponCode'`,
    );
    if (existing.rowCount) console.log("Admin brief schema already applied.");
    else {
      await pool.query(await readFile("prisma/migrations/202610180003_admin_brief/migration.sql", "utf8"));
      console.log("Applied additive admin brief schema; existing data preserved.");
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
