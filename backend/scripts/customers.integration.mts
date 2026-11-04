// Admin → Customers server paging (lib/customer-list.ts) on real SQL: page boundaries, search, the per-customer
// summaries, and the stat cards/tabs/segments/top/activity compared with the rules the screen used to run in the
// browser over the full list. In-process PostgreSQL (PGlite); nothing leaves this machine.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
const socket = new PGLiteSocketServer({ db, port: 55471, host: "127.0.0.1" });
await socket.start();
Object.assign(process.env, {
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55471/postgres",
  DIRECT_URL: "postgres://postgres:postgres@127.0.0.1:55471/postgres",
  DATABASE_SSL: "false",
  DATABASE_POOL_MAX: "1",
  JWT_SECRET: "isolated-local-customers-test-secret-only",
  JOB_MODE: "cron",
  VERCEL: "1",
});
const { prisma } = await import("../src/lib/db");
const { listCustomers, parseCustomerListQuery, customerPeriods } = await import("../src/lib/customer-list");

// 20 Nov 2026, 12:00 Pakistan time. "This month" starts 1 Nov 00:00 PKT.
const NOW = Date.parse("2026-11-20T07:00:00Z");
const day = 86_400_000;
const ago = (days: number) => new Date(NOW - days * day);
let orderNo = 1;
async function order(customerId: string, phone: string, status: string, total: number, at: Date, city = "Lahore") {
  await prisma.order.create({
    data: {
      orderNumber: `ZM-T${orderNo++}`,
      idempotencyKey: crypto.randomUUID(),
      customerId,
      fullName: "Test",
      phone,
      city,
      address: "Test address 123",
      subtotal: total,
      total,
      status,
      // An hour before the day mark, so no order shares a timestamp with a registration.
      createdAt: new Date(+at - 3600_000),
    } as any,
  });
}

// 25 customers. Names sort as C01..C25; createdAt spreads over 60 days so "newest" is C25 first.
const ids: string[] = [];
for (let i = 1; i <= 25; i++) {
  const n = String(i).padStart(2, "0");
  const c = await prisma.customer.create({
    data: {
      name: `C${n} Customer`,
      phone: `0300${String(1000000 + i)}`,
      email: i % 5 === 0 ? `c${n}@example.com` : null,
      blocklisted: i === 7,
      refusalCount: i === 7 ? 2 : 0,
      createdAt: ago(60 - i * 2),
      updatedAt: ago(60 - i * 2),
    },
  });
  ids.push(c.id);
}
const [c1, c2, c3] = ids;
// C01: 2 delivered (1,200 each), 1 returned, 1 cancelled; latest order in Karachi.
await order(c1, "03001000001", "DELIVERED", 1200, ago(40), "Lahore");
await order(c1, "03001000001", "DELIVERED", 1200, ago(10), "Lahore");
await order(c1, "03001000001", "RETURNED", 900, ago(5), "Lahore");
await order(c1, "03001000001", "CANCELLED", 500, ago(2), "Karachi");
// C02: VIP by count (10 settled orders of 1,000).
for (let k = 0; k < 10; k++) await order(c2, "03001000002", "SETTLED", 1000, ago(50 - k), "Islamabad");
// C03: VIP by spend (one 60,000 delivered order, 100 days ago: not active).
await order(c3, "03001000003", "DELIVERED", 60000, ago(100), "Multan");
// C07 (blocked) ordered recently: not active because blocked.
await order(ids[6], "03001000007", "NEW", 700, ago(1), "Lahore");
// C10 ordered once this month.
await order(ids[9], "03001000010", "CONFIRMED", 1500, ago(3), "Peshawar");

// ---- The old browser rules, copied from the Customers screen before this change ----
const all = await prisma.customer.findMany({ include: { orders: true }, orderBy: { updatedAt: "desc" } });
const legacy = all.map((c) => ({
  ...c,
  orders: [...c.orders]
    .sort((a, b) => +b.createdAt - +a.createdAt)
    .map((o) => ({ ...o, total: Number(o.total), createdAt: o.createdAt.toISOString() })),
  createdAt: c.createdAt.toISOString(),
}));
const stamp = (d: string) => new Date(d).getTime();
const valid = (o: any) => !["CANCELLED", "RETURNED"].includes(o.status);
function classify(c: any, start: number, end: number) {
  const orders = c.orders.filter((o: any) => valid(o) && stamp(o.createdAt) <= end);
  const spent = orders
    .filter((o: any) => ["DELIVERED", "SETTLED"].includes(o.status))
    .reduce((n: number, o: any) => n + o.total, 0);
  return {
    new: stamp(c.createdAt) >= start && stamp(c.createdAt) <= end,
    active: !c.blocklisted && orders.some((o: any) => stamp(o.createdAt) >= end - 90 * day),
    returning: orders.length >= 2,
    vip: orders.filter((o: any) => ["DELIVERED", "SETTLED"].includes(o.status)).length >= 10 || spent >= 50000,
  };
}
const totalSpent = (c: any) =>
  c.orders
    .filter((o: any) => ["DELIVERED", "SETTLED"].includes(o.status))
    .reduce((n: number, o: any) => n + o.total, 0);
