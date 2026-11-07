import assert from "node:assert/strict";
import test from "node:test";
import { fillDeliveryAmounts, resolveStoreProductTabs } from "../lib/product-tabs";

const oldReturns = "<p><strong>Can I check the product before paying?</strong><br/>Riders in major cities can let you inspect the parcel. We also offer a 7-day replacement window.</p><p><strong>What if I receive a damaged product?</strong><br/>Share photos on WhatsApp within 7 days and we will arrange a replacement.</p>";
const legacyFaq = oldReturns + "<p><strong>When is shipping free?</strong><br/>Shipping is free on an order above Rs 8,000, and on any product whose free-shipping option is turned on.</p>";
const savedFaq = oldReturns + "<p><strong>When is shipping free?</strong><br/>Shipping is free on an order above {free_delivery_over}, and on any product whose free-shipping option is turned on. Otherwise delivery is {delivery_fee}.</p>";
const faq = (global: unknown, product?: unknown) =>
  resolveStoreProductTabs(global, product).find((tab) => tab.key === "generalFaq")?.html;

test("both saved default FAQs pick up the video requirement and current delivery amounts", () => {
  for (const content of [legacyFaq, savedFaq]) {
    const html = faq({ generalFaq: { content } });
    assert.ok(html);
    assert.match(html, /within 7 days of delivery/);
    assert.match(html, /a continuous video showing the full parcel opening/);
    assert.match(html, /href="\/refund_returns\/"/);
    assert.doesNotMatch(html, /Share photos|Riders in major cities/);
    assert.match(fillDeliveryAmounts(html, { freeOver: 7500, flatFee: 190 }), /Rs 7,500/);
  }
});

test("product-level defaults refresh while custom and hidden FAQs retain their settings", () => {
  const product = (content: string) => ({ productTabs: { generalFaq: { override: true, content } } });
  assert.match(faq(null, product(legacyFaq)) ?? "", /a continuous video/);
  const custom = "<p>This product has a custom FAQ.</p>";
  assert.equal(faq(null, product(custom)), custom);
  assert.equal(faq(null, product("")), undefined);
});
