ZELVOMART - PRODUCT IMAGE TEMPLATE
==================================

Upload at: Admin > Products > Bulk Image Upload
The product must already exist (a draft is fine). Import the CSV first.

Images are matched to products by NAME: the product title, or its slug or SKU.
The system never guesses. A name that matches no product, or more than one, is
listed as "Unassigned" and you pick the product by hand. Nothing is uploaded
until you click Confirm.

THREE WAYS TO NAME THE IMAGES
-----------------------------
1. One ZIP per product, named like the product. Inside, the images can be 1, 2, 3...

     EXAMPLE Cotton T-Shirt.zip
       1.webp                  <- main image
       2.webp

2. One ZIP with a folder per product, named like the product:

     product-images.zip
       EXAMPLE Matte Lipstick Rose Red/   <- simple product
         1.jpg                            <- main image
         2.jpg
         3.png
       EXAMPLE Cotton T-Shirt/            <- variable product, same layout
         1.webp
         2.webp

3. Loose image files (Image folder option) named with the product name:

     EXAMPLE Cotton T-Shirt.jpg
     EXAMPLE Cotton T-Shirt-1.jpg
     EXAMPLE Cotton T-Shirt-front.webp

RULES
-----
1. Names are compared exactly, ignoring case, spaces, punctuation and "&" vs "and".
   Title first, then slug, then SKU. A SKU or slug as the folder name also works.
2. Main image: the file numbered 1, then 2, 3 and so on. Without numbers, the first
   file in name order is the main image. You can change it later in the admin.
3. No sub-folders. A variable product's images belong to the product and show for
   every variation. Set a variation's own images by hand in the product form.
4. Formats: JPG, JPEG, PNG, WEBP, GIF. Images are converted to WEBP in the browser
   (longest side 1200 px). GIFs upload as they are. Maximum 4 MB per image after
   conversion.
5. Existing product images are kept. Maximum 13 images per product.
6. The same image uploaded again is skipped as a duplicate.
7. The ZIP holds images only. Alt text and image title come from the CSV
   (imageAlt, imageTitle) and apply to every image of the product.
8. No password on the ZIP. Normal .zip only (not RAR or 7z).
9. .txt, .md and .csv files like this one are ignored.

The exact product names are in "Download product names CSV", in the Bulk Image
Upload window.
