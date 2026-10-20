# Settings functionality and UI update - 20 October 2026

Implemented locally in the current working tree. No production deployment was performed.

## Settings editor

- Shared modal design with a tinted header, clear field groups, consistent inputs, blurred backdrop and a sticky blue Save button with a matching footer background.
- The footer shows saving, success and error states. Inputs are disabled while saving; modal dismissal waits for the save. Reopening remounts fields from saved values, discarding unsaved edits.
- Store, Delivery, Tracking, Cities and Recovery use the shared save flow. Cities report malformed lines and duplicate names rather than throwing an unhandled error.
- Recovery settings now also expose coupon override, email subject/body and WhatsApp template, so those controls do not require leaving Settings.
- Removed the nonfunctional minimum-selling-price input: no minimum-price enforcement existed, and exposing it as a working control was misleading. This update does not add a new minimum-price business rule.

## Applied behavior

- Settings updates are validated before writing and saved atomically. Empty/masked token inputs preserve saved tokens. Runtime worker/internal keys cannot be written through the Settings form endpoint.
- Active city lists validate integer ranges (1-90) and duplicates. Omitted cities are deactivated without removing historical orders. Checkout refreshes city estimates and continues using the unlisted-city fallback.
- Store contact data flows to server-rendered pages, launch header/footer, contact/policy copy, WhatsApp links and llms.txt. Existing storefront tabs check for changes every 30 seconds and on focus; same-browser saves also signal active tabs immediately. Hidden tabs refresh on return.
- Successful authenticated Settings/Cities writes expire the frontend settings/store/products/cities caches and invalidate the layout. Public settings, bootstrap and settings-dependent product API responses no longer serve stale CDN responses.
- Buy 2 percentage is read from Settings for product responses, server order pricing and coupon validation. Browser cart, cart drawer and checkout use the same configured percentage, including zero. Existing open carts refresh their percentage. Saved historical order totals remain snapshots.
- Browser tracking respects live enable switches. Pixel identifier/enable changes reload an active storefront after detecting new settings so already-loaded vendor scripts do not keep an old configuration. Other setting changes refresh server data. Server event delivery still requires valid credentials and a running worker.
- Replay retention remains an application setting; worker cleanup and the external R2 lifecycle must be configured consistently. This update does not modify Cloudflare lifecycle rules or deploy/start the worker.

## Verification

- Frontend and backend TypeScript checks passed.
- 33 focused regression tests passed, including new settings/city validation and browser/server discount parity tests.
- Browser tested Delivery modal at normal size and 390 x 844 phone viewport. Long Tracking modal retains its visible Save footer and scrollable content.
- Browser save temporarily changed delivery 300 -> 301; successful saved state and backend/public settings response both reflected 301. Restored 300 and confirmed saved state and backend response. Free-delivery threshold remains 10,000.
- Invalid city input `Lahore | 5 | 2` displays an inline error without writing. Existing 15 active cities remain; Lahore minimum remains 2 days.
- Product API still responds successfully with the configured 5% bundle percentage. No real order, coupon or recovery offer was created, and no email/ad test event was sent.
- Saved preview screenshots are in output/admin-settings/.

Earlier admin acceptance also found and fixed an invalid UTF-8 byte in AbandonedCarts that blocked the Customers page. Dashboard/menu and phone Orders/Customers drawers were inspected; that earlier report's login blocker is now resolved. Full real-agent order/customer mutation acceptance and external tracking/email acceptance are separate from these Settings checks.
