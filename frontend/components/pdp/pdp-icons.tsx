import React from "react";

export const ICONS = {
  cash: ["M3 7h18v10H3z", "M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "M6.5 10v.01M17.5 14v.01"],
  truck: ["M2.5 6.5h11v10h-11z", "M13.5 10h4l3 3v3.5h-7z", "M7 19.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z", "M17 19.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z"],
  shield: ["M12 3l7.5 3v5.5c0 4.5-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5-7.5-9.5V6z", "M8.8 12.2l2.2 2.2 4.2-4.4"],
  exchange: ["M4 12a8 8 0 0 1 13.7-5.6L20 8.5", "M20 4v4.5h-4.5", "M20 12a8 8 0 0 1-13.7 5.6L4 15.5", "M4 20v-4.5h4.5"],
  gift: ["M3.5 9h17v4h-17z", "M5 13v7h14v-7", "M12 9v11", "M12 9c-1.5-4-5.5-4.5-5.5-2s3 2 5.5 2zM12 9c1.5-4 5.5-4.5 5.5-2s-3 2-5.5 2z"],
  heart: ["M12 20.5l-7.4-7.2a4.6 4.6 0 0 1 6.5-6.5L12 7.7l.9-.9a4.6 4.6 0 0 1 6.5 6.5z"],
  cart: ["M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6", "M9 20h.01M19 20h.01"],
  share: ["M8.7 13.3C8.9 12.9 9 12.5 9 12s-.1-.9-.3-1.3m0 2.6a3 3 0 1 1 0-2.6m0 2.6l6.6 3.3m-6.6-6l6.6-3.3m0 0a3 3 0 1 0 5.4-2.7 3 3 0 0 0-5.4 2.7zm0 9.3a3 3 0 1 0 5.4 2.7 3 3 0 0 0-5.4-2.7z"],
  expand: ["M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"],
  left: ["M15 6l-6 6 6 6"],
  right: ["M9 6l6 6-6 6"],
  arrow: ["M5 12h14M13 6l6 6-6 6"],
  doc: ["M6 3h9l4 4v14H6z", "M15 3v4h4", "M9 12h6M9 16h6"],
  sliders: ["M4 7h10M18 7h2M4 17h2M10 17h10", "M16 5v4M8 15v4"],
  box: ["M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z", "M3.5 7.5L12 12l8.5-4.5M12 12v9"],
  pencil: ["M4 20h4L19 9l-4-4L4 16z", "M13.5 6.5l4 4"],
  play: ["M8 5v14l11-7z"],
  close: ["M6 6l12 12M18 6L6 18"],
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "pdp-icon" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      fill={name === "play" ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function isValidImageUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") || trimmed.startsWith("data:")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getValidVideoEmbedUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace(/^\//, "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.replace(/^\//, "");
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

export const initials = (name: string) =>
  name.split(/\s[·–|-]\s/)[0].split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");