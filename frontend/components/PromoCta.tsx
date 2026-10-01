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
    <section className="section promo-section">
      <div className="site-shell">
        <div className="promo-card">
          <div>
            <span className="promo-kicker">ZELVOMART • QUALITY CHECKED</span>
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
