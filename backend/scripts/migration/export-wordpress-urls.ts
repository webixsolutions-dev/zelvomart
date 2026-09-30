import fs from "node:fs/promises";
import path from "node:path";

const source = (process.env.SOURCE_STORE_URL || "https://zelvomart.com").replace(/\/$/, "");
const start = process.env.WP_SITEMAP_URL || `${source}/sitemap_index.xml`;
const outDir = path.resolve(process.cwd(), "migration");

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function locs(xml: string) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => decodeXml(match[1].trim()));
}

async function fetchXml(url: string) {
  const response = await fetch(url, { headers: { "user-agent": "ZelvomartMigration/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function collect(url: string, seen = new Set<string>()): Promise<string[]> {
  if (seen.has(url)) return [];
  seen.add(url);
  const xml = await fetchXml(url);
  const found = locs(xml);
  if (/<sitemapindex[\s>]/i.test(xml)) {
    const nested = await Promise.all(found.map((item) => collect(item, seen)));
    return nested.flat();
  }
  return found;
}

async function main() {
  const urls = [...new Set(await collect(start))].sort();
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "wordpress-urls.json"), JSON.stringify({ source, exportedAt: new Date().toISOString(), urls }, null, 2));
  await fs.writeFile(path.join(outDir, "wordpress-urls.csv"), `url\n${urls.map((url) => `"${url.replace(/"/g, '""')}"`).join("\n")}\n`);
  console.log(`Exported ${urls.length} WordPress URLs to migration/wordpress-urls.json and .csv`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
