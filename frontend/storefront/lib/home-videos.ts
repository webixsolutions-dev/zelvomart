/**
 * Home page videos: compressed MP4 files and posters on Cloudflare R2 (bucket zelvomart-media, folder videos/).
 * To add or change a video, upload the .mp4 and its .jpg poster to R2 and edit a row here. Videos are never
 * committed to the repo. Names with spaces must be URL-encoded (%20). The shorts play in this order.
 */
const R2_VIDEOS =
  // Local testing only: point the tiles at another server. Production uses the R2 folder.
  process.env.NEXT_PUBLIC_HOME_VIDEO_BASE || "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/videos/";

export type HomeVideo = { id: string; title: string; src: string; poster: string };

const video = (id: string, title: string, file: string, poster = file): HomeVideo => ({
  id,
  title,
  src: `${R2_VIDEOS}${file}.mp4`,
  poster: `${R2_VIDEOS}${poster}.jpg`,
});

/** Watch & Discover: vertical 9:16 shorts. */
export const homeShorts: HomeVideo[] = [
  video("short-1", "Handbag with Shoulder Strap", "Handbag%20with%20Shoulder%20Strap"),
  video("short-2", "Rhode Lip Tint", "Zelvomart-Rhode-Lip-Tint"),
  video("short-3", "Sip in Style", "sip-in-style"),
  video("short-4", "Heart Pendant", "Zelvomart%20heart-pendant"),
  video("short-5", "Floor Scrubber", "Zelvomart-Floor-Scrubber"),
];

/** The unboxing section (vertical video in a wide frame; the poster is made for the frame, 960×612). */
export const unboxingVideo: HomeVideo = video(
  "unboxing",
  "Pack an Order With Me — Zelvomart jewellery packing",
  "Zelvomart%20The%20unboxing",
  "pack-an-order",
);
