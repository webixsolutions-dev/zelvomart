import { prisma } from "../../lib/db";
import { requireAuth, type AuthedRequest } from "../../lib/auth";
import { normalizePakistanPhone } from "../../lib/phone";
import type { Express } from "express";
import { audit, routeParam } from "../../http/shared";

function customerInput(body: any) {
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.name !== "string" ||
    typeof body.phone !== "string" ||
    (body.email != null && typeof body.email !== "string") ||
    (body.notes != null && typeof body.notes !== "string")
  )
    return null;
  const name = String(body.name || "").trim(),
    phone = normalizePakistanPhone(String(body.phone || "")),
    email = String(body.email || "").trim(),
    notes = String(body.notes || "").trim();
  if (
    name.length < 2 ||
    name.length > 100 ||
    !phone ||
    email.length > 254 ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    notes.length > 2000
  )
    return null;
  return { name, phone: phone!, email: email || null, notes: notes || null };
}

export function registerAdminCustomersRoutes(app: Express) {
  app.get("/api/admin/customers", requireAuth("customers.read"), async (_req, res) => {
    const rows = await prisma.customer.findMany({
      include: {
        orders: {
          select: { id: true, orderNumber: true, total: true, status: true, city: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json(
      rows.map((c) => ({
        ...c,
        orders: c.orders.map((o) => ({ ...o, total: Number(o.total) })),
        totalSpent: c.orders
          .filter((o) => ["DELIVERED", "SETTLED"].includes(o.status))
          .reduce((sum, o) => sum + Number(o.total), 0),
        orderCount: c.orders.length,
        city: c.orders[0]?.city || null,
        lastOrder: c.orders[0]?.createdAt || null,
      })),
    );
  });
  app.post("/api/admin/customers", requireAuth("customers.write"), async (req: AuthedRequest, res) => {
    const data = customerInput(req.body);
    if (!data)
      return res.status(400).json({ error: "Enter a name, valid Pakistani mobile number, and valid optional email." });
    try {
      const row = await prisma.customer.create({ data });
      await audit(req, "create", "Customer", row.id);
      res.status(201).json({ id: row.id });
    } catch (error: any) {
      if (error.code === "P2002")
        return res.status(409).json({ error: "A customer with this phone number already exists." });
      throw error;
    }
  });
  app.patch("/api/admin/customers/bulk-blocklist", requireAuth("customers.write"), async (req: AuthedRequest, res) => {
    if (!req.body || !Array.isArray(req.body.ids) || req.body.ids.length > 100)
      return res.status(400).json({ error: "INVALID_BULK_UPDATE" });
    const ids: string[] = Array.isArray(req.body.ids)
      ? [...new Set<string>(req.body.ids.map(String))].slice(0, 100)
      : [];
    if (!ids.length || typeof req.body.blocklisted !== "boolean")
      return res.status(400).json({ error: "INVALID_BULK_UPDATE" });
    const result = await prisma.customer.updateMany({
      where: { id: { in: ids } },
      data: { blocklisted: req.body.blocklisted },
    });
    await audit(req, "bulk_blocklist", "Customer", undefined, { ids, blocklisted: req.body.blocklisted });
    res.json({ updated: result.count });
  });
  app.get("/api/admin/customers/:id", requireAuth("customers.read"), async (req, res) => {
    const row = await prisma.customer.findUnique({
      where: { id: routeParam(req, "id") },
      include: { orders: { include: { items: true }, orderBy: { createdAt: "desc" } } },
    });
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    const abandoned = await prisma.abandonedCheckout.findMany({
      where: { OR: [{ phone: row.phone }, ...(row.email ? [{ email: row.email }] : [])] },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json({ ...row, orders: row.orders.map((o) => ({ ...o, total: Number(o.total) })), abandoned });
  });
  app.patch("/api/admin/customers/:id", requireAuth("customers.write"), async (req: AuthedRequest, res) => {
    const data = customerInput(req.body);
    if (!data)
      return res.status(400).json({ error: "Enter a name, valid Pakistani mobile number, and valid optional email." });
    try {
      const row = await prisma.customer.update({ where: { id: routeParam(req, "id") }, data });
      await audit(req, "update", "Customer", row.id);
      res.json({ id: row.id });
    } catch (error: any) {
      if (error.code === "P2002")
        return res.status(409).json({ error: "A customer with this phone number already exists." });
      if (error.code === "P2025") return res.status(404).json({ error: "Customer not found." });
      throw error;
    }
  });
  app.patch("/api/admin/customers/:id/blocklist", requireAuth("customers.write"), async (req: AuthedRequest, res) => {
    const current = await prisma.customer.findUnique({ where: { id: routeParam(req, "id") } });
    if (!current) return res.status(404).json({ error: "NOT_FOUND" });
    const row = await prisma.customer.update({
      where: { id: routeParam(req, "id") },
      data: { blocklisted: typeof req.body.blocklisted === "boolean" ? req.body.blocklisted : !current.blocklisted },
    });
    await audit(req, "toggle_blocklist", "Customer", row.id, { blocklisted: row.blocklisted });
    res.json(row);
  });
}
