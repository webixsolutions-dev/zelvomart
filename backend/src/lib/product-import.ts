// CSV product import: column definitions, templates and row -> product planning.
// Pure functions only (no database access) so the same definitions drive the
// downloadable templates, the import endpoint and the generator script.

export type ImportColumn = {
  key: string;
  scope: "simple" | "variable" | "both";
  required?: boolean;
  help: string;
};

export const PRODUCT_TAG_IDS = ["customer-favourite", "best-selling", "new-arrival", "15-off", "20-off", "30-off"];
export const STOCK_STATUSES = ["instock", "outofstock", "onbackorder"];
export const MAX_PRODUCT_IMAGES = 13;
export const MAX_VARIATION_IMAGES = 8;

export const IMPORT_COLUMNS: ImportColumn[] = [
  { key: "type", scope: "both", required: true, help: "simple | variable | variation. A variation row belongs to the variable product named in parentSku." },
  { key: "parentSku", scope: "variable", help: "Variation rows only: the SKU of the variable product this variation belongs to." },
  { key: "title", scope: "both", required: true, help: "Product name. Leave blank on variation rows." },
  { key: "slug", scope: "both", help: "URL slug. Blank = generated from the title." },
  { key: "sku", scope: "both", required: true, help: "Unique SKU. An existing SKU updates that product; a new SKU creates one. Variation rows: blank = PARENTSKU-V1, -V2..." },
  { key: "category", scope: "both", help: "Category name or slug. Created automatically when it does not exist." },
  { key: "categorySlug", scope: "both", help: "Category slug. Blank = generated from the category name." },
  { key: "categoryDescription", scope: "both", help: "Category description." },
  { key: "categoryImageUrl", scope: "both", help: "Category image URL." },
  { key: "categorySortOrder", scope: "both", help: "Category sort order (number, lower shows first)." },
  { key: "categorySeoTitle", scope: "both", help: "Category SEO title." },
  { key: "categorySeoDescription", scope: "both", help: "Category SEO description." },
  { key: "brand", scope: "both", help: "Brand name." },
  { key: "regularPrice", scope: "both", required: true, help: "Regular price in Rs, digits only. Variable parents: leave blank, each variation row carries its own price." },
  { key: "salePrice", scope: "both", help: "Sale price in Rs. Must be lower than regularPrice." },
  { key: "costPrice", scope: "both", help: "Your cost price in Rs (never shown to customers)." },
  { key: "saleFrom", scope: "both", help: "Sale start date, YYYY-MM-DD." },
  { key: "saleTo", scope: "both", help: "Sale end date, YYYY-MM-DD." },
  { key: "trackStock", scope: "both", help: "yes | no. Default yes." },
  { key: "stock", scope: "both", help: "Stock quantity. Variable parents: leave blank, the variation quantities are added up." },
  { key: "stockStatus", scope: "both", help: "instock | outofstock | onbackorder. Blank = instock when stock is above 0." },
  { key: "weight", scope: "both", help: "Weight (lbs)." },
  { key: "length", scope: "both", help: "Length (in)." },
  { key: "width", scope: "both", help: "Width (in)." },
  { key: "height", scope: "both", help: "Height (in)." },
  { key: "shippingClass", scope: "both", help: "Blank or shipping-charges." },
  { key: "freeShipping", scope: "both", help: "yes | no. Default no." },
  { key: "shortDescription", scope: "both", help: "Short description shown beside the price. Plain text or HTML." },
  { key: "descriptionHtml", scope: "both", help: "Full description in HTML (<p>, <h2>, <ul><li>...)." },
  { key: "imageUrls", scope: "both", help: "Image URLs separated by |. First one is the main image. Leave blank when you upload images with the image ZIP." },
  { key: "imageAlt", scope: "both", help: "Alt text for the product image. Blank = product title." },
  { key: "imageTitle", scope: "both", help: "Image title." },
  { key: "videoUrl", scope: "both", help: "Product video URL." },
  { key: "tags", scope: "both", help: `Tags separated by |. Allowed: ${PRODUCT_TAG_IDS.join(" | ")}.` },
  { key: "badge", scope: "both", help: "Custom badge text shown on the product image." },
  { key: "featured", scope: "both", help: "yes | no. Featured on the homepage." },
  { key: "bundleEnabled", scope: "both", help: "yes | no. Buy-two discount. Default yes." },
  { key: "deliveryDays", scope: "both", help: "Delivery days shown on the product page. Default 3." },
  { key: "deliveryNote", scope: "both", help: "Delivery note. Default: Delivered across Pakistan." },
  { key: "purchaseNote", scope: "both", help: "Purchase note." },
  { key: "menuOrder", scope: "both", help: "Menu order (number)." },
  { key: "focusKeyword", scope: "both", help: "SEO focus keyword." },
  { key: "seoTitle", scope: "both", help: "SEO title." },
  { key: "seoDescription", scope: "both", help: "SEO meta description." },
  { key: "canonicalUrl", scope: "both", help: "Canonical URL." },
  { key: "redirectFallback", scope: "both", help: "yes | no. Send visitors to /shop while the product is not posted. Default yes." },
  { key: "redirectUrl", scope: "both", help: "Custom redirect URL for this product page." },
  { key: "tabWhyChoose", scope: "both", help: "HTML that replaces the global 'Why Choose Zelvomart' tab for this product. Blank = global tab." },
  { key: "tabShippingProcess", scope: "both", help: "HTML that replaces the global 'Shipping Process' tab. Blank = global tab." },
  { key: "tabGeneralFaq", scope: "both", help: "HTML that replaces the global 'General FAQ' tab. Blank = global tab." },
  { key: "attribute1Name", scope: "variable", help: "First option name, e.g. Color. Set it on the variable row." },
  { key: "attribute1Values", scope: "variable", help: "Variable row: every value separated by | (Black | White). Variation row: the one value of that variation (Black)." },
  { key: "attribute2Name", scope: "variable", help: "Second option name, e.g. Size. Optional." },
  { key: "attribute2Values", scope: "variable", help: "Same rule as attribute1Values." },
  { key: "attribute3Name", scope: "variable", help: "Third option name. Optional." },
  { key: "attribute3Values", scope: "variable", help: "Same rule as attribute1Values." },
  { key: "gtin", scope: "variable", help: "Variation rows: GTIN / barcode." },
  { key: "variationEnabled", scope: "variable", help: "Variation rows: yes | no. Default yes." },
  { key: "swatchesEnabled", scope: "variable", help: "Variable row: yes | no. Default yes." },
  { key: "swatchShape", scope: "variable", help: "Variable row: circle | square. Default circle." },
  { key: "swatchSize", scope: "variable", help: "Variable row: small | medium | large. Default medium." },
];

