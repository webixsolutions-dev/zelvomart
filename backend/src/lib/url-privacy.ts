/** Keep attribution parameters, but never retain confirmation keys or personal query values. */
export function privateSafeUrl(value: string) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()])
      if (/^(key|token|restore|coupon|email|phone|address|name|access_token|auth|q|search)$/i.test(key))
        url.searchParams.delete(key);
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}
