// CSV product import: column definitions, templates and row -> product planning.
// Pure functions only (no database access) so the same definitions drive the
// downloadable templates, the import endpoint and the generator script.
//
// The CSV carries only what an AI writes for a NEW product. Everything else (stock,
// shipping, badges, tabs, redirects...) is set by hand in the product form after import.
// The import is create-only: a row that matches an existing product is rejected.

export type ImportColumn = {
  key: string;
  scope: "simple" | "variable" | "both";
  required?: boolean;
  help: string;
};

export const PRODUCT_TAG_IDS = ["customer-favourite", "best-selling", "new-arrival", "15-off", "20-off", "30-off"];
export const MAX_PRODUCT_IMAGES = 13;
export const MAX_VARIATION_IMAGES = 8;

export const IMPORT_COLUMNS: ImportColumn[] = [
  { key: "type", scope: "both", required: true, help: "simple (simple template) or variable (variable template)." },
  { key: "title", scope: "both", required: true, help: "Product name." },
  { key: "slug", scope: "both", help: "URL slug. Blank = made from the title." },
  {
    key: "sku",
    scope: "both",
    required: true,
    help: 'Unique product code. A SKU, slug or title that already exists in the shop is rejected as "Already exists".',
  },
  {
    key: "category",
    scope: "both",
    required: true,
    help: "One of the store's categories (name or slug). Blank or wrong = choose it from the dropdown in the import preview.",
  },
  {
    key: "regularPrice",
    scope: "both",
    required: true,
    help: "Price in Rs, digits only. Variable products: one price for every variation.",
  },
  {
    key: "salePrice",
    scope: "both",
    help: "Lower than regularPrice. Any sale price puts the product on the Discount page.",
  },
  {
    key: "shortDescription",
    scope: "both",
    help: "Two lines of text, then 3-4 points: <p>...</p><ul><li>...</li><li>...</li><li>...</li></ul>. The points show with a tick icon in the buy box.",
  },
  {
    key: "descriptionHtml",
    scope: "both",
    help: "Full description with headings, paragraphs and lists. Use <h2>-<h6>: the product name is the page's <h1>, so any <h1> is saved as <h2>.",
  },
  { key: "weight", scope: "both", help: "kg. Shown on the product page when filled." },
  { key: "length", scope: "both", help: "cm. Shown on the product page when filled." },
  { key: "width", scope: "both", help: "cm. Shown on the product page when filled." },
  { key: "height", scope: "both", help: "cm. Shown on the product page when filled." },
  {
    key: "imageAlt",
    scope: "both",
    help: "One alt text, applied to every image of the product. Blank = product title.",
  },
  { key: "imageTitle", scope: "both", help: "One image title, applied to every image of the product." },
  {
    key: "tags",
    scope: "both",
    help: `Separated by |: ${PRODUCT_TAG_IDS.join(", ")}. Other values are ignored with a warning.`,
  },
  { key: "focusKeyword", scope: "both", help: "SEO focus keyword." },
  { key: "seoTitle", scope: "both", help: "Meta title, up to 60 characters." },
  { key: "seoDescription", scope: "both", help: "Meta description, up to 155 characters." },
  { key: "attribute1Name", scope: "variable", required: true, help: "First option name, e.g. Color." },
  {
    key: "attribute1Values",
    scope: "variable",
    required: true,
    help: "Its values separated by |, e.g. Black | White.",
  },
  { key: "attribute2Name", scope: "variable", help: "Second option, e.g. Size." },
  { key: "attribute2Values", scope: "variable", help: "e.g. S | M | L." },
  { key: "attribute3Name", scope: "variable", help: "Third option; rarely used." },
  { key: "attribute3Values", scope: "variable", help: "Values of the third option." },
];

// Old header names (previous template, WooCommerce-style) -> current column.
const HEADER_ALIASES: Record<string, string> = {
  name: "title",
  producttitle: "title",
  productname: "title",
  price: "regularPrice",
  categoryname: "category",
  description: "descriptionHtml",
  parent: "parentSku",
  producttype: "type",
  enabled: "variationEnabled",
};

