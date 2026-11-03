import { prisma } from "./db";
import { memo, MEMO_TTL_MS } from "./memo";

/**
 * One city by its exact name (active or not), from a 60 s copy of the City table (lib/memo.ts).
 * Saving cities in admin refreshes the "cities" tag, which clears this copy at once.
 */
export async function cityByName(name: string) {
  const all = await memo("cities:byName", MEMO_TTL_MS, async () => {
    const rows = await prisma.city.findMany();
    return new Map(rows.map((row) => [row.name, row]));
  });
  return all.get(name) ?? null;
}
