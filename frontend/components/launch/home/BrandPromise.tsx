import { Check } from "lucide-react";
import { LazyYouTube } from "./LazyYouTube";

const points = [
  "Checked by hand before it’s sealed",
  "Zelvomart seal on every parcel",
  "A thank-you card in every order",
];

const UNBOXING_ID = "RkFifzRoieE";

/** Packing film plus the unboxing promise — replaces the old own-stock marketplace block. */
export function BrandPromise() {
  return (
    <div className="unbox">
      <div className="unbox-player">
        <LazyYouTube id={UNBOXING_ID} title="Pack an Order With Me — Zelvomart jewellery packing" />
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
