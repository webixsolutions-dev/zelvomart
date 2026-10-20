import { VolumeX } from "lucide-react";
import { LazyYouTube } from "./LazyYouTube";

/** Homepage shorts. Each one autoplays muted and loops. */
export const homeShorts: { id: string; title: string; youtubeId: string }[] = [
  { id: "short-1", title: "Heart Pendant Jewellery", youtubeId: "1Ucas-8A7Jc" },
  { id: "short-2", title: "Textured Handbag", youtubeId: "2GUG6Osv0Qg" },
  { id: "short-3", title: "Sip in Style", youtubeId: "k5f9jnUUqRg" },
  { id: "short-4", title: "42-Piece Magnetic Blocks", youtubeId: "nLqUowhaqdE" },
  { id: "short-5", title: "A little shopping therapy", youtubeId: "DOw3BuB0wi0" },
];

export function WatchDiscover() {
  return (
    <div className="watch-discover">
      <div className="eyebrow">Watch & Discover</div>
      <h2>See Zelvomart products in action</h2>
      <div className="shorts-grid">
        {homeShorts.map((video) => (
          <article className="short-card" key={video.id}>
            <div className="short-frame">
              <LazyYouTube id={video.youtubeId} title={video.title} />
              <span className="short-badge">Shorts</span>
              <span className="short-muted" aria-hidden="true">
                <VolumeX size={14} />
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
