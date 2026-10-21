import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { launchRedirect } from "../../frontend/lib/launch/redirects";

// Read-only. Export WordPress's sitemap first, then check it against the local/preview site.
async function main() {
  const input = process.argv.find((arg) => arg.startsWith("--input="))?.slice(8) || "migration/wordpress-urls.json";
  const base = process.env.LAUNCH_CHECK_URL || "http://localhost:3000";
  const data = JSON.parse(await readFile(input, "utf8")) as { urls: string[] };
  const results = [];
  for (const old of data.urls) {
    const source = new URL(old),
      url = new URL(source.pathname + source.search, base);
    try {
      const first = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30000) });
      const location = first.headers.get("location");
      let status = first.status,
        ok = status === 200;
      const expected = launchRedirect(source.pathname);
      if (status === 301 && location) {
        const target = new URL(location, url);
        if (target.origin !== new URL(base).origin) throw new Error("Redirect leaves the preview site.");
        if (expected && target.pathname.replace(/\/+$/, "") !== expected)
          throw new Error("Redirect destination does not match the launch map.");
        const final = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(30000) });
        status = final.status;
        ok = status === 200;
      }
      results.push({ path: source.pathname, firstStatus: first.status, location, finalStatus: status, ok });
    } catch (error) {
      results.push({
        path: source.pathname,
        ok: false,
        error: error instanceof Error ? error.message : "Request failed",
      });
    }
  }
  await mkdir("migration", { recursive: true });
  await writeFile(path.join("migration", "launch-url-results.json"), JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify({
      checked: results.length,
      passed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      report: "migration/launch-url-results.json",
    }),
  );
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
