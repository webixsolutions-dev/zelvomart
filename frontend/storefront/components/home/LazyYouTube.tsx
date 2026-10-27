"use client";

import { useEffect, useRef, useState } from "react";
import { youtubeEmbed } from "@store/lib/youtube";

/**
 * YouTube embed that can be warmed before the visitor reaches its section, then
 * autoplays muted as before. Until then the video thumbnail fills the frame.
 */
export function LazyYouTube({
  id,
  title,
  eager = false,
  rootMargin = 300,
}: {
  id: string;
  title: string;
  eager?: boolean;
  rootMargin?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(eager);

  useEffect(() => {
    // Establish the YouTube connection while the page is being explored so the player
    // doesn't start its DNS/TLS handshake only after the visitor reaches the section.
    for (const href of ["https://www.youtube-nocookie.com", "https://i.ytimg.com"]) {
      if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = href;
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }
    }
    if (eager) return;
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setLoad(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: `${rootMargin}px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, rootMargin]);

  return (
    <div ref={ref} className="yt-lazy">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="yt-thumb" src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={title} loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "high" : "auto"} />
      {load && (
        <iframe
          src={youtubeEmbed(id)}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
}
