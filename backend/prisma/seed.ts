import { Prisma, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  ["Home & Living", "home-living", 10, "/images/categories/home-living.svg"],
  ["Home Decor", "home-decor", 20, "/images/categories/home-decor.svg"],
  ["Beauty & Personal Care", "beauty-personal-care", 30, "/images/categories/beauty-personal-care.svg"],
  ["Tech & Gadgets", "tech-gadgets", 40, "/images/categories/tech-gadgets.svg"],
  ["Fashion Accessories", "fashion-accessories", 50, "/images/categories/fashion-accessories.svg"],
  ["Sports & Fitness", "sports-fitness", 60, "/images/categories/sports-fitness.svg"],
  ["Kids & Toys", "kids-toys", 70, "/images/categories/kids-toys.svg"],
] as const;

const defaultSettings: Record<string, unknown> = {
  "store.info": {
    name: "Zelvomart",
    phone: "0300-2026711",
    email: "zelvomart@gmail.com",
    whatsapp: "923002026711",
    country: "Pakistan",
  },
  "store.announcement": {
    enabled: true,
    items: [
      "Quality Checked Before Dispatch",
      "Order Via WhatsApp or Website",
      "Cash on Delivery Across Pakistan",
      "Free Delivery on Orders Above Rs 8,000",
    ],
  },
  "store.bundleDefaultDiscountPercent": 5,
  "store.minimumSellingPrice": 1000,
  "store.delivery": {
    mode: "FREE",
    flatRate: 0,
    freeAbove: 0,
    codFee: 0,
  },
  "checkout.requiredFields": {
    fullName: true,
    phone: true,
    email: true,
    city: true,
    address: true,
    postcode: true,
    orderNotes: false,
    terms: true,
  },
  "payments.methods": ["COD"],
  "tracking.metaPixelId": "1645715973642563",
  "tracking.clarityId": "",
  "notifications.orderRecipients": ["zelvomart@gmail.com"],
  "postex.trackingBaseUrl": "https://postex.pk/tracking",
  "homepage.config": {
    heroKicker: "ZELVOMART • CASH ON DELIVERY",
    heroTitle: "Everyday finds, delivered across Pakistan.",
    heroBody:
      "Shop useful products for home, beauty, tech, fashion, fitness and more with convenient Cash on Delivery.",
    heroImage: "/images/hero/zelvomart-shopping.svg",
    popularCollectionsVideos: [],
  },
};

const defaultPages = [
  {
    slug: "blog",
    title: "Blog",
    bodyHtml:
      "<h2>Useful ideas for everyday shopping</h2><p>The Zelvomart Blog shares practical buying guides, product ideas, care tips and store updates.</p><h3>Shopping guides</h3><p>Compare products, understand features and choose what fits your routine.</p><h3>Product inspiration</h3><p>Discover useful ideas across home, beauty, tech, fashion and fitness.</p><p><a href=\"/shop\"><strong>Explore the latest products →</strong></a></p>",
  },
  {
    slug: "about-us",
    title: "About Us",
    bodyHtml:
      "<p>Zelvomart is an online store serving customers across Pakistan with quality-checked products and Cash on Delivery.</p>",
  },
  {
    slug: "contact-us",
    title: "Contact Us",
    bodyHtml:
      "<p>For order help or product questions, contact Zelvomart on WhatsApp or email.</p>",
  },
  {
    slug: "faq",
    title: "Frequently Asked Questions",
    bodyHtml:
      "<p>Common questions about ordering, delivery, Cash on Delivery, returns and support.</p>",
  },
  {
    slug: "shipping-delivery",
    title: "Shipping & Delivery",
    bodyHtml:
      "<p>Orders are confirmed before dispatch. Delivery estimates are shown during checkout and may vary by city.</p>",
  },
  {
    slug: "returns-exchange",
    title: "Returns & Exchange",
    bodyHtml:
      "<p>Return and exchange rules are managed by Zelvomart and should be reviewed before launch.</p>",
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    bodyHtml:
      "<p>Zelvomart stores only the information needed to process orders, provide support, prevent fraud and improve the store.</p>",
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    bodyHtml:
      "<p>These terms apply to orders placed through Zelvomart.</p>",
  },
];

const cities = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Gujranwala",
  "Sialkot",
  "Hyderabad",
  "Bahawalpur",
  "Sargodha",
  "Abbottabad",
  "Sukkur",
];

async function main() {
  for (const [name, slug, sortOrder, imageUrl] of categories) {
    await prisma.category.upsert({
      where: { slug },
      update: { name, sortOrder },
      create: { name, slug, sortOrder, imageUrl },
    });
  }

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as Prisma.InputJsonValue },
    });
  }

  for (const page of defaultPages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      update: {},
      create: page,
    });
  }

  for (const name of cities) {
    await prisma.city.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await prisma.sequence.upsert({
    where: { name: "order" },
    update: {},
    create: { name: "order", value: 10000 },
  });

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.upsert({
      where: { email },
      update: {
        name: "Owner",
        role: Role.OWNER,
        passwordHash,
        totpSecret: null,
        twoFactorReady: false,
        active: true,
      },
      create: {
        name: "Owner",
        email,
        passwordHash,
        role: Role.OWNER,
        totpSecret: null,
        twoFactorReady: false,
        active: true,
      },
    });
  }

  console.log("Zelvomart seed completed. No dummy products were created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
