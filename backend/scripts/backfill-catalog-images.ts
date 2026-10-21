import "dotenv/config";
import { prisma } from "../src/lib/db";
import { catalogImageCopies, imageCopyKey, saveCatalogImage } from "../src/lib/catalog-images";
async function main() {
  const products = await prisma.product.findMany({
    select: { images: true, variants: { select: { imageUrl: true } } },
  });
  const urls = new Set<string>();
  for (const p of products) {
    if (Array.isArray(p.images)) for (const value of p.images) if (typeof value === "string") urls.add(value);
    for (const v of p.variants) if (v.imageUrl) urls.add(v.imageUrl);
  }
  const copies = await catalogImageCopies();
  let needed = 0,
    created = 0,
    skipped = 0;
  for (const url of urls) {
    if (/\.(jpe?g|png)(\?|$)/i.test(url) || copies[imageCopyKey(url)]) continue;
    needed++;
    if (!process.argv.includes("--apply")) continue;
    try {
      const source = new URL(url);
      const own = new URL(process.env.S3_PUBLIC_BASE_URL || "https://invalid.local");
      if (source.origin !== own.origin) {
        skipped++;
        continue;
      }
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 20 * 1024 * 1024) throw new Error("Image too large");
      await saveCatalogImage(url, bytes);
      created++;
    } catch (error) {
      skipped++;
      console.error("Image copy failed:", error instanceof Error ? error.message : "Unknown error");
    }
  }
  console.log(
    JSON.stringify({ images: urls.size, needed, created, skipped, dryRun: !process.argv.includes("--apply") }),
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