function headerKey(header: string) {
  return String(header || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// Columns of older files still read on old-style `variation` rows (one row per variation).
const LEGACY_VARIATION_COLUMNS = ["parentSku", "gtin", "variationEnabled"];

// Columns removed from the template. Old files that still have them import; the values are
// ignored with a warning. The owner sets these by hand in the product form.
const RETIRED_COLUMNS = [
  "categorySlug",
  "categoryDescription",
  "categoryImageUrl",
  "categorySortOrder",
  "categorySeoTitle",
  "categorySeoDescription",
  "brand",
  "costPrice",
  "saleFrom",
  "saleTo",
  "trackStock",
  "stock",
  "quantity",
  "stockStatus",
  "shippingClass",
  "freeShipping",
  "videoUrl",
  "imageUrls",
  "images",
  "image",
  "badge",
  "featured",
  "bundleEnabled",
  "deliveryDays",
  "deliveryNote",
  "purchaseNote",
  "menuOrder",
  "canonicalUrl",
  "redirectFallback",
  "redirectUrl",
  "tabWhyChoose",
  "tabShippingProcess",
  "tabGeneralFaq",
  "swatchesEnabled",
  "swatchShape",
  "swatchSize",
  "robotsIndex",
  "robotsNoFollow",
  "imageCaption",
  "imageDescription",
];
const RETIRED_KEYS = new Set(RETIRED_COLUMNS.map(headerKey));

const COLUMN_BY_HEADER = new Map<string, string>([
  ...IMPORT_COLUMNS.map((column) => [headerKey(column.key), column.key] as [string, string]),
  ...LEGACY_VARIATION_COLUMNS.map((column) => [headerKey(column), column] as [string, string]),
  ...Object.entries(HEADER_ALIASES),
]);

const REQUIRED_HEADERS = ["type", "title", "sku", "regularPrice"];

/**
 * Checks the header row. `errors` reject the whole file (a missing required column or a
 * repeated column). Removed and unknown columns only give `warnings`: they are ignored.
 */
export function validateHeaders(headers: string[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Map<string, string>();
  const retired: string[] = [];
  const unknown: string[] = [];
  let blank = 0;
  for (const raw of headers) {
    const header = String(raw ?? "").trim();
    if (!header) {
      blank += 1;
      continue;
    }
    const column = COLUMN_BY_HEADER.get(headerKey(header));
    if (!column) (RETIRED_KEYS.has(headerKey(header)) ? retired : unknown).push(header);
    else if (seen.has(column))
      errors.push(`Column "${header}" is repeated (it is the same column as "${seen.get(column)}"). Keep it once.`);
    else seen.set(column, header);
  }
  if (retired.length)
    warnings.push(
      `Column${retired.length === 1 ? "" : "s"} no longer in the template, ignored: ${retired.join(", ")}. Set ${retired.length === 1 ? "it" : "these"} in the product form after import.`,
    );
  if (unknown.length) warnings.push(`Unknown column${unknown.length === 1 ? "" : "s"} ignored: ${unknown.join(", ")}.`);
  if (blank)
    warnings.push(
      `${blank} column${blank === 1 ? " has" : "s have"} no name in the header row and ${blank === 1 ? "was" : "were"} ignored.`,
    );
  const missing = REQUIRED_HEADERS.filter((column) => !seen.has(column));
  if (missing.length)
    errors.push(
      `Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Start again from the template.`,
    );
  return { errors, warnings };
}

const NUMBER_COLUMNS = ["weight", "length", "width", "height"];

// Format checks shared by product rows and old-style variation rows.
function valueErrors(cells: Record<string, string>, label: string, errors: string[]) {
  if (cells.type && !/^(simple|variable|variation)$/i.test(cells.type))
    errors.push(`${label}type "${cells.type}" is not allowed. Use simple or variable.`);
  for (const column of NUMBER_COLUMNS) {
    const value = parseNumber(cells[column]);
    if (cells[column] && (value == null || value < 0))
      errors.push(`${label}${column} "${cells[column]}" is not a number.`);
  }
  if (cells.variationEnabled && !parseBoolStrict(cells.variationEnabled))
    errors.push(`${label}variationEnabled "${cells.variationEnabled}" must be yes or no.`);
}

export function templateColumns(kind: "simple" | "variable") {
  return IMPORT_COLUMNS.filter((column) => column.scope === "both" || column.scope === kind).map(
    (column) => column.key,
  );
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
    regularPrice: "900",
    salePrice: "700",
    shortDescription:
      "<p>Long-lasting matte lipstick with a smooth, non-drying finish.<br>Rich colour in one swipe.</p><ul><li>Stays on for hours</li><li>Non-drying formula</li><li>Easy, precise bullet</li></ul>",
    descriptionHtml:
      "<p>A richly pigmented matte lipstick that glides on smoothly and stays put for hours.</p><h2>Why you will love it</h2><ul><li>Long-lasting colour</li><li>Non-drying formula</li></ul>",
    weight: "0.2",
    imageAlt: "Matte Lipstick Rose Red",
    tags: "best-selling|new-arrival",
    focusKeyword: "matte lipstick",
    seoTitle: "Matte Lipstick Rose Red | Zelvomart",
    seoDescription: "Buy long-lasting matte lipstick in Rose Red online in Pakistan with cash on delivery.",
  },
];

const VARIABLE_EXAMPLES: Record<string, string>[] = [
  {
    type: "variable",
    title: "EXAMPLE Cotton T-Shirt",
    sku: "ZVM-EXAMPLE-TEE-001",
    category: "Fashion Accessories",
    regularPrice: "1500",
    salePrice: "1200",
    shortDescription:
      "<p>Soft everyday cotton tee in two colours.<br>Breathable and easy to wash.</p><ul><li>100% cotton</li><li>Pre-shrunk fabric</li><li>Regular fit</li></ul>",
    descriptionHtml:
      "<p>A breathable 100% cotton t-shirt made for daily wear.</p><h2>Details</h2><ul><li>Pre-shrunk fabric</li><li>Regular fit</li></ul>",
    weight: "0.4",
    tags: "new-arrival",
    focusKeyword: "cotton t-shirt",
    seoTitle: "Cotton T-Shirt | Zelvomart",
    seoDescription: "Shop a soft cotton t-shirt online in Pakistan with cash on delivery.",
    attribute1Name: "Color",
    attribute1Values: "Black | White",
    attribute2Name: "Size",
    attribute2Values: "M | L",
  },
];

export function templateCsv(kind: "simple" | "variable", withExamples = true) {
  const columns = templateColumns(kind);
  const examples = withExamples ? (kind === "simple" ? SIMPLE_EXAMPLES : VARIABLE_EXAMPLES) : [];
  const lines = [
    columns.join(","),
    ...examples.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(",")),
  ];
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
  enabled: boolean;
};

export type PlannedProduct = {
  row: number;
  sku: string;
  title: string;
  slug: string;
  productType: "simple" | "variable";
  // Normalised cells of the product row. Only non-empty cells are present.
  cells: Record<string, string>;
  // `declared`: the variable row listed the values, so variation rows may only use those.
  attributes: { name: string; values: string[]; declared?: boolean }[];
  variations: PlannedVariation[];
  // True when the file used the old one-row-per-variation layout for this product.
  legacyVariations: boolean;
  /** Other rows of this file with the same SKU, slug or title: shown as "Already exists". */
  duplicates: string[];
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

/** Title key for duplicate checks: ignores case, extra spaces and punctuation. */
export function titleKey(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** One <h1> per page: the product name. Any <h1> in a description becomes <h2>. */
export function demoteH1(html: string) {
  return String(html || "").replace(/<(\/?)h1(?=[\s>])/gi, "<$1h2");
}

function parseBoolStrict(value: string) {
  return ["1", "0", "true", "false", "yes", "no", "y", "n", "on", "off"].includes(value.trim().toLowerCase());
}

export function parseBool(value: unknown, fallback: boolean) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
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

function priceErrors(label: string, cells: Record<string, string>, errors: string[]) {
  const regular = parseNumber(cells.regularPrice);
  const sale = parseNumber(cells.salePrice);
  if (cells.regularPrice && (regular == null || regular <= 0))
    errors.push(`${label}regularPrice "${cells.regularPrice}" must be a number above 0.`);
  if (cells.salePrice && (sale == null || sale < 0))
    errors.push(`${label}salePrice "${cells.salePrice}" is not a number.`);
  if (regular != null && sale != null && sale >= regular)
    errors.push(`${label}salePrice must be lower than regularPrice.`);
}

/** Every combination of the attribute values, in the order the product form builds them. */
function combinations(attributes: { name: string; values: string[] }[]) {
  let rows: Record<string, string>[] = [{}];
  for (const attribute of attributes)
    rows = rows.flatMap((row) => attribute.values.map((value) => ({ ...row, [attribute.name]: value })));
  return rows.filter((row) => Object.keys(row).length);
}

const MAX_COMBINATIONS = 100;

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
      slug: slugify(cells.slug || cells.title || ""),
      productType: type === "variable" ? "variable" : "simple",
      cells,
      attributes: [],
      variations: [],
      legacyVariations: false,
      duplicates: [],
      errors: [],
      warnings: [],
    };
    if (!product.title) product.errors.push("title is required.");
    if (!product.sku) product.errors.push("sku is required.");
    else if (!bySku.has(product.sku.toLowerCase())) bySku.set(product.sku.toLowerCase(), product);
    if (cells.slug && !product.slug) product.errors.push(`slug "${cells.slug}" has no letters or digits.`);
    valueErrors(cells, "", product.errors);
    priceErrors("", cells, product.errors);
    if (cells.parentSku) product.errors.push("parentSku is only for old-style variation rows. Empty it.");
    if (type !== "variable") {
      const stray = [
        "attribute1Name",
        "attribute1Values",
        "attribute2Name",
        "attribute2Values",
        "attribute3Name",
        "attribute3Values",
      ].filter((column) => cells[column]);
      if (stray.length)
        product.errors.push(
          `${stray.join(", ")} ${stray.length === 1 ? "is" : "are"} only for variable products. Set type to variable or empty ${stray.length === 1 ? "it" : "them"}.`,
        );
    }
    const unknownTags = parseList(cells.tags).filter((tag) => !PRODUCT_TAG_IDS.includes(slugify(tag)));
    if (unknownTags.length)
      product.warnings.push(`Unknown tags ignored: ${unknownTags.join(", ")}. Allowed: ${PRODUCT_TAG_IDS.join(", ")}.`);
    if (cells.seoTitle && cells.seoTitle.length > 60)
      product.warnings.push(`seoTitle is ${cells.seoTitle.length} characters; Google shows about 60.`);
    if (cells.seoDescription && cells.seoDescription.length > 155)
      product.warnings.push(`seoDescription is ${cells.seoDescription.length} characters; Google shows about 155.`);
    if (/<h1[\s>]/i.test(cells.descriptionHtml || ""))
      product.warnings.push(
        "descriptionHtml has an <h1>; it is saved as <h2> (the product name is the page's only <h1>).",
      );
    if (product.productType === "variable") {
      for (const n of [1, 2, 3]) {
        const name = cells[`attribute${n}Name`];
        const values = [
          ...new Map(parseList(cells[`attribute${n}Values`]).map((value) => [value.toLowerCase(), value])).values(),
        ];
        if (name) product.attributes.push({ name, values, declared: values.length > 0 });
        else if (values.length) product.errors.push(`attribute${n}Values is filled but attribute${n}Name is empty.`);
        else continue;
        if (name && n > 1 && !cells[`attribute${n - 1}Name`])
          product.errors.push(
            `attribute${n}Name is filled but attribute${n - 1}Name is empty. Fill the attributes in order.`,
          );
      }
      if (
        new Set(product.attributes.map((attribute) => attribute.name.toLowerCase())).size !== product.attributes.length
      )
        product.errors.push("Two attributes have the same name.");
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
      slug: "",
      productType: "variable",
      cells: orphan.cells,
      attributes: [],
      variations: [],
      legacyVariations: true,
      duplicates: [],
      errors: [
        `Variation row: no variable product with sku "${orphan.cells.parentSku || ""}" in this file. Variable products now take one row; put the options in attribute1Name / attribute1Values.`,
      ],
      warnings: [],
    });
  }

  for (const product of products) {
    if (product.productType === "simple") {
      if (!product.cells.regularPrice) product.errors.push("regularPrice is required.");
      continue;
    }
    if (product.legacyVariations && !product.cells.title) continue;
    if (product.variations.length) {
      // Old file: one row per variation. Imported as before, with a warning.
      product.legacyVariations = true;
      product.warnings.push(
        `Old template: ${product.variations.length} variation row${product.variations.length === 1 ? "" : "s"} imported as before. New files use one row per product.`,
      );
      if (!product.attributes.length)
        product.errors.push("attribute1Name is required on the variable row (for example Color).");
      checkLegacyVariations(product);
      continue;
    }
    // New file: one row; every combination of the options, at the row's price.
    if (!product.cells.regularPrice) product.errors.push("regularPrice is required: one price for every variation.");
    if (!product.attributes.length)
      product.errors.push("attribute1Name and attribute1Values are required (for example Color and Black | White).");
    product.attributes.forEach((attribute, index) => {
      if (!attribute.values.length)
        product.errors.push(`attribute${index + 1}Values is empty. List the ${attribute.name} values separated by |.`);
    });
    const combos = product.attributes.every((attribute) => attribute.values.length)
      ? combinations(product.attributes)
      : [];
    if (combos.length > MAX_COMBINATIONS) {
      product.errors.push(`The options make ${combos.length} variations; the limit is ${MAX_COMBINATIONS}.`);
      continue;
    }
    const regular = parseNumber(product.cells.regularPrice) ?? 0;
    const sale = parseNumber(product.cells.salePrice);
    product.variations = combos.map((attributes, index) => ({
      row: product.row,
      key: variationKey(attributes),
      name: Object.values(attributes).join(" / "),
      sku: `${product.sku}-V${index + 1}`,
      gtin: "",
      attributes,
      regularPrice: regular,
      salePrice: sale,
      enabled: true,
    }));
  }

  flagFileDuplicates(products);
  return products;
}

