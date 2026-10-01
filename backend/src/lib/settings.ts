import { prisma } from "./db";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return (row?.value as T | undefined) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  return prisma.setting.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  });
}

export async function getSettings(keys: string[]) {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
