import { prisma } from "./db";
import { forget, memo, MEMO_TTL_MS } from "./memo";

/**
 * Store settings. Every setting except the large, rarely read groups below is loaded in ONE query and kept for
 * 60 s (lib/memo.ts), so a request that reads several settings, or many requests in a row, cost no extra reads.
 * A save (setSetting, or any route that refreshes the storefront "settings" tag) clears the copy at once.
 */
const UNCACHED_PREFIXES = ["feed.", "health."];
const uncached = (key: string) => UNCACHED_PREFIXES.some((prefix) => key.startsWith(prefix));

function cachedSettings() {
  return memo("settings:all", MEMO_TTL_MS, async () => {
    const rows = await prisma.setting.findMany({
      where: { NOT: UNCACHED_PREFIXES.map((prefix) => ({ key: { startsWith: prefix } })) },
      select: { key: true, value: true },
    });
    return new Map(rows.map((row) => [row.key, row.value]));
  });
}

export function forgetSettings() {
  forget("settings:");
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  if (uncached(key)) {
    const row = await prisma.setting.findUnique({ where: { key } });
    return (row?.value as T | undefined) ?? fallback;
  }
  return ((await cachedSettings()).get(key) as T | undefined) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  const row = await prisma.setting.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  });
  if (!uncached(key)) forgetSettings();
  return row;
}

export async function getSettings(keys: string[]) {
  const direct = keys.filter(uncached);
  const all = await cachedSettings();
  const out: Record<string, unknown> = {};
  for (const key of keys) if (!uncached(key) && all.has(key)) out[key] = all.get(key);
  if (direct.length) {
    const rows = await prisma.setting.findMany({ where: { key: { in: direct } } });
    for (const row of rows) out[row.key] = row.value;
  }
  return out;
}
