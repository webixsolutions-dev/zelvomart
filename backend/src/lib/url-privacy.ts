/** Keep public attribution, but remove credentials and customer details before telemetry leaves the browser. */
export function privateSafeUrl(value: string) {
  if (!value.trim()) return "";
  try {
    const url = new URL(value, "https://www.zelvomart.com");
    if (!/^https?:$/.test(url.protocol)) return "";
    for (const key of [...url.searchParams.keys()])
      if (
        /^(t|key|token|restore|coupon|email|phone|address|name|text|body|code|password|otp|access_token|auth|signature|sig|q|search)$/i.test(
          key,
        ) ||
        /^x-amz-/i.test(key)
      )
        url.searchParams.delete(key);
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

/** rrweb records DOM attributes as well as URLs. Clean full snapshots AND incremental mutations. */
export function sanitizeReplayEvent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeReplayEvent);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (typeof item === "string") {
        if (/^(href|src|action|formaction|poster|referrer|sourceUrl|currentUrl|landingUrl)$/i.test(key))
          return [key, privateSafeUrl(item)];
        if (/^(srcset|data-srcset)$/i.test(key) && /[?&](?:t|key|token|x-amz-[^=]*)=/i.test(item)) return [key, ""];
        if (/^(?:data-)?(?:token|secret|password|access_token|payment-token)$/i.test(key)) return [key, "[redacted]"];
      }
      return [key, sanitizeReplayEvent(item)];
    }),
  );
}

export function privatePaymentPath(pathname: string) {
  return /^\/(pay|order-confirmed)(?:\/|$)/.test(pathname);
}
