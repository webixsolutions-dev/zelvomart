// Writes the CSV templates and the column reference into /import-templates from the
// column definitions the import endpoint uses, so the files never drift from the code.
// Run: npm run templates --workspace backend   (or: npx tsx scripts/generate-import-templates.ts)
import fs from "node:fs";
import path from "node:path";
import { IMPORT_COLUMNS, templateCsv } from "../src/lib/product-import";

const outDir = path.resolve(__dirname, "../../import-templates");
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, "simple-products-template.csv"), templateCsv("simple"));
fs.writeFileSync(path.join(outDir, "variable-products-template.csv"), templateCsv("variable"));

const row = (column: (typeof IMPORT_COLUMNS)[number]) =>
  `| \`${column.key}\` | ${column.required ? "Yes" : "No"} | ${column.help.replace(/\|/g, "\\|")} |`;
const simple = IMPORT_COLUMNS.filter((column) => column.scope === "both")
  .map(row)
  .join("\n");
const variable = IMPORT_COLUMNS.filter((column) => column.scope === "variable")
  .map(row)
  .join("\n");

fs.writeFileSync(
  path.join(outDir, "CSV-COLUMNS.md"),
  `# CSV column reference

Generated from \`backend/src/lib/product-import.ts\`. Do not edit by hand.

The CSV carries only what is written for a NEW product. Everything else (stock, shipping,
badge, featured, delivery, tabs, redirects, video, images) is set by hand in the product
form after import. Blank cells are normal: blank means the default or empty, never an
error, except in the required columns.

## simple-products-template.csv

| Column | Required | What goes in it |
|---|---|---|
${simple}

## variable-products-template.csv

A variable product is a single row with \`type = variable\`. It has every column of the
simple template plus the option columns below. The import creates every combination of
the options as a variation, all at the row's \`regularPrice\` / \`salePrice\` and In stock,
with SKUs \`<sku>-V1\`, \`<sku>-V2\`...

Example: Color \`Black | White\` and Size \`M | L\` gives 4 variations (Black / M, Black / L,
White / M, White / L).

| Column | Required | What goes in it |
|---|---|---|
${variable}

## Defaults for everything not in the CSV

In stock (Track stock OFF), delivery charges apply (not free), buy-2 bundle on, no brand,
redirect fallback on, store-wide product tabs, indexable. Swatches on, circle, medium.
`,
);

console.log(`Templates written to ${outDir}`);
