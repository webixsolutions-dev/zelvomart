import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import express from "express";
import type { AddressInfo } from "node:net";
import { isEmailConflict } from "../src/lib/email-conflict";
import { friendlyError } from "../../frontend/lib/app-errors";

test("only the email unique constraint is mapped to an email conflict", () => {
  for (const target of [["email"], "User_email_key", "email"])
    assert.equal(isEmailConflict({ code: "P2002", meta: { target } }), true);
  for (const error of [
    null,
    {},
    { code: "P1001" },
    { code: "P2002" },
    { code: "P2002", meta: { target: ["phone"] } },
    { code: "P2002", meta: { target: "User_other_email_key" } },
  ])
    assert.equal(isEmailConflict(error), false);
  assert.equal(
    friendlyError("EMAIL_ALREADY_EXISTS", 409),
    "A user with this email address already exists. Use a different email address.",
  );
});

test("registered admin user routes return 409 for duplicate email and retain customer phone conflicts", async (t) => {
  const require = createRequire(__filename);
  const originals = new Map<string, NodeModule | undefined>();
  const stub = (path: string, exports: unknown) => {
    const filename = require.resolve(path);
    originals.set(filename, require.cache[filename]);
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule;
  };
  let userFailure: unknown;
  const writes: Array<{ method: string; data: any }> = [];
  const audits: unknown[][] = [];
  const forgotten: string[] = [];
  const permissions: string[] = [];
  const customers: Array<{ id: string; phone: string; email: string | null }> = [];
  const prisma = {
    user: {
      create: async ({ data }: any) => {
        writes.push({ method: "create", data });
        if (userFailure) throw userFailure;
        return { id: "staff-1", twoFactorReady: false, ...data };
      },
      update: async ({ data }: any) => {
        writes.push({ method: "update", data });
        if (userFailure) throw userFailure;
        return { id: "staff-1", name: "Staff", email: "staff@example.com", role: "MANAGER", active: true, ...data };
      },
    },
    customer: {
      create: async ({ data }: any) => {
        if (customers.some((row) => row.phone === data.phone)) throw { code: "P2002", meta: { target: ["phone"] } };
        const row = { id: `customer-${customers.length + 1}`, ...data };
        customers.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        if (customers.some((row) => row.id !== where.id && row.phone === data.phone))
          throw { code: "P2002", meta: { target: ["phone"] } };
        const row = customers.find((row) => row.id === where.id);
        if (!row) throw { code: "P2025" };
        return Object.assign(row, data);
      },
    },
  };
  // Replace imports before loading the real route registrars: no database module or connection is opened.
  stub("../src/lib/db", { prisma });
  stub("../src/lib/auth", {
    requireAuth: (permission: string) => (req: any, _res: any, next: () => void) => {
      permissions.push(permission);
      req.admin = { id: "owner-1", role: "OWNER" };
      next();
    },
    forgetAdminUser: (id: string) => forgotten.push(id),
  });
  stub("../src/http/shared", {
    routeParam: (req: any, key: string) => req.params[key],
    audit: async (...args: unknown[]) => {
      audits.push(args);
    },
  });
  const app = express();
  app.use(express.json());
  require("../src/routes/auth").registerAuthRoutes(app);
  require("../src/routes/admin/customers").registerAdminCustomersRoutes(app);
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "SERVER_ERROR" });
  });
  const server = app.listen(0, "127.0.0.1");
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = async (method: string, path: string, body: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const user = { name: "Staff", email: " Staff@Example.com ", password: "valid-password-123", role: "MANAGER" };
  try {
    await t.test("create and update convert email P2002 to the stable 409 code", async () => {
      for (const [method, path, target] of [
        ["POST", "/api/admin/users", ["email"]],
        ["PATCH", "/api/admin/users/staff-1", "User_email_key"],
      ] as const) {
        userFailure = { code: "P2002", meta: { target }, message: "private database detail" };
        const result = await request(method, path, user);
        assert.deepEqual(result, { status: 409, body: { error: "EMAIL_ALREADY_EXISTS" } });
        assert.equal(writes.at(-1)?.data.email, "staff@example.com");
      }
      assert.equal(audits.length, 0);
      assert.equal(forgotten.length, 0);
    });
    await t.test("successful writes keep audit/cache behavior and normalize email", async () => {
      userFailure = undefined;
      assert.equal((await request("POST", "/api/admin/users", user)).status, 201);
      assert.equal(writes.at(-1)?.data.email, "staff@example.com");
      assert.notEqual(writes.at(-1)?.data.passwordHash, user.password);
      assert.equal((await request("PATCH", "/api/admin/users/staff-1", { email: " NEW@Example.com " })).status, 200);
      assert.equal(writes.at(-1)?.data.email, "new@example.com");
      assert.equal(audits.length, 2);
      assert.deepEqual(forgotten, ["staff-1"]);
    });
    await t.test("unrelated constraints and database failures stay server errors", async () => {
      for (const error of [
        { code: "P2002", meta: { target: ["phone"] } },
        { code: "P1001", message: "private database detail" },
      ]) {
        userFailure = error;
        const result = await request("PATCH", "/api/admin/users/staff-1", { email: "staff@example.com" });
        assert.deepEqual(result, { status: 500, body: { error: "SERVER_ERROR" } });
      }
    });
    await t.test("customers can share email while duplicate phones still return 409", async () => {
      const customer = { name: "Customer", phone: "03001234567", email: "shared@example.com" };
      assert.equal((await request("POST", "/api/admin/customers", customer)).status, 201);
      assert.equal((await request("POST", "/api/admin/customers", { ...customer, phone: "03007654321" })).status, 201);
      assert.equal(customers[0].email, customers[1].email);
      assert.equal(
        (await request("PATCH", "/api/admin/customers/customer-2", { ...customer, phone: "03007654321" })).status,
        200,
      );
      const expected = { status: 409, body: { error: "A customer with this phone number already exists." } };
      assert.deepEqual(await request("POST", "/api/admin/customers", customer), expected);
      assert.deepEqual(await request("PATCH", "/api/admin/customers/customer-2", customer), expected);
    });
    assert.ok(permissions.includes("users.write"));
    assert.ok(permissions.includes("customers.write"));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    for (const [filename, original] of originals) {
      if (original) require.cache[filename] = original;
      else delete require.cache[filename];
    }
  }
});
