"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CircleCheck,
  Clock,
  ExternalLink,
  House,
  MapPin,
  Package,
  PackageSearch,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { money, waLink } from "@/lib/launch/format";
import { site } from "@/lib/launch/site";
import { deliveryEstimate, findOrder, stages, statusInfo, type TrackedOrder } from "@/lib/launch/tracking";
import { WhatsAppIcon } from "@/components/launch/ui/BrandIcons";
import { Breadcrumbs } from "@/components/launch/ui/Breadcrumbs";
import { FaqAccordion, FaqJsonLd } from "@/components/launch/ui/FaqAccordion";
import s from "./TrackOrder.module.css";

/** Same icons in the result tracker and in "What each stage means": check, shield, box, truck, house. */
const stageIcons: LucideIcon[] = [CircleCheck, ShieldCheck, Package, Truck, House];

/** "Mon–Sat, 10am – 7pm" → "Mon–Sat, 10am–7pm" */
const hours = site.supportHours.replace(/\s+–\s+/g, "–");

export const trackFaqs = [
  {
    q: "Where can I find my order number?",
    a: "In the confirmation message we send after you order, and on the thank-you page. It starts with ZM-. If you can’t find it, message us on WhatsApp with the mobile number you used at checkout.",
  },
  {
    q: "My order isn’t showing. What should I check?",
    a: "Make sure the order number is typed exactly and the mobile number is the one used at checkout. Still no match? Message us and we’ll check it for you.",
  },
  {
    q: "When will my parcel arrive?",
    a: `Usually ${site.shipping.estimate} depending on your city. Once it is booked with ${site.shipping.courier}, the courier link shows the latest update.`,
  },
  {
    q: "Why hasn’t my status changed?",
    a: "Status updates when our team confirms, packs or books your order, and when the courier scans the parcel. If nothing has changed in 2 working days, message us.",
  },
  {
    q: "Can I change my address after ordering?",
    a: "Yes, before dispatch. Message us on WhatsApp with your order number and the new address.",
  },
];

const wa = (text: string) => waLink(site.whatsappNumber, text);

