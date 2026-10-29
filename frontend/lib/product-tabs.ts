export const PRODUCT_TAB_DEFS = [
  {
    key: "whyChoose",
    title: "Why Choose Zelvomart",
    content:
      "<p><strong>Cash on Delivery</strong> — Pay only when your order arrives at your door.</p><p><strong>Quality Checked</strong> — Every product is inspected before dispatch.</p><p><strong>Nationwide Delivery</strong> — We reach cities across Pakistan.</p><p><strong>Real Support</strong> — Message us on WhatsApp and talk to a real person.</p>",
  },
  {
    key: "shippingProcess",
    title: "Shipping Process",
    content:
      "<p><strong>Order confirmation.</strong> We verify the order by call or WhatsApp before it leaves.</p><p><strong>Dispatch.</strong> Parcels are handed to our delivery partners and packed for the journey.</p><p><strong>Timeline.</strong> Major cities usually take 2–4 working days. Other cities usually take 3–5 working days.</p><p><strong>Delivery charge.</strong> {delivery_fee} per order. The whole order ships free when the total is above {free_delivery_over}. Products with free shipping turned on ship free on their own.</p>",
  },
  {
    key: "generalFaq",
    title: "General FAQ",
    content:
      "<p><strong>Can I check the product before paying?</strong><br/>Riders in major cities can let you inspect the parcel. We also offer a 7-day replacement window.</p><p><strong>What if I receive a damaged product?</strong><br/>Share photos on WhatsApp within 7 days and we will arrange a replacement.</p><p><strong>When is shipping free?</strong><br/>Shipping is free on an order above {free_delivery_over}, and on any product whose free-shipping option is turned on. Otherwise delivery is {delivery_fee}.</p>",
  },
] as const;

export type ProductTabKey = (typeof PRODUCT_TAB_DEFS)[number]["key"];

export type ResolvedProductTab = {
  key: ProductTabKey;
  title: string;
  html: string;
  overridden: boolean;
};

export type ProductTabCopy = { title: string; content: string };
export type ProductTabOverride = { override: boolean; content: string };

export function defaultProductTabs() {
  return Object.fromEntries(PRODUCT_TAB_DEFS.map((tab) => [tab.key, { title: tab.title, content: tab.content }])) as Record<
    ProductTabKey,
    ProductTabCopy
  >;
}

export function mergeGlobalProductTabs(saved: Record<string, Partial<ProductTabCopy>> | null | undefined) {
  const defaults = defaultProductTabs();
  return Object.fromEntries(
    PRODUCT_TAB_DEFS.map((tab) => [
      tab.key,
      {
        title: String(saved?.[tab.key]?.title || defaults[tab.key].title),
        // A section saved empty stays empty (the product page hides it); a section never saved shows the default.
        content: typeof saved?.[tab.key]?.content === "string" ? String(saved[tab.key]!.content) : defaults[tab.key].content,
      },
    ]),
  ) as Record<ProductTabKey, ProductTabCopy>;
}

export function readProductTabOverrides(catalogMeta: unknown): Record<ProductTabKey, ProductTabOverride> {
  const source =
    catalogMeta && typeof catalogMeta === "object" && (catalogMeta as any).productTabs
      ? ((catalogMeta as any).productTabs as Record<string, any>)
      : {};

  return Object.fromEntries(
    PRODUCT_TAB_DEFS.map((tab) => [
      tab.key,
      {
        override: Boolean(source[tab.key]?.override),
        content: typeof source[tab.key]?.content === "string" ? source[tab.key].content : "",
      },
    ]),
  ) as Record<ProductTabKey, ProductTabOverride>;
}

export function resolveProductTabs(globalValue: unknown, catalogMeta: unknown): ResolvedProductTab[] {
  const globalTabs = mergeGlobalProductTabs(globalValue && typeof globalValue === "object" ? (globalValue as Record<string, Partial<ProductTabCopy>>) : null);
  const overrides = readProductTabOverrides(catalogMeta);

  return PRODUCT_TAB_DEFS.map((def) => {
    const overridden = overrides[def.key].override;
    const html = overridden ? overrides[def.key].content : globalTabs[def.key].content;
    return {
      key: def.key,
      title: globalTabs[def.key].title,
      html,
      overridden,
    };
  });
}

/** Placeholders the tab text may use; the store fills in the live amounts from Admin → Settings → Delivery. */
export const DELIVERY_PLACEHOLDERS = ["{free_delivery_over}", "{delivery_fee}"] as const;

export function fillDeliveryAmounts(html: string, amounts: { freeOver: number; flatFee: number }) {
  const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
  return html.replaceAll("{free_delivery_over}", rs(amounts.freeOver)).replaceAll("{delivery_fee}", rs(amounts.flatFee));
}

const hasText = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;

/**
 * The tabs a product page shows. A product's own override wins; otherwise the saved store-wide tab; a tab that was
 * never saved shows the default text. A tab saved empty (or an empty override) is hidden.
 */
export function resolveStoreProductTabs(globalValue: unknown, catalogMeta: unknown): { key: ProductTabKey; title: string; html: string }[] {
  const saved = globalValue && typeof globalValue === "object" ? (globalValue as Record<string, Partial<ProductTabCopy> | undefined>) : {};
  const overrides = readProductTabOverrides(catalogMeta);
  return PRODUCT_TAB_DEFS.map((def) => {
    const stored = saved[def.key];
    const title = String(stored?.title || "").trim() || def.title;
    const storeHtml = stored && typeof stored.content === "string" ? stored.content : def.content;
    const html = overrides[def.key].override ? overrides[def.key].content : storeHtml;
    return { key: def.key, title, html };
  }).filter((tab) => hasText(tab.html));
}
