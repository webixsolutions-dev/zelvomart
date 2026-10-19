// Analytics never receives checkout identifiers, search text or arbitrary query values.
export function analyticsPageUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    if (/^\/(admin|account|my-account)(\/|$)/.test(url.pathname)) return null;
    if (/^\/(checkout\/success|order-confirmed)(\/|$)/.test(url.pathname)) url.pathname = '/order-confirmed';
    return url.toString();
  } catch { return null; }
}
