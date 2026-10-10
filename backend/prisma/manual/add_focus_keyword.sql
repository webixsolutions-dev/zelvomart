-- Additive migration for Production: Add nullable focusKeyword column to Product table
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "focusKeyword" TEXT;
