"use client";

import { useRef, useState } from "react";
import { BadgeCheck, Play, X } from "lucide-react";
import type { Review } from "@store/lib/reviews";
import { Stars } from "@store/components/ui/Stars";

/** One review with its photos and videos (opens a viewer). Shared by the product page and its review list. */
export function ReviewCard({ r }: { r: Review }) {
  const [active, setActive] = useState<number | null>(null);
  const gallery = useRef<HTMLDialogElement>(null);
  function openMedia(index: number) {
    setActive(index);
    gallery.current?.showModal();
  }
  return (
    <article className="rv-card">
      <header>
        <span className="rv-avatar" aria-hidden="true">
          {r.avatarUrl ? (
            <img
              src={r.avatarUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "50%",
              }}
            />
          ) : (
            r.name.trim().charAt(0).toUpperCase()
          )}
        </span>
        <span className="rv-who">
          <strong>{r.name}</strong>
          {r.city && <small>{r.city}</small>}
        </span>
        {r.verified && (
          <span className="rv-verified">
            <BadgeCheck size={15} /> Verified buyer
          </span>
        )}
      </header>
      <div className="rv-meta">
        <Stars
          rating={r.rating}
          count={1}
          size={14}
          bare
          className="rv-stars"
        />
        <small>
          <time dateTime={r.createdAt.slice(0, 10)}>
            {r.createdAt.slice(0, 10)}
          </time>
        </small>
      </div>
      <p>{r.text}</p>
      {!!r.media?.length && (
        <div className="rv-media">
          {r.media.map((m, index) => (
            <button
              type="button"
              key={m.url}
              onClick={() => openMedia(index)}
              aria-label={m.type === "video" ? "Open video" : "Open photo"}
            >
              {m.type === "video" ? (
                <span className="rv-video">
                  <Play size={18} />
                </span>
              ) : (
                <img src={m.url} alt="" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}
      <dialog
        ref={gallery}
        className="rv-gallery"
        aria-label={`Media from ${r.name}'s review`}
        onClose={() => setActive(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) gallery.current?.close();
        }}
      >
        <button
          type="button"
          className="btn ghost"
          onClick={() => gallery.current?.close()}
          aria-label="Close gallery"
        >
          <X />
        </button>
        {active !== null &&
          r.media?.[active] &&
          (r.media[active].type === "video" ? (
            <video
              key={r.media[active].url}
              src={r.media[active].url}
              controls
              autoPlay
            />
          ) : (
            <img
              src={r.media[active].url}
              alt={`Photo from ${r.name}'s review`}
            />
          ))}
        <div className="rv-gallery-controls">
          <button
            type="button"
            className="btn ghost"
            disabled={active === null || active === 0}
            onClick={() => setActive((i) => Math.max(0, (i || 0) - 1))}
          >
            Previous
          </button>
          <span>
            {active === null ? 0 : active + 1} / {r.media?.length || 0}
          </span>
          <button
            type="button"
            className="btn ghost"
            disabled={active === null || active === (r.media?.length || 0) - 1}
            onClick={() =>
              setActive((i) =>
                Math.min((r.media?.length || 1) - 1, (i || 0) + 1),
              )
            }
          >
            Next
          </button>
        </div>
      </dialog>
    </article>
  );
}
