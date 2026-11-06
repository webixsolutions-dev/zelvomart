import test from "node:test";
import assert from "node:assert/strict";
import {
  addressSearchText,
  applyAddressSuggestion,
  citySuggestions,
} from "../storefront/lib/checkout-address";
import locations from "../storefront/data/pakistan-cities.json";

test("all 873 supplied locations are available; city and PostEx code search are case-insensitive", () => {
  assert.equal(locations.length, 873);
  assert.equal(new Set(locations.map((c) => c.name.toLowerCase())).size, 873);
  assert.ok(citySuggestions("lah").includes("Lahore"));
  assert.ok(citySuggestions("KHI").includes("Karachi"));
  assert.deepEqual(citySuggestions("My own delivery town"), []);
});

test("area selection preserves house and street text; manual addresses need no suggestion", () => {
  assert.equal(addressSearchText("House 15, Gulb"), "Gulb");
  assert.equal(addressSearchText("House 15 Gulb"), "Gulb");
  assert.equal(
    applyAddressSuggestion("House 15, Street 4, Gulb", "Gulberg"),
    "House 15, Street 4, Gulberg",
  );
  assert.equal(
    applyAddressSuggestion("Flat 4B Gulb", "Gulberg"),
    "Flat 4B, Gulberg",
  );
});
