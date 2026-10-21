// One-time copy of the old stock settings into the new Product/Variant columns.
// Before, trackStock and stockStatus were only kept inside the catalog JSON (sourceUrl).
// Run once, right after `npm run db:push` added the columns:
//   npm run stock:backfill            (dry run: prints what would change)
//   npm run stock:backfill -- --apply (writes)
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { readCatalogMeta } from "../src/lib/catalog-meta";
import { cleanStockStatus } from "../src/lib/stock";
import { getSetting, setSetting } from "../src/lib/settings";

const FLAG = "migrations.stockColumnsBackfilled";
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

function statusFrom(value: unknown, stock: number) {
  if (value === "instock" || value === "outofstock" || value === "onbackorder") return cleanStockStatus(value);
  return stock > 0 ? "instock" : "outofstock";
}

async function main() {
  if ((await getSetting<string | null>(FLAG, null)) && !force) {
    console.log(`Already done (${FLAG} is set). Pass --force to run again.`);
    return;
  }
  const products = await prisma.product.findMany({ include: { variants: true } });
  let productChanges = 0;
  let variantChanges = 0;
  for (const product of products) {
    const meta = readCatalogMeta(product.sourceUrl) || {};
    // The old form treated a missing trackStock as ON for products.
    // A variable parent never sells alone: Track OFF + Out of stock; its variations decide.
    const variable = meta.productType === "variable" || product.variants.length > 0;
    const trackStock = variable ? false : meta.trackStock !== false;
    const stockStatus = variable ? "outofstock" : statusFrom(meta.stockStatus, product.stock);
    if (product.trackStock !== trackStock || product.stockStatus !== stockStatus) {
      productChanges += 1;
      console.log(`${product.sku}: track ${trackStock ? "ON" : "OFF"}, ${stockStatus}, stock ${product.stock}`);
      if (apply) await prisma.product.update({ where: { id: product.id }, data: { trackStock, stockStatus } });
    }
    const variations: any[] = Array.isArray(meta.variations) ? meta.variations : [];
    for (const variant of product.variants) {
      const entry =
        variations.find(
          (item) => (item?.sku && item.sku === variant.sku) || (item?.name && item.name === variant.name),
        ) || {};
      // The old form's "Manage stock?" defaulted to OFF for variations.
      const variantTrack = Boolean(entry.trackStock);
      const attributes = (variant.attributes || {}) as Record<string, unknown>;
      const variantStatus = statusFrom(entry.stockStatus ?? attributes.stockStatus, variant.stock);
      if (variant.trackStock !== variantTrack || variant.stockStatus !== variantStatus) {
        variantChanges += 1;
        console.log(`  ${variant.sku}: track ${variantTrack ? "ON" : "OFF"}, ${variantStatus}, stock ${variant.stock}`);
        if (apply)
          await prisma.variant.update({
            where: { id: variant.id },
            data: { trackStock: variantTrack, stockStatus: variantStatus },
          });
      }
    }
  }
  console.log(
    `\n${apply ? "Updated" : "Would update"} ${productChanges} product(s) and ${variantChanges} variation(s).`,
  );
  if (apply) await setSetting(FLAG, new Date().toISOString());
  else console.log("Dry run. Re-run with --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
