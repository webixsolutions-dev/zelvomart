# API-driven analytics additions — 20 October 2026

Added dashboard order-status distribution, daily revenue/orders/average-order-value rankings, selectable channel revenue/orders/visitor comparisons, and product revenue/units/orders/views/cart-addition comparisons. Reuses the dashboard period and existing overview API responses without extra API requests. Product catalog adds image/category/price/draft readiness counts from loaded products.

Every chart includes explicit metric definitions, text values, accessible labels, keyboard selectors and empty states. Rankings show up to eight rows; product comparisons are limited to the API's returned subset of up to 20 products. Campaign visitor totals may count the same visitor across campaigns. These limitations are visible next to the charts. No invented ROI, profit or forecasting metrics.

Validation: TypeScript and diff whitespace checks passed. Browser confirmed populated charts, daily AOV/channel visitors/product units selector changes, and 320px layouts without page overflow. Catalog readiness displayed actual missing-field counts. Existing business records were not changed.
