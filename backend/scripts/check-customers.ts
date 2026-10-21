import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { signAdminToken, passwordStamp } from "../src/lib/auth";

// From backend/: npx tsx scripts/check-customers.ts [--write-test]
// Write checks create one uniquely tagged fixture, then clean up only its records.
async function main() {
  const base = process.env.CUSTOMER_CHECK_API_URL || "http://localhost:4000";
  const user = await prisma.user.findFirst({
    where: { role: "OWNER" },
    select: { id: true, name: true, email: true, role: true, passwordHash: true },
  });
  assert.ok(user, "An existing owner is required for API checks.");
  const token = signAdminToken(user, passwordStamp(user.passwordHash));
  async function api(path: string, method = "GET", body?: unknown, auth = true) {
    const r = await fetch(`${base}/api/admin/customers${path}`, {
      method,
      headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(45000),
    });
    return { status: r.status, body: await r.json() };
  }
  const initial = await api("");
  assert.equal(initial.status, 200);
  assert.ok(Array.isArray(initial.body));
  console.log("PASS database connection, schema, and customer listing");
  assert.equal((await api("", "GET", undefined, false)).status, 401);
  for (const body of [
    { name: "Bad", phone: "invalid" },
    { name: "Bad", phone: "03001234567", email: "invalid" },
  ])
    assert.equal((await api("", "POST", body)).status, 400);
  for (const body of [
    { ids: [], blocklisted: true },
    { ids: ["missing"], blocklisted: "true" },
  ])
    assert.equal((await api("/bulk-blocklist", "PATCH", body)).status, 400);
  console.log("PASS authentication and input validation");
  if (!process.argv.includes("--write-test")) return;
  const marker = `codex-customer-qa:${randomUUID()}`;
  let phone = "";
  for (let n = 0; n < 20; n++) {
    const candidate = `+92399${String(Math.floor(Math.random() * 10000000)).padStart(7, "0")}`;
    if (!(await prisma.customer.findUnique({ where: { phone: candidate }, select: { id: true } }))) {
      phone = candidate;
      break;
    }
  }
  assert.ok(phone, "Could not allocate a fixture phone.");
  let customerId: string | undefined;
  try {
    const created = await api("", "POST", {
      name: "Temporary customer QA",
      phone,
      email: "customer-qa@example.invalid",
      notes: marker,
    });
    const stored = await prisma.customer.findUnique({ where: { phone }, select: { id: true, notes: true } });
    if (stored?.notes === marker) customerId = stored.id;
    assert.equal(created.status, 201, `Create failed: ${created.body.error || created.status}`);
    assert.equal(created.body.id, customerId);
    assert.ok(customerId);
    assert.equal((await api("", "POST", { name: "Duplicate QA", phone: phone.replace(/^\+92/, "0") })).status, 409);
    console.log("PASS customer creation and duplicate phone rejection");
    assert.equal(
      (
        await api(`/${customerId}`, "PATCH", {
          name: "Updated temporary QA",
          phone,
          email: "updated-qa@example.invalid",
          notes: marker,
        })
      ).status,
      200,
    );
    const edited = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(edited.name, "Updated temporary QA");
    assert.equal(edited.email, "updated-qa@example.invalid");
    console.log("PASS profile updates persisted");
    for (const blocklisted of [true, false]) {
      const result = await api("/bulk-blocklist", "PATCH", { ids: [customerId], blocklisted });
      assert.equal(result.status, 200);
      assert.equal(result.body.updated, 1);
      assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).blocklisted, blocklisted);
    }
    assert.equal((await api(`/${customerId}/blocklist`, "PATCH", {})).status, 200);
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).blocklisted, true);
    assert.equal((await api("/bulk-blocklist", "PATCH", { ids: [customerId], blocklisted: false })).status, 200);
    console.log("PASS bulk block/unblock and existing toggle endpoint");
    const listed = (await api("")).body.find((c: { id: string }) => c.id === customerId);
    assert.ok(listed);
    assert.equal(listed.orderCount, 0);
    assert.equal(listed.totalSpent, 0);
    assert.deepEqual(listed.orders, []);
    assert.equal(listed.lastOrder, null);
    assert.equal(listed.blocklisted, false);
    const audits = await prisma.auditLog.findMany({
      where: { entity: "Customer", entityId: customerId },
      select: { action: true },
    });
    assert.ok(audits.some((a) => a.action === "create"));
    assert.ok(audits.some((a) => a.action === "update"));
    console.log("PASS dashboard response and audit records");
  } finally {
    if (customerId) {
      assert.ok(
        await prisma.customer.findFirst({
          where: { id: customerId, notes: marker, orders: { none: {} } },
          select: { id: true },
        }),
        "Fixture changed or has orders; preserving it for inspection.",
      );
      await prisma.$transaction([
        prisma.auditLog.deleteMany({
          where: {
            entity: "Customer",
            userId: user.id,
            OR: [
              { entityId: customerId },
              { action: "bulk_blocklist", details: { path: ["ids"], array_contains: [customerId] } },
            ],
          },
        }),
        prisma.customer.deleteMany({ where: { id: customerId, notes: marker, orders: { none: {} } } }),
      ]);
      assert.equal(await prisma.customer.count({ where: { id: customerId } }), 0);
      console.log("PASS temporary customer and QA audit records cleaned up");
    }
  }
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Customer checks failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
