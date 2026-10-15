# Zelvomart bulk import templates

Everything needed to add products and product images in bulk from the admin panel
(`/admin/products` and `/admin/products/drafts`).

| File | Use it for |
|---|---|
| `simple-products-template.csv` | Products with one price |
| `variable-products-template.csv` | Products with options (Color, Size...), one row per product |
| `CSV-COLUMNS.md` | What every column means and which values are allowed |
| `product-images-template.zip` | Example of the image ZIP: one folder per product, named like the product |
| `product-images-template/` | The same example, unzipped |

The two CSV files and `CSV-COLUMNS.md` are generated from the import code. After changing
columns in `backend/src/lib/product-import.ts`, regenerate them:

```
npm run templates --workspace backend
```

The same two CSV templates can be downloaded inside the admin: **Import CSV → Templates**.

---

## 1. Products from CSV

The CSV carries only what an AI writes for a **new** product. Everything else (stock,
shipping, badge, featured, delivery, tabs, redirects, video) is set by hand in the
product form after import. Images come only from the image ZIP (section 2).

### Steps

1. Give an AI assistant three things: the template CSV (simple or variable), `CSV-COLUMNS.md`,
   and your product data. Use the prompt below.
2. Admin → **Products** → **Import CSV** → choose the CSV the AI returned.
3. The file is checked first (dry run). Nothing is saved yet. Each product shows **New**,
   **Already exists** or **Error** with the reason and the spreadsheet row number, plus any
   warnings (removed columns, unknown tags, a category that did not match...).
4. Every row has a **Category** dropdown with the store's categories. It is pre-selected when
   the CSV value matches a category name or slug, and empty when it is blank or wrong.
   Saving starts only when every row that will be saved has a category.
5. Save to drafts:
   - **Add all to drafts** saves every valid product at once, or
   - **Add to draft** on one row saves only that product.
6. Check each draft, then post it (**Post** on a row, **Post all drafts**, or later from
   **Products → Drafts**).

### Rules the importer follows

- **Create-only.** A row is rejected as **Already exists**, and nothing changes, when its SKU,
  slug or title matches an existing product (drafts included). The title match ignores case,
  extra spaces and punctuation. Variation SKUs are checked too. To change an existing product,
  edit it in the admin.
- **Duplicates in the file.** Two rows with the same SKU, slug or title are both flagged.
- **New products are always drafts.**
- **Blank cells are normal.** Blank means the default or empty, never an error, except in the
  required columns (`type`, `title`, `sku`, `category`, `regularPrice`, and for variable
  products `attribute1Name` / `attribute1Values`).