function legacyView(from: string, to: string) {
  const p = customerPeriods(from, to, NOW);
  const [start, end, ps, pe] = [p.start, p.end, p.previousStart, p.previousEnd].map((d) => d.getTime());
  const snapshot = legacy.filter((c) => stamp(c.createdAt) <= end);
  const previous = legacy.filter((c) => stamp(c.createdAt) <= pe);
  const k = (list: any[], s: number, e: number, key: "new" | "active" | "returning" | "vip") =>
    list.filter((c) => classify(c, s, e)[key]).length;
  const seg = (f: (s: ReturnType<typeof classify>) => boolean) =>
    snapshot.filter((c) => f(classify(c, start, end))).length;
  return {
    counts: {
      all: snapshot.length,
      new: k(snapshot, start, end, "new"),
      active: k(snapshot, start, end, "active"),
      returning: k(snapshot, start, end, "returning"),
      vip: k(snapshot, start, end, "vip"),
    },
    previousCounts: {
      all: previous.length,
      new: k(previous, ps, pe, "new"),
      active: k(previous, ps, pe, "active"),
      returning: k(previous, ps, pe, "returning"),
    },
    segments: {
      vip: seg((s) => s.vip),
      returning: seg((s) => !s.vip && s.returning),
      new: seg((s) => !s.vip && !s.returning && s.new),
      other: seg((s) => !s.vip && !s.returning && !s.new),
    },
    top: [...snapshot]
      .filter((c) => totalSpent(c) > 0)
      .sort((a, b) => totalSpent(b) - totalSpent(a))
      .slice(0, 5)
      .map((c) => c.id),
    activity: snapshot
      .flatMap((c) => [
        { id: `new-${c.id}`, createdAt: c.createdAt },
        ...c.orders
          .filter((o: any) => stamp(o.createdAt) >= start && stamp(o.createdAt) <= end)
          .map((o: any) => ({ id: o.id, createdAt: o.createdAt })),
      ])
      .filter((a) => stamp(a.createdAt) >= start && stamp(a.createdAt) <= end)
      .sort((a, b) => stamp(b.createdAt) - stamp(a.createdAt))
      .slice(0, 6)
      .map((a) => a.id),
  };
}
const list = (q: Record<string, string> = {}) => listCustomers(parseCustomerListQuery(q), NOW);

// ---- Page boundaries ----
{
  const p1 = await list({ pageSize: "10" });
  const p2 = await list({ pageSize: "10", page: "2" });
  const p3 = await list({ pageSize: "10", page: "3" });
  assert.equal(p1.total, 25);
  assert.equal(p1.totalPages, 3);
  assert.deepEqual([p1.items.length, p2.items.length, p3.items.length], [10, 10, 5]);
  const seen = [...p1.items, ...p2.items, ...p3.items].map((c) => c.id);
  assert.equal(new Set(seen).size, 25, "pages do not overlap and together hold every customer");
  assert.equal(p1.items[0].name, "C25 Customer", "newest first");
  const beyond = await list({ pageSize: "10", page: "99" });
  assert.equal(beyond.page, 3, "a page past the end shows the last page");
  assert.deepEqual(
    beyond.items.map((c) => c.id),
    p3.items.map((c) => c.id),
  );
  assert.equal(parseCustomerListQuery({ pageSize: "500" }).pageSize, 100, "page size is capped");
  assert.equal(parseCustomerListQuery({ pageSize: "-3", page: "abc" }).pageSize, 10);
  assert.equal(parseCustomerListQuery({ page: "abc" }).page, 1);
  const exported = await list({ export: "1", pageSize: "10" });
  assert.equal(exported.items.length, 25, "the CSV export gets every matching row");
  assert.equal("counts" in exported, false);
  const empty = await list({ q: "nobody-matches-this" });
  assert.deepEqual([empty.total, empty.page, empty.totalPages, empty.items.length], [0, 1, 1, 0]);
  console.log("ok - page boundaries");
}

