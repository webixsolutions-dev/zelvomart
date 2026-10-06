import Link from "next/link";

type FeaturedVideoProps = {
  eyebrow?: string;
  title: string;
  copy: string;
  points?: string[];
  url?: string;
  poster?: string;
  ctaLabel?: string;
};

export default function FeatureVideoSection({
  eyebrow = "SEE IT IN ACTION",
  title,
  copy,
  points = [],
  url,
  poster,
  ctaLabel = "Video link coming soon",
}: FeaturedVideoProps) {
  const art = (
    <div className="mock-feature-video-media" style={poster ? { backgroundImage: `url(${poster})` } : undefined}>
      <span className="mock-feature-video-badge">Play video</span>
      <div className="mock-feature-video-glow" />
    </div>
  );

  return (
    <section className="section mock-feature-video-section">
      <div className="site-shell mock-feature-video-wrap">
        {url ? (
          <Link href={url} className="mock-feature-video-link" target="_blank" rel="noreferrer" data-no-motion="true">
            {art}
          </Link>
        ) : (
          <div className="mock-feature-video-link is-placeholder" data-no-motion="true">{art}</div>
        )}
        <div className="mock-feature-video-copy">
          <span className="mock-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{copy}</p>
          {points.length ? <ul>{points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
          <span className="mock-feature-video-cta">{url ? "Open video →" : ctaLabel}</span>
        </div>
      </div>
    </section>
  );
}
