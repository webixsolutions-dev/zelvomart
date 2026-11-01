import sanitizeHtml from "sanitize-html";

/** Keep product editor formatting while stripping scripts and unsafe attributes. */
export function sanitizeDescriptionHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "figure", "figcaption", "video", "source"],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["style"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      video: ["src", "controls", "poster", "preload"],
      source: ["src", "type"],
    },
    allowedStyles: { "*": { "text-align": [/^(left|center|right|justify)$/] } },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // sanitize-html checks schemes only on href/src/cite by default; `poster` would keep a javascript: URL.
    allowedSchemesAppliedToAttributes: ["href", "src", "cite", "poster"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }) },
  });
}
