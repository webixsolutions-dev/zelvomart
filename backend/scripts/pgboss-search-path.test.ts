import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const sql = (name: string) => readFileSync(resolve(__dirname, "../prisma/sql", name), "utf8");
const apply = sql("04-pgboss-search-path.sql");
const rollback = sql("04-pgboss-search-path-rollback.sql");

test("pg-boss paths apply and roll back on a copy; queue creation/deletion still work", async () => {
  const db = new PGlite();
  try {
    // Use the installed pg-boss DDL, not a hand-written substitute for its functions.
    const plans = require("pg-boss/src/plans.js");
    await db.exec(plans.create("pgboss", 24));
    await db.exec(apply);
    await db.exec(apply); // Safe to reapply.
    const config = await db.query<{ proconfig: string[] }>(
      "select proconfig from pg_proc where oid in ('pgboss.create_queue(text,json)'::regprocedure, 'pgboss.delete_queue(text)'::regprocedure)",
    );
    assert.equal(config.rows.length, 2);
    assert.ok(config.rows.every((row) => row.proconfig.includes("search_path=pgboss, pg_temp")));
    await db.exec("select pgboss.create_queue('copy-test', '{}');");
    assert.equal((await db.query("select name from pgboss.queue where name = 'copy-test'")).rows.length, 1);
    await db.exec("select pgboss.delete_queue('copy-test');");
    assert.equal((await db.query("select name from pgboss.queue where name = 'copy-test'")).rows.length, 0);
    await db.exec(rollback);
    const reset = await db.query<{ proconfig: string[] | null }>(
      "select proconfig from pg_proc where oid in ('pgboss.create_queue(text,json)'::regprocedure, 'pgboss.delete_queue(text)'::regprocedure)",
    );
    assert.ok(reset.rows.every((row) => !row.proconfig?.some((entry) => entry.startsWith("search_path="))));
    await db.exec("alter function pgboss.delete_queue(text) set search_path = pg_catalog;");
    await assert.rejects(db.exec(apply), /Unexpected configuration/);
    await db.exec("rollback;");
    const unchanged = await db.query<{ proconfig: string[] | null }>(
      "select proconfig from pg_proc where oid = 'pgboss.create_queue(text,json)'::regprocedure",
    );
    assert.equal(unchanged.rows[0].proconfig, null);
  } finally {
    await db.close();
  }
});

test("missing worker functions stop the patch before any change", async () => {
  const db = new PGlite();
  try {
    await assert.rejects(db.exec(apply), /Missing function/);
    await db.exec("rollback;");
    assert.equal((await db.query("select 1 from pg_namespace where nspname = 'pgboss'")).rows.length, 0);
  } finally {
    await db.close();
  }
});
