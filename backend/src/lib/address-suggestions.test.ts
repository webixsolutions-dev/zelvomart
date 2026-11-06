import test from "node:test";
import assert from "node:assert/strict";
import { addressSuggestions, pakistanAddressSuggestions } from "./address-suggestions";

test("address results stay in Pakistan and the chosen city; duplicates and other cities are dropped", () => {
  const p = (countrycode: string, city: string, name: string) => ({ properties: { countrycode, city, name } });
  assert.deepEqual(
    pakistanAddressSuggestions(
      [
        p("PK", "Lahore Cant", "Gulberg"),
        p("PK", "Lahore Cant", "Gulberg"),
        p("PK", "Karachi", "Gulberg"),
        p("IN", "Lahore", "Wrong country"),
      ],
      "Lahore",
    ),
    ["Gulberg"],
  );
});

test("contact-like queries are not sent to the map service, and a provider failure does not invent suggestions", async () => {
  const fetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("Unavailable", { status: 503 });
  };
  try {
    assert.deepEqual(await addressSuggestions("Lahore", "0300 1234567"), []);
    assert.deepEqual(await addressSuggestions("Lahore", "person@example.com"), []);
    assert.equal(calls, 0);
    assert.deepEqual(await addressSuggestions("Lahore", "Gulberg"), []);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = fetch;
  }
});
