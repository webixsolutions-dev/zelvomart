import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSettingsUpdate, validateCitySettings } from "../src/lib/settings-validation";
import { bundleLineTotal } from "../src/lib/pricing";
import { bundleLineTotal as browserBundle } from "../../frontend/lib/bundle-price";
test("settings reject malformed delivery, discounts and switches before any save", () => {
  for (const value of [0, -1, NaN, Infinity])
    assert.throws(() =>
      validateSettingsUpdate({ "store.delivery": { mode: "FREE_ABOVE", flatRate: value, freeAbove: 8000 } }),
    );
  assert.throws(() => validateSettingsUpdate({ "store.bundleDefaultDiscountPercent": 101 }));
  assert.throws(() => validateSettingsUpdate({ "tracking.metaPixelEnabled": "false" }));
  assert.throws(() => validateSettingsUpdate({ "tracking.sessionReplayRetentionDays": 1.5 }));
  assert.throws(() => validateSettingsUpdate({ "worker.heartbeat": { at: "fake" } }));
  assert.equal(
    validateSettingsUpdate({ "store.bundleDefaultDiscountPercent": 0 })["store.bundleDefaultDiscountPercent"],
    0,
  );
  assert.equal(validateSettingsUpdate({ "tracking.metaPixelEnabled": false })["tracking.metaPixelEnabled"], false);
});
test("cities validate the whole list, trim names and reject duplicate or fractional estimates", () => {
  assert.equal(validateCitySettings([{ name: " Lahore ", deliveryMinDays: 2, deliveryMaxDays: 4 }])[0].name, "Lahore");
  assert.throws(() => validateCitySettings([{ name: "Lahore", deliveryMinDays: 3, deliveryMaxDays: 2 }]));
  assert.throws(() => validateCitySettings([{ name: "Lahore", deliveryMinDays: 2, deliveryMaxDays: 2.5 }]));
  assert.throws(() =>
    validateCitySettings([
      { name: "Lahore", deliveryMinDays: 2, deliveryMaxDays: 4 },
      { name: " lahore ", deliveryMinDays: 2, deliveryMaxDays: 4 },
    ]),
  );
});
test("configured bundle percentages agree in browser and checkout, including zero", () => {
  for (const percent of [0, 5, 12.5, 100])
    assert.deepEqual(bundleLineTotal(1000, 2, 2, percent), browserBundle(1000, 2, 2, percent));
  assert.equal(bundleLineTotal(1000, 1, 2, 12.5).total, 1750);
  assert.equal(bundleLineTotal(1000, 1, 2, 0).total, 2000);
});