- **Categories are never created.** The category must be one of the store's categories.
- **Slug** is made from the title when blank.
- **descriptionHtml**: any `<h1>` is saved as `<h2>` (the product name is the page's only `<h1>`).
- Lists inside one cell are separated with `|` (tags, attribute values).
- **Defaults** for everything not in the CSV: In stock (Track stock OFF), delivery charges
  apply (not free), buy-2 bundle on, no brand, redirect fallback on, store-wide product tabs,
  indexable. Variable products: swatches on, circle, medium.

### Old files

Files made from the previous templates still import:

- A removed column (`brand`, `costPrice`, `stock`, `badge`, `featured`, `imageUrls`,
  `categorySlug`, `tabWhyChoose`...) is ignored with a warning. An unknown column is ignored
  with a warning too.
- Old variable files with one `variation` row per combination (`parentSku`) import as before,
  with a warning.

The whole file is rejected only when a required column (`type`, `title`, `sku`,
`regularPrice`) is missing from the header row, a column is repeated, or the file is not a
comma-separated CSV (an .xlsx file, or a semicolon-separated export).

### Variable products: one row per product

- `type = variable`, the same columns as a simple product, plus `attribute1Name` (e.g. `Color`)
  and `attribute1Values` (e.g. `Black | White`). Up to three options (`attribute1…3`).
- The import creates every combination as a variation, all at the row's `regularPrice` /
  `salePrice` and In stock, the same as the form's **Regenerate variations** button.
  Color `Black | White` and Size `M | L` gives 4 variations with SKUs `<sku>-V1` … `<sku>-V4`.
- Remove a combination or change a variation's price by hand in the admin afterwards.

### Prompt to give the AI (CSV)

```
I am attaching a CSV template, a column reference (CSV-COLUMNS.md) and my product data.
Fill the template with my products and return one CSV file.

Rules:
- Keep the header row exactly as it is. Do not add, remove, rename or reorder columns.
- Delete the EXAMPLE rows. One row per product (a variable product is also one row).
- Follow CSV-COLUMNS.md for every column: required columns, allowed values and formats.
- category must be exactly one of: <paste your category names here>.
- Prices are digits only (1500, not "Rs 1,500").
- Separate several values in one cell with " | ".
- Give every product a unique sku. Keep SKUs I already supplied unchanged.
- Leave a cell empty when I did not give that information. Do not invent prices.
- shortDescription: two lines of text, then 3-4 points: <p>...</p><ul><li>...</li></ul>.
- descriptionHtml: clean HTML with <h2>-<h6>, <p>, <ul><li>. Never use <h1>.
- seoTitle up to 60 characters, seoDescription up to 155 characters.
- Wrap any cell that contains a comma, a quote or a line break in double quotes,
  doubling quotes inside it.
- Save as UTF-8 CSV.
```

---

## 2. Product images (Bulk Image Upload)

Import the products first (they can still be drafts), then upload their images.
Images are matched by **product name** and never placed on a product by guess: an image
must never land on the wrong product.

### Three ways to name the images

```
EXAMPLE Cotton T-Shirt.zip          ← one ZIP per product, named like the product
├── 1.webp                          ← 1 = main image
└── 2.webp

product-images.zip                  ← one ZIP, one folder per product
├── Stainless Steel Tumbler 1200ml/ ← simple product
│   ├── 1.jpg                       ← main image
│   ├── 2.jpg
│   └── 3.png
└── Cotton T-Shirt/                 ← variable product, same layout
    ├── 1.webp
    └── 2.webp

Loose files (Image folder option):
  HP EliteBook 840 G8 Laptop.jpg
  HP EliteBook 840 G8 Laptop-1.jpg
  HP EliteBook 840 G8 Laptop-front.webp
```

### Matching rules

- Names are compared **exactly** after normalising: case, spaces, punctuation and `&` vs `and`
  are ignored. Title first, then slug, then SKU. A SKU or slug as the folder or ZIP name also
  works. There is no fuzzy matching.
- Loose files may add `-1`, `-2`… or a view word (`-front`, `-back`, `-side`, `-detail`…) after
  the product name.
- A name that matches no product, or more than one, goes to the **Unassigned** list with a
  dropdown to pick the product by hand. Unassigned files are not uploaded.
- **Main image:** the file numbered `1`, then `2`, `3`… Without numbers, the first file in name
  order. The owner can change it later in the admin. When the product already has images and
  the upload has no `1`, the new images are added after the current ones.
- **No sub-folders.** Simple and variable products use the same layout. A variable product's
  images belong to the product and show for every variation; set a variation's own images by
  hand in the product form.
- **13 images per product**, counting the ones it already has. Existing images are kept.
- The ZIP holds images only. Alt text and image title come from the CSV (`imageAlt`,
  `imageTitle`) and apply to every image of the product.

### Size and speed

- Every image (bulk upload, main image, gallery, variation images) is converted in the
  browser before upload: WebP, longest side 1200 px, no upscaling, no cropping, quality about
  80, aiming at 150–250 KB. GIFs upload as they are. Anything still above 4 MB is rejected.
- 4 images upload at once, with a progress bar per product. A failed image is retried once;
  if it still fails, nothing is saved for that product and the others carry on.
- Files are stored in R2 as `products/<sha256>.webp`. The same image uploaded again gets the
  same URL and is skipped ("duplicate skipped") on the product and on its variations.

### Steps

1. Admin → **Products** → **Bulk Image Upload**.
2. Optional: **Download product names CSV** lists every product's exact title, slug and SKU.
3. Choose an **Image folder** or one or more **Product ZIP file(s)**.
4. Check the preview: file or folder → matched product (thumbnail and title), image count,
   main image and the alt text found. Pick a product for any unassigned file.
5. Click **Confirm and upload**. Nothing is uploaded before that.

### Prompt to give the AI (images)

```
I am attaching my product images and zelvomart-product-names.csv. Organise the images into one ZIP.

Rules:
- Create one folder per product. Name it exactly as the title column in the CSV.
- Put that product's images directly inside its folder. No sub-folders.
- Rename the best front-facing image to 1 (keep its extension, e.g. 1.jpg). It is the main image.
- Rename the other images 2, 3, 4... in the order they should appear. At most 13 per product.
- Do not create folders for products that have no images.
- List any image you could not assign to a product instead of guessing.
- Return a single ZIP file with no password.
```

---

## Testing checklist

1. Start the app (`START_DEV.bat`, or `npm run dev` in `backend` and `frontend`) and sign in to `/admin`.
2. **Import CSV** → choose `simple-products-template.csv` as it is. One row shows as **New** with
   the category "Beauty & Personal Care" pre-selected. Click **Add to draft**, then open
   **Products → Drafts**: "EXAMPLE Matte Lipstick Rose Red" is there.
3. Import `variable-products-template.csv` the same way. The draft "EXAMPLE Cotton T-Shirt"
   has Color and Size attributes and four variations (`-V1` … `-V4`), each at Rs 1,500 / 1,200.
4. Import the same file again: the row now shows **Already exists** and cannot be saved.
5. **Bulk Image Upload** → **Product ZIP file(s)** → choose `product-images-template.zip` after
   replacing the placeholder `.txt` files with real images named `1`, `2`… (the folder names already
   match the two example product titles). Check the preview, then **Confirm and upload**.
6. Click **Post** on a draft and open `/product/<slug>` on the shop.
7. Delete the two EXAMPLE products when you are done.
