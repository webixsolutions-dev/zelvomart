-- Advance payment by Easypaisa Till / Raast QR (feature off by default: setting payments.advance).
-- Adds the ADVANCE_EASYPAISA method, the order payment state, and the PaymentProof table. COD orders are unchanged
-- (paymentStatus NOT_REQUIRED, advanceDiscount 0). Apply with the owner's approval after a backup:
--   npx prisma db execute --file prisma/migrations/202611050001_advance_payment/migration.sql --schema prisma/schema.prisma
--
-- Rollback (only while no order uses advance payment; enum values cannot be removed, the extra one is harmless):
--   DROP TABLE IF EXISTS "PaymentProof";
--   DROP INDEX IF EXISTS "Order_paymentMethod_paymentStatus_createdAt_idx";
--   ALTER TABLE "Order" DROP COLUMN IF EXISTS "paymentStatus", DROP COLUMN IF EXISTS "advanceDiscount",
--     DROP COLUMN IF EXISTS "advanceReceived", DROP COLUMN IF EXISTS "paymentTokenHash",
--     DROP COLUMN IF EXISTS "paymentVerifiedAt", DROP COLUMN IF EXISTS "paymentVerifiedById";
--   DROP TYPE IF EXISTS "PaymentStatus"; DROP TYPE IF EXISTS "PaymentProofMethod"; DROP TYPE IF EXISTS "PaymentProofStatus";

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'AWAITING_PAYMENT', 'SUBMITTED', 'VERIFIED', 'MISMATCH', 'REJECTED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProofMethod" AS ENUM ('TILL', 'RAAST_QR', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('SUBMITTED', 'MISMATCH', 'VERIFIED', 'PARTIAL', 'REJECTED');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ADVANCE_EASYPAISA';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "advanceDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "advanceReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "paymentTokenHash" TEXT,
ADD COLUMN     "paymentVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "paymentVerifiedById" TEXT;

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentProofMethod" NOT NULL DEFAULT 'OTHER',
    "tid" TEXT NOT NULL,
    "tidNormalized" TEXT,
    "amountSent" DECIMAL(12,2) NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderLast4" TEXT,
    "paidAt" TIMESTAMP(3),
    "screenshotKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "dhash" TEXT,
    "ocrJson" JSONB,
    "ocrTid" TEXT,
    "ocrAmount" DECIMAL(12,2),
    "ocrDateTime" TIMESTAMP(3),
    "ocrSender" TEXT,
    "ocrReceiver" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "amountMismatch" BOOLEAN NOT NULL DEFAULT false,
    "receiverMismatch" BOOLEAN NOT NULL DEFAULT false,
    "tidDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "imageDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "timeOutOfWindow" BOOLEAN NOT NULL DEFAULT false,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "merchantReference" TEXT,
    "rejectReason" TEXT,
    "notes" TEXT,
    "refundAmount" DECIMAL(12,2),
    "refundReference" TEXT,
    "refundedById" TEXT,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentProof_orderId_idx" ON "PaymentProof"("orderId");

-- CreateIndex
CREATE INDEX "PaymentProof_sha256_idx" ON "PaymentProof"("sha256");

-- CreateIndex
CREATE INDEX "PaymentProof_status_idx" ON "PaymentProof"("status");

-- CreateIndex
CREATE INDEX "Order_paymentMethod_paymentStatus_createdAt_idx" ON "Order"("paymentMethod", "paymentStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A TID can back only one live proof (rejected proofs free it). Prisma cannot express a partial unique index.
CREATE UNIQUE INDEX "PaymentProof_tidNormalized_live_key" ON "PaymentProof"("tidNormalized")
  WHERE "tidNormalized" IS NOT NULL AND "status" <> 'REJECTED';

-- Same lock-down as every public table (prisma/sql/01-lock-public-schema.sql): no access for anon/authenticated.
ALTER TABLE "PaymentProof" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "PaymentProof" FROM anon, authenticated;
  END IF;
END $$;
