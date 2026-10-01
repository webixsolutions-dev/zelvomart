"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function nextMidnight() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(23, 59, 59, 999);
  return target;
}

export default function FlashDealBanner() {
  const endAt = useMemo(() => nextMidnight().getTime(), []);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const diff = Math.max(0, endAt - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const items = [
    { value: days, label: "Days" },
    { value: hours, label: "Hours" },
    { value: minutes, label: "Minutes" },
    { value: seconds, label: "Seconds" },
  ];

  return (
    <section className="section flash-section">
      <div className="site-shell">
        <div className="flash-banner">
          <div className="flash-copy">
            <span className="flash-icon">⚡</span>
            <div>
              <h2>Flash Deal</h2>
              <p>Hurry up! Deal ends soon. Grab your favourites with Cash on Delivery.</p>
            </div>
          </div>

          <div className="flash-side">
            <div className="flash-timer">
              {items.map((item) => (
                <div className="flash-box" key={item.label}>
                  <strong>{String(item.value).padStart(2, "0")}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <Link href="/shop" className="btn-dark">Shop Deals</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