// ---- Search (name, phone, email, latest order city), case-insensitive, LIKE characters literal ----
{
  assert.deepEqual(
    (await list({ q: "c03 cust" })).items.map((c) => c.name),
    ["C03 Customer"],
  );
  assert.deepEqual(
    (await list({ q: "1000010" })).items.map((c) => c.name),
    ["C10 Customer"],
  );
  assert.deepEqual(
    (await list({ q: "C15@EXAMPLE" })).items.map((c) => c.name),
    ["C15 Customer"],
  );
  assert.deepEqual(
    (await list({ q: "karachi" })).items.map((c) => c.name),
    ["C01 Customer"],
    "latest order city",
  );
  assert.equal((await list({ q: "%" })).total, 0, "% is matched literally, not as a wildcard");
  assert.equal((await list({ q: "_" })).total, 0);
  assert.deepEqual(
    (await list({ city: "Multan" })).items.map((c) => c.name),
    ["C03 Customer"],
  );
  assert.deepEqual(
    (await list({ state: "blocked" })).items.map((c) => c.name),
    ["C07 Customer"],
  );
  assert.equal((await list({ state: "unblocked" })).total, 24);
  console.log("ok - search and filters");
}

// ---- Per-customer summaries ----
{
  const one = (await list({ q: "C01 " })).items[0];
  assert.equal(one.orderCount, 4);
  assert.equal(one.totalSpent, 2400, "lifetime delivered/settled only");
  assert.equal(one.deliveredCount, 2);
  assert.equal(one.returnedCount, 1);
  assert.equal(new Date(one.lastOrder!).toISOString(), new Date(+ago(2) - 3600_000).toISOString());
  assert.equal(one.city, "Karachi");
  assert.deepEqual(one.segments, { new: false, active: true, returning: true, vip: false });
  const vipByCount = (await list({ q: "C02 " })).items[0];
  assert.deepEqual([vipByCount.orderCount, vipByCount.totalSpent, vipByCount.segments.vip], [10, 10000, true]);
  const vipBySpend = (await list({ q: "C03 " })).items[0];
  assert.deepEqual([vipBySpend.segments.vip, vipBySpend.segments.active], [true, false]);
  const blocked = (await list({ q: "C07 " })).items[0];
  assert.deepEqual([blocked.blocklisted, blocked.refusalCount, blocked.segments.active], [true, 2, false]);
  const none = (await list({ q: "C04 " })).items[0];
  assert.deepEqual([none.orderCount, none.totalSpent, none.lastOrder, none.city], [0, 0, null, null]);
  assert.equal("orders" in none, false, "no order history in the list");
  const bySpent = await list({ sort: "spent", pageSize: "3" });
  assert.deepEqual(
    bySpent.items.map((c) => c.name),
    ["C03 Customer", "C02 Customer", "C01 Customer"],
  );
  const byOrders = await list({ sort: "orders", pageSize: "2" });
  assert.deepEqual(
    byOrders.items.map((c) => c.name),
    ["C02 Customer", "C01 Customer"],
  );
  const byName = await list({ sort: "name", pageSize: "2" });
  assert.deepEqual(
    byName.items.map((c) => c.name),
    ["C01 Customer", "C02 Customer"],
  );
  assert.deepEqual((await list({ segment: "vip" })).items.map((c) => c.name).sort(), ["C02 Customer", "C03 Customer"]);
  console.log("ok - summaries, sorting and tabs");
}

// ---- Stats match the old in-browser rules, for this month and for a custom range ----
for (const [from, to] of [
  ["", ""],
  ["2026-10-01", "2026-10-31"],
  ["2026-11-05", ""],
]) {
  const server = (await list({ from, to })) as any;
  const old = legacyView(from, to);
  assert.deepEqual(server.counts, old.counts, `counts ${from}..${to}`);
  assert.deepEqual(server.previousCounts, old.previousCounts, `previous counts ${from}..${to}`);
  assert.deepEqual(server.segments, old.segments, `segments ${from}..${to}`);
  assert.deepEqual(
    server.top.map((c: any) => c.id),
    old.top,
    `top ${from}..${to}`,
  );
  assert.deepEqual(
    server.activity.map((a: any) => a.id),
    old.activity,
    `activity ${from}..${to}`,
  );
  if (from || to) {
    const p = customerPeriods(from, to, NOW);
    const expected = legacy
      .filter(
        (c) =>
          (stamp(c.createdAt) >= +p.start && stamp(c.createdAt) <= +p.end) ||
          c.orders.some((o: any) => stamp(o.createdAt) >= +p.start && stamp(o.createdAt) <= +p.end),
      )
      .map((c) => c.id)
      .sort();
    assert.equal(server.total, expected.length, `date filter ${from}..${to}`);
  }
}
assert.deepEqual((await list()).cities, ["Islamabad", "Karachi", "Lahore", "Multan", "Peshawar"]);
console.log("ok - stats match the previous in-browser rules");

await prisma.$disconnect();
await socket.stop();
await db.close();
process.exit(0);
