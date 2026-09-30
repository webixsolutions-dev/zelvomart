"use client";

import { useState } from "react";

export default function PopularCollections({ videos = [] }: { videos?: Array<{ title: string; url: string; poster?: string }> }) {
  const [playing, setPlaying] = useState<number | null>(null);
  if (!videos.length) return null;

  return (
    <section className="section section-soft">
      <div className="site-shell">
        <div className="section-title"><div><h2>Explore Popular Collections</h2><p>Videos load only when you tap them.</p></div></div>
        <div className="grid gap-4 md:grid-cols-3">
          {videos.map((video, index) => (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" key={video.url}>
              {playing === index ? (
                <video src={video.url} controls autoPlay preload="metadata" className="aspect-[4/5] w-full object-cover" />
              ) : (
                <button className="relative aspect-[4/5] w-full bg-slate-100 text-slate-700" onClick={() => setPlaying(index)}>
                  {video.poster ? <img src={video.poster} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : null}
                  <span className="absolute inset-0 grid place-items-center"><span className="rounded-full bg-white/90 px-5 py-3 font-extrabold shadow">Play video</span></span>
                </button>
              )}
              <div className="p-4 text-sm font-extrabold text-slate-800">{video.title}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