// Old header names (previous template, WooCommerce-style) -> current column.
const HEADER_ALIASES: Record<string, string> = {
  name: "title",
  producttitle: "title",
  productname: "title",
  price: "regularPrice",
  categoryname: "category",
  images: "imageUrls",
  image: "imageUrls",
  description: "descriptionHtml",
  parent: "parentSku",
  producttype: "type",
  quantity: "stock",
  enabled: "variationEnabled",
};

function headerKey(header: string) {
  return String(header || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const COLUMN_BY_HEADER = new Map<string, string>([
  ...IMPORT_COLUMNS.map((column) => [headerKey(column.key), column.key] as [string, string]),
  ...Object.entries(HEADER_ALIASES),
]);

const REQUIRED_HEADERS = ["type", "title", "sku", "regularPrice"];

/** Checks the header row against the template. Any message here rejects the whole file. */
export function validateHeaders(headers: string[]): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  const unknown: string[] = [];
  let blank = 0;
  for (const raw of headers) {
    const header = String(raw ?? "").trim();
    if (!header) {
      blank += 1;
      continue;
    }
    const column = COLUMN_BY_HEADER.get(headerKey(header));
    if (!column) unknown.push(header);
    else if (seen.has(column)) errors.push(`Column "${header}" is repeated (it is the same column as "${seen.get(column)}"). Keep it once.`);
    else seen.set(column, header);
  }
  if (unknown.length) {
    errors.push(`Unknown column${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. Use the template header row unchanged; do not add or rename columns.`);
  }
  if (blank) errors.push(`${blank} column${blank === 1 ? " has" : "s have"} no name in the header row. Every column needs its template name.`);
  const missing = REQUIRED_HEADERS.filter((column) => !seen.has(column));
  if (missing.length) errors.push(`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Start again from the template.`);
  return errors;
}

const BOOL_COLUMNS = ["trackStock", "freeShipping", "featured", "bundleEnabled", "redirectFallback", "variationEnabled", "swatchesEnabled"];
const BOOL_VALUES = ["1", "0", "true", "false", "yes", "no", "y", "n", "on", "off"];
const NUMBER_COLUMNS = ["costPrice", "weight", "length", "width", "height", "categorySortOrder", "menuOrder"];
const URL_COLUMNS = ["videoUrl", "canonicalUrl", "categoryImageUrl", "redirectUrl"];
const ENUM_COLUMNS: Record<string, string[]> = {
  swatchShape: ["circle", "square"],
  swatchSize: ["small", "medium", "large"],
  shippingClass: ["shipping-charges"],
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validUrl(value: string, allowPath: boolean) {
  return /^https?:\/\/\S+$/i.test(value) || (allowPath && /^\/[^/\s]\S*$/.test(value));
}

// Format checks shared by product rows and variation rows.
function valueErrors(cells: Record<string, string>, label: string, errors: string[]) {
  if (cells.type && !/^(simple|variable|variation)$/i.test(cells.type)) errors.push(`${label}type "${cells.type}" is not allowed. Use simple, variable or variation.`);
  for (const column of BOOL_COLUMNS) {
    if (cells[column] && !BOOL_VALUES.includes(cells[column].toLowerCase())) errors.push(`${label}${column} "${cells[column]}" must be yes or no.`);
  }
  for (const column of NUMBER_COLUMNS) {
    const value = parseNumber(cells[column]);
    if (cells[column] && (value == null || value < 0)) errors.push(`${label}${column} "${cells[column]}" is not a number.`);
  }
  if (cells.stock) {
    const stock = parseNumber(cells.stock);
    if (stock == null || stock < 0 || !Number.isInteger(stock)) errors.push(`${label}stock "${cells.stock}" must be a whole number, 0 or more.`);
  }
  if (cells.stockStatus && !normalizeStockStatus(cells.stockStatus)) errors.push(`${label}stockStatus "${cells.stockStatus}" must be ${STOCK_STATUSES.join(", ")}.`);
  for (const column of ["saleFrom", "saleTo"]) {
    if (cells[column] && !validDate(cells[column])) errors.push(`${label}${column} "${cells[column]}" must be a date written as YYYY-MM-DD.`);
  }
  if (cells.saleFrom && cells.saleTo && validDate(cells.saleFrom) && validDate(cells.saleTo) && cells.saleTo < cells.saleFrom) errors.push(`${label}saleTo is before saleFrom.`);
  for (const [column, allowed] of Object.entries(ENUM_COLUMNS)) {
    if (cells[column] && !allowed.includes(cells[column].toLowerCase())) errors.push(`${label}${column} "${cells[column]}" is not allowed. Use ${allowed.join(" or ")}${column === "shippingClass" ? " or leave it empty" : ""}.`);
  }
  for (const column of URL_COLUMNS) {
    if (cells[column] && !validUrl(cells[column], column === "redirectUrl")) errors.push(`${label}${column} "${cells[column]}" is not a valid URL (it must start with https://).`);
  }
  const badImages = parseList(cells.imageUrls).filter((url) => !validUrl(url, true));
  if (badImages.length) errors.push(`${label}imageUrls has ${badImages.length === 1 ? "a value that is not a URL" : "values that are not URLs"}: ${badImages.slice(0, 3).join(", ")}. Leave imageUrls empty and upload the images with the ZIP.`);
}

export function templateColumns(kind: "simple" | "variable") {
  return IMPORT_COLUMNS.filter((column) => column.scope === "both" || column.scope === kind).map((column) => column.key);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const SIMPLE_EXAMPLES: Record<string, string>[] = [
  {
    type: "simple",
    title: "EXAMPLE Matte Lipstick Rose Red",
    sku: "ZVM-EXAMPLE-LIP-001",
    category: "Beauty & Personal Care",
    categorySlug: "beauty-personal-care",
    categoryDescription: "Makeup, skincare and personal care essentials.",
    categorySortOrder: "3",
    categorySeoTitle: "Beauty & Personal Care | Zelvomart",
    categorySeoDescription: "Shop makeup, skincare and personal care with cash on delivery across Pakistan.",
    brand: "Zelvomart",
    regularPrice: "900",
    salePrice: "700",
    costPrice: "350",
    trackStock: "yes",
    stock: "25",
    stockStatus: "instock",
    weight: "0.2",
    freeShipping: "no",
    shortDescription: "Long-lasting matte lipstick with a smooth, non-drying finish.",
    descriptionHtml: "<p>A richly pigmented matte lipstick that glides on smoothly and stays put for hours.</p><h2>Why you will love it</h2><ul><li>Long-lasting colour</li><li>Non-drying formula</li></ul>",
    imageAlt: "Matte Lipstick Rose Red",
    tags: "best-selling|new-arrival",
    featured: "no",
    bundleEnabled: "yes",
    deliveryDays: "3",
    deliveryNote: "Delivered across Pakistan",
    focusKeyword: "matte lipstick",
    seoTitle: "Matte Lipstick Rose Red | Zelvomart",
    seoDescription: "Buy long-lasting matte lipstick in Rose Red online in Pakistan with cash on delivery.",
    redirectFallback: "yes",
  },
];

const VARIABLE_EXAMPLES: Record<string, string>[] = [
  {
    type: "variable",
    title: "EXAMPLE Cotton T-Shirt",
    sku: "ZVM-EXAMPLE-TEE-001",
    category: "Fashion & Accessories",
    categorySlug: "fashion-accessories",
    categoryDescription: "Clothing, bags and everyday accessories.",
    categorySortOrder: "5",
    brand: "Zelvomart",
    trackStock: "yes",
    weight: "0.4",
    shortDescription: "Soft everyday cotton tee in two colours.",
    descriptionHtml: "<p>A breathable 100% cotton t-shirt made for daily wear.</p><ul><li>Pre-shrunk fabric</li><li>Regular fit</li></ul>",
    tags: "new-arrival",
    bundleEnabled: "yes",
    deliveryDays: "3",
    deliveryNote: "Delivered across Pakistan",
    focusKeyword: "cotton t-shirt",
    seoTitle: "Cotton T-Shirt | Zelvomart",
    seoDescription: "Shop a soft cotton t-shirt online in Pakistan with cash on delivery.",
    attribute1Name: "Color",
    attribute1Values: "Black | White",
    attribute2Name: "Size",
    attribute2Values: "M | L",
    swatchesEnabled: "yes",
    swatchShape: "circle",
    swatchSize: "medium",
  },
  { type: "variation", parentSku: "ZVM-EXAMPLE-TEE-001", sku: "ZVM-EXAMPLE-TEE-001-BLK-M", regularPrice: "1500", salePrice: "1200", stock: "10", stockStatus: "instock", attribute1Values: "Black", attribute2Values: "M", variationEnabled: "yes" },
  { type: "variation", parentSku: "ZVM-EXAMPLE-TEE-001", sku: "ZVM-EXAMPLE-TEE-001-BLK-L", regularPrice: "1500", salePrice: "1200", stock: "8", stockStatus: "instock", attribute1Values: "Black", attribute2Values: "L", variationEnabled: "yes" },
  { type: "variation", parentSku: "ZVM-EXAMPLE-TEE-001", sku: "ZVM-EXAMPLE-TEE-001-WHT-M", regularPrice: "1500", stock: "6", stockStatus: "instock", attribute1Values: "White", attribute2Values: "M", variationEnabled: "yes" },
  { type: "variation", parentSku: "ZVM-EXAMPLE-TEE-001", sku: "ZVM-EXAMPLE-TEE-001-WHT-L", regularPrice: "1600", stock: "0", stockStatus: "outofstock", attribute1Values: "White", attribute2Values: "L", variationEnabled: "yes" },
];

export function templateCsv(kind: "simple" | "variable", withExamples = true) {
  const columns = templateColumns(kind);
  const examples = withExamples ? (kind === "simple" ? SIMPLE_EXAMPLES : VARIABLE_EXAMPLES) : [];
  const lines = [columns.join(","), ...examples.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(","))];
  return `${lines.join("\r\n")}\r\n`;
}

export type PlannedVariation = {
  row: number;
  key: string;
  name: string;
  sku: string;
  gtin: string;
  attributes: Record<string, string>;
  regularPrice: number;
  salePrice: number | null;
  saleFrom: string;
  saleTo: string;
  trackStock: boolean;
  quantity: number;
  stockStatus: string;
  stock: number;
  weight: string;
  length: string;
  width: string;
  height: string;
  shippingClass: string;
  images: string[];
  enabled: boolean;
};

export type PlannedProduct = {
  row: number;
  sku: string;
  title: string;
  productType: "simple" | "variable";
  // Normalised cells of the product row. Only non-empty cells are present.
  cells: Record<string, string>;
  // `declared`: the variable row listed the values, so variation rows may only use those.
  attributes: { name: string; values: string[]; declared?: boolean }[];
  variations: PlannedVariation[];
  errors: string[];
  warnings: string[];
};

export function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseBool(value: unknown, fallback: boolean) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(text)) return true;
  if (["0", "false", "no", "n", "off"].includes(text)) return false;
  return fallback;
}

