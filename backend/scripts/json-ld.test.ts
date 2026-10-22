import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { jsonLd } from "../../frontend/lib/json-ld";

test("structured data cannot break out of its script and preserves the original content", () => {
  const title = '</script><img src=x onerror="alert(1)"><script>悪意 & <test>';
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description: "Line one\nLine two < 3",
    nested: [{ name: "</ScRiPt><script>alert(2)</script>" }],
  };
  const serialized = jsonLd(data);
  assert.equal(serialized.includes("<"), false);
  assert.deepEqual(JSON.parse(serialized), data);
  const html = renderToStaticMarkup(
    createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: serialized } }),
  );
  assert.equal((html.match(/<script/g) || []).length, 1);
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  assert.equal(html.includes("<img"), false);
  assert.deepEqual(JSON.parse(html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"))), data);
});
