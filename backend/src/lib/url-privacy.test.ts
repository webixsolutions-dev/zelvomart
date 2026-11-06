import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { privateSafeUrl, sanitizeReplayEvent } from "./url-privacy";
import { prepareReplayChunk } from "./replay-storage";

test("telemetry strips payment tokens and customer query values while preserving attribution", () => {
  const url = privateSafeUrl("https://www.zelvomart.com/pay/ZM-1/?t=PRIVATE&key=CONFIRM&utm_source=facebook#receipt");
  assert.equal(url, "https://www.zelvomart.com/pay/ZM-1/?utm_source=facebook");
  assert.equal(privateSafeUrl(""), "");
  assert.equal(privateSafeUrl("javascript:alert(1)"), "");
});

test("stored full snapshots and attribute mutations contain no private links or WhatsApp message text", () => {
  const events = [
    {
      type: 2,
      data: {
        node: { childNodes: [{ attributes: { href: "/pay/ZM-1/?t=PRIVATE&key=CONFIRM", "data-token": "SECRET" } }] },
      },
    },
    {
      type: 3,
      data: {
        attributes: [
          {
            id: 17,
            attributes: {
              href: "https://wa.me/923001234567?text=PRIVATE_NAME",
              src: "https://private.example/proof?X-Amz-Signature=SIGNED",
            },
          },
        ],
      },
    },
  ];
  const stored = gunzipSync(prepareReplayChunk(events)).toString();
  for (const secret of ["PRIVATE", "CONFIRM", "SECRET", "PRIVATE_NAME", "SIGNED"])
    assert.equal(stored.includes(secret), false, secret);
  assert.deepEqual(JSON.parse(stored), sanitizeReplayEvent(events));
  assert.equal(
    events[0].data.node?.childNodes[0].attributes["data-token"],
    "SECRET",
    "original recorder data is not mutated",
  );
});