export function TrackOrderView() {
  const [loading, setLoading] = useState(false);
  const [id, setId] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ id?: string; phone?: string }>({});
  const [result, setResult] = useState<TrackedOrder | "none" | null>(null);
  const [searched, setSearched] = useState("");
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (result && result !== "none") resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!id.trim()) next.id = "Please enter your order number.";
    if (phone.replace(/\D/g, "").length < 10) next.phone = "Please enter the mobile number used at checkout.";
    setErrors(next);
    if (next.id || next.phone) return;
    setSearched(id.trim());
    setLoading(true);
    try {
      setResult((await findOrder(id, phone)) ?? "none");
    } catch {
      setResult("none");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className={s.hero}>
        <Breadcrumbs items={[{ label: "Track Order" }]} />
        <div className={`container ${s.heroGrid}`}>
          <div className={s.intro}>
            <p className="eyebrow">
              <span className={s.line} aria-hidden="true" />
              From our stock to your doorstep
            </p>
            <h1>
              Track your <span>Zelvomart order.</span>
            </h1>
            <p className={s.lead}>
              Enter your order number and mobile number to see where your parcel is, from confirmation to your doorstep.
            </p>
            <ul className={s.facts}>
              <li>
                <Banknote size={18} /> Cash on Delivery
              </li>
              <li>
                <Truck size={18} /> Delivered by {site.shipping.courier}
              </li>
              <li>
                <Clock size={18} /> {site.shipping.estimate}
              </li>
            </ul>
            <p className={s.caption}>
              <WhatsAppIcon size={16} /> A real person is always a message away.
            </p>
          </div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <div>
                <p className="eyebrow">Your parcel, a little closer</p>
                <h2>Find your parcel.</h2>
                <p>Use the details from your order confirmation.</p>
              </div>
              <span className={s.cardIcon} aria-hidden="true">
                <PackageSearch size={24} />
              </span>
            </div>

            <form className={s.form} onSubmit={submit} noValidate>
              <div className={s.field}>
                <label htmlFor="track-order">
                  Order number <span aria-hidden="true">*</span>
                </label>
                <span className={`${s.input} ${errors.id ? s.invalid : ""}`}>
                  <Package size={18} aria-hidden="true" />
                  <input
                    id="track-order"
                    name="orderNumber"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="e.g. ZM-10004"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                    aria-invalid={!!errors.id}
                    aria-describedby="track-order-hint"
                  />
                </span>
                <small id="track-order-hint" className={errors.id ? s.error : undefined}>
                  {errors.id ?? "It’s in your order confirmation message."}
                </small>
              </div>
              <div className={s.field}>
                <label htmlFor="track-phone">
                  Mobile number <span aria-hidden="true">*</span>
                </label>
                <span className={`${s.input} ${errors.phone ? s.invalid : ""}`}>
                  <Smartphone size={18} aria-hidden="true" />
                  <input
                    id="track-phone"
                    name="mobile"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03XX XXXXXXX"
                    autoComplete="tel"
                    required
                    aria-invalid={!!errors.phone}
                    aria-describedby="track-phone-hint"
                  />
                </span>
                <small id="track-phone-hint" className={errors.phone ? s.error : undefined}>
                  {errors.phone ?? "The same number you used at checkout."}
                </small>
              </div>
              <button className={`btn block lg ${s.submit}`} type="submit" disabled={loading}>
                <Search size={18} /> {loading ? "Checking…" : "Track order"}
              </button>
            </form>

            <p className={s.assure}>
              <ShieldCheck size={15} /> These details help us find the right order.
            </p>

            <div aria-live="polite">
              {result === "none" && (
                <div className={`notice warn ${s.noMatch}`}>
                  <span>
                    <strong>We couldn&apos;t find a match.</strong> Double-check the order number and mobile number, or message us and
                    we&apos;ll update you right away.
                  </span>
                  <a
                    className="btn wa sm"
                    href={wa(searched ? `Hi Zelvomart! Please share the status of my order ${searched}.` : "Hi Zelvomart! Please share the status of my order.")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <WhatsAppIcon size={16} /> Ask on WhatsApp
                  </a>
                </div>
              )}
            </div>

            <p className={s.cardFoot}>
              <span>Can&apos;t find your order number?</span>
              <a href={wa("Hi Zelvomart, please help me find my order number.")} target="_blank" rel="noopener noreferrer">
                We can help <ArrowRight size={15} />
              </a>
            </p>
          </div>
        </div>
      </section>

      {result && result !== "none" && (
        <section className={s.resultSection} ref={resultRef} aria-labelledby="track-result-title">
          <div className="container">
            <OrderResult order={result} />
          </div>
        </section>
      )}

      <section className={s.stagesSection} aria-labelledby="stages-title">
        <div className="container">
          <div className={s.sectionHead}>
            <div>
              <p className="eyebrow">From click to doorstep</p>
              <h2 id="stages-title">What each stage means.</h2>
            </div>
            <p>A simple guide to your parcel’s journey.</p>
          </div>
          <ol className={s.journey}>
            {stages.map((st, i) => {
              const Icon = stageIcons[i];
              return (
                <li key={st.key}>
                  <span className={s.journeyIcon}>
                    <Icon size={22} />
                  </span>
                  <div>
                    <small>{String(i + 1).padStart(2, "0")}</small>
                    <h3>{st.title}</h3>
                    <p>{st.sub}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className={s.helpSection} aria-labelledby="track-help-title">
        <div className="container">
          <div className={s.help}>
            <span className={s.helpIcon} aria-hidden="true">
              <WhatsAppIcon size={28} />
            </span>
            <div className={s.helpCopy}>
              <p className="eyebrow">Here for the little questions, too</p>
              <h2 id="track-help-title">Need a hand?</h2>
              <p>Can’t find an order, or need a delivery update? Let’s talk.</p>
            </div>
            <div className={s.helpAction}>
              <a className="btn wa lg" href={wa("Hi Zelvomart! I need help with my order.")} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> Chat on WhatsApp
              </a>
              <small>{hours} · Pakistan time</small>
            </div>
          </div>
        </div>
      </section>

      <section className={`${s.faqSection} ${s.last}`} aria-labelledby="track-faq-title">
        <div className={`container ${s.faqGrid}`}>
          <div className={s.faqIntro}>
            <p className="eyebrow">A little help before you track</p>
            <h2 id="track-faq-title">
              Clear answers.
              <br />
              Easy next steps.
            </h2>
            <p>Check the basics here, or ask our team for a little guidance.</p>
            <Link prefetch={false} className={s.textLink} href="/contact-us/">
              Visit customer care <ArrowRight size={16} />
            </Link>
            <Link prefetch={false} className={s.guide} href="/shipping-policy/">
              <span className={s.guideIcon} aria-hidden="true">
                <Truck size={20} />
              </span>
              <span>
                <strong>Delivery questions?</strong>
                <small>Read our delivery guide</small>
              </span>
              <ArrowRight size={16} />
            </Link>
          </div>
          <div>
            <FaqAccordion items={trackFaqs} defaultOpen={null} />
          </div>
        </div>
        <FaqJsonLd items={trackFaqs} />
      </section>
    </>
  );
}

function OrderResult({ order }: { order: TrackedOrder }) {
  const info = statusInfo[order.status];
  const delivered = order.status === "DELIVERED";
  const booked = info.stage !== null && info.stage >= 2;
  const placed = new Date(order.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
  const ask = wa(`Hi Zelvomart! I have a question about my order ${order.number}.`);
  const courierLink =
    order.trackingUrl &&
    (
      <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
        {order.trackingNumber ?? `Track on ${order.courier}`} <ExternalLink size={13} />
      </a>
    );

  return (
    <article className={s.result} data-tone={info.tone}>
      <header className={s.resultHead}>
        <div>
          <h2 id="track-result-title">Order {order.number}</h2>
          <p>Placed on {placed}</p>
        </div>
        <span className={s.pill} data-tone={info.tone}>
          <span aria-hidden="true" /> {info.label}
        </span>
      </header>

      {info.stage === null ? (
        <div className={s.closed}>
          <p>{info.sentence}</p>
          <a className="btn wa" href={ask} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon size={16} /> Ask on WhatsApp
          </a>
        </div>
      ) : (
        <>
          <ol className={s.tracker} aria-label="Order progress">
            {stages.map((st, i) => {
              const Icon = stageIcons[i];
              const state = i < info.stage! || (delivered && i === 4) ? "done" : i === info.stage ? "current" : "todo";
              return (
                <li key={st.key} data-state={state} data-current={i === info.stage || undefined} aria-current={i === info.stage ? "step" : undefined}>
                  <span className={s.trackerIcon}>
                    <Icon size={20} />
                  </span>
                  <span className={s.trackerLabel}>{st.title}</span>
                </li>
              );
            })}
          </ol>
          <p className={s.sentence}>
            {info.sentence}
            {order.status === "IN_TRANSIT" && courierLink && <> Courier tracking: {courierLink}</>}
          </p>
        </>
      )}

      <div className={s.details}>
        <div className={s.detailsFacts}>
          <h3>Delivery details</h3>
          <dl>
            <div>
              <dt>
                <MapPin size={16} /> City
              </dt>
              <dd>{order.city}</dd>
            </div>
            <div>
              <dt>
                <Clock size={16} /> {delivered ? "Delivery" : "Expected delivery"}
              </dt>
              <dd>{delivered ? "Delivered" : order.estimate || deliveryEstimate(order.city)}</dd>
            </div>
            <div>
              <dt>
                <Truck size={16} /> Courier
              </dt>
              <dd>
                {order.courier}
                {booked && order.trackingNumber && !order.trackingUrl && <> · {order.trackingNumber}</>}
                {booked && courierLink && <> · {courierLink}</>}
                {!booked && info.stage !== null && <small>Tracking number shared once booked</small>}
              </dd>
            </div>
            <div>
              <dt>
                <Banknote size={16} /> Payment
              </dt>
              <dd>Cash on Delivery</dd>
            </div>
          </dl>
          <a className={`btn wa-outline ${s.ask}`} href={ask} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon size={16} /> Ask on WhatsApp
          </a>
        </div>

        <div className={s.items}>
          {order.lines.length > 0 && (
          <>
          <h3>
            {order.lines.length} {order.lines.length === 1 ? "item" : "items"} in this order
          </h3>
          <ul>
            {order.lines.map((l, i) => (
              <li key={i}>
                <img src={l.image} alt="" width={64} height={64} loading="lazy" decoding="async" />
                <div>
                  <strong>{l.name}</strong>
                  <small>
                    Qty {l.qty} · {money(l.price * l.qty)}
                  </small>
                </div>
                {delivered && l.slug && (
                  <Link prefetch={false} className={`btn ghost sm ${s.review}`} href={`/product/${l.slug}/#reviews`}>
                    <Star size={15} /> Leave a review
                  </Link>
                )}
              </li>
            ))}
          </ul>
          </>
          )}
          <p className={s.total}>
            <span>{delivered ? "Order total" : "Total due on delivery"}</span>
            <strong>{money(order.total)}</strong>
          </p>
        </div>
      </div>
    </article>
  );
}
