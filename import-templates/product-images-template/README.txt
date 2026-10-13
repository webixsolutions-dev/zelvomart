ZELVOMART - PRODUCT IMAGE TEMPLATE
==================================

Upload at: Admin > Products > Upload Image ZIP
The product must already exist (a draft is fine). Import the CSV first.

STRUCTURE
---------
One folder per product. The folder name is the product SKU. The images go inside it.

  ZVM-L-7581/                 <- folder name = product SKU
    1.jpg                     <- the image named 1 = FEATURED (main) image
    2.jpg                     <- every other image = the rest of the product's images
    3.jpg
    side-view.jpg

Zip that folder (ZVM-L-7581.zip) and upload it.
For several products, put all the SKU folders in one ZIP:

  product-images.zip
    ZVM-L-7581/
      1.jpg
      2.jpg
    ZVM-EXAMPLE-LIP-001/
      1.jpg
      2.jpg

RULES (only this structure is accepted)
---------------------------------------
If the ZIP breaks any rule, the upload is blocked and every problem is listed with the
folder or file and how to fix it. Nothing is uploaded until the ZIP is fixed.

1. Folder name = the exact product SKU, as shown in the admin.
   A slug or a product title is rejected.
2. Name the featured image 1 (1.jpg, 1.png or 1.webp). It becomes the main product
   image, also when the product already has images.
   A product with no images yet must have an image named 1.
3. The other images can have any name. Numbered images come first in number order
   (2, 3, 4 ...), then the rest by name.
4. All images sit directly in the SKU folder. No images outside a SKU folder and
   no ZIP inside the ZIP. One outer wrapper folder is fine.
5. Formats: JPG, JPEG, PNG, WEBP, GIF, AVIF. Maximum 8 MB per image.
   The file must really be that format; a renamed or damaged file is rejected.
6. Maximum 13 images per product, including the ones it already has unless
   "Replace existing images" is ticked.
7. No password on the ZIP. Normal .zip only (not RAR or 7z). Keep it under 4 GB.
8. .txt, .md and .csv files like this one are ignored.

OPTIONAL - images for one option of a variable product
------------------------------------------------------
Inside the SKU folder of a variable product, add a sub-folder named with a variation
SKU or one option value (for example Black). The images in it are saved on those
variations. Simple products cannot have sub-folders.

The exact folder name for every product is in "Folder names CSV", downloadable from the
Upload Image ZIP window.
