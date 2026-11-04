// Isolated visual review only: never writes to the store or storage.
let serial = 0;
export async function uploadAdminImage(_file: Blob, name?: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 35));
  return `review-only://${++serial}/${encodeURIComponent(name || 'image')}`;
}
export async function clientApi<T = unknown>(path: string, _init?: RequestInit, _admin?: boolean): Promise<T> {
  if (!/^\/api\/admin\/products\/demo-\d+\/images$/.test(path)) throw new Error('Review data only');
  return {} as T;
}
