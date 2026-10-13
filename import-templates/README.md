# Zelvomart bulk import templates

Everything needed to add products and product images in bulk from the admin panel
(`/admin/products` and `/admin/products/drafts`).

| File | Use it for |
|---|---|
| `simple-products-template.csv` | Products with one price and one stock count |
| `variable-products-template.csv` | Products with options (Color, Size...) |
| `CSV-COLUMNS.md` | What every column means and which values are allowed |
| `product-images-template.zip` | Example of the image ZIP structure |
| `product-images-template/` | The same example, unzipped |

The two CSV files and `CSV-COLUMNS.md` are generated from the import code. After changing
columns in `backend/src/lib/product-import.ts`, regenerate them:

```
npm run templates --workspace backend
```

The same two CSV templates can be downloaded inside the admin: **Import CSV → Templates**.

---

## 1. Products from CSV

### Steps

1. Give an AI assistant three things: the template CSV (simple or variable), `CSV-COLUMNS.md`,
   and your product data. Use the prompt below.
2. Admin → **Products** → **Import CSV** → choose the CSV the AI returned.
3. The file is checked first. Nothing is saved yet. Each product shows **New**,
   **Will update** or **Error** with the reason and the spreadsheet row number.
4. Save to drafts:
   - **Add all to drafts** saves every valid product at once, or
   - **Add to draft** on one row saves only that product.
5. Post:
   - **Post** on a row puts that product on the shop in one click, or
   - **Post all drafts** posts every product saved from this file.
   - Later, the same **Post** / **Post all** buttons are on **Products → Drafts**.

### Rules the importer follows

- **SKU decides create or update.** A new SKU creates a product. An existing SKU updates it.
- **New products are always drafts.** An existing product keeps its current status.
- **Empty cells never erase data.** On an update, only filled cells change the product.
- **Categories are created automatically** when the name or slug does not exist yet. The
  `category*` columns fill the category's description, image, sort order and SEO fields.
- **Slug** is generated from the title when blank. A posted product never changes its slug.
- A product can be saved as a draft without a price, but it cannot be posted until it has one.
- Lists inside one cell are separated with `|` (tags, image URLs, attribute values).

### What gets rejected

The whole file is rejected, and nothing is saved, when the header row was changed:
an added or renamed column, a repeated column, a column without a name, or a missing
`type`, `title`, `sku` or `regularPrice` column. The same happens for a file that is not
a comma-separated CSV (an .xlsx file, or a semicolon-separated export).

A single product is rejected, with its row number and the reason, when a value is wrong:
missing title or SKU, a SKU repeated in the file, a price or stock that is not a number,
a sale price that is not lower than the regular price, a yes/no column with another value,
a date that is not `YYYY-MM-DD`, an invalid URL, a variation without its variable row, or
a variation value that is not listed on the variable row. The other products in the file
can still be added.

### Variable products

- One row with `type = variable` describes the product: title, category, descriptions, SEO,
  `attribute1Name` (e.g. `Color`) and `attribute1Values` (e.g. `Black | White`).
- One row with `type = variation` per combination follows it. Set `parentSku` to the variable
  row's `sku`, put the single value in `attribute1Values` (e.g. `Black`), and give the
  variation its own `sku`, `regularPrice`, `salePrice` and `stock`.
- The product's price is the lowest variation price and its stock is the sum of the variations.
- Up to three attributes (`attribute1…3`).

### Prompt to give the AI (CSV)

```
I am attaching a CSV template, a column reference (CSV-COLUMNS.md) and my product data.
Fill the template with my products and return one CSV file.

Rules:
- Keep the header row exactly as it is. Do not add, remove, rename or reorder columns.
- Delete the EXAMPLE rows. One row per product (and one row per variation for variable products).
- Follow CSV-COLUMNS.md for every column: required columns, allowed values and formats.
- Prices and stock are digits only (1500, not "Rs 1,500").
- yes/no columns contain only yes or no. Dates are YYYY-MM-DD.
- Separate several values in one cell with " | ".
- Give every product a unique sku. Keep SKUs I already supplied unchanged.
- Leave a cell empty when I did not give that information. Do not invent prices, stock or URLs.
- Leave imageUrls empty; images are uploaded separately in a ZIP.
- Write descriptionHtml as clean HTML (<p>, <h2>, <ul><li>) and wrap any cell that contains
  a comma, a quote or a line break in double quotes, doubling quotes inside it.
- Save as UTF-8 CSV.
```

