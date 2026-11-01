import assert from "node:assert/strict";
import test from "node:test";
import { forget, memo } from "./memo";

test("memo: one load per TTL, shared while loading, failures not cached", async () => {
  let loads = 0;
  const load = async () => ++loads;
  assert.deepEqual(await Promise.all([memo("a", 1000, load), memo("a", 1000, load), memo("a", 1000, load)]), [1, 1, 1]);
  assert.equal(await memo("a", 1000, load), 1);
  assert.equal(loads, 1);
  await assert.rejects(memo("b", 1000, () => Promise.reject(new Error("db down"))));
  assert.equal(await memo("b", 1000, async () => "ok"), "ok");
  // Expired values load again.
  assert.equal(await memo("c", 1, load), 2);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(await memo("c", 1, load), 3);
});

test("forget: an admin save shows at once, and a load that started before the save is not kept", async () => {
  let value = "old";
  assert.equal(await memo("settings:all", 60_000, async () => value), "old");
  value = "new";
  forget("settings:");
  assert.equal(await memo("settings:all", 60_000, async () => value), "new");
  // Race: a slow load of the old value is still running when the save clears the cache.
  let release!: () => void;
  const slow = memo(
    "settings:race",
    60_000,
    () => new Promise<string>((resolve) => (release = () => resolve("stale"))),
  );
  forget("settings:");
  release();
  assert.equal(await slow, "stale"); // that caller gets what it asked for…
  assert.equal(await memo("settings:race", 60_000, async () => "fresh"), "fresh"); // …but it is not cached
});