export function parseNumber(value: unknown): number | null {
  const text = String(value ?? "").replace(/rs\.?|pkr|,|\s/gi, "");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function parseList(value: unknown) {
  return String(value ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeStockStatus(value: unknown) {
  const key = String(value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (key === "instock") return "instock";
  if (key === "outofstock") return "outofstock";
  if (key === "onbackorder" || key === "backorder") return "onbackorder";
  return "";
}

// Same rule the product form uses to turn status + quantity into a stock count.
export function stockFrom(status: string, quantity: number, trackStock = true) {
  if (status === "outofstock") return 0;
  if (!trackStock && status === "instock") return Math.max(1, quantity || 1);
  if (quantity <= 0) return 0;
  return quantity;
}

export function variationKey(attributes: Record<string, string>) {
  return Object.entries(attributes)
    .map(([name, value]) => `${name}:${value}`)
    .join("|");
}

function normalizeRow(raw: Record<string, unknown>) {
  const cells: Record<string, string> = {};
  for (const [header, value] of Object.entries(raw || {})) {
    const column = COLUMN_BY_HEADER.get(headerKey(header));
    if (!column) continue;
    const text = String(value ?? "").trim();
    if (text && !cells[column]) cells[column] = text;
  }
  return cells;
}

function rowType(cells: Record<string, string>) {
  const type = (cells.type || "").toLowerCase();
  if (type.startsWith("variation")) return "variation";
  if (type.startsWith("variable")) return "variable";
  if (type) return "simple";
  return cells.parentSku ? "variation" : "simple";
}

function stockFields(cells: Record<string, string>, trackDefault: boolean) {
  const trackStock = parseBool(cells.trackStock, trackDefault);
  const rawQuantity = parseNumber(cells.stock);
  let stockStatus = normalizeStockStatus(cells.stockStatus);
  let quantity = Math.max(0, Math.floor(rawQuantity ?? (stockStatus === "outofstock" ? 0 : 1)));
  if (!stockStatus) stockStatus = quantity > 0 ? "instock" : "outofstock";
  if (stockStatus === "outofstock") quantity = 0;
  return { trackStock, quantity, stockStatus, stock: stockFrom(stockStatus, quantity, trackStock) };
}

function priceErrors(label: string, cells: Record<string, string>, errors: string[]) {
  const regular = parseNumber(cells.regularPrice);
  const sale = parseNumber(cells.salePrice);
  if (cells.regularPrice && (regular == null || regular < 0)) errors.push(`${label}regularPrice "${cells.regularPrice}" is not a number.`);
  if (cells.salePrice && (sale == null || sale < 0)) errors.push(`${label}salePrice "${cells.salePrice}" is not a number.`);
  if (regular != null && sale != null && sale >= regular) errors.push(`${label}salePrice must be lower than regularPrice.`);
}

/**
 * Turns raw CSV rows into products. `firstRow` is the spreadsheet row number of rows[0]
 * so messages point at the line the user sees. Rows may carry a `__row` number instead.
 */
export function planImport(rows: Record<string, unknown>[], firstRow = 2): PlannedProduct[] {
  const products: PlannedProduct[] = [];
  const bySku = new Map<string, PlannedProduct>();
  const orphans: { row: number; cells: Record<string, string> }[] = [];
  let last: PlannedProduct | null = null;

  rows.forEach((raw, index) => {
    const row = Number((raw as any)?.__row) || firstRow + index;
    const cells = normalizeRow(raw);
    if (!Object.keys(cells).length) return;
    const type = rowType(cells);

    if (type === "variation") {
      const parent: PlannedProduct | null = cells.parentSku ? bySku.get(cells.parentSku.toLowerCase()) || null : last;
      if (!parent) {
        orphans.push({ row, cells });
        return;
      }
      addVariation(parent, row, cells);
      return;
    }

    const product: PlannedProduct = {
      row,
      sku: cells.sku || "",
      title: cells.title || "",
      productType: type === "variable" ? "variable" : "simple",
      cells,
      attributes: [],
      variations: [],
      errors: [],
      warnings: [],
    };
    if (!product.title) product.errors.push("title is required.");
    if (!product.sku) product.errors.push("sku is required.");
    else if (bySku.has(product.sku.toLowerCase())) product.errors.push(`sku "${product.sku}" appears more than once in this file.`);
    else bySku.set(product.sku.toLowerCase(), product);
    valueErrors(cells, "", product.errors);
    priceErrors("", cells, product.errors);
    if (cells.parentSku) product.errors.push("parentSku is only for variation rows. Empty it, or set type to variation.");
    if (type !== "variable") {
      const stray = ["attribute1Name", "attribute1Values", "attribute2Name", "attribute2Values", "attribute3Name", "attribute3Values"].filter((column) => cells[column]);
      if (stray.length) product.errors.push(`${stray.join(", ")} ${stray.length === 1 ? "is" : "are"} only for variable products. Set type to variable or empty ${stray.length === 1 ? "it" : "them"}.`);
    }
    const unknownTags = parseList(cells.tags).filter((tag) => !PRODUCT_TAG_IDS.includes(slugify(tag)));
    if (unknownTags.length) product.warnings.push(`Unknown tags ignored: ${unknownTags.join(", ")}.`);
    if (product.productType === "variable") {
      for (const n of [1, 2, 3]) {
        const name = cells[`attribute${n}Name`];
        const values = parseList(cells[`attribute${n}Values`]);
        if (name) product.attributes.push({ name, values, declared: values.length > 0 });
        else if (values.length) product.errors.push(`attribute${n}Values is filled but attribute${n}Name is empty.`);
        else continue;
        if (name && n > 1 && !cells[`attribute${n - 1}Name`]) product.errors.push(`attribute${n}Name is filled but attribute${n - 1}Name is empty. Fill the attributes in order.`);
      }
      if (new Set(product.attributes.map((attribute) => attribute.name.toLowerCase())).size !== product.attributes.length) product.errors.push("Two attributes have the same name.");
    }
    products.push(product);
    last = product;
  });

  for (const orphan of orphans) {
    const parent = orphan.cells.parentSku ? bySku.get(orphan.cells.parentSku.toLowerCase()) : null;
    if (parent) {
      addVariation(parent, orphan.row, orphan.cells);
      continue;
    }
    products.push({
      row: orphan.row,
      sku: orphan.cells.sku || "",
      title: `Variation of ${orphan.cells.parentSku || "?"}`,
      productType: "variable",
      cells: orphan.cells,
      attributes: [],
      variations: [],
      errors: [`Variation row: no variable product with sku "${orphan.cells.parentSku || ""}" in this file. Put the variable row in the same file.`],
      warnings: [],
    });
  }

  for (const product of products) {
    if (product.productType === "simple") {
      if (!product.errors.length && !product.cells.regularPrice) product.warnings.push("No regularPrice: it can be saved as a draft but not posted.");
      continue;
    }
    if (!product.attributes.length && product.variations.length) product.errors.push("attribute1Name is required on the variable row (for example Color).");
    if (!product.variations.length && product.cells.title) product.errors.push("A variable product needs at least one variation row (type = variation, parentSku = this sku).");
    const seenKeys = new Set<string>();
    const seenSkus = new Set<string>();
    product.variations.forEach((variation, index) => {
      if (!variation.sku) variation.sku = `${product.sku}-V${index + 1}`;
      const label = `Row ${variation.row}: `;
      if (seenSkus.has(variation.sku.toLowerCase())) product.errors.push(`${label}variation sku "${variation.sku}" is repeated.`);
      seenSkus.add(variation.sku.toLowerCase());
      if (seenKeys.has(variation.key)) product.errors.push(`${label}the combination "${variation.name}" is repeated.`);
      seenKeys.add(variation.key);
      for (const attribute of product.attributes) {
        const value = variation.attributes[attribute.name];
        if (!value) product.errors.push(`${label}missing a value for "${attribute.name}".`);
        else if (!attribute.values.some((item) => item.toLowerCase() === value.toLowerCase())) {
          if (attribute.declared) product.errors.push(`${label}"${value}" is not one of the ${attribute.name} values listed on the variable row (${attribute.values.join(" | ")}).`);
          else attribute.values.push(value);
        }
      }
      if (variation.regularPrice <= 0) product.warnings.push(`${label}variation "${variation.name}" has no regularPrice and will not be sold.`);
    });
  }

  return products;
}

function addVariation(parent: PlannedProduct, row: number, cells: Record<string, string>) {
  const label = `Row ${row}: `;
  if (parent.productType !== "variable") {
    parent.errors.push(`${label}variation rows need a parent with type = variable.`);
    return;
  }
  const attributes: Record<string, string> = {};
  [1, 2, 3].forEach((n, index) => {
    const name = parent.attributes[index]?.name;
    const value = parseList(cells[`attribute${n}Values`])[0];
    if (name && value) {
      const known = parent.attributes[index].values.find((item) => item.toLowerCase() === value.toLowerCase());
      attributes[name] = known || value;
    }
  });
  valueErrors(cells, label, parent.errors);
  priceErrors(label, cells, parent.errors);
  [1, 2, 3].forEach((n, index) => {
    const values = parseList(cells[`attribute${n}Values`]);
    if (values.length > 1) parent.errors.push(`${label}a variation row takes one value in attribute${n}Values, not a list (${cells[`attribute${n}Values`]}).`);
    if (values.length && !parent.attributes[index]) parent.errors.push(`${label}attribute${n}Values is filled but the variable row has no attribute${n}Name.`);
  });
  const stock = stockFields(cells, true);
  parent.variations.push({
    row,
    key: variationKey(attributes),
    name: Object.values(attributes).join(" / "),
    sku: cells.sku || "",
    gtin: cells.gtin || "",
    attributes,
    regularPrice: parseNumber(cells.regularPrice) ?? 0,
    salePrice: parseNumber(cells.salePrice),
    saleFrom: cells.saleFrom || "",
    saleTo: cells.saleTo || "",
    ...stock,
    weight: cells.weight || "",
    length: cells.length || "",
    width: cells.width || "",
    height: cells.height || "",
    shippingClass: cells.shippingClass || "",
    images: parseList(cells.imageUrls).slice(0, MAX_VARIATION_IMAGES),
    enabled: parseBool(cells.variationEnabled, true),
  });
}

export type ProductWrite = {
  columns: Record<string, unknown>;
  meta: Record<string, unknown>;
  variants: { name: string; sku: string; stock: number; priceOverride: number | null; imageUrl: string | null; attributes: Record<string, string> }[] | null;
  category: { name: string; slug: string; fields: Record<string, unknown> } | null;
  slug: string;
  explicitSlug: boolean;
};

/**
 * Builds the database write for one planned product. `existingMeta` is the catalog
 * meta of the product being updated (null when creating); only cells that are filled
 * in the CSV overwrite existing values.
 */
export function buildProductWrite(product: PlannedProduct, existingMeta: Record<string, any> | null): ProductWrite {
  const cells = product.cells;
  const creating = !existingMeta;
  const has = (key: string) => Boolean(cells[key]);
  const columns: Record<string, unknown> = { title: product.title };
  const meta: Record<string, unknown> = { ...(existingMeta || {}) };
  const setMeta = (key: string, value: unknown, fallback?: unknown) => {
    if (value !== undefined) meta[key] = value;
    else if (creating && fallback !== undefined) meta[key] = fallback;
  };
  const text = (key: string) => (has(key) ? cells[key] : undefined);

  if (has("shortDescription")) columns.shortDescription = cells.shortDescription;
  if (has("descriptionHtml")) columns.descriptionHtml = cells.descriptionHtml;
  if (has("videoUrl")) columns.videoUrl = cells.videoUrl;
  if (has("seoTitle")) columns.seoTitle = cells.seoTitle;
  if (has("seoDescription")) columns.seoDescription = cells.seoDescription;
  if (has("canonicalUrl")) columns.canonicalUrl = cells.canonicalUrl;
  if (has("costPrice")) columns.costPrice = parseNumber(cells.costPrice);
  if (has("imageUrls")) columns.images = parseList(cells.imageUrls).slice(0, MAX_PRODUCT_IMAGES);
  else if (creating) columns.images = [];

  const tags = has("tags") ? parseList(cells.tags).map(slugify).filter((tag) => PRODUCT_TAG_IDS.includes(tag)) : undefined;
  setMeta("tags", tags, []);
  const finalTags = (meta.tags as string[]) || [];
  if (has("featured") || has("tags") || creating) columns.featured = parseBool(cells.featured, false) || finalTags.includes("best-selling");
  if (has("bundleEnabled") || creating) {
    columns.bundleEnabled = parseBool(cells.bundleEnabled, true);
    meta.bundleEnabled = columns.bundleEnabled;
  }
  if (creating) {
    columns.bundleDiscountPercent = 5;
    meta.bundleDiscountPercent = 5;
  }

  meta.productType = product.productType;
  setMeta("brand", text("brand"), "");
  setMeta("badge", text("badge"), "");
  setMeta("weight", text("weight"), "0");
  setMeta("length", text("length"), "");
  setMeta("width", text("width"), "");
  setMeta("height", text("height"), "");
  setMeta("shippingClass", text("shippingClass"), "");
  setMeta("saleFrom", text("saleFrom"), "");
  setMeta("saleTo", text("saleTo"), "");
  setMeta("purchaseNote", text("purchaseNote"), "");
  setMeta("menuOrder", text("menuOrder"), "0");
  setMeta("deliveryDays", text("deliveryDays"), "3");
  setMeta("deliveryNote", text("deliveryNote"), "Delivered across Pakistan");
  setMeta("focusKeyword", text("focusKeyword"), "");
  setMeta("redirectUrl", text("redirectUrl"), "");
  setMeta("freeShipping", has("freeShipping") ? parseBool(cells.freeShipping, false) : undefined, false);
  setMeta("redirectFallback", has("redirectFallback") ? parseBool(cells.redirectFallback, true) : undefined, true);
  if (creating) meta.customTabs = [];

  if (has("imageAlt") || has("imageTitle") || creating) {
    const current = (meta.imageMeta as Record<string, unknown>) || { alt: "", title: "", caption: "", description: "", excludeFromSitemap: false, fileName: "", fileSize: 0, width: 0, height: 0 };
    meta.imageMeta = { ...current, ...(has("imageAlt") ? { alt: cells.imageAlt } : creating ? { alt: product.title } : {}), ...(has("imageTitle") ? { title: cells.imageTitle } : {}) };
  }

  const tabCells: [string, string][] = [["whyChoose", "tabWhyChoose"], ["shippingProcess", "tabShippingProcess"], ["generalFaq", "tabGeneralFaq"]];
  if (tabCells.some(([, cell]) => has(cell))) {
    const tabs: Record<string, unknown> = { ...((meta.productTabs as Record<string, unknown>) || {}) };
    for (const [key, cell] of tabCells) if (has(cell)) tabs[key] = { override: true, content: cells[cell] };
    meta.productTabs = tabs;
  }

  let variants: ProductWrite["variants"] = null;
  if (product.productType === "simple") {
    if (has("regularPrice") || creating) columns.price = parseNumber(cells.regularPrice) ?? 0;
    if (has("salePrice")) columns.salePrice = parseNumber(cells.salePrice);
    else if (creating) columns.salePrice = null;
    if (has("stock") || has("stockStatus") || has("trackStock") || creating) {
      const stock = stockFields(cells, true);
      columns.stock = stock.stock;
      meta.trackStock = stock.trackStock;
      meta.stockStatus = stock.stockStatus;
    }
    if (creating) {
      meta.attributes = [];
      meta.variations = [];
    }
    variants = creating ? [] : null;
  } else {
    const previous: any[] = Array.isArray(existingMeta?.variations) ? existingMeta!.variations : [];
    const enabled = product.variations.filter((variation) => variation.enabled);
    const prices = enabled.map((variation) => variation.regularPrice).filter((value) => value > 0);
    columns.price = prices.length ? Math.min(...prices) : parseNumber(cells.regularPrice) ?? 0;
    columns.salePrice = has("salePrice") ? parseNumber(cells.salePrice) : null;
    columns.stock = enabled.reduce((sum, variation) => sum + variation.stock, 0);
    meta.trackStock = parseBool(cells.trackStock, true);
    meta.stockStatus = Number(columns.stock) > 0 ? "instock" : "outofstock";
    setMeta("swatchesEnabled", has("swatchesEnabled") ? parseBool(cells.swatchesEnabled, true) : undefined, true);
    setMeta("swatchShape", text("swatchShape")?.toLowerCase(), "circle");
    setMeta("swatchSize", text("swatchSize")?.toLowerCase(), "medium");
    meta.attributes = product.attributes.map((attribute, index) => ({
      id: `attr-csv-${index + 1}`,
      name: attribute.name,
      valuesText: attribute.values.join(" | "),
      visible: true,
      forVariations: true,
      open: false,
    }));
    meta.variations = product.variations.map((variation) => {
      // Keep images already uploaded for this variation when the CSV gives none.
      const before = previous.find((item) => (item?.sku && item.sku === variation.sku) || item?.key === variation.key);
      const images = variation.images.length ? variation.images : Array.isArray(before?.images) ? before.images : [];
      return {
        key: variation.key,
        name: variation.name,
        attributes: variation.attributes,
        sku: variation.sku,
        gtin: variation.gtin,
        regularPrice: variation.regularPrice > 0 ? String(variation.regularPrice) : "",
        salePrice: variation.salePrice != null ? String(variation.salePrice) : "",
        saleFrom: variation.saleFrom,
        saleTo: variation.saleTo,
        trackStock: variation.trackStock,
        quantity: variation.quantity,
        stockStatus: variation.stockStatus,
        weight: variation.weight,
        length: variation.length,
        width: variation.width,
        height: variation.height,
        shippingClass: variation.shippingClass,
        images,
        enabled: variation.enabled,
        downloadable: false,
        virtual: false,
      };
    });
    variants = (meta.variations as any[])
      .filter((variation) => variation.enabled && Number(variation.regularPrice || variation.salePrice || 0) > 0)
      .map((variation) => ({
        name: variation.name,
        sku: variation.sku,
        stock: stockFrom(variation.stockStatus, variation.quantity, variation.trackStock),
        priceOverride: Number(variation.salePrice || variation.regularPrice) || null,
        imageUrl: variation.images[0] || null,
        attributes: { ...variation.attributes, stockStatus: variation.stockStatus },
      }));
  }

  let category: ProductWrite["category"] = null;
  if (has("category") || has("categorySlug")) {
    const name = cells.category || cells.categorySlug;
    const fields: Record<string, unknown> = {};
    if (has("categoryDescription")) fields.description = cells.categoryDescription;
    if (has("categoryImageUrl")) fields.imageUrl = cells.categoryImageUrl;
    if (has("categorySortOrder") && parseNumber(cells.categorySortOrder) != null) fields.sortOrder = Math.floor(parseNumber(cells.categorySortOrder)!);
    if (has("categorySeoTitle")) fields.seoTitle = cells.categorySeoTitle;
    if (has("categorySeoDescription")) fields.seoDescription = cells.categorySeoDescription;
    category = { name, slug: slugify(cells.categorySlug || name), fields };
  }

  return { columns, meta, variants, category, slug: slugify(cells.slug || product.title), explicitSlug: has("slug") };
}
