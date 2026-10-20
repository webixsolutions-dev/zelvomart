# Catalog admin UI — 20 October 2026

Updated Categories, Tags, Discounts, Coupons, Reviews and Product Tabs with a shared scoped stylesheet: consistent card borders, spacing, page headings, status labels, form controls and responsive layouts. Category dialogs and coupon forms stack on phones. Tag cards use a responsive grid and independently scroll long product lists. Product tab editor controls wrap on small screens. Tables retain their horizontal layout and internal scrolling.

Validation: frontend TypeScript check passed. Browser checked all six routes at 320px and 1280px; category dialog and coupon form opened and dismissed without saving. No page-level horizontal overflow observed. Product tab editor inspected at both widths. Business data was not modified.
