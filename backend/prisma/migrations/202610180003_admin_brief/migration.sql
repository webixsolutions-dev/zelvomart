BEGIN;
ALTER TABLE "Order" ADD COLUMN "couponCode" TEXT, ADD COLUMN "couponDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "AbandonedCheckout" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "AbandonedCheckout" ADD COLUMN "restoreToken" TEXT, ADD COLUMN "emailSentAt" TIMESTAMP(3), ADD COLUMN "followedUpBy" TEXT, ADD COLUMN "lostAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "AbandonedCheckout_restoreToken_key" ON "AbandonedCheckout"("restoreToken");
CREATE INDEX "AbandonedCheckout_email_idx" ON "AbandonedCheckout"("email");
CREATE INDEX "EventLog_channel_eventName_createdAt_idx" ON "EventLog"("channel","eventName","createdAt");
CREATE TABLE "Coupon" ("id" TEXT PRIMARY KEY,"code" TEXT NOT NULL UNIQUE,"type" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,"expiresAt" TIMESTAMP(3),"active" BOOLEAN NOT NULL DEFAULT true,"usedCount" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "OrderNote" ("id" TEXT PRIMARY KEY,"orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,"body" TEXT NOT NULL,"authorId" TEXT,"authorName" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "OrderNote_orderId_createdAt_idx" ON "OrderNote"("orderId","createdAt");
CREATE TABLE "RecoveryUnsubscribe" ("email" TEXT PRIMARY KEY,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "Coupon" ("id","code","type","amount","updatedAt") VALUES ('launch-engr-rafia','ENGR-RAFIA','PERCENT',5,CURRENT_TIMESTAMP),('launch-next15','NEXT15','PERCENT',15,CURRENT_TIMESTAMP) ON CONFLICT ("code") DO NOTHING;

COMMIT;
