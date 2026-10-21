import { Router } from "express";
import { prisma } from "./lib/db";
import { requireAuth, type AuthedRequest } from "./lib/auth";
import { couponInput } from "./lib/coupons";
export const couponRouter = Router();
couponRouter.get("/", requireAuth("products.write"), async (_req, res) => {
  const [coupons, usage] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.order.groupBy({
      by: ["couponCode"],
      where: {
        couponCode: { not: null },
        test: false,
        staffCreated: false,
        status: { notIn: ["CANCELLED", "RETURNED"] },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);
  res.json(
    coupons.map((c) => ({
      ...c,
      amount: Number(c.amount),
      revenue: Number(usage.find((u) => u.couponCode === c.code)?._sum.total || 0),
    })),
  );
});
couponRouter.post("/", requireAuth("products.write"), async (req: AuthedRequest, res) => {
  try {
    const data = couponInput(req.body);
    const row = await prisma.coupon.create({ data });
    await prisma.auditLog.create({
      data: { userId: req.admin?.id, action: "create", entity: "Coupon", entityId: row.id },
    });
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.code === "P2002" ? "That coupon code already exists." : e.message });
  }
});
couponRouter.put("/:id", requireAuth("products.write"), async (req: AuthedRequest, res) => {
  try {
    const data = couponInput(req.body);
    const row = await prisma.coupon.update({ where: { id: String(req.params.id) }, data });
    await prisma.auditLog.create({
      data: { userId: req.admin?.id, action: "update", entity: "Coupon", entityId: row.id },
    });
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.code === "P2002" ? "That coupon code already exists." : e.message });
  }
});
// Deactivate instead of deleting so historical order codes remain meaningful.
couponRouter.delete("/:id", requireAuth("products.write"), async (req: AuthedRequest, res) => {
  await prisma.coupon.update({ where: { id: String(req.params.id) }, data: { active: false } });
  await prisma.auditLog.create({
    data: { userId: req.admin?.id, action: "deactivate", entity: "Coupon", entityId: String(req.params.id) },
  });
  res.json({ ok: true });
});
