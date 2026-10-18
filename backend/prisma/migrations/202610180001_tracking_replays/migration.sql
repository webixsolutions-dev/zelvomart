-- Additive migration: existing orders and replay event JSON remain readable.
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ttp" TEXT, ADD COLUMN IF NOT EXISTS "ttclid" TEXT, ADD COLUMN IF NOT EXISTS "visitorId" TEXT;
ALTER TABLE "SessionReplay" ADD COLUMN IF NOT EXISTS "reachedCart" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "reachedCheckout" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "ordered" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "hasSnapshot" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "durationMs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SessionReplayChunk" ADD COLUMN IF NOT EXISTS "storageKey" TEXT, ADD COLUMN IF NOT EXISTS "byteSize" INTEGER, ADD COLUMN IF NOT EXISTS "firstTimestamp" DOUBLE PRECISION, ADD COLUMN IF NOT EXISTS "lastTimestamp" DOUBLE PRECISION;
ALTER TABLE "SessionReplayChunk" ALTER COLUMN "events" SET DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS "SessionReplay_funnel_startedAt_idx" ON "SessionReplay" ("reachedCart", "ordered", "startedAt");
UPDATE "SessionReplay" s SET "durationMs" = LEAST(2147483647,GREATEST(0,EXTRACT(EPOCH FROM (s."lastSeenAt"-s."startedAt"))*1000))::integer,
 "hasSnapshot"=EXISTS(SELECT 1 FROM "SessionReplayChunk" c WHERE c."sessionId"=s.id AND jsonb_path_exists(c.events,'$[*] ? (@.type == 2)')),
 "ordered"=EXISTS(SELECT 1 FROM "Order" o WHERE o."replaySessionId"=s.id),
 "reachedCart"=EXISTS(SELECT 1 FROM "EventLog" e WHERE e."sessionReplayId"=s.id AND e."eventName"='AddToCart'),
 "reachedCheckout"=EXISTS(SELECT 1 FROM "EventLog" e WHERE e."sessionReplayId"=s.id AND e."eventName"='InitiateCheckout');
