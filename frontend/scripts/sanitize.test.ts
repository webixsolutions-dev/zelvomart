import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeDescriptionHtml } from "../storefront/lib/sanitize-description";

const BAD = ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox(1)"];

test("storefront: unsafe URL schemes are removed from href, src and video poster", () => {
  for (const url of BAD) {
    const out = sanitizeDescriptionHtml(
      `<a href="${url}">x</a><img src="${url}"><video src="${url}" poster="${url}"></video><video><source src="${url}"></video>`,
    );
    assert.ok(!/javascript:|vbscript:|data:/i.test(out), `${url} survived: ${out}`);
  }
});

test("storefront: http, https, mailto and tel survive", () => {
  const out = sanitizeDescriptionHtml(
    '<a href="https://zelvomart.com/">a</a><a href="http://x.pk/">b</a><a href="mailto:hi@zelvomart.com">c</a>' +
      '<a href="tel:+923001234567">d</a><video src="https://cdn.example/v.mp4" poster="https://cdn.example/p.jpg"></video>',
  );
  for (const keep of ["https://zelvomart.com/", "http://x.pk/", "mailto:hi@zelvomart.com", "tel:+923001234567"])
    assert.ok(out.includes(keep), keep);
  assert.ok(out.includes('poster="https://cdn.example/p.jpg"'));
});

test("storefront: malformed HTML gives no script tags or event handlers", () => {
  const out = sanitizeDescriptionHtml(
    '<p onclick="x()" style="text-align:center;background:url(javascript:x)">a<script>alert(1)</script><img src=x onerror=alert(1)><svg onload=alert(1)><a href="javas&#99;ript:alert(1)">z</a>',
  );
  assert.ok(!/<script|onerror|onload|onclick|javascript:/i.test(out), out);
});
