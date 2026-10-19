# Email setup

Order received and status emails: orders@zelvomart.com.
Recovery offers: offers@zelvomart.com.
Replies: support@zelvomart.com.
Contact requests: support@zelvomart.com; Reply goes to the customer.
Saved notifications.orderRecipients override ORDER_ALERT_RECIPIENTS; fallback is support@zelvomart.com.

Default recovery discount is 5%, editable under Settings > Recovery offers. Offers can be disabled there. Custom coupons in Customers > Abandoned carts > Templates override the percentage. Each generated code is single-use, valid for 24 hours from first draft (or parent expiry if sooner). Settings changes affect newly generated codes only. No automatic bulk sending has been enabled.

Resend is the existing delivery provider. Configure RESEND_API_KEY in backend and worker environment, verify the sending domain, and run the existing background worker before real delivery. Keep Hostinger MX records for incoming mail. No live DNS changes or real emails were sent during implementation. Never put credentials in chat.

Optional environment overrides: ORDERS_EMAIL_FROM, OFFERS_EMAIL_FROM, SUPPORT_EMAIL_FROM, EMAIL_REPLY_TO, SUPPORT_EMAIL_TO, ORDER_ALERT_RECIPIENTS. EMAIL_FROM remains a legacy fallback for order sending only.

Customers without email are skipped without blocking checkout. Stable provider idempotency keys protect order-email retries. Provider rejection fails the job; provider acknowledgement does not prove inbox delivery.

Validation: frontend/backend TypeScript checks, mocked provider tests, discount validation and 24-hour expiry checks passed. Live domain, active worker and actual inbox delivery remain unverified pending configuration.
