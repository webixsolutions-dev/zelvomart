import { prisma } from "../src/lib/db";
import { policyPages } from "../prisma/policy-pages";

/**
 * Creates the four policy pages Admin → Pages edits (privacy-policy, terms-conditions, shipping-policy,
 * refund_returns). A page that already exists is never overwritten, unless it still holds the exact
 * one-line placeholder an older seed created (that one never had real content).
 * Run once per database: `npm run pages:policies --workspace backend`.
 */
const OLD_PLACEHOLDERS: Record<string, string> = {
  "privacy-policy": "<p>Zelvomart stores only the information needed to process orders, provide support, prevent fraud and improve the store.</p>",
};

export async function seedPolicyPages(log: (line: string) => void = console.log) {
  for (const page of policyPages) {
    const existing = await prisma.page.findUnique({ where: { slug: page.slug } });
    if (!existing) {
      await prisma.page.create({ data: { ...page, published: true } });
      log(`created  /${page.slug}/`);
    } else if (existing.bodyHtml.trim() === OLD_PLACEHOLDERS[page.slug]) {
      await prisma.page.update({ where: { slug: page.slug }, data: { ...page, published: true } });
      log(`replaced /${page.slug}/ (it held the old seed placeholder)`);
    } else {
      log(`kept     /${page.slug}/ (already exists, left as it is)`);
    }
  }
}

if (require.main === module) {
  seedPolicyPages()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
