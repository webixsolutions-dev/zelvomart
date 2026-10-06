type VideoCard = {
  title: string;
  url?: string;
  poster?: string;
};

function youtubeEmbed(url?: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.replace(/^\//, "")}`;
    if (parsed.hostname.includes("youtube.com")) {
      const shorts = parsed.pathname.match(/\/shorts\/([^/?]+)/)?.[1];
      const watch = parsed.searchParams.get("v");
      const embed = parsed.pathname.match(/\/embed\/([^/?]+)/)?.[1];
      const id = shorts || watch || embed;
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
  } catch {}
  return "";
}

function isDirectVideo(url?: string) {
  return Boolean(url && /\.(mp4|webm|ogg)(\?.*)?$/i.test(url));
}

export default function HomeVideoShowcase({ videos }: { videos: VideoCard[] }) {
  if (!videos.length) return null;

  return (
    <section className="zm-shorts-section">
      <div className="site-shell">
        <div className="zm-shorts-heading">
          <h2>See Zelvomart products in action</h2>
          <p>Discover handpicked essentials across our most popular categories.</p>
        </div>
        <div className="zm-shorts-row" data-no-motion="true">
          {videos.slice(0, 5).map((video, index) => {
            const embed = youtubeEmbed(video.url);
            return (
              <article className="zm-short-card" key={`${video.title}-${index}`} aria-label={video.title}>
                {embed ? (
                  <iframe
                    src={`${embed}?rel=0&modestbranding=1`}
                    title={video.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : isDirectVideo(video.url) ? (
                  <video controls playsInline preload="metadata" poster={video.poster || undefined}>
                    <source src={video.url} />
                  </video>
                ) : (
                  <div className="zm-short-placeholder" style={video.poster ? { backgroundImage: `url(${video.poster})` } : undefined}>
                    <span className="zm-short-play">▶</span>
                    <small>{video.title}</small>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
