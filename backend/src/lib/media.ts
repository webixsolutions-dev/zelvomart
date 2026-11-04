import { mediaBase, mediaUrl } from "@zelvomart/media";

/**
 * Public media URL for what the backend prints itself (catalog feeds): the old R2 host becomes
 * NEXT_PUBLIC_MEDIA_BASE_URL, else S3_PUBLIC_BASE_URL, else it stays. Read time only; stored URLs never change.
 */
export function publicMediaUrl(url: string) {
  return mediaUrl(url, mediaBase(process.env));
}
