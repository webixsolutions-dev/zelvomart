import Link from "next/link";

export default function PromoCta({
  title,
  body,
  buttonText,
  buttonHref,
  secondaryText,
  secondaryHref,
}: {
  title: string;
  body: string;
  buttonText: string;
  buttonHref: string;
  secondaryText?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="section promo-section brand-support-section">
      <div className="site-shell">
        <div className="promo-card brand-support-card">
          <div className="brand-support-number">Z</div>
          <div className="brand-support-copy">
            <span className="promo-kicker">REAL PEOPLE • REAL SUPPORT</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
          <div className="promo-actions">
            <Link href={buttonHref} className="btn-green">{buttonText}</Link>
            {secondaryText && secondaryHref ? <Link href={secondaryHref} className="btn-outline">{secondaryText}</Link> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
