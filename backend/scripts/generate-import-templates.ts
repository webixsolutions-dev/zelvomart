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

const table = (kind: "simple" | "variable") =>
  IMPORT_COLUMNS.filter((column) => column.scope === "both" || column.scope === kind)
    .map((column) => `| \`${column.key}\` | ${column.required ? "yes" : ""} | ${column.help.replace(/\|/g, "\\|")} |`)
    .join("\n");

fs.writeFileSync(
  path.join(outDir, "CSV-COLUMNS.md"),
  `# CSV column reference

Generated from \`backend/src/lib/product-import.ts\`. Do not edit by hand.

## simple-products-template.csv

| Column | Required | What goes in it |
|---|---|---|
${table("simple")}

## variable-products-template.csv

Same columns as the simple template plus the variation columns. One \`variable\` row
describes the product; one \`variation\` row per option combination follows it.

| Column | Required | What goes in it |
|---|---|---|
${table("variable")}
`,
);

console.log(`Templates written to ${outDir}`);
