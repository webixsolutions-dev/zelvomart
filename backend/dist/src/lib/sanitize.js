"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanHtml = cleanHtml;
const sanitize_html_1 = __importDefault(require("sanitize-html"));
function cleanHtml(html) {
    return (0, sanitize_html_1.default)(html, {
        allowedTags: sanitize_html_1.default.defaults.allowedTags.concat(["img", "figure", "figcaption", "video", "source"]),
        allowedAttributes: {
            ...sanitize_html_1.default.defaults.allowedAttributes,
            img: ["src", "alt", "width", "height", "loading"],
            video: ["src", "controls", "poster", "preload"],
            source: ["src", "type"],
            a: ["href", "target", "rel"],
        },
        allowedSchemes: ["http", "https", "mailto", "tel"],
    });
}
