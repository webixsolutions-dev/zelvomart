// Keep identical to backend/src/lib/product-video.ts.
// Product video = a YouTube or Vimeo link only (no uploads). The player loads after a click.

export type ProductVideo = {
  provider: "youtube" | "vimeo";
  id: string;
  /** Normalised link that is stored. */
  url: string;
  /** Player URL; autoplay because it only loads after the shopper clicks play. */
  embedUrl: string;
  /** Thumbnail shown before the click. Vimeo has no fixed URL: it comes from oEmbed when saved. */
  thumbnailUrl: string | null;
};

export const VIDEO_URL_ERROR = "Paste a YouTube link (youtube.com/watch, youtu.be or youtube.com/shorts) or a Vimeo link.";

export function parseVideoUrl(input: unknown): ProductVideo | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  let youtubeId = "";
  if (host === "youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") youtubeId = url.searchParams.get("v") || "";
    else {
      const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
      youtubeId = match?.[1] || "";
    }
  } else if (host === "youtu.be") {
    youtubeId = url.pathname.slice(1).split("/")[0] || "";
  } else if (host === "youtube-nocookie.com") {
    youtubeId = url.pathname.match(/^\/embed\/([\w-]+)/)?.[1] || "";
  }
  if (youtubeId) {
    if (!/^[\w-]{11}$/.test(youtubeId)) return null;
    return {
      provider: "youtube",
      id: youtubeId,
      url: `https://www.youtube.com/watch?v=${youtubeId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`,
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = url.pathname.match(/(?:^|\/)(?:video\/)?(\d{6,})(?:\/([\da-f]+))?/i);
    if (!match) return null;
    const id = match[1];
    const hash = match[2] || url.searchParams.get("h") || "";
    return {
      provider: "vimeo",
      id,
      url: `https://vimeo.com/${id}${hash ? `/${hash}` : ""}`,
      embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1${hash ? `&h=${hash}` : ""}`,
      thumbnailUrl: null,
    };
  }
  return null;
}
