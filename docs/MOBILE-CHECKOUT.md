# Mobile checkout changes

New page destinations open at the header immediately. Browser history and in-page anchors retain their normal behaviour. Cart and checkout use a mobile total/action bar with an expandable order summary; the normal page summary and action remain available. Delivery details and payment are separately editable, collapsible steps.

## Pakistani delivery locations

`frontend/storefront/data/pakistan-cities.json` contains all 873 unique locations from the owner's PostEx coverage spreadsheet supplied on 6 November 2026. The checkout searches names and PostEx short codes. Customers may type a city or address without choosing a suggestion; the list is not a restriction on checkout.

The Mumbai database was updated with these 873 active locations, preserving existing delivery estimates. The repeatable import, run from the repository root with the intended database configured, is:

```sh
node --import tsx backend/scripts/import-postex-cities.ts
```

Address suggestions use Photon/OpenStreetMap, restricted to Pakistan and the selected city. They search the area or street text and preserve the customer's house/flat prefix when selected. Requests are debounced, limited, timed out, and cached; a failed lookup leaves manual entry available. Coverage varies with map data. `ADDRESS_SUGGESTIONS_URL` can point the backend at a compatible dedicated Photon service if traffic outgrows the public service. No API key is needed for the default service.

## Payments and email

COD remains the default. Advance payments use the existing merchant configuration and server-calculated saving. The first unpaid reminder is set to 60 minutes in Mumbai and in the code defaults. Existing cron/sweep scheduling still determines the exact delivery time. Reminder emails offer separate payment and COD links. The COD link opens a confirmation card; visiting the link alone does not change the order or remove its saving.

The refund policy and staff refund suggestions now return the full received amount for customer cancellation before dispatch. After dispatch, applicable courier charges can be deducted. Suggestions use status history so a cancelled order that was previously dispatched is treated correctly; staff can adjust the amount to the actual courier charges.

Customer emails share a responsive branded layout with the existing site icon. Gmail's sender avatar is controlled outside message HTML. Enabling it requires an eligible BIMI certificate/logo and a reviewed DMARC enforcement rollout. Existing DNS was left unchanged; the current monitoring-only DMARC record must not be replaced without checking all legitimate senders.

## Release

Deploy both frontend and backend from this change to the existing Zelvomart projects. No schema migration is required. Use the Mumbai Supabase project; the previous database was not changed. The owning Vercel account must be connected for deployment inspection and live verification.

Local browser verification covers 320, 375, 390, 430, 768 and 1280px widths, summary-sheet dismissal/focus restoration, footer alignment, navigation from deep pages, address suggestions, COD checkout, advance checkout and the explicit COD switch. Test orders were created only in an isolated temporary database.
