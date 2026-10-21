import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();
const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

async function check(path: string) {
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  return { path, status: response.status, location: response.headers.get("location") };
}

async function main() {
  const products = await prisma.product.findMany({ select: { slug: true } });
  const categories = await prisma.category.findMany({ select: { slug: true } });
  const paths = [
    "/",
    "/shop/",
    ...products.map((row) => `/product/${row.slug}/`),
    ...categories.map((row) => `/product-category/${row.slug}/`),
  ];
  const failures = [] as any[];
  for (const path of paths) {
    const result = await check(path);
    if (![200, 301, 302, 307, 308].includes(result.status)) failures.push(result);
  }
  console.table(failures);
  if (failures.length) process.exitCode = 1;
  else console.log(`Checked ${paths.length} URLs successfully.`);
}

main().finally(() => prisma.$disconnect());