function checkLegacyVariations(product: PlannedProduct) {
  const seenKeys = new Set<string>();
  const seenSkus = new Set<string>();
  product.variations.forEach((variation, index) => {
    if (!variation.sku) variation.sku = `${product.sku}-V${index + 1}`;
    const label = `Row ${variation.row}: `;
    if (seenSkus.has(variation.sku.toLowerCase()))
      product.errors.push(`${label}variation sku "${variation.sku}" is repeated.`);
    seenSkus.add(variation.sku.toLowerCase());
    if (seenKeys.has(variation.key)) product.errors.push(`${label}the combination "${variation.name}" is repeated.`);
    seenKeys.add(variation.key);
    for (const attribute of product.attributes) {
      const value = variation.attributes[attribute.name];
      if (!value) product.errors.push(`${label}missing a value for "${attribute.name}".`);
      else if (!attribute.values.some((item) => item.toLowerCase() === value.toLowerCase())) {
        if (attribute.declared)
          product.errors.push(
            `${label}"${value}" is not one of the ${attribute.name} values listed on the variable row (${attribute.values.join(" | ")}).`,
          );
        else attribute.values.push(value);
      }
    }
    if (variation.regularPrice <= 0)
      product.warnings.push(`${label}variation "${variation.name}" has no regularPrice and will not be sold.`);
  });
}

