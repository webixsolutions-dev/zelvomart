# Admin brief implementation - 18 October 2026

Source: Zelvomart Admin Panel Changes Developer Brief-2.pdf (21 pages).

## Implemented

- Fixed checkout requirements: name, Pakistani mobile, city, address and the existing
  terms checkbox. Email, notes and postcode are not required. The settings row no
  longer controls checkout validation.
- Settings now has Store, Delivery, Tracking & Feeds, and Cities & estimates.
  Saved notification recipients/templates remain intact. No new COD fees are charged;
  historical order COD fees remain available. Free delivery applies at or above the
  configured threshold, before coupons. Header, FAQ, trust strip, cart and checkout
  use the delivery policy; mounted storefront pages refresh it every 45 seconds.
- City saves reject missing/invalid days. Unlisted cities use 2-7 working days in
  checkout, order confirmation and tracking.
- Fourteen sidebar links, retaining existing role limits. Reports, CRO and Marketing
  pages redirect to Dashboard; Tracking and Jobs remain detail pages. Experiments
  no longer run or expose public experiment endpoints; historical data is retained.
- Dashboard has independently loaded KPI, sales/status, funnel, source/campaign,
  product, recovery, health and CRO panels, plus connected Meta ad data. SQL aggregation
  replaces large browser-event downloads for these new panels. Date presets/custom
  periods and equal previous-period comparisons are supported; test/staff orders
  are excluded. Funnel links pass the selected dates and matching drop-off filters.
- Orders have native status tabs/counts, replay/repeat filters, flags, phone actions,
  quick view, bulk print/export/status actions and responsive shared tables. Detail
  edits validate customer/items, recalculate totals and inventory transactionally,
  audit changes and write timeline entries. Private staff notes, customer history,
  attribution/replay, Purchase acceptance/resend and adjacent-order links are included.
  Cancellation/reopening and edits share a lock, releasing/re-reserving stock once.
- Customers includes Abandoned carts. Customer drawers show orders, saved carts,
  private notes and blocklist controls. Recovery templates are editable. Valid phone
  OR email saves a cart; authenticated account carts use their verified account email.
  Offers wait one hour, skip converted/lost/unsubscribed carts, and reserve one email
  send per cart. WhatsApp opens a draft for the agent to send. Restore tokens expire
  after 30 days and return current product data, not personal contact details.
- Coupons support case-insensitive codes, percent/fixed discounts, PKR amounts,
  expiry through 23:59:59 Pakistan time, on/off, usage/revenue, checkout application,
  server revalidation, invoice/email lines, and final discounted Purchase value.
  NEXT15 (15%) and ENGR-RAFIA (5%) were seeded without overwriting existing codes.

## Database and validation

Applied only the additive SQL in `202610180003_admin_brief` to the configured database
using `scripts/apply-admin-brief.ts`. The existing database has no Prisma migration
baseline; no reset, db push or broad schema synchronization was performed. Do not
run migrate deploy against it without first resolving its historical baseline.

Frontend/backend type checks and 21 focused regressions passed. The isolated live
API check passed all nine Dashboard endpoints, coupon validation, an order with no
email/postcode, item edits/stock rollback, private notes, cancellation/reopening,
customer history, filters, city validation and converted-cart contact restrictions.
All fixture records were removed. No email/ad jobs were dispatched by the test.
An earlier attempt hit an intermittent Supabase connection close; the subsequent
complete checks passed. No full build was run.

## Rollout and remaining choices

- Deploy the frontend and backend to publish the code changes. The configured
  database schema has already been updated additively.
- Choose the default recovery coupon in Customers > Abandoned carts > Templates.
  It remains blank, so offers cannot be sent accidentally with an invented offer.
  Expiry comes from the selected coupon rather than an invented duration.
- The always-on worker host setup from the tracking brief remains outstanding.
  Team emails and queued platform events require that worker. Actual email delivery
  and Meta ad account credentials were not tested by sending external messages.
- PostEx API booking and automated cart follow-ups remain later work, as specified
  in the brief; manual tracking entry and agent-triggered recovery are implemented.
- Approximate IP geolocation and Google account sign-in are not part of this brief;
  visitor identity is not inferred from unrelated Google login sessions.
