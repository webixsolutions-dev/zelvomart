// Kept for the backend's launch tests and URL checker. The storefront's redirects live in
// storefront/lib/redirects.ts; this file gives the same answers without the trailing slash.
import { legacyPaths, storefrontRedirect } from "../../storefront/lib/redirects";

const bare = (target: string) => target.split("?")[0].replace(/\/+$/, "") || "/";

export const launchRedirects: Record<string, string> = Object.fromEntries(
  Object.entries(legacyPaths).map(([source, target]) => [source, bare(target)]),
);

export function launchRedirect(pathname: string) {
  const target = storefrontRedirect(pathname);
  return target ? bare(target) : null;
}
