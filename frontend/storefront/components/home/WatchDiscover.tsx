import { VolumeX } from "lucide-react";
import { homeShorts } from "@store/lib/home-videos";
import { VideoTile } from "./VideoTile";

/**
 * Homepage shorts: self-hosted MP4s (lib/home-videos.ts). Each one starts muted and loops when it is about a
 * screen away, and pauses when it leaves; until then only its poster image loads.
 */
export function WatchDiscover() {
  return (
    <div className="watch-discover">
      <div className="eyebrow">Watch & Discover</div>
      <h2>See Zelvomart products in action</h2>
      <div className="shorts-grid">
        {homeShorts.map((video) => (
          <article className="short-card" key={video.id}>
            <div className="short-frame">
              <VideoTile src={video.src} poster={video.poster} title={video.title} width={360} height={640} />
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
