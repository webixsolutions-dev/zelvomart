# CSV column reference

Generated from `backend/src/lib/product-import.ts`. Do not edit by hand.

## simple-products-template.csv

| Column | Required | What goes in it |
|---|---|---|
| `type` | yes | simple \| variable \| variation. A variation row belongs to the variable product named in parentSku. |
| `title` | yes | Product name. Leave blank on variation rows. |
| `slug` |  | URL slug. Blank = generated from the title. |
| `sku` | yes | Unique SKU. An existing SKU updates that product; a new SKU creates one. Variation rows: blank = PARENTSKU-V1, -V2... |
| `category` |  | Category name or slug. Created automatically when it does not exist. |
| `categorySlug` |  | Category slug. Blank = generated from the category name. |
| `categoryDescription` |  | Category description. |
| `categoryImageUrl` |  | Category image URL. |
| `categorySortOrder` |  | Category sort order (number, lower shows first). |
| `categorySeoTitle` |  | Category SEO title. |
| `categorySeoDescription` |  | Category SEO description. |
| `brand` |  | Brand name. |
| `regularPrice` | yes | Regular price in Rs, digits only. Variable parents: leave blank, each variation row carries its own price. |
| `salePrice` |  | Sale price in Rs. Must be lower than regularPrice. |
| `costPrice` |  | Your cost price in Rs (never shown to customers). |
| `saleFrom` |  | Sale start date, YYYY-MM-DD. |
| `saleTo` |  | Sale end date, YYYY-MM-DD. |
| `trackStock` |  | yes \| no. Default yes. |
| `stock` |  | Stock quantity. Variable parents: leave blank, the variation quantities are added up. |
| `stockStatus` |  | instock \| outofstock \| onbackorder. Blank = instock when stock is above 0. |
| `weight` |  | Weight (lbs). |
| `length` |  | Length (in). |
| `width` |  | Width (in). |
| `height` |  | Height (in). |
| `shippingClass` |  | Blank or shipping-charges. |
| `freeShipping` |  | yes \| no. Default no. |
| `shortDescription` |  | Short description shown beside the price. Plain text or HTML. |
| `descriptionHtml` |  | Full description in HTML (<p>, <h2>, <ul><li>...). |
| `imageUrls` |  | Image URLs separated by \|. First one is the main image. Leave blank when you upload images with the image ZIP. |
| `imageAlt` |  | Alt text for the product image. Blank = product title. |
| `imageTitle` |  | Image title. |
| `videoUrl` |  | Product video URL. |
| `tags` |  | Tags separated by \|. Allowed: customer-favourite \| best-selling \| new-arrival \| 15-off \| 20-off \| 30-off. |
| `badge` |  | Custom badge text shown on the product image. |
| `featured` |  | yes \| no. Featured on the homepage. |
| `bundleEnabled` |  | yes \| no. Buy-two discount. Default yes. |
| `deliveryDays` |  | Delivery days shown on the product page. Default 3. |
| `deliveryNote` |  | Delivery note. Default: Delivered across Pakistan. |
| `purchaseNote` |  | Purchase note. |
| `menuOrder` |  | Menu order (number). |
| `focusKeyword` |  | SEO focus keyword. |
| `seoTitle` |  | SEO title. |
| `seoDescription` |  | SEO meta description. |
| `canonicalUrl` |  | Canonical URL. |
| `redirectFallback` |  | yes \| no. Send visitors to /shop while the product is not posted. Default yes. |
| `redirectUrl` |  | Custom redirect URL for this product page. |
| `tabWhyChoose` |  | HTML that replaces the global 'Why Choose Zelvomart' tab for this product. Blank = global tab. |
| `tabShippingProcess` |  | HTML that replaces the global 'Shipping Process' tab. Blank = global tab. |
| `tabGeneralFaq` |  | HTML that replaces the global 'General FAQ' tab. Blank = global tab. |

## variable-products-template.csv

Same columns as the simple template plus the variation columns. One `variable` row
describes the product; one `variation` row per option combination follows it.

