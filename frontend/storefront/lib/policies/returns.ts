import type { PolicyDocument } from "./types";

export const returnsPolicy: PolicyDocument = {
  "slug": "refund_returns",
  "title": "Refund & Return Policy",
  "subtitle": "How refunds, returns, and exchanges work at Zelvomart.",
  "icon": "return",
  "sections": [
    {
      "heading": "Our Promise",
      "body": "We stand behind every order. If your product arrives damaged, incorrect, or different from what you ordered, we will refund, replace, or exchange it.",
      "icon": "heart",
      "tone": "primary"
    },
    {
      "heading": "The Unboxing Video Requirement",
      "body": "To claim a refund or return, you must record a continuous video while opening your package — starting before you open it and continuing until the product is fully unwrapped. This video protects you as much as it protects us; it’s the fastest way for us to confirm a genuine issue and resolve it fairly. Without this video, we may not be able to process a refund or return, so please make it a habit with every order.",
      "icon": "video",
      "tone": "callout"
    },
    {
      "heading": "What's Covered",
      "body": "We offer a refund, replacement, or exchange if the product arrives damaged, you receive the wrong item, or the product is defective. This must be reported within 7 days of delivery.",
      "icon": "check",
      "half": true,
      "tone": "soft"
    },
    {
      "heading": "What's Not Covered",
      "body": "We’re unable to offer a refund or exchange for change-of-mind requests once a product has been delivered, or for claims made without the required unboxing video.",
      "icon": "cross",
      "half": true
    },
    {
      "heading": "How to Request a Refund or Return",
      "body": "Message us on WhatsApp at [+92 300 2026711](https://wa.me/923002026711) within 7 days of delivery, along with your order details and your unboxing video. Our team will review your request and confirm the next steps.",
      "icon": "message"
    },
    {
      "heading": "Refund Timeline",
      "body": "Once your return is approved, refunds are processed within a reasonable timeframe depending on how the refund is being returned to you.",
      "icon": "clock"
    },
    {
      "heading": "Contact Us",
      "body": "Questions about a return or refund? Message us on WhatsApp at [+92 300 2026711](https://wa.me/923002026711) or email [support@zelvomart.com](mailto:support@zelvomart.com).",
      "icon": "mail",
      "tone": "contact"
    }
  ]
};
