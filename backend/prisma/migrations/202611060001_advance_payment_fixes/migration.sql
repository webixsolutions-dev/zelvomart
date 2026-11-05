-- Advance payment fixes after the first live test (ZM-10018). Additive only; COD orders are unchanged.
-- Apply after a backup, BEFORE merging the fixes PR:
--   npx prisma db execute --file prisma/migrations/202611060001_advance_payment_fixes/migration.sql --schema prisma/schema.prisma
--
-- Rollback (only while no proof was saved without a TID or amount):
--   ALTER TABLE "Order" DROP COLUMN IF EXISTS "advanceRefunded";
--   ALTER TABLE "PaymentProof" DROP COLUMN IF EXISTS "detailsFromAutoRead", DROP COLUMN IF EXISTS "detailsMissing",
--     DROP COLUMN IF EXISTS "amountReceived", DROP COLUMN IF EXISTS "refundReason",
--     ALTER COLUMN "tid" SET NOT NULL, ALTER COLUMN "amountSent" SET NOT NULL;

-- Money sent back to the customer, so the courier amount is total - received + refunded.
ALTER TABLE "Order" ADD COLUMN "advanceRefunded" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- A screenshot alone is enough: TID and amount may come from the auto-read or from staff.
ALTER TABLE "PaymentProof" ALTER COLUMN "tid" DROP NOT NULL,
ALTER COLUMN "amountSent" DROP NOT NULL,
ADD COLUMN "detailsFromAutoRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "detailsMissing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "amountReceived" DECIMAL(12,2),
ADD COLUMN "refundReason" TEXT;

-- Refunds recorded before this change (e.g. ZM-10018) count towards the order's refunded total.
UPDATE "Order" o SET "advanceRefunded" = r.total
FROM (SELECT "orderId", SUM("refundAmount") AS total FROM "PaymentProof" WHERE "refundAmount" IS NOT NULL GROUP BY "orderId") r
WHERE o.id = r."orderId";

-- Proofs accepted before this change: the amount staff accepted is the order's received amount.
UPDATE "PaymentProof" p SET "amountReceived" = o."advanceReceived"
FROM "Order" o
WHERE p."orderId" = o.id AND p."status" IN ('VERIFIED', 'PARTIAL') AND p."amountReceived" IS NULL;
