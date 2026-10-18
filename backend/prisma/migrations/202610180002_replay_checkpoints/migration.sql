ALTER TABLE "SessionReplayChunk" ADD COLUMN IF NOT EXISTS "hasSnapshot" BOOLEAN NOT NULL DEFAULT false;
UPDATE "SessionReplayChunk" SET "hasSnapshot"=true WHERE NOT "hasSnapshot" AND jsonb_path_exists(events,'$[*] ? (@.type == 2)');
UPDATE "SessionReplayChunk" c SET "firstTimestamp"=v.first_ts,"lastTimestamp"=v.last_ts
FROM (SELECT id,MIN((e->>'timestamp')::double precision) first_ts,MAX((e->>'timestamp')::double precision) last_ts FROM "SessionReplayChunk",jsonb_array_elements(events) e WHERE jsonb_typeof(e->'timestamp')='number' GROUP BY id) v
WHERE c.id=v.id AND (c."firstTimestamp" IS NULL OR c."lastTimestamp" IS NULL);
CREATE INDEX IF NOT EXISTS "SessionReplayChunk_checkpoint_idx" ON "SessionReplayChunk" ("sessionId","hasSnapshot","sequence");
