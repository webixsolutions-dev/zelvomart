"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Heart, PackageCheck, ShoppingBag, Truck } from "lucide-react";
import { getCategory, getProduct, categoryPath, type Variant } from "@store/lib/catalog";
import { discountPct, money, waLink } from "@store/lib/format";
import { site } from "@store/lib/site";
import { useShop } from "@store/lib/store";
import { useViewContent } from "@store/lib/orders";
import { deliverBy, shortDate } from "@store/lib/delivery";
import { resolveProductTabs } from "@store/lib/productTabs";
import { sanitizeDescriptionHtml } from "@store/lib/sanitize-description";
import { approvedReviews, reviewSummary } from "@store/lib/reviews";
import { Price } from "@store/components/ui/Price";
import { Stars } from "@store/components/ui/Stars";
import { QtyStepper } from "@store/components/shop/QtyStepper";
import { WhatsAppIcon } from "@store/components/ui/BrandIcons";
import { ReviewCard } from "./ReviewCard";

// Below the fold: its code (filters, photo upload, review form) is a separate chunk. Still rendered on the server.
const ProductReviews = dynamic(() => import("./ProductReviews").then((m) => m.ProductReviews));

function isSize(label: string, kind?: string) {
  return kind ? kind === "size" : /size/i.test(label);
}

function withoutGeneratedDescriptionCta(html: string) {
  const marker = html.toLowerCase().indexOf("to ask about the product and place your order");
  if (marker < 0) return html;

  const paragraphStart = html.toLowerCase().lastIndexOf("<p", marker);
  const paragraphEnd = html.toLowerCase().indexOf("</p>", marker);
  if (paragraphStart < 0 || paragraphEnd < 0) return html;

  const paragraph = html.slice(paragraphStart, paragraphEnd).toLowerCase();
  if (!paragraph.includes("explore the") || !paragraph.includes("collection")) return html;
  return html.slice(0, paragraphStart) + html.slice(paragraphEnd + 4);
}

function withoutGeneratedDescriptionText(text: string) {
  return text
    .replace(
      /(?:^|\n)\s*Choose\b[^\n]*to ask about the product and place your order\.\s*Explore the [^\n.]* collection\.?\s*$/i,
      "",
    )
    .trim();
}

