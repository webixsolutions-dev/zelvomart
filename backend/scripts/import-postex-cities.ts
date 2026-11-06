import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";

/** Source: the owner's PostEx "Coverage area list 800+.xlsx", supplied 6 November 2026. */
async function main() {
  const locations = JSON.parse(
    await readFile(resolve(__dirname, "../../frontend/storefront/data/pakistan-cities.json"), "utf8"),
  ) as { name: string; postexCode: string }[];
  const existing = new Map((await prisma.city.findMany()).map((city) => [city.name.toLowerCase(), city]));
  const added = locations.filter((city) => !existing.has(city.name.toLowerCase()));
  await prisma.$transaction([
    ...locations
      .filter((city) => existing.has(city.name.toLowerCase()))
      .map((city) =>
        prisma.city.update({
          where: { id: existing.get(city.name.toLowerCase())!.id },
          data: { postexCode: city.postexCode },
        }),
      ),
    prisma.city.createMany({ data: added.map(({ name, postexCode }) => ({ name, postexCode })), skipDuplicates: true }),
  ]);
  console.log(
    `Imported ${locations.length} PostEx locations (${added.length} new). Existing delivery estimates were preserved.`,
  );
}
main().finally(() => prisma.$disconnect());
