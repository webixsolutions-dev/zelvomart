type Feature = { properties?: Record<string, unknown> };
const normal = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function pakistanAddressSuggestions(features: Feature[], city: string) {
  const selected = normal(city);
  return [
    ...new Set(
      features.flatMap(({ properties: p }) => {
        if (!p || String(p.countrycode).toUpperCase() !== "PK") return [];
        const localities = [p.city, p.county, p.district, p.locality, p.name].map(normal);
        if (!localities.some((place) => place === selected || place.startsWith(`${selected} `))) return [];
        const parts = [p.name, p.street, p.suburb, p.district].filter(
          (part) => typeof part === "string" && part.trim() && normal(part) !== selected,
        );
        const label = [...new Set(parts.map((part) => String(part).trim()))].join(", ");
        return label && label.length <= 200 ? [label] : [];
      }),
    ),
  ].slice(0, 6);
}

// Public map names only; never cache customer names, contact details or complete checkout payloads.
const cache = new Map<string, { at: number; suggestions: string[] }>();
export async function addressSuggestions(city: string, query: string) {
  if (
    city.length < 2 ||
    city.length > 100 ||
    query.length < 3 ||
    query.length > 120 ||
    /@|https?:|(?:\d[\s-]*){7,}/i.test(query)
  )
    return [];
  const key = `${normal(city)}:${normal(query)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 600_000) return cached.suggestions;
  // Photon supports search-as-you-type; unlike the Nominatim public API, this use is permitted at moderate volume.
  const endpoint = new URL(process.env.ADDRESS_SUGGESTIONS_URL || "https://photon.komoot.io/api/");
  endpoint.search = new URLSearchParams({
    q: `${query}, ${city}, Pakistan`,
    countrycode: "PK",
    limit: "8",
    lang: "en",
  }).toString();
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(2500),
    headers: { accept: "application/json" },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { features?: Feature[] };
  const suggestions = pakistanAddressSuggestions(Array.isArray(data.features) ? data.features.slice(0, 20) : [], city);
  if (cache.size >= 300) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), suggestions });
  return suggestions;
}
