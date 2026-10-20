"use client";

import { useEffect, useRef, useState } from "react";
import { youtubeEmbed } from "@store/lib/youtube";

/**
 * YouTube embed that only loads when the visitor scrolls near it (~300px early),
 * then autoplays muted as before. Until then the video thumbnail fills the frame.
 */
export function LazyYouTube({ id, title }: { id: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
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
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="yt-lazy">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="yt-thumb" src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={title} loading="lazy" decoding="async" />
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
