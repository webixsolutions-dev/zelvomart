"use client";

import { useEffect, useMemo, useState } from "react";

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
  const slides = useMemo(() => videos.filter(Boolean).slice(0, 8), [videos]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [slides.length, paused]);

  if (!slides.length) return null;
  const video = slides[active];
  const embed = youtubeEmbed(video.url);

  const previous = () => setActive((current) => (current - 1 + slides.length) % slides.length);
  const next = () => setActive((current) => (current + 1) % slides.length);

  return (
    <section className="zm-shorts-section zm-video-slider-section">
      <div className="site-shell">
        <div className="zm-shorts-heading">
          <h2>See Zelvomart products in action</h2>
          <p>Discover handpicked essentials across our most popular categories.</p>
        </div>

        <div
          className="zm-video-slider"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <button className="zm-video-arrow prev" type="button" onClick={previous} aria-label="Previous video">‹</button>

          <article className="zm-video-slide" key={`${video.title}-${active}`} aria-label={video.title}>
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

          <button className="zm-video-arrow next" type="button" onClick={next} aria-label="Next video">›</button>
        </div>

        {slides.length > 1 ? (
          <div className="zm-video-dots" aria-label="Video slider navigation">
            {slides.map((slide, index) => (
              <button
                key={`${slide.title}-${index}`}
                type="button"
                className={index === active ? "active" : ""}
                aria-label={`Show video ${index + 1}`}
                aria-current={index === active ? "true" : undefined}
                onClick={() => setActive(index)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
