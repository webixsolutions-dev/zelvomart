import { test } from "node:test";
import assert from "node:assert/strict";
import { bundleLineTotal } from "./pricing";
import { MAX_LINE_PIECES, cartItemSchema } from "./validators";

const line = (quantity: number, bundleSize: 1 | 2) =>
  cartItemSchema.safeParse({ productId: "p1", quantity, bundleSize });

test("a line holds at most 20 pieces: 20 single pieces or 10 bundles", () => {
  assert.equal(MAX_LINE_PIECES, 20);
  assert.equal(line(20, 1).success, true);
  assert.equal(line(21, 1).success, false);
  assert.equal(line(10, 2).success, true);
  assert.equal(line(11, 2).success, false);
  assert.equal(line(0, 1).success, false);
});

test("bundle quantity is whole bundles: 1, 2, 3 bundles are 2, 4, 6 pieces", () => {
  for (const [bundles, pieces] of [
    [1, 2],
    [2, 4],
    [3, 6],
  ]) {
    const priced = bundleLineTotal(950, bundles, 2, 5);
    assert.equal(priced.pieces, pieces);
    assert.equal(priced.total, Math.round(950 * pieces * 0.95));
  }
});

test("the storefront's line rounding matches the server (discount off the whole line, then rounded)", () => {
  // 999 × 2 × 0.95 = 1898.1 → 1898 on both sides.
  assert.equal(bundleLineTotal(999, 1, 2, 5).total, Math.round(999 * 2 * (1 - 5 / 100)));
  assert.equal(bundleLineTotal(1249, 3, 2, 5).total, Math.round(1249 * 6 * (1 - 5 / 100)));
});
