# Professional public pages update

Updated Shop, Blog, About Us and Contact Us to share the same premium storefront system.

## What changed
- Shop: premium two-tone hero, trust strip, cleaner browse/filter hierarchy and existing dynamic product/category pagination preserved.
- Blog: premium journal layout using the existing dynamic CMS page content plus editorial topic cards.
- About Us: premium story layout using the existing dynamic CMS page content plus a values section.
- Contact Us: premium support layout with dynamic CMS content and a working contact form for name, email, phone number and problem/message.
- Contact form submits through the Next.js `/api/contact` proxy to the Express backend `/api/contact` endpoint.
- Backend contact submissions are emailed to the existing notification recipients using Resend. Existing `RESEND_API_KEY` / `EMAIL_FROM` configuration is reused.
- Public-page motion selectors were extended to the new cards/forms; admin remains untouched.

## Preserved
Products, categories, admin, checkout, orders, SEO metadata, CRO, Meta attribution and session replay behavior were not removed.