---

## 2. Product images from a ZIP

Import the products first (they can still be drafts), then upload their images.

### Template structure

One folder per product. **The folder name is the product SKU**, and the images go inside it.

```
ZVM-L-7581/                 ← folder name = product SKU
├── 1.jpg                   ← the image named 1 = featured (main) image
├── 2.jpg                   ← every other image = the rest of the product's images
├── 3.jpg
└── side-view.jpg
```

Zip that folder (`ZVM-L-7581.zip`) and upload it. For several products, put all the SKU
folders in one ZIP.

Only this structure is accepted. If anything in the ZIP breaks a rule, the upload is
blocked, every problem is listed with the folder or file and how to fix it, and nothing is
uploaded until you fix the ZIP and choose it again.

- **Folder name = the exact product SKU.** A slug or title is rejected, with the SKU to use.
- **The image named `1` is the featured image.** It becomes the main product image, also when
  the product already has images. A product with no images yet must have an image named `1`.
- **The other images can have any name.** Numbered images come first in number order
  (`2`, `3`, `4`…), then the rest by name.
- All images sit directly in the SKU folder. No images outside a SKU folder, no ZIP inside the ZIP.
- A ZIP named after the SKU with the SKU folder inside it is fine, and so is one outer wrapper folder.
- **Formats:** JPG, PNG, WEBP, GIF, AVIF, up to 8 MB each. The file must really be that format:
  a renamed or damaged file is rejected.
- **Limit:** 13 images per product, counting the ones it already has unless you replace them.
- `.txt`, `.md`, `.csv` and system files (`.DS_Store`, `Thumbs.db`) are ignored.
- Not supported: password-protected ZIPs, RAR/7z, ZIPs over 4 GB.

Optional, variable products only: a sub-folder inside the SKU folder named with a variation
SKU or one option value (`Black`) saves its images on those variations (up to 8 each).

### Steps

1. Admin → **Products** → **Upload Image ZIP**.
2. Optional: **Folder names CSV** downloads every product with the exact folder name (SKU)
   to use and how many images it already has. Give this file to the AI together with your images.
3. Choose the ZIP. Every file is checked against the structure above. If there are
   problems they are listed and the upload button stays disabled.
4. When the check passes, click **Upload images**. The image named `1` becomes the main image
   and the others are added after the existing ones. Tick **Replace existing images** to
   swap all of them instead.
5. If one image of a product fails while uploading, nothing is saved for that product and
   the row shows why; the other products are still saved.

### Prompt to give the AI (images)

```
I am attaching my product images, zelvomart-image-folders.csv and the template rules
(product-images-template/README.txt). Organise the images into one ZIP.

Rules:
- Create one folder per product. Name it exactly as the folderName column in the CSV (the SKU).
- Put that product's images directly inside its folder.
- Rename the best front-facing image to 1 (keep its extension, e.g. 1.jpg). It is the featured image.
- Rename the other images 2, 3, 4... in the order they should appear.
- Keep the original file format and do not resize or recompress the images.
- Do not create folders for products that have no images.
- List any image you could not assign to a product instead of guessing.
- Return a single ZIP file with no password.
```

---

## Testing checklist

1. Start the app (`START_DEV.bat`, or `npm run dev` in `backend` and `frontend`) and sign in to `/admin`.
2. **Import CSV** → choose `simple-products-template.csv` as it is. One row shows as **New**.
   Click **Add to draft**, then open **Products → Drafts**: "EXAMPLE Matte Lipstick Rose Red" is there.
3. Import `variable-products-template.csv` the same way. The draft "EXAMPLE Cotton T-Shirt"
   has Color and Size attributes and four variations.
4. Import the same file again: the row now shows **Will update**.
5. **Upload Image ZIP** → choose `product-images-template.zip` after replacing the placeholder
   `.txt` files with real images, one of them named `1` in each folder (the folder names already
   match the two example SKUs).
6. Click **Post** on a draft and open `/product/<slug>` on the shop.
7. Delete the two EXAMPLE products when you are done.
