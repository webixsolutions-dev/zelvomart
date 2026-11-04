import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import express from "express";
import type { AddressInfo } from "node:net";

type Row = { id: string; phone: string; blocklisted: boolean };

test("admin customer delete: roles, keep or delete orders, not found, bulk", async (t) => {
  const require = createRequire(__filename);
  const stub = (path: string, exports: unknown) => {
    const filename = require.resolve(path);
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule;
  };
  let role = "OWNER";
  let customers: Row[] = [];
  let orders: { id: string; customerId: string | null }[] = [];
  const deletedOrders: string[] = [];
  const deletedJobsFor: string[] = [];
  const audits: unknown[][] = [];
  const reset = () => {
    customers = [
      { id: "c1", phone: "03001234567", blocklisted: true },
      { id: "c2", phone: "03007654321", blocklisted: false },
    ];
    orders = [
      { id: "o1", customerId: "c1" },
      { id: "o2", customerId: "c1" },
      { id: "o3", customerId: "c2" },
    ];
    deletedOrders.length = 0;
    deletedJobsFor.length = 0;
    audits.length = 0;
  };
  const prisma = {
    customer: {
      findUnique: async ({ where }: any) => {
        const row = customers.find((c) => c.id === where.id);
        return row
          ? { ...row, orders: orders.filter((o) => o.customerId === row.id).map((o) => ({ id: o.id })) }
          : null;
      },
      deleteMany: async ({ where }: any) => {
        const before = customers.length;
        customers = customers.filter((c) => c.id !== where.id);
        // Like onDelete: SetNull, kept orders lose the link.
        for (const order of orders) if (order.customerId === where.id) order.customerId = null;
        return { count: before - customers.length };
      },
    },
    order: {
      findUnique: async ({ where }: any) => {
        const row = orders.find((o) => o.id === where.id);
        return row ? { id: row.id, orderNumber: `ZM-${row.id}`, status: "NEW", test: false } : null;
      },
      updateMany: async () => ({ count: 0 }),
      delete: async ({ where }: any) => {
        orders = orders.filter((o) => o.id !== where.id);
        deletedOrders.push(where.id);
        return { id: where.id };
      },
    },
    job: {
      deleteMany: async ({ where }: any) => {
        deletedJobsFor.push(where.orderId);
        return { count: 1 };
      },
    },
    $transaction: async (steps: Promise<unknown>[]) => Promise.all(steps),
  };
  stub("../src/lib/db", { prisma });
  stub("../src/lib/auth", {
    requireAuth: () => (req: any, _res: any, next: () => void) => {
      req.admin = { id: "admin-1", role };
      next();
    },
  });
  stub("../src/http/shared", {
    routeParam: (req: any, key: string) => req.params[key],
    audit: async (...args: unknown[]) => {
      audits.push(args);
    },
  });
  const app = express();
  app.use(express.json());
  require("../src/routes/admin/customers").registerAdminCustomersRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    await t.test("staff below manager cannot delete", async () => {
      reset();
      role = "STAFF";
      assert.equal((await request("DELETE", "/api/admin/customers/c1")).status, 403);
      assert.equal((await request("POST", "/api/admin/customers/bulk-delete", { ids: ["c1"] })).status, 403);
      assert.equal(customers.length, 2);
      role = "OWNER";
    });
    await t.test("default keeps the customer's orders, unlinked", async () => {
      reset();
      const result = await request("DELETE", "/api/admin/customers/c1");
      assert.deepEqual(result, { status: 200, body: { deleted: ["c1"], ordersDeleted: 0, ordersKept: 2 } });
      assert.deepEqual(deletedOrders, []);
      assert.deepEqual(
        orders.map((o) => [o.id, o.customerId]),
        [
          ["o1", null],
          ["o2", null],
          ["o3", "c2"],
        ],
      );
      const [, action, entity, id, details] = audits.at(-1) as [unknown, string, string, string, any];
      assert.deepEqual([action, entity, id], ["hard_delete", "Customer", "c1"]);
      assert.equal(details.phone, "•••4567");
      assert.equal(JSON.stringify(details).includes("03001234567"), false);
    });
    await t.test("withOrders deletes their orders and those orders' jobs, nobody else's", async () => {
      reset();
      const result = await request("DELETE", "/api/admin/customers/c1?withOrders=1");
      assert.deepEqual(result, { status: 200, body: { deleted: ["c1"], ordersDeleted: 2, ordersKept: 0 } });
      assert.deepEqual(deletedOrders, ["o1", "o2"]);
      assert.deepEqual(deletedJobsFor, ["o1", "o2"]);
      assert.deepEqual(orders, [{ id: "o3", customerId: "c2" }]);
    });
    await t.test("missing customer is a 404", async () => {
      reset();
      assert.deepEqual(await request("DELETE", "/api/admin/customers/nope"), {
        status: 404,
        body: { error: "NOT_FOUND" },
      });
    });
    await t.test("bulk delete reports deleted, skipped and order totals", async () => {
      reset();
      assert.equal((await request("POST", "/api/admin/customers/bulk-delete", { ids: [] })).status, 400);
      const result = await request("POST", "/api/admin/customers/bulk-delete", {
        ids: ["c1", "c2", "c1", "ghost"],
        withOrders: true,
      });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, {
        deleted: ["c1", "c2"],
        skipped: [{ id: "ghost", reason: "NOT_FOUND" }],
        errors: [],
        ordersDeleted: 3,
        ordersKept: 0,
      });
      assert.equal(customers.length, 0);
      assert.equal(orders.length, 0);
    });
    await t.test("withOrders must be exactly true in bulk", async () => {
      reset();
      const result = await request("POST", "/api/admin/customers/bulk-delete", { ids: ["c2"], withOrders: "yes" });
      assert.deepEqual(result.body.ordersKept, 1);
      assert.deepEqual(deletedOrders, []);
    });
  } finally {
    server.close();
  }
});
