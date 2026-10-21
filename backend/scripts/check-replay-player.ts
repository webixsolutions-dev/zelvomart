import "dotenv/config";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { deleteReplayChunks } from "../src/lib/replay-storage";
const base = "http://localhost:4000",
  prefix = "http://localhost:3000/__replay_player_qa/";
async function post(path: string, body: unknown) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  assert.equal(r.status, 200, await r.text());
}
async function main() {
  const mode = process.argv[2] || "create";
  if (mode === "create") {
    const id = randomUUID(),
      now = Date.now() - 20000;
    await post("/api/session-replays/start", {
      sessionId: id,
      visitorId: randomUUID(),
      landingUrl: prefix + id,
      currentUrl: prefix + id,
      startedAt: new Date(now).toISOString(),
      viewport: "390x844",
      device: "mobile",
    });
    const text = (id: number, textContent: string) => ({ type: 3, id, textContent });
    const element = (id: number, tagName: string, childNodes: any[] = [], attributes: Record<string, string> = {}) => ({
      type: 2,
      id,
      tagName,
      attributes,
      childNodes,
    });
    const snapshot = {
      type: 2,
      timestamp: now + 1,
      data: {
        node: {
          type: 0,
          id: 1,
          childNodes: [
            { type: 1, id: 2, name: "html", publicId: "", systemId: "" },
            element(3, "html", [
              element(4, "head", [
                element(5, "style", [
                  text(
                    6,
                    "body{margin:0;padding:32px;background:#eef5ff;color:#102342;font:18px Arial}h1{font-size:28px}p{padding:18px;background:white;border-radius:12px}",
                  ),
                ]),
              ]),
              element(7, "body", [
                element(8, "h1", [text(9, "Replay verification")]),
                element(10, "p", [text(11, "Initial snapshot loaded")]),
              ]),
            ]),
          ],
        },
        initialOffset: { top: 0, left: 0 },
      },
    };
    await post("/api/session-replays/chunk", {
      sessionId: id,
      sequence: 0,
      currentUrl: prefix + id,
      events: [
        { type: 4, timestamp: now, data: { href: prefix + id, width: 390, height: 844 } },
        snapshot,
        { type: 3, timestamp: now + 10000, data: { source: 4, width: 390, height: 844 } },
      ],
    });
    console.log(JSON.stringify({ id, url: `http://localhost:3000/admin/session-replays/${id}?live=1` }));
    return;
  }
  const id = process.argv[3];
  assert.ok(id);
  const session = await prisma.sessionReplay.findUniqueOrThrow({ where: { id } });
  assert.equal(session.landingUrl, prefix + id, "Only the dedicated QA fixture may be changed.");
  if (mode === "append") {
    const sequence = await prisma.sessionReplayChunk.count({ where: { sessionId: id } });
    await post("/api/session-replays/chunk", {
      sessionId: id,
      sequence,
      currentUrl: prefix + id,
      events: [
        {
          type: 3,
          timestamp: Date.now(),
          data: {
            source: 0,
            texts: [{ id: 11, value: `Live update ${sequence} received` }],
            attributes: [],
            removes: [],
            adds: [],
          },
        },
      ],
    });
    console.log("PASS live incremental event uploaded");
  } else if (mode === "cleanup") {
    const chunks = await prisma.sessionReplayChunk.findMany({
      where: { sessionId: id, storageKey: { not: null } },
      select: { storageKey: true },
    });
    await deleteReplayChunks(chunks.map((c) => c.storageKey!));
    await prisma.sessionReplay.delete({ where: { id } });
    console.log("PASS player QA fixture removed");
  } else throw new Error("Use create, append <id>, or cleanup <id>");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
