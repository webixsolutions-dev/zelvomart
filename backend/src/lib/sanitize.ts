import sanitizeHtml from "sanitize-html";

export function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption", "video", "source"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height", "loading"],
      video: ["src", "controls", "poster", "preload"],
      source: ["src", "type"],
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // sanitize-html checks schemes only on href/src/cite by default; `poster` would keep a javascript: URL.
    allowedSchemesAppliedToAttributes: ["href", "src", "cite", "poster"],
  });
}
