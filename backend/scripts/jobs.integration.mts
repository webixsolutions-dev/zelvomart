// Order jobs: sent right after the order, never twice, failures retried by the cron, idle cron = 1 query.
// Runs against an in-process PostgreSQL (PGlite) and a fake email API; nothing leaves this machine.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const db = await PGlite.create();
const schema = execFileSync(
  process.execPath,
  [
    require.resolve("prisma/build/index.js"),
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url)),
    "--script",
  ],
  { encoding: "utf8" },
);
await db.exec(schema);
const socket = new PGLiteSocketServer({ db, port: 55451, host: "127.0.0.1" });
await socket.start();

// Fake email API (Resend's POST /emails). `failing` makes every send answer 500.
let failing = false;
const delivered: string[] = [];
const mail = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    if (failing) {
      res.writeHead(500, { "content-type": "application/json" });
      return res.end(JSON.stringify({ name: "application_error", message: "fake outage", statusCode: 500 }));
    }
    delivered.push(String(JSON.parse(body || "{}").subject || ""));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: randomUUID() }));
  });
});
await new Promise<void>((resolve) => mail.listen(55452, "127.0.0.1", resolve));

Object.assign(process.env, {
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55451/postgres",
  DIRECT_URL: "postgres://postgres:postgres@127.0.0.1:55451/postgres",
  DATABASE_SSL: "false",
  DATABASE_POOL_MAX: "1",
  JWT_SECRET: "isolated-local-jobs-test-secret-only",
  JOB_MODE: "cron",
  RESEND_API_KEY: "re_test_only",
  RESEND_BASE_URL: "http://127.0.0.1:55452",
  EMAIL_FROM: "Zelvomart <orders@example.com>",
  REVALIDATION_SECRET: "",
});
const { prisma } = await import("../src/lib/db");
const { createOrder } = await import("../src/lib/order");
const { runJobsNow } = await import("../src/lib/job-runner");
const { runCronQueue } = await import("../src/lib/cron-queue");

const category = await prisma.category.create({ data: { name: "Home", slug: "home-living" } });
const product = await prisma.product.create({
  data: {
    title: "Steel Bottle",
    slug: "steel-bottle",
    sku: "SB-1",
    price: 1200,
    status: "PUBLISHED",
    categoryId: category.id,
  },
});
await prisma.city.create({ data: { name: "Lahore" } });
await prisma.setting.create({ data: { key: "notifications.orderRecipients", value: ["team@example.com"] } });

async function placeOrder() {
  const order = await createOrder(
    {
      idempotencyKey: randomUUID(),
      fullName: "Ayesha Khan",
      phone: "+923001234567",
      email: "ayesha@example.com",
      city: "Lahore",
      address: "House 12, Street 4, Model Town",
      paymentMethod: "COD",
      cart: [{ productId: product.id, quantity: 1 }],
    } as any,
    { dispatchJobs: false },
  );
  return (order as { jobIds: string[] }).jobIds;
}
const jobs = (ids: string[]) =>
  prisma.job.findMany({ where: { id: { in: ids } }, select: { name: true, status: true, attempts: true } });

// 1. The order's own jobs go out right away, once.
const first = await placeOrder();
assert.equal(first.length, 3, "team email, customer email, Meta purchase");
await runJobsNow(first);
let rows = await jobs(first);
assert.deepEqual(rows.map((r) => [r.name, r.status, r.attempts]).sort(), [
  ["customer-order-email", "SUCCEEDED", 1],
  ["meta-purchase", "SKIPPED", 1],
  ["order-team-email", "SUCCEEDED", 1],
]);
assert.equal(delivered.length, 2);
console.log("PASS: order jobs sent right after the order (2 emails, Meta skipped without a pixel)");

// 2. A cron run right after sends nothing again.
const afterCron = await runCronQueue();
assert.equal(afterCron.processed, 0);
assert.equal(delivered.length, 2);
console.log("PASS: cron run right after the order sends nothing twice");

// 3. Instant sending and a cron run at the same moment: each email still goes out exactly once.
const second = await placeOrder();
await Promise.all([runJobsNow(second), runCronQueue(), runJobsNow(second)]);
rows = await jobs(second);
assert.ok(
  rows.every((r) => r.attempts === 1),
  JSON.stringify(rows),
);
assert.equal(delivered.length, 4);
console.log("PASS: parallel instant send + cron: every job claimed once");

// 4. A failing email provider: the order is saved, the rows wait FAILED, the cron retries them after 60 s.
failing = true;
const third = await placeOrder();
await runJobsNow(third); // must not throw
rows = await jobs(third);
assert.equal(rows.filter((r) => r.status === "FAILED").length, 2, JSON.stringify(rows));
assert.equal((await runCronQueue(Date.now())).processed, 0, "not retried within the first minute");
failing = false;
const retry = await runCronQueue(Date.now() + 61_000);
assert.equal(retry.succeeded, 2, JSON.stringify(retry));
rows = await jobs(third);
assert.ok(rows.filter((r) => r.name.endsWith("email")).every((r) => r.status === "SUCCEEDED" && r.attempts === 2));
console.log("PASS: failed emails stay queued and are sent by the cron retry");

// 5. An idle store: one cron run is one query.
let operations = 0;
const counting = prisma.$extends({
  query: {
    $allOperations({ args, query }) {
      operations++;
      return query(args);
    },
  },
});
const idle = await runCronQueue(Date.now() + 120_000, counting as any);
assert.equal(idle.processed, 0);
assert.equal(operations, 1, `idle cron used ${operations} queries`);
console.log("PASS: idle cron run = 1 query");

await prisma.$disconnect();
await socket.stop();
await db.close();
mail.close();
console.log("All job tests passed.");
process.exit(0);
