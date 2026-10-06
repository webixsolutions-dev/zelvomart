-- Customer storefront accounts and persistent login sessions
CREATE TABLE IF NOT EXISTS "StoreUser" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StoreUser_email_key" ON "StoreUser"("email");

CREATE TABLE IF NOT EXISTS "StoreSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StoreSession_tokenHash_key" ON "StoreSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "StoreSession_userId_expiresAt_idx" ON "StoreSession"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "StoreSession_expiresAt_idx" ON "StoreSession"("expiresAt");
DO $$ BEGIN
  ALTER TABLE "StoreSession" ADD CONSTRAINT "StoreSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "StoreUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
