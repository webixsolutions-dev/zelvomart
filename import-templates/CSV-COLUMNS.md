# CSV column reference

Generated from `backend/src/lib/product-import.ts`. Do not edit by hand.

The CSV carries only what is written for a NEW product. Everything else (stock, shipping,
badge, featured, delivery, tabs, redirects, video, images) is set by hand in the product
form after import. Blank cells are normal: blank means the default or empty, never an
error, except in the required columns.

## simple-products-template.csv

| Column | Required | What goes in it |
|---|---|---|
| `type` | Yes | simple (simple template) or variable (variable template). |
| `title` | Yes | Product name. |
| `slug` | No | URL slug. Blank = made from the title. |
| `sku` | Yes | Unique product code. A SKU, slug or title that already exists in the shop is rejected as "Already exists". |
| `category` | Yes | One of the store's categories (name or slug). Blank or wrong = choose it from the dropdown in the import preview. |
| `regularPrice` | Yes | Price in Rs, digits only. Variable products: one price for every variation. |
| `salePrice` | No | Lower than regularPrice. Any sale price puts the product on the Discount page. |
| `shortDescription` | No | Two lines of text, then 3-4 points: <p>...</p><ul><li>...</li><li>...</li><li>...</li></ul>. The points show with a tick icon in the buy box. |
| `descriptionHtml` | No | Full description with headings, paragraphs and lists. Use <h2>-<h6>: the product name is the page's <h1>, so any <h1> is saved as <h2>. |
| `weight` | No | kg. Shown on the product page when filled. |
| `length` | No | cm. Shown on the product page when filled. |
| `width` | No | cm. Shown on the product page when filled. |
| `height` | No | cm. Shown on the product page when filled. |
| `imageAlt` | No | One alt text, applied to every image of the product. Blank = product title. |
| `imageTitle` | No | One image title, applied to every image of the product. |
| `tags` | No | Separated by \|: customer-favourite, best-selling, new-arrival, 15-off, 20-off, 30-off. Other values are ignored with a warning. |
| `focusKeyword` | No | SEO focus keyword. |
| `seoTitle` | No | Meta title, up to 60 characters. |
| `seoDescription` | No | Meta description, up to 155 characters. |

## variable-products-template.csv

A variable product is a single row with `type = variable`. It has every column of the
simple template plus the option columns below. The import creates every combination of
the options as a variation, all at the row's `regularPrice` / `salePrice` and In stock,
with SKUs `<sku>-V1`, `<sku>-V2`...

Example: Color `Black | White` and Size `M | L` gives 4 variations (Black / M, Black / L,
White / M, White / L).

| Column | Required | What goes in it |
|---|---|---|
| `attribute1Name` | Yes | First option name, e.g. Color. |
| `attribute1Values` | Yes | Its values separated by \|, e.g. Black \| White. |
| `attribute2Name` | No | Second option, e.g. Size. |
| `attribute2Values` | No | e.g. S \| M \| L. |
| `attribute3Name` | No | Third option; rarely used. |
| `attribute3Values` | No | Values of the third option. |

## Defaults for everything not in the CSV

In stock (Track stock OFF), delivery charges apply (not free), buy-2 bundle on, no brand,
redirect fallback on, store-wide product tabs, indexable. Swatches on, circle, medium.
