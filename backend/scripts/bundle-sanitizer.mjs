import { build } from "esbuild";
import { createRequire } from "node:module";
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = new URL("../src/generated/sanitize-html.cjs", import.meta.url);
const compiled = new URL("../dist/src/generated/sanitize-html.cjs", import.meta.url);

// Vercel's CommonJS loader cannot require htmlparser2's ESM entry. Bundle the
// current patched sanitizer and its parser together, retaining their versions.
await build({
  entryPoints: [require.resolve("sanitize-html")],
  outfile: fileURLToPath(source),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  legalComments: "eof",
});

// Plain Node deployments use tsc's output, while Vercel traces the source tree.
await mkdir(new URL("./", compiled), { recursive: true });
await copyFile(source, compiled);