// Two rows in the same file with the same SKU, slug or title are both flagged.
function flagFileDuplicates(products: PlannedProduct[]) {
  const real = products.filter((product) => product.cells.title || product.sku);
  const checks: [string, (product: PlannedProduct) => string][] = [
    ["SKU", (product) => product.sku.toLowerCase()],
    ["slug", (product) => product.slug],
    ["title", (product) => titleKey(product.title)],
  ];
  for (const [label, keyOf] of checks) {
    const groups = new Map<string, PlannedProduct[]>();
    for (const product of real) {
      const key = keyOf(product);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) || []), product]);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      for (const product of group) {
        const others = group.filter((other) => other !== product).map((other) => other.row);
        product.duplicates.push(
          `Same ${label} as row${others.length === 1 ? "" : "s"} ${others.join(", ")} in this file.`,
        );
      }
    }
  }
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
    if (values.length > 1)
      parent.errors.push(
        `${label}a variation row takes one value in attribute${n}Values, not a list (${cells[`attribute${n}Values`]}).`,
      );
    if (values.length && !parent.attributes[index])
      parent.errors.push(`${label}attribute${n}Values is filled but the variable row has no attribute${n}Name.`);
  });
  parent.variations.push({
    row,
    key: variationKey(attributes),
    name: Object.values(attributes).join(" / "),
    sku: cells.sku || "",
    gtin: cells.gtin || "",
    attributes,
    regularPrice: parseNumber(cells.regularPrice) ?? 0,
    salePrice: parseNumber(cells.salePrice),
    enabled: parseBool(cells.variationEnabled, true),
  });
}

