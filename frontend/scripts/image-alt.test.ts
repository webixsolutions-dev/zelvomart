import assert from "node:assert/strict";
import test from "node:test";
import { generatedImageAlts, imageAlts, keptImageAlts } from "../lib/image-alt";

const imgs = ["https://r2.dev/1.webp", "https://r2.dev/2.webp", "https://r2.dev/3.webp", "https://r2.dev/4.webp"];

test("each image gets its own natural alt: title, variant, then view N", () => {
  const alts = generatedImageAlts("Pink Marble Insulated Tumbler 1200ml", imgs, [
    { name: "Blue", imageUrl: imgs[1] },
    { name: "Red / Large", images: [imgs[2]] },
  ]);
  assert.deepEqual(alts, [
    "Pink Marble Insulated Tumbler 1200ml",
    "Pink Marble Insulated Tumbler 1200ml in Blue",
    "Pink Marble Insulated Tumbler 1200ml in Red, Large",
    "Pink Marble Insulated Tumbler 1200ml – view 4",
  ]);
  assert.equal(new Set(alts).size, alts.length);
});

test("two images of one variant stay distinct", () => {
  const alts = generatedImageAlts("Lamp", imgs.slice(0, 3), [{ name: "Gold", images: [imgs[1], imgs[2]] }]);
  assert.deepEqual(alts, ["Lamp", "Lamp in Gold", "Lamp in Gold – view 3"]);
});

test("a saved alt overrides the generated one; the old main-image alt still works", () => {
  const alts = imageAlts("Lamp", imgs.slice(0, 3), { overrides: { [imgs[2]]: "  Lamp switched on at night " }, mainAlt: "Brass desk lamp" });
  assert.deepEqual(alts, ["Brass desk lamp", "Lamp – view 2", "Lamp switched on at night"]);
});

test("only saved alts for images still on the product are kept", () => {
  assert.deepEqual(keptImageAlts({ [imgs[1]]: "A", [imgs[3]]: " ", gone: "B" }, imgs), { [imgs[1]]: "A" });
});
