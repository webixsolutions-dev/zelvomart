import type { PolicyDocument } from "./types";

export const shippingPolicy: PolicyDocument = {
  "slug": "shipping-policy",
  "title": "Shipping Policy",
  "subtitle": "Delivery areas, charges, timelines and payment choices.",
  "icon": "truck",
  "sections": [
    {
      "heading": "Delivery Areas",
      "body": "We deliver nationwide across Pakistan, reaching cities and towns through our courier partners.",
      "icon": "pin",
      "tone": "soft"
    },
    {
      "heading": "Order Processing",
      "body": "Once your order is placed, our team confirms it with you by WhatsApp or phone before it’s packed and dispatched. Orders are typically handed to our courier within 24-48 hours of confirmation.",
      "icon": "package",
      "half": true
    },
    {
      "heading": "Delivery Timeline",
      "body": "Delivery usually takes 2-7 working days depending on your location, though this may vary due to courier delays or circumstances beyond our control.",
      "icon": "clock",
      "half": true
    },
    {
      "heading": "Tracking Your Order",
      "body": "We’ll share your order and tracking details on WhatsApp once it has been dispatched, so you know when to expect it.",
      "icon": "truck"
    },
    {
      "heading": "Cash on Delivery",
      "body": "You can choose Cash on Delivery and pay the courier when your parcel arrives. Advance payment is also available when shown at checkout; the payment page explains how to pay from your bank app, Easypaisa or JazzCash.",
      "icon": "cash",
      "tone": "primary"
    },
    {
      "heading": "Contact Us",
      "body": "Questions about your delivery? Message us on WhatsApp at [+92 300 2026711](https://wa.me/923002026711) or email [support@zelvomart.com](mailto:support@zelvomart.com).",
      "icon": "mail",
      "tone": "contact"
    }
  ]
};