export function ProductDetail({ slug }: { slug: string }) {
  const p = getProduct(slug)!;
  const cat = getCategory(p.category)!;
  const router = useRouter();
  // ?variant=SKU is read in the browser after mount. useSearchParams() would need a <Suspense> boundary on
  // this statically generated page; without one, every product page answered 500.
  const [variantSku, setVariantSku] = useState<string | null>(null);
  const [urlRead, setUrlRead] = useState(false);
  useEffect(() => {
    setVariantSku(new URLSearchParams(window.location.search).get("variant"));
    setUrlRead(true);
  }, [p.slug]);
  // Fires once, after the URL is read, so the event carries the selected variant.
  useViewContent(p, variantSku, urlRead);
  const { addToCart, toggleWish, isWished, ready } = useShop();
  const reviews = useMemo(() => approvedReviews(p.id), [p.id]);
  const summary = reviewSummary(reviews);
  const tabs = useMemo(() => resolveProductTabs(p), [p]);

  const options = p.variants?.options ?? [];
  const sizeLayout = !!p.variants && isSize(p.variants.label, p.variants.kind);
  const imageSwatches = !sizeLayout && options.some((o) => o.imageUrl);

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [qty, setQtyState] = useState(1);
  const [ordering, setOrdering] = useState(false);
  const [bundle, setBundle] = useState<1 | 2>(1);
  const [variant, setVariant] = useState<string | undefined>(() =>
    (options.find((o) => o.sku === variantSku && !o.soldOut) || options.find((o) => !o.soldOut))?.name,
  );
  const [tab, setTab] = useState(tabs[0]?.id ?? "description");
  const [openRows, setOpenRows] = useState<string[]>(["description"]);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [eta, setEta] = useState<string | null>(null);

  // The date depends on today, so it is worked out in the browser, not at build time.
  useEffect(() => {
    setEta(shortDate(deliverBy()));
    router.prefetch("/checkout/");
  }, [router]);
  useEffect(() => {
    if (!variantSku) return;
    const match = options.find((option) => option.sku === variantSku && !option.soldOut);
    if (match) { setVariant(match.name); setGalleryIndex(0); }
  }, [variantSku, p.id]);

  const wished = ready && isWished(p.id);
  const pct = discountPct(p.price, p.compare);
  const inStock = p.inStock !== false;
  const bundleOn = !!p.bundleEnabled && !!p.bundleDiscountPercent;
  const bundlePct = bundleOn && bundle === 2 && qty >= 2 ? p.bundleDiscountPercent! : 0;
  const unit = bundlePct ? Math.round(p.price * (1 - bundlePct / 100)) : p.price;
  const total = unit * qty;
  const twoPrice = bundleOn ? Math.round(p.price * (1 - p.bundleDiscountPercent! / 100)) * 2 : 0;
  const selected: Variant | undefined = options.find((o) => o.name === variant);

  const setQty = (n: number) => {
    setQtyState(n);
    if (bundle === 2 && n < 2) setBundle(1);
  };
  const pickBundle = (b: 1 | 2) => {
    setBundle(b);
    setQtyState(b);
  };

  const cartOpts = { qty, variant, ...(bundlePct ? { bundle: bundlePct } : {}) };
  const waText = `Hi Zelvomart! I'd like to order:\n• ${p.name}${variant ? ` (${variant})` : ""} × ${qty}\nTotal: ${money(total)}\nLink: ${site.url}/product/${p.slug}/`;
  const toggleRow = (id: string) => setOpenRows((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const goReviews = () => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const gallery = selected?.images?.length
    ? selected.images.map((src) => ({ src, alt: p.name + (variant ? " in " + variant : "") }))
    : selected?.imageUrl
      ? [{ src: selected.imageUrl, alt: p.name + (variant ? " in " + variant : "") }]
      : p.gallery?.length
        ? p.gallery
        : [{ src: p.image, alt: p.name }];
  const activeImage = gallery[Math.min(galleryIndex, gallery.length - 1)] || { src: p.image, alt: p.name };
  const mainImage = activeImage.src;

  return (
    <>
      <section className="section pt-sm pd-top">
        <div className="container pd-layout">
          {/* Gallery: sticky on desktop inside its own column, so it stops at the end of this section. */}
          <div className="pd-gallery-col">
            <div className="pd-card pd-gallery">
              <div
                className={`gallery-main ${zoom ? "zooming" : ""}`}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
                }}
                onMouseLeave={() => setZoom(null)}
              >
                <Image
                  key={mainImage}
                  src={mainImage}
                  alt={activeImage.alt || p.name + (variant ? " in " + variant : "")}
                  width={600}
                  height={600}
                  priority
                  unoptimized
                  sizes="(max-width:760px) 100vw, 620px"
                  style={zoom ? { transform: "scale(1.8)", transformOrigin: zoom.x + "% " + zoom.y + "%" } : undefined}
                />
                {p.badge && (
                  <div className="pd-tags">
                    <span className={`badge badge-${p.badge.replace(/\s/g, "").toLowerCase()}`}>{p.badge}</span>
                  </div>
                )}
                {pct > 0 && <span className="badge badge-sale pd-discount">-{pct}%</span>}
                <button
                  className={`pd-wishlist-top ${wished ? "wished" : ""}`}
                  type="button"
                  aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
                  aria-pressed={wished}
                  onClick={() => toggleWish(p.id)}
                >
                  <Heart size={19} fill={wished ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="gallery-thumbs" role="tablist" aria-label="Product images">
                {gallery.map((image, i) => (
                  <button key={image.src + "-" + i} type="button" role="tab" aria-selected={galleryIndex === i} aria-label={"Product image " + (i + 1) + " of " + gallery.length} className={galleryIndex === i ? "active" : ""} onClick={() => setGalleryIndex(i)}>
                    <span>
                      <Image src={image.src} alt={image.alt || ""} width={120} height={120} unoptimized />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pd-card pd-info">
            <Link href={categoryPath(cat.id)} className="pd-cat">
              {cat.name}
            </Link>
            <a href="#reviews" className="pd-rating" onClick={(e) => (e.preventDefault(), goReviews())}>
              <Stars rating={summary.average} count={summary.count} size={16} />
              <span>{summary.count ? `${summary.count} review${summary.count === 1 ? "" : "s"}` : "Write the first review"}</span>
            </a>
            <h1>{p.name}</h1>
            <Price price={p.price} compare={p.compare} size="lg" />
            {pct > 0 && <p className="you-save">You save {money(p.compare! - p.price)} on the regular price</p>}

            <hr className="pd-divider" />
            <p className="pd-short">{p.tagline}</p>
            <ul className="pd-ticks">
              {p.highlights.slice(0, 4).map((h) => (
                <li key={h}>
                  <Check size={15} strokeWidth={3} /> {h}
                </li>
              ))}
            </ul>
            <hr className="pd-divider" />

            {p.variants && (
              <div className="pd-variant">
                <p className="pd-label">
                  {p.variants.label}: <strong>{variant}</strong>
                </p>
                {imageSwatches ? (
                  <div className="pd-swatches">
                    {options.map((o) => (
                      <button key={o.name} type="button" className={variant === o.name ? "active" : ""} aria-pressed={variant === o.name} onClick={() => { setVariant(o.name); setGalleryIndex(0); }}>
                        <span className="pd-swatch-img">
                          <Image src={o.imageUrl || o.images?.[0] || p.image} alt="" width={64} height={64} unoptimized />
                        </span>
                        <small>{o.name}</small>
                      </button>
                    ))}
                  </div>
                ) : sizeLayout ? (
                  <div className="pd-sizes">
                    {options.map((o) => (
                      <button
                        key={o.name}
                        type="button"
                        className={`${variant === o.name ? "active" : ""} ${o.soldOut ? "sold-out" : ""}`}
                        aria-pressed={variant === o.name}
                        disabled={o.soldOut}
                        aria-label={o.soldOut ? `${o.name}, sold out` : o.name}
                        onClick={() => { setVariant(o.name); setGalleryIndex(0); }}
                      >
                        {o.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="variant-options">
                    {options.map((o) => (
                      <button key={o.name} type="button" className={variant === o.name ? "active" : ""} aria-pressed={variant === o.name} disabled={o.soldOut} onClick={() => { setVariant(o.name); setGalleryIndex(0); }}>
                        <span style={{ background: o.swatch }} />
                        {o.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {bundleOn && (
              <div className="pd-bundle">
                <p className="pd-label">Choose your bundle</p>
                <div className="pd-bundle-options" role="radiogroup" aria-label="Choose your bundle">
                  <button type="button" role="radio" aria-checked={bundle === 1} className={bundle === 1 ? "active" : ""} onClick={() => pickBundle(1)}>
                    <span className="pd-radio" aria-hidden="true" />
                    <span className="pd-bundle-copy">
                      <strong>Buy 1</strong>
                      <small>Standard price</small>
                    </span>
                    <span className="pd-bundle-price">{money(p.price)}</span>
                  </button>
                  <button type="button" role="radio" aria-checked={bundle === 2} className={bundle === 2 ? "active" : ""} onClick={() => pickBundle(2)}>
                    <span className="pd-best">Best value</span>
                    <span className="pd-radio" aria-hidden="true" />
                    <span className="pd-bundle-copy">
                      <strong>Buy 2</strong>
                      <span className="pd-save-pill">Save {money(p.price * 2 - twoPrice)}</span>
                      <small>
                        <Check size={13} strokeWidth={3} /> Great for gifting
                      </small>
                      <small>
                        <Check size={13} strokeWidth={3} /> Pay on delivery
                      </small>
                    </span>
                    <span className="pd-bundle-price">
                      {money(twoPrice)}
                      <s>{money(p.price * 2)}</s>
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="pd-buy">
              <div className="pd-buy-row">
                <QtyStepper value={qty} onChange={setQty} />
                <span className={`pd-stock ${inStock ? "" : "out"}`}>
                  <span className="dot" aria-hidden="true" />
                  {inStock ? "In stock · Ships within 24 hours" : "Out of stock"}
                </span>
                <span className="pd-total">
                  <small>Total</small>
                  <strong>{money(total)}</strong>
                </span>
              </div>
              <button
                className="btn block lg pd-order"
                type="button"
                disabled={!inStock || !ready || ordering}
                onClick={() => {
                  if (ordering) return;
                  setOrdering(true);
                  addToCart(p, { ...cartOpts, silent: true, setQuantity: true });
                  router.push("/checkout/");
                }}
              >
                {ordering ? <><span className="pd-order-spinner" aria-hidden="true" />Preparing checkout…</> : "Order now"}
              </button>
              <p className="pd-order-note">Pay when your parcel arrives · Delivered by {site.shipping.courier}</p>
              <div className="pd-buy-secondary">
                <a className="btn wa-outline" href={waLink(site.whatsappNumber, waText)} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon /> Order on WhatsApp
                </a>
                <button className="btn ghost pd-cart" type="button" disabled={!inStock} onClick={() => addToCart(p, cartOpts)}>
                  <ShoppingBag size={17} /> Add to cart
                </button>
              </div>

              <div className="pd-delivery">
                <p className="pd-eta">
                  <Truck size={18} />
                  <span>
                    Order now — get it by <strong suppressHydrationWarning>{eta ?? `within ${site.shipping.estimate}`}</strong>
                  </span>
                </p>
                <ol className="pd-steps">
                  <li className="done">
                    <span className="pd-step-dot" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <strong>Ordered</strong>
                    <small>Today</small>
                  </li>
                  <li>
                    <span className="pd-step-dot" aria-hidden="true">
                      <PackageCheck size={12} />
                    </span>
                    <strong>Dispatched</strong>
                    <small>1–2 days</small>
                  </li>
                  <li>
                    <span className="pd-step-dot" aria-hidden="true">
                      <Truck size={12} />
                    </span>
                    <strong>Delivered</strong>
                    <small>
                      {site.shipping.minDays}–{site.shipping.maxDays} days
                    </small>
                  </li>
                </ol>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Details: tabs on desktop, an accordion card on phones. Every section is in the HTML on load. */}
      <section className="section pd-details-section">
        <div className="container">
          <div className="pd-details">
            <h2 className="pd-details-title">Details, delivery &amp; reviews</h2>
            <div className="tabs pd-tabs" role="tablist" aria-label="Product details">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            {tabs.map((t) => {
              const open = openRows.includes(t.id);
              return (
                <div key={t.id} className={`pd-panel ${tab === t.id ? "is-active" : ""} ${open ? "is-open" : ""}`}>
                  <button type="button" className="pd-acc-head" aria-expanded={open} aria-controls={`panel-${t.id}`} onClick={() => toggleRow(t.id)}>
                    {t.label}
                    <ChevronDown size={18} />
                  </button>
                  <div className="pd-panel-body" id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`}>
                    {t.id === "description" && (
                      <div className="desc-grid">
                        <div>
                          {p.descriptionHtml ? (
                            <div className="pd-description-content" dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(withoutGeneratedDescriptionCta(p.descriptionHtml)) }} />
                          ) : (
                            <p>{withoutGeneratedDescriptionText(p.description)}</p>
                          )}
                        </div>
                        <div className="desc-side">
                          {p.idealFor.length > 0 && <div className="info-box">
                            <h3>Perfect for</h3>
                            <ul className="dot-list">{p.idealFor.map((x) => <li key={x}>{x}</li>)}</ul>
                          </div>}
                          {p.inBox.length > 0 && <div className="info-box">
                            <h3>What&apos;s in the box</h3>
                            <ul className="dot-list">{p.inBox.map((x) => <li key={x}>{x}</li>)}</ul>
                          </div>}
                        </div>
                      </div>
                    )}
                    {t.id === "why" && (
                      <div className="pd-why">
                        {t.points.map((pt) => (
                          <div key={pt.title}>
                            <Check size={18} strokeWidth={3} />
                            <span>
                              <strong>{pt.title}</strong>
                              <p>{pt.text}</p>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.id === "shipping" && (
                      <>
                        <ol className="pd-ship-steps">
                          {t.steps.map((s, i) => (
                            <li key={s.title}>
                              <small>{String(i + 1).padStart(2, "0")}</small>
                              <strong>{s.title}</strong>
                              <p>{s.text}</p>
                            </li>
                          ))}
                        </ol>
                        <p className="pd-ship-note">
                          {t.note}{" "}
                          <Link href="/shipping-policy/" className="link-cta">
                            Shipping policy →
                          </Link>
                        </p>
                      </>
                    )}
                    {t.id === "faq" && (
                      <dl className="pd-faq">
                        {t.items.map((f) => (
                          <div key={f.q}>
                            <dt>{f.q}</dt>
                            <dd>{f.a}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {t.id === "info" && (
                      <table className="spec-table">
                        <tbody>
                          {t.rows.map(([k, v]) => (
                            <tr key={k}>
                              <th>{k}</th>
                              <td>{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Phones only: the last row summarises reviews and jumps to the full section. */}
            <div className={`pd-panel pd-panel-reviews ${openRows.includes("reviews") ? "is-open" : ""}`}>
              <button type="button" className="pd-acc-head" aria-expanded={openRows.includes("reviews")} onClick={() => toggleRow("reviews")}>
                Reviews ({summary.count})
                <ChevronDown size={18} />
              </button>
              <div className="pd-panel-body">
                <div className="pd-review-peek">
                  <strong>{summary.count ? summary.average.toFixed(1) : "0"}</strong>
                  <Stars rating={summary.average} count={summary.count} size={15} showAverage={false} />
                </div>
                {reviews.slice(0, 3).map((r) => (
                  <ReviewCard key={r.id} r={r} />
                ))}
                {!summary.count && <p className="pd-muted">No reviews yet. Be the first to share your experience.</p>}
                <button type="button" className="btn ghost block" onClick={goReviews}>
                  View all reviews &amp; photos ↓
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProductReviews product={p} reviews={reviews} />

      <div className="sticky-buy">
        <div>
          <strong>{money(p.price)}</strong>
          {p.compare && <s>{money(p.compare)}</s>}
        </div>
        <button className="btn grow" type="button" disabled={!inStock} onClick={() => addToCart(p, cartOpts)}>
          <ShoppingBag size={17} /> Add to Cart
        </button>
      </div>
    </>
  );
}
