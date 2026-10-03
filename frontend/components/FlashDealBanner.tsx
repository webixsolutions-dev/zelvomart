"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Countdown = {
  hours: number;
  minutes: number;
  seconds: number;
};

function getCountdown(): Countdown {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const diff = Math.max(0, end.getTime() - now.getTime());

  return {
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export default function FlashDealBanner() {
  // Keep the server render deterministic. The real clock starts only after
  // hydration, preventing the server/client one-second mismatch warning.
  const [countdown, setCountdown] = useState<Countdown | null>(null);

  useEffect(() => {
    const update = () => setCountdown(getCountdown());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const items = [
    { value: countdown?.hours, label: "Hours" },
    { value: countdown?.minutes, label: "Minutes" },
    { value: countdown?.seconds, label: "Seconds" },
  ];

  return (
    <section className="section flash-section brand-drop-section">
      <div className="site-shell">
        <div className="flash-banner brand-drop-banner">
          <div className="flash-copy">
            <span className="brand-drop-tag">LIMITED DROP</span>
            <div>
              <h2>Today’s Zelvo Deals</h2>
              <p>Selected products, limited-time pricing and the same easy Cash on Delivery experience.</p>
            </div>
          </div>

          <div className="flash-side">
            <div className="flash-timer" aria-label="Deal countdown" aria-live="off">
              {items.map((item) => (
                <div className="flash-box" key={item.label}>
                  <strong>{item.value == null ? "--" : String(item.value).padStart(2, "0")}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <Link href="/shop" className="brand-drop-button">Shop the drop <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
