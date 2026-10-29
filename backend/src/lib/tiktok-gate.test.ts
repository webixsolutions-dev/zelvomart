import { test } from "node:test";
import assert from "node:assert/strict";
import { tiktokEventsOn } from "./tiktok";

test("TikTok jobs only when the Events API is switched on and a pixel ID is set", () => {
  assert.equal(tiktokEventsOn(true, "C123"), true);
  assert.equal(tiktokEventsOn("true", "C123"), true);
  assert.equal(tiktokEventsOn(false, "C123"), false);
  assert.equal(tiktokEventsOn("false", "C123"), false);
  assert.equal(tiktokEventsOn(undefined, "C123"), false, "never switched on");
  assert.equal(tiktokEventsOn(true, ""), false, "no pixel");
  assert.equal(tiktokEventsOn(true, "   "), false, "blank pixel");
  assert.equal(tiktokEventsOn(true, undefined), false);
});
