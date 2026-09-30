import { prisma } from "@/lib/db";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return (row?.value as T | undefined) ?? fallback;
}

export async function getStoreSettings() {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "store.info",
          "store.announcement",
          "store.bundleDefaultDiscountPercent",
          "store.minimumSellingPrice",
          "store.delivery",
          "checkout.requiredFields",
          "payments.methods",
          "tracking.metaPixelId",
          "tracking.clarityId",
          "notifications.orderRecipients",
          "postex.trackingBaseUrl",
          "homepage.config",
        ],
      },
    },
  });

  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
