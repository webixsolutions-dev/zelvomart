import type { Prisma } from "../generated/prisma/client";
import { tiktokJobsEnabled } from "./tiktok";

type Tx = Prisma.TransactionClient;

/**
 * Emails and conversions follow the payment for advance orders (checkout sends nothing):
 * - Meta/TikTok Purchase: at the first payment proof, or when the order becomes Cash on Delivery. Same event_id as
 *   always (the order number, set in job-processor.ts), once per order, timed when it happens.
 * - Order emails (team + customer): when staff accept the payment ("advance-paid") or the order becomes COD
 *   ("cod-switch"). Each kind has its own delivery key, so it is sent once.
 */
export async function enqueuePurchaseOnce(
  tx: Tx,
  order: { id: string; test: boolean; staffCreated: boolean; blocklistedAtOrder: boolean },
) {
  if (order.test || order.staffCreated || order.blocklistedAtOrder) return [];
  const names = ["meta-purchase", ...((await tiktokJobsEnabled()) ? ["tiktok-purchase"] : [])];
  const existing = await tx.job.findMany({
    where: { orderId: order.id, name: { in: names } },
    select: { name: true },
  });
  const eventTime = Math.floor(Date.now() / 1000);
  const jobs = await Promise.all(
    names
      .filter((name) => !existing.some((job) => job.name === name))
      .map((name) =>
        tx.job.create({
          data: { name, orderId: order.id, payload: { orderId: order.id, eventTime } },
          select: { id: true },
        }),
      ),
  );
  return jobs.map((job) => job.id);
}

export type OrderEmailKind = "advance-paid" | "cod-switch";

export async function enqueueOrderEmails(tx: Tx, orderId: string, kind: OrderEmailKind, message?: string) {
  const jobs = await Promise.all(
    ["order-team-email", "customer-order-email"].map((name) =>
      tx.job.create({
        data: {
          name,
          orderId,
          payload: { orderId, kind, ...(message && name === "customer-order-email" ? { message } : {}) },
        },
        select: { id: true },
      }),
    ),
  );
  return jobs.map((job) => job.id);
}
