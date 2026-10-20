# Shared admin table update

Applied the user's requested professional row/table layout across the shared AdminTable component.

- Normal rows and columns are preserved at all screen widths, with horizontal row dividers, subtle alternating backgrounds and row hover feedback.
- Content-aware minimum column widths replace the fixed table layout that squeezed customer names and phone numbers into individual letters.
- Wide tables scroll inside a bordered region; the whole page remains constrained to the viewport. A visible scrollbar and labelled left/right buttons support mouse, keyboard and phone use.
- Primary identifiers stay visible while scrolling on larger table panels. Sticky columns are disabled on narrow panels so they do not obscure the remaining data.
- Column visibility preferences remain supported; hiding a column also reduces the table's minimum width.
- Orders quick view now has an SVG eye plus a readable View label and a 44px phone touch target. The adjacent actions menu has a distinct control.
- All operational admin tables already use this shared component. The two standalone invoice/bulk-print tables additionally received screen-only scroll wrappers; printed documents retain normal table flow.

Verification: frontend TypeScript and git diff whitespace checks passed. Browser checked Orders at 1137px, 390px and 320px; Customers and Products at 320px. In each measured small-screen view the document width equals the viewport while the table retains readable columns within its scroll region. The View button opened the correct order quick-view modal. No business data was changed.

The original intermediate card layout was superseded by the user's clarification to retain horizontal professional tables. Browser refresh may be needed to discard old development CSS loaded before the change.
