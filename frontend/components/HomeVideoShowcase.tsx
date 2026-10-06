import Link from "next/link";

type VideoCard = {
  title: string;
  url?: string;
  poster?: string;
  subtitle?: string;
};

export default function HomeVideoShowcase({
  title = "Watch it before you buy it",
  copy = "Short product videos make it easier to see the size, finish and real-life feel before you order.",
  videos,
}: {
  title?: string;
  copy?: string;
  videos: VideoCard[];
}) {
  if (!videos.length) return null;

  return (
    <section className="section section-soft mock-video-section">
      <div className="site-shell">
        <div className="section-title mock-video-section-title">
          <div>
            <h2>{title}</h2>
            <p>{copy}</p>
          </div>
          <span>Video links can be updated anytime.</span>
        </div>

        <div className="mock-video-grid" data-no-motion="true">
          {videos.map((video) => {
            const href = video.url || "#";
            const card = (
              <>
                <div className="mock-video-poster" style={video.poster ? { backgroundImage: `url(${video.poster})` } : undefined}>
                  <span className="mock-video-play">▶</span>
                  <small>{video.url ? "Short video" : "Video link coming soon"}</small>
                </div>
                <div className="mock-video-copy">
                  <strong>{video.title}</strong>
                  {video.subtitle ? <p>{video.subtitle}</p> : null}
                </div>
              </>
            );

            return video.url ? (
              <Link key={video.title} href={href} className="mock-video-card" target="_blank" rel="noreferrer">
                {card}
              </Link>
            ) : (
              <div key={video.title} className="mock-video-card is-placeholder">
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
