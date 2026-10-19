# Admin UI follow-up - 20 October 2026

Scope requested: Admin menu, Dashboard, Orders, Customers and Coupons; finish browser/phone acceptance and fix discovered issues.

## Applied locally

- Fixed MARKETER landing navigation: `/admin/reports` redirects to `/admin`, so the shell's former MARKETER redirect to Reports caused a loop. The shell now directs that role to its permitted Products page without expanding permissions.
- Replaced Orders quick view and Customer details overlays with a shared native modal drawer. Browser modal behavior traps keyboard focus; Escape and backdrop clicks close it; background body scrolling is locked; the header/close button stays visible while drawer content scrolls; phone height uses `100dvh` with safe-area padding.
- Enabled-but-unconfigured server tracking is now red in the Dashboard health panel. Disabled platforms and no-order states retain amber.
- Coupon percentage input enforces 1 through 100 in the form; fixed amounts allow positive PKR decimals. Changing discount type updates validation. Save-in-flight blocks switching/cancelling editors. Added explicit no-coupon state and named Edit buttons.

## Verified

- Frontend `tsc --noEmit --incremental false`: passed after these changes.
- Admin, tracking, launch, error and mocked email suites: 30 passed, 0 failed.
- `git diff --check`: passed (existing line-ending warnings only).

## Browser acceptance status

Authenticated browser acceptance completed using the owner admin account:

- **Navigation**: 14 menu links loaded, sidebar collapses/expands properly on mobile viewport (390px), no horizontal overflow.
- **Dashboard**: All panels, KPIs, charts, and tracking health indicators render cleanly. Server tracking indicators correctly flag unconfigured endpoints.
- **Orders**: Status filtering, search, and quick-view drawer tested. Drawer traps keyboard focus, closes on Escape/backdrop click, and restores previous focus.
- **Customers**: Search, pagination, details drawer, and merged Abandoned Carts tab render cleanly at 390px mobile viewport without overflow. Encoding issue in `AbandonedCarts.tsx` resolved.
- **Coupons**: Responsive form verified. Percentage validation enforces 1–100%, fixed amount allows PKR decimals, and form controls disable during saving.

