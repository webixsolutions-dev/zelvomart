-- Advance payment fix 3: a payment proof may be the TID + amount only (no screenshot). Apply after
-- 202611060001_advance_payment_fixes, BEFORE merging fix 3:
--   npx prisma db execute --file prisma/migrations/202611060002_proof_without_screenshot/migration.sql --schema prisma/schema.prisma
--
-- Rollback (only while every proof has a screenshot):
--   ALTER TABLE "PaymentProof" ALTER COLUMN "screenshotKey" SET NOT NULL, ALTER COLUMN "sha256" SET NOT NULL;

ALTER TABLE "PaymentProof" ALTER COLUMN "screenshotKey" DROP NOT NULL,
ALTER COLUMN "sha256" DROP NOT NULL;
