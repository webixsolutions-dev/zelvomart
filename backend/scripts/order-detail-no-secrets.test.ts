import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import express from "express";
import type { AddressInfo } from "node:net";

// Group A regression: GET /api/admin/orders/:id once spread `statusHistory: { include: { user: true } }` into the
// response, so any ORDER_AGENT could read a staff member's passwordHash and totpSecret.
const SECRET_KEYS = ["passwordHash", "totpSecret", "token", "tokenHash", "twoFactorReady", "email"];

function findKeys(value: unknown, keys: string[], path = "$", hits: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item, index) => findKeys(item, keys, `${path}[${index}]`, hits));
  else if (value && typeof value === "object")
    for (const [key, child] of Object.entries(value)) {
      if (keys.includes(key)) hits.push(`${path}.${key}`);
      findKeys(child, keys, `${path}.${key}`, hits);
    }
  return hits;
}

test("order details never return staff secrets, even nested in statusHistory[].user", async () => {
  const require = createRequire(__filename);
  const stub = (path: string, exports: unknown) => {
    const filename = require.resolve(path);
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule;
  };
  const staff = {
    id: "staff-1",
    name: "Sana (manager)",
    email: "sana@zelvomart.com",
    passwordHash: "$2b$12$leaked-hash",
    totpSecret: "JBSWY3DPEHPK3PXP",
    twoFactorReady: true,
    role: "MANAGER",
    active: true,
  };
  let findArgs: any;
  const prisma = {
    order: {
      // Like a careless query: returns full user rows whatever the select says, so only the route's own
      // whitelist stands between the database and the response.
      findUnique: async (args: any) => {
        findArgs = args;
        return {
          id: "o1",
          orderNumber: "ZM-1",
          phone: "03001234567",
          total: "741.00",
          subtotal: "551.00",
          bundleSaving: "0",
          deliveryFee: "190",
          codFee: "0",
          postexTracking: null,
          items: [],
          customer: { id: "c1", name: "Customer", phone: "03001234567" },
          statusHistory: [
            {
              id: "h2",
              from: "NEW",
              to: "CONFIRMED",
              note: "called",
              createdAt: new Date(),
              userId: staff.id,
              user: staff,
            },
            { id: "h1", from: null, to: "NEW", note: null, createdAt: new Date(), userId: null, user: null },
          ],
        };
      },
    },
  };
  stub("../src/lib/db", { prisma });
  stub("../src/lib/auth", {
    requireAuth: () => (req: any, _res: any, next: () => void) => {
      req.admin = { id: "agent-1", name: "Agent", email: "agent@zelvomart.com", role: "ORDER_AGENT" };
      next();
    },
  });
  stub("../src/admin-order-edit", { orderExtras: async () => ({ notes: [], history: [] }) });
  const app = express();
  app.use(express.json());
  require("../src/routes/admin/orders").registerAdminOrdersRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/orders/o1`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(findKeys(body, SECRET_KEYS), [], "no secret or staff contact field anywhere in the response");
    assert.deepEqual(body.statusHistory[0].user, { id: "staff-1", name: "Sana (manager)" });
    assert.equal(body.statusHistory[0].to, "CONFIRMED");
    assert.equal(body.statusHistory[0].note, "called");
    assert.equal(body.statusHistory[1].user, null);
    // The query itself asks only for the user's id and name.
    assert.deepEqual(findArgs.include.statusHistory.select.user, { select: { id: true, name: true } });
  } finally {
    server.close();
  }
});
