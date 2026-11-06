import locations from "../data/pakistan-cities.json";

const normalize = (text: string) =>
  text
    .toLocaleLowerCase("en-PK")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function citySuggestions(query: string) {
  const key = normalize(query);
  return locations
    .filter(
      (city) =>
        !key ||
        normalize(city.name).includes(key) ||
        normalize(city.postexCode).startsWith(key),
    )
    .sort(
      (a, b) =>
        Number(normalize(b.name).startsWith(key)) -
        Number(normalize(a.name).startsWith(key)),
    )
    .slice(0, 8)
    .map((city) => city.name);
}

/** Search the area/street, keeping the house or flat number out of the map lookup. */
export function addressSearchText(address: string) {
  const last = address.split(",").pop()?.trim() || "";
  return last
    .replace(
      /^(?:house|flat|plot|shop|office|apartment|unit)\s*(?:no\.?|#)?\s*[\w/-]+\s*/i,
      "",
    )
    .trim();
}

/** Selecting an area must never discard the customer's house/flat information. */
export function applyAddressSuggestion(address: string, suggestion: string) {
  const comma = address.lastIndexOf(",");
  if (comma >= 0) return `${address.slice(0, comma).trim()}, ${suggestion}`;
  const prefix = address
    .match(
      /^(?:house|flat|plot|shop|office|apartment|unit)\s*(?:no\.?|#)?\s*[\w/-]+\s*/i,
    )?.[0]
    ?.trim();
  return prefix ? `${prefix}, ${suggestion}` : suggestion;
}
