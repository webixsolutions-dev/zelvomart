import { Check } from "lucide-react";
import { unboxingVideo } from "@store/lib/home-videos";
import { VideoTile } from "./VideoTile";

const points = [
  "Checked by hand before it’s sealed",
  "Zelvomart seal on every parcel",
  "A thank-you card in every order",
];

/** Packing film plus the unboxing promise — replaces the old own-stock marketplace block. */
export function BrandPromise() {
  return (
    <div className="unbox">
      {/* Vertical film in the wide frame: centred, with a blurred, darkened copy of the poster behind it (no black bars). */}
      <div className="unbox-player" style={{ ["--unbox-poster" as string]: `url("${unboxingVideo.poster}")` }}>
        <span className="unbox-backdrop" aria-hidden="true" />
        <VideoTile src={unboxingVideo.src} poster={unboxingVideo.poster} title={unboxingVideo.title} width={960} height={612} />
      </div>
      <div className="unbox-copy">
        <div className="eyebrow">The unboxing</div>
        <h2>
          Arrives like a gift.
          <br />
          Every single time.
        </h2>
        <p>
          Each order is checked, sealed in Zelvomart packaging and sent with care so it feels as good to open as it does to use.
        </p>
        <ul className="unbox-list">
          {points.map((point) => (
            <li key={point}>
              <span className="unbox-check" aria-hidden="true">
                <Check size={14} strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
