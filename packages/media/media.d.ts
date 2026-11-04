export const LEGACY_MEDIA_HOST: string;
export function mediaBase(env?: { NEXT_PUBLIC_MEDIA_BASE_URL?: string; S3_PUBLIC_BASE_URL?: string }): string;
export function mediaUrl<T>(url: T, base: string): T;
export function mediaHtml<T>(html: T, base: string): T;
