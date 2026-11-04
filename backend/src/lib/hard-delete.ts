import type { AuthedRequest } from "./auth";
import { prisma } from "./db";
import { audit } from "../http/shared";

/** Only the owner and managers may delete orders or customers for good (the admin hides the buttons for others). */
const HARD_DELETE_ROLES = new Set(["OWNER", "MANAGER"]);
export const canHardDelete = (req: AuthedRequest) => HARD_DELETE_ROLES.has(String(req.admin?.role));

/**
 * Removes one order for good. Its queued jobs go in the same transaction (so no email or Meta/TikTok event is ever
 * sent for it), its session recording is unlinked, and items/history/notes cascade. Stock is not put back.
 * Returns the deleted id, or "NOT_FOUND".
 */
export async function hardDeleteOrder(req: AuthedRequest, id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, status: true, test: true },
  });
  if (!order) return "NOT_FOUND" as const;
  await prisma.$transaction([
    prisma.job.deleteMany({ where: { orderId: id } }),
    prisma.order.updateMany({ where: { id, replaySessionId: { not: null } }, data: { replaySessionId: null } }),
    prisma.order.delete({ where: { id } }),
  ]);
  await audit(req, "hard_delete", "Order", id, {
    orderNumber: order.orderNumber,
    test: order.test,
    status: order.status,
  });
  return order.id;
}

/** Last 4 digits only, so the audit log can tell customers apart without keeping the full number. */
const maskedPhone = (phone: string) => `•••${phone.slice(-4)}`;

/**
 * Removes one customer for good.
 * - withOrders false: their orders stay in Orders (each order keeps its own name, phone and address) and are only
 *   unlinked from the customer; their reviews stay too.
 * - withOrders true: their orders are deleted first, exactly like deleting them from Orders.
 * The blocklist mark goes with the customer. Their next order creates a fresh customer record.
 * Returns what happened, or "NOT_FOUND".
 */
export async function hardDeleteCustomer(req: AuthedRequest, id: string, withOrders: boolean) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, phone: true, blocklisted: true, orders: { select: { id: true } } },
  });
  if (!customer) return "NOT_FOUND" as const;
  let ordersDeleted = 0;
  if (withOrders)
    for (const order of customer.orders) if ((await hardDeleteOrder(req, order.id)) !== "NOT_FOUND") ordersDeleted++;
  const deleted = await prisma.customer.deleteMany({ where: { id } });
  if (!deleted.count) return "NOT_FOUND" as const;
  const ordersKept = withOrders ? 0 : customer.orders.length;
  await audit(req, "hard_delete", "Customer", id, {
    phone: maskedPhone(customer.phone),
    blocklisted: customer.blocklisted,
    ordersDeleted,
    ordersKept,
  });
  return { id: customer.id, ordersDeleted, ordersKept };
}
