"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

/**
 * Self-hosted, muted, looping video (MP4 on Cloudflare R2) that costs nothing at page load:
 * - only the poster image is in the page (lazy `<img>`); the video has no `src` and `preload="none"`;
 * - about one screen before the tile scrolls into view, the `src` is set and the video plays muted; it pauses again
 *   when it leaves that area, so a row of tiles never downloads or plays all at once;
 * - the poster stays on top until the video is actually playing, then fades out (no black frame, no jump);
 * - reduced-motion and data-saver visitors, and any browser that blocks autoplay, keep the poster with a play
 *   button and the video loads only when tapped.
 */
export function VideoTile({
  src,
  poster,
  title,
  width,
  height,
  className = "",
  rootMargin = 600,
}: {
  src: string;
  poster: string;
  title: string;
  width: number;
  height: number;
  className?: string;
  rootMargin?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false); // src set
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduced || saveData || !("IntersectionObserver" in window)) {
      setNeedsTap(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const near = entries.some((entry) => entry.isIntersecting);
        const v = video.current;
        if (near) {
          setArmed(true);
          if (v && v.getAttribute("src")) void play(v);
        } else if (v && !v.paused) {
          v.pause();
        }
      },
      { rootMargin: `${rootMargin}px ${rootMargin}px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  // Once the src is in place, start playing (muted autoplay); a refusal falls back to the tap-to-play poster.
  useEffect(() => {
    const v = video.current;
    if (armed && v && !needsTap) void play(v);
  }, [armed, needsTap]);

  async function play(v: HTMLVideoElement) {
    try {
      v.muted = true;
      await v.play();
    } catch {
      setNeedsTap(true);
    }
  }

  const showVideo = (v: HTMLVideoElement) => {
    if (typeof v.requestVideoFrameCallback !== "function") {
      setPlaying(true);
      return;
    }
    if (frame.current != null) v.cancelVideoFrameCallback(frame.current);
    frame.current = v.requestVideoFrameCallback(() => {
      frame.current = null;
      if (!v.paused) setPlaying(true);
    });
  };

  const showPoster = (v: HTMLVideoElement) => {
    if (frame.current != null) {
      v.cancelVideoFrameCallback(frame.current);
      frame.current = null;
    }
    setPlaying(false);
  };

  const start = () => {
    setNeedsTap(false);
    setArmed(true);
    const v = video.current;
    if (v) {
      if (!v.getAttribute("src")) v.setAttribute("src", src);
      void play(v);
    }
  };

  return (
    <div ref={wrap} className={`video-tile ${playing ? "is-playing" : ""} ${className}`}>
      <video
        ref={video}
        src={armed ? src : undefined}
        muted
        loop
        playsInline
        preload="none"
        aria-label={title}
        onPlaying={(event) => showVideo(event.currentTarget)}
        onPause={(event) => showPoster(event.currentTarget)}
        onError={(event) => { showPoster(event.currentTarget); setFailed(true); }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="video-tile-poster" src={poster} alt={title} width={width} height={height} loading="lazy" decoding="async" />
      {needsTap && !failed && (
        <button type="button" className="video-tile-play" onClick={start} aria-label={`Play video: ${title}`}>
          <Play size={22} fill="currentColor" />
        </button>
      )}
    </div>
  );
}
