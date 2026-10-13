function cachePathsForTags(tags: string[]) {
  const paths = new Set<string>();
  const refreshesCatalog = tags.some((tag) =>
    ['products', 'featured-products', 'categories', 'store'].includes(tag) ||
    tag.startsWith('product:') ||
    tag.startsWith('category:'),
  );
  if (refreshesCatalog) {
    paths.add('/');
    paths.add('/shop');
  }
  for (const tag of tags) {
    if (tag.startsWith('category:')) paths.add(`/product-category/${tag.slice('category:'.length)}/`);
    if (tag.startsWith('product:')) paths.add(`/product/${tag.slice('product:'.length)}/`);
  }
  return [...paths];
}

export async function invalidateFrontendCache(tags: string[]) {
  const secret = process.env.REVALIDATION_SECRET;
  const configuredFrontend = process.env.FRONTEND_URL?.split(',').map((value) => value.trim()).find(Boolean);
  if (!secret || !configuredFrontend || !tags.length) return;

  const endpoint = `${configuredFrontend.replace(/\/$/, '')}/api/revalidate`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidation-secret': secret,
      },
      body: JSON.stringify({
        tags: [...new Set(tags)],
        paths: cachePathsForTags(tags),
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok && process.env.NODE_ENV === 'development') {
      console.warn('Frontend cache invalidation failed:', response.status);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.warn('Frontend cache invalidation error:', error);
  }
}