| Column | Required | What goes in it |
|---|---|---|
| `type` | yes | simple \| variable \| variation. A variation row belongs to the variable product named in parentSku. |
| `parentSku` |  | Variation rows only: the SKU of the variable product this variation belongs to. |
| `title` | yes | Product name. Leave blank on variation rows. |
| `slug` |  | URL slug. Blank = generated from the title. |
| `sku` | yes | Unique SKU. An existing SKU updates that product; a new SKU creates one. Variation rows: blank = PARENTSKU-V1, -V2... |
| `category` |  | Category name or slug. Created automatically when it does not exist. |
| `categorySlug` |  | Category slug. Blank = generated from the category name. |
| `categoryDescription` |  | Category description. |
| `categoryImageUrl` |  | Category image URL. |
| `categorySortOrder` |  | Category sort order (number, lower shows first). |
| `categorySeoTitle` |  | Category SEO title. |
| `categorySeoDescription` |  | Category SEO description. |
| `brand` |  | Brand name. |
| `regularPrice` | yes | Regular price in Rs, digits only. Variable parents: leave blank, each variation row carries its own price. |
| `salePrice` |  | Sale price in Rs. Must be lower than regularPrice. |
| `costPrice` |  | Your cost price in Rs (never shown to customers). |
| `saleFrom` |  | Sale start date, YYYY-MM-DD. |
| `saleTo` |  | Sale end date, YYYY-MM-DD. |
| `trackStock` |  | yes \| no. Default yes. |
| `stock` |  | Stock quantity. Variable parents: leave blank, the variation quantities are added up. |
| `stockStatus` |  | instock \| outofstock \| onbackorder. Blank = instock when stock is above 0. |
| `weight` |  | Weight (lbs). |
| `length` |  | Length (in). |
| `width` |  | Width (in). |
| `height` |  | Height (in). |
| `shippingClass` |  | Blank or shipping-charges. |
| `freeShipping` |  | yes \| no. Default no. |
| `shortDescription` |  | Short description shown beside the price. Plain text or HTML. |
| `descriptionHtml` |  | Full description in HTML (<p>, <h2>, <ul><li>...). |
| `imageUrls` |  | Image URLs separated by \|. First one is the main image. Leave blank when you upload images with the image ZIP. |
| `imageAlt` |  | Alt text for the product image. Blank = product title. |
| `imageTitle` |  | Image title. |
| `videoUrl` |  | Product video URL. |
| `tags` |  | Tags separated by \|. Allowed: customer-favourite \| best-selling \| new-arrival \| 15-off \| 20-off \| 30-off. |
| `badge` |  | Custom badge text shown on the product image. |
| `featured` |  | yes \| no. Featured on the homepage. |
| `bundleEnabled` |  | yes \| no. Buy-two discount. Default yes. |
| `deliveryDays` |  | Delivery days shown on the product page. Default 3. |
| `deliveryNote` |  | Delivery note. Default: Delivered across Pakistan. |
| `purchaseNote` |  | Purchase note. |
| `menuOrder` |  | Menu order (number). |
| `focusKeyword` |  | SEO focus keyword. |
| `seoTitle` |  | SEO title. |
| `seoDescription` |  | SEO meta description. |
| `canonicalUrl` |  | Canonical URL. |
| `redirectFallback` |  | yes \| no. Send visitors to /shop while the product is not posted. Default yes. |
| `redirectUrl` |  | Custom redirect URL for this product page. |
| `tabWhyChoose` |  | HTML that replaces the global 'Why Choose Zelvomart' tab for this product. Blank = global tab. |
| `tabShippingProcess` |  | HTML that replaces the global 'Shipping Process' tab. Blank = global tab. |
| `tabGeneralFaq` |  | HTML that replaces the global 'General FAQ' tab. Blank = global tab. |
| `attribute1Name` |  | First option name, e.g. Color. Set it on the variable row. |
| `attribute1Values` |  | Variable row: every value separated by \| (Black \| White). Variation row: the one value of that variation (Black). |
| `attribute2Name` |  | Second option name, e.g. Size. Optional. |
| `attribute2Values` |  | Same rule as attribute1Values. |
| `attribute3Name` |  | Third option name. Optional. |
| `attribute3Values` |  | Same rule as attribute1Values. |
| `gtin` |  | Variation rows: GTIN / barcode. |
| `variationEnabled` |  | Variation rows: yes \| no. Default yes. |
| `swatchesEnabled` |  | Variable row: yes \| no. Default yes. |
| `swatchShape` |  | Variable row: circle \| square. Default circle. |
| `swatchSize` |  | Variable row: small \| medium \| large. Default medium. |
