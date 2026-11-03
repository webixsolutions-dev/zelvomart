import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

test("the generated sanitizer runs when the host cannot require ESM dependencies", () => {
  const script = `
    const sanitize = require(process.argv[1]);
    const html = sanitize('<script>alert(1)</script><p onclick="bad()">Safe</p>', {
      allowedTags: ['p'], allowedAttributes: {}
    });
    process.stdout.write(html);
  `;

  for (const folder of ["src/generated", "dist/src/generated"]) {
    const result = spawnSync(
      process.execPath,
      ["--no-experimental-require-module", "-e", script, resolve(__dirname, "..", folder, "sanitize-html.cjs")],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "<p>Safe</p>");
  }
});