export type ProductWrite = {
  columns: Record<string, unknown>;
  meta: Record<string, unknown>;
  variants: {
    name: string;
    sku: string;
    priceOverride: number | null;
    imageUrl: string | null;
    attributes: Record<string, string>;
    trackStock: boolean;
    stockStatus: string;
    active: boolean;
  }[];
  slug: string;
  explicitSlug: boolean;
};

/**
 * Builds the database write for one NEW product. Everything the CSV does not carry gets
 * the store defaults: In stock (Track OFF), delivery charge applies, buy-2 bundle on,
 * no brand, redirect fallback on, store-wide product tabs, indexable.
 */
export function buildProductWrite(product: PlannedProduct): ProductWrite {
  const cells = product.cells;
  const has = (key: string) => Boolean(cells[key]);
  const text = (key: string) => cells[key] || "";
  const regular = parseNumber(cells.regularPrice) ?? 0;
  const sale = has("salePrice") ? parseNumber(cells.salePrice) : null;
  const tags = parseList(cells.tags)
    .map(slugify)
    .filter((tag, index, all) => PRODUCT_TAG_IDS.includes(tag) && all.indexOf(tag) === index);

  const columns: Record<string, unknown> = {
    title: product.title,
    shortDescription: text("shortDescription") || null,
    descriptionHtml: has("descriptionHtml") ? demoteH1(cells.descriptionHtml) : null,
    seoTitle: text("seoTitle") || null,
    seoDescription: text("seoDescription") || null,
    images: [],
    featured: tags.includes("best-selling"),
    bundleEnabled: true,
    bundleDiscountPercent: 5,
    trackStock: false,
    stockStatus: "instock",
    stock: 0,
    price: regular,
    salePrice: sale,
  };

  const meta: Record<string, unknown> = {
    productType: product.productType,
    tags,
    bundleEnabled: true,
    bundleDiscountPercent: 5,
    badge: "",
    weight: text("weight"),
    length: text("length"),
    width: text("width"),
    height: text("height"),
    saleFrom: "",
    saleTo: "",
    deliveryDays: "3",
    deliveryNote: "Delivered across Pakistan",
    focusKeyword: text("focusKeyword"),
    freeShipping: false,
    redirectFallback: true,
    robotsIndex: "index",
    robotsNoFollow: false,
    customTabs: [],
    imageMeta: {
      alt: text("imageAlt") || product.title,
      title: text("imageTitle"),
      fileName: "",
      fileSize: 0,
      width: 0,
      height: 0,
    },
    attributes: [],
    variations: [],
  };

  let variants: ProductWrite["variants"] = [];
  if (product.productType === "variable") {
    const enabled = product.variations.filter((variation) => variation.enabled);
    const prices = enabled.map((variation) => variation.regularPrice).filter((value) => value > 0);
    if (product.legacyVariations) {
      columns.price = prices.length ? Math.min(...prices) : regular;
    }
    meta.swatchesEnabled = true;
    meta.swatchShape = "circle";
    meta.swatchSize = "medium";
    meta.attributes = product.attributes.map((attribute, index) => ({
      id: `attr-csv-${index + 1}`,
      name: attribute.name,
      valuesText: attribute.values.join(" | "),
      visible: true,
      forVariations: true,
      open: false,
    }));
    meta.variations = product.variations.map((variation) => ({
      key: variation.key,
      name: variation.name,
      attributes: variation.attributes,
      sku: variation.sku,
      gtin: variation.gtin,
      regularPrice: variation.regularPrice > 0 ? String(variation.regularPrice) : "",
      salePrice: variation.salePrice != null ? String(variation.salePrice) : "",
      saleFrom: "",
      saleTo: "",
      trackStock: false,
      quantity: 0,
      stockStatus: "instock",
      weight: "",
      length: "",
      width: "",
      height: "",
      images: [],
      enabled: variation.enabled,
    }));
    variants = product.variations
      .filter((variation) => variation.enabled && (variation.regularPrice > 0 || (variation.salePrice ?? 0) > 0))
      .map((variation) => ({
        name: variation.name,
        sku: variation.sku,
        priceOverride: (variation.salePrice ?? 0) > 0 ? variation.salePrice : variation.regularPrice || null,
        imageUrl: null,
        attributes: { ...variation.attributes },
        trackStock: false,
        stockStatus: "instock",
        active: true,
      }));
  }

  return { columns, meta, variants, slug: product.slug, explicitSlug: has("slug") };
}
