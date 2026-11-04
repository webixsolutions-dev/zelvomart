-- Covering indexes for six foreign keys Supabase reported without one (Database → Advisors → Performance).
-- The tables are tiny, so a plain CREATE INDEX (a short lock) is fine. Nothing is dropped.
-- Apply with the owner's approval; see the PR or docs/OPERATIONS.md section 10 for the command.
--
-- Rollback (drops only these six indexes):
--   DROP INDEX IF EXISTS "AuditLog_userId_idx";
--   DROP INDEX IF EXISTS "Order_customerId_idx";
--   DROP INDEX IF EXISTS "OrderItem_productId_idx";
--   DROP INDEX IF EXISTS "OrderStatusHistory_userId_idx";
--   DROP INDEX IF EXISTS "Review_customerId_idx";
--   DROP INDEX IF EXISTS "Review_orderId_idx";

CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "OrderStatusHistory_userId_idx" ON "OrderStatusHistory"("userId");
CREATE INDEX IF NOT EXISTS "Review_customerId_idx" ON "Review"("customerId");
CREATE INDEX IF NOT EXISTS "Review_orderId_idx" ON "Review"("orderId");
