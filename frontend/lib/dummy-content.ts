import type { Category, Product } from "@/types/product";

export const DISPLAY_CATEGORY_SLUGS = [
  "home-living",
  "home-decor",
  "beauty-personal-care",
  "tech-gadgets",
  "fashion-accessories",
  "sports-fitness",
] as const;

export const CATEGORY_BLURBS: Record<string, string> = {
  "home-living": "Smart tools for everyday use",
  "home-decor": "Decorate your happy place",
  "beauty-personal-care": "Look good, feel confident",
  "tech-gadgets": "Everyday tech, made easy",
  "fashion-accessories": "Bags, jewelry & more",
  "sports-fitness": "Gear up, stay active",
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-home-living", name: "Home & Living", slug: "home-living", description: CATEGORY_BLURBS["home-living"], image: "/images/categories/home-living.svg" },
  { id: "cat-home-decor", name: "Home Decor", slug: "home-decor", description: CATEGORY_BLURBS["home-decor"], image: "/images/categories/home-decor.svg" },
  { id: "cat-beauty", name: "Beauty & Personal Care", slug: "beauty-personal-care", description: CATEGORY_BLURBS["beauty-personal-care"], image: "/images/categories/beauty-personal-care.svg" },
  { id: "cat-tech", name: "Tech & Gadgets", slug: "tech-gadgets", description: CATEGORY_BLURBS["tech-gadgets"], image: "/images/categories/tech-gadgets.svg" },
  { id: "cat-fashion", name: "Fashion Accessories", slug: "fashion-accessories", description: CATEGORY_BLURBS["fashion-accessories"], image: "/images/categories/fashion-accessories.svg" },
  { id: "cat-sports", name: "Sports & Fitness", slug: "sports-fitness", description: CATEGORY_BLURBS["sports-fitness"], image: "/images/categories/sports-fitness.svg" },
];

export function getDisplayCategories(categories: Category[]): Category[] {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  return DISPLAY_CATEGORY_SLUGS.map((slug) => bySlug.get(slug) || DEFAULT_CATEGORIES.find((category) => category.slug === slug)!).filter(Boolean);
}

function makeProduct(id: string, slug: string, name: string, regularPrice: number, image: string, categoryName: string, categorySlug: string, salePrice?: number): Product {
  const currentPrice = salePrice ?? regularPrice;
  const discountPercent = salePrice ? Math.round(((regularPrice - currentPrice) / regularPrice) * 100) : 0;
  return {
    id,
    slug,
    name,
    sku: slug.toUpperCase(),
    categories: [{ id: `${id}-cat`, name: categoryName, slug: categorySlug }],
    categorySlugs: [categorySlug],
    price: currentPrice,
    regularPrice,
    salePrice: salePrice ?? null,
    onSale: Boolean(salePrice),
    discountPercent,
    stockStatus: "instock",
    stockQuantity: 25,
    featured: true,
    averageRating: 4.7,
    reviewCount: 12,
    image,
    images: [{ src: image, alt: name }],
    shortDescription: `${name} available with Cash on Delivery across Pakistan.`,
    description: `<p>${name} is a Zelvomart showcase product. It includes clear pricing, stock information and convenient Cash on Delivery ordering.</p><p>Quality checked before dispatch. Contact us on WhatsApp if you need more product details.</p>`,
    hasOptions: false,
    variants: [],
    bundleEnabled: false,
    reviews: [],
    permalink: `/product/${slug}/`,
  };
}

const homeLiving = [
  makeProduct("hl1", "cordless-neck-shoulder-massager", "Cordless Neck & Shoulder Kneading Massager", 6499, "/images/categories/home-living.svg", "Home & Living", "home-living"),
  makeProduct("hl2", "foldable-laundry-basket", "Foldable Laundry Basket", 2199, "/images/categories/home-living.svg", "Home & Living", "home-living", 1799),
  makeProduct("hl3", "multi-purpose-storage-rack", "Multi-Purpose Storage Rack", 3499, "/images/categories/home-living.svg", "Home & Living", "home-living", 2899),
  makeProduct("hl4", "kitchen-organizer-set", "Kitchen Organizer Set", 2499, "/images/categories/home-living.svg", "Home & Living", "home-living"),
];
const homeDecor = [
  makeProduct("hd1", "wireless-desk-lamp", "Wireless Desk Lamp", 3399, "/images/categories/home-decor.svg", "Home Decor", "home-decor", 2899),
  makeProduct("hd2", "minimal-table-lamp", "Minimal Table Lamp", 3999, "/images/categories/home-decor.svg", "Home Decor", "home-decor", 3299),
  makeProduct("hd3", "decorative-wall-frame-set", "Decorative Wall Frame Set", 2799, "/images/categories/home-decor.svg", "Home Decor", "home-decor"),
  makeProduct("hd4", "ambient-night-light", "Ambient Night Light", 1999, "/images/categories/home-decor.svg", "Home Decor", "home-decor", 1599),
];
const beauty = [
  makeProduct("bw1", "shoulder-massager", "Cordless Neck & Shoulder Massager", 6499, "/images/categories/beauty-personal-care.svg", "Beauty & Personal Care", "beauty-personal-care"),
  makeProduct("bw2", "facial-cleaning-brush", "Facial Cleaning Brush", 1899, "/images/categories/beauty-personal-care.svg", "Beauty & Personal Care", "beauty-personal-care", 1499),
  makeProduct("bw3", "matte-liquid-lipgloss", "Emelie Matte Liquid Lipgloss", 1299, "/images/products/matte-liquid-lipgloss.jpeg", "Beauty & Personal Care", "beauty-personal-care", 999),
  makeProduct("bw4", "lip-eye-pencil", "Emelie Paris Matte Lip & Eye Pencil", 1299, "/images/categories/beauty-personal-care.svg", "Beauty & Personal Care", "beauty-personal-care", 999),
];
const tech = [
  makeProduct("tg1", "portable-mini-blender", "Portable Mini Blender", 2699, "/images/categories/tech-gadgets.svg", "Tech & Gadgets", "tech-gadgets", 2199),
  makeProduct("tg2", "smart-watch-series", "Everyday Smart Watch", 4999, "/images/categories/tech-gadgets.svg", "Tech & Gadgets", "tech-gadgets", 3999),
  makeProduct("tg3", "fast-charging-power-bank", "Fast Charging Power Bank", 4499, "/images/categories/tech-gadgets.svg", "Tech & Gadgets", "tech-gadgets", 3699),
  makeProduct("tg4", "wireless-earbuds", "Wireless Earbuds", 3599, "/images/categories/tech-gadgets.svg", "Tech & Gadgets", "tech-gadgets", 2899),
];
const fashion = [
  makeProduct("f1", "classic-gold-watch-set", "Classic Gold Watch Set", 3199, "/images/categories/fashion-accessories.svg", "Fashion Accessories", "fashion-accessories", 2499),
  makeProduct("f2", "crystal-jewelry-set", "Crystal Jewelry Set", 2799, "/images/categories/fashion-accessories.svg", "Fashion Accessories", "fashion-accessories", 2199),
  makeProduct("f3", "elegant-bracelet-watch", "Elegant Bracelet Watch", 2999, "/images/categories/fashion-accessories.svg", "Fashion Accessories", "fashion-accessories", 2399),
  makeProduct("f4", "gold-charm-set", "Gold Charm Set", 2499, "/images/categories/fashion-accessories.svg", "Fashion Accessories", "fashion-accessories", 1999),
];
const sports = [
  makeProduct("sf1", "adjustable-hand-gripper", "Adjustable Hand Gripper", 1899, "/images/categories/sports-fitness.svg", "Sports & Fitness", "sports-fitness", 1499),
  makeProduct("sf2", "resistance-band-set", "Resistance Band Set", 2599, "/images/categories/sports-fitness.svg", "Sports & Fitness", "sports-fitness", 1999),
  makeProduct("sf3", "home-workout-mat", "Home Workout Mat", 3499, "/images/categories/sports-fitness.svg", "Sports & Fitness", "sports-fitness", 2899),
  makeProduct("sf4", "sports-water-bottle", "Sports Water Bottle", 1499, "/images/categories/sports-fitness.svg", "Sports & Fitness", "sports-fitness", 1199),
];

export const DUMMY_PRODUCTS: Record<string, Product[]> = {
  "home-living": homeLiving,
  "home-decor": homeDecor,
  "beauty-personal-care": beauty,
  "tech-gadgets": tech,
  "fashion-accessories": fashion,
  "sports-fitness": sports,
  fashion,
  beauty,
  best: [homeLiving[0], sports[0], beauty[2], tech[1], fashion[0], homeDecor[0], tech[2], homeLiving[1]],
};

export const ALL_DUMMY_PRODUCTS = DISPLAY_CATEGORY_SLUGS.flatMap((slug) => DUMMY_PRODUCTS[slug]);

export const STATIC_BLOG_POSTS = [
  { title: "How to Shop Smart with Cash on Delivery", excerpt: "A simple checklist for choosing products, confirming your order and receiving your parcel with confidence.", tag: "Shopping Guide", date: "October 2026" },
  { title: "6 Everyday Products That Make Home Life Easier", excerpt: "Practical home and living picks designed to save time, reduce clutter and make daily routines simpler.", tag: "Home & Living", date: "October 2026" },
  { title: "Beauty & Personal Care Picks for Your Daily Routine", excerpt: "Easy-to-use beauty essentials and self-care products you can add to your everyday routine.", tag: "Beauty", date: "September 2026" },
  { title: "Tech Accessories Worth Keeping in Your Bag", excerpt: "From charging accessories to compact gadgets, here are useful tech products for work and travel.", tag: "Tech", date: "September 2026" },
  { title: "Simple Fitness Gear for Home Workouts", excerpt: "Build a practical home setup with compact fitness accessories that are easy to store and use.", tag: "Fitness", date: "September 2026" },
  { title: "What Happens After You Place an Order?", excerpt: "See how Zelvomart confirms, checks, dispatches and tracks orders before they reach your doorstep.", tag: "Orders", date: "August 2026" },
];

export const STATIC_PAGES: Record<string, { title: string; bodyHtml: string }> = {
  blog: {
    title: "Blog",
    bodyHtml: `
      <h2>Useful ideas for everyday shopping</h2>
      <p>The Zelvomart Blog is where we share practical buying guides, product roundups, care tips and store updates.</p>
      <h3>Shopping guides</h3>
      <p>Simple advice to help you compare products, understand features and choose what fits your routine.</p>
      <h3>Product inspiration</h3>
      <p>Discover useful ideas across home, beauty, tech, fashion and fitness without unnecessary clutter.</p>
      <h3>Order and delivery updates</h3>
      <p>We also use this space to explain how Cash on Delivery, order confirmation, dispatch and customer support work.</p>
      <p><a href="/shop"><strong>Explore the latest products →</strong></a></p>
    `,
  },
  "about-us": {
    title: "About Us",
    bodyHtml: `
      <h2>Shopping made simple for Pakistan</h2>
      <p>Zelvomart is an online shopping store focused on useful everyday products, clear pricing and a convenient Cash on Delivery experience.</p>
      <h3>Our goal</h3>
      <p>We want customers to discover practical products without a complicated checkout. Browse by category, check the product details, place your order and our team handles the rest.</p>
      <h3>What you can shop</h3>
      <ul><li>Home & Living essentials</li><li>Home Decor</li><li>Beauty & Personal Care</li><li>Tech & Gadgets</li><li>Fashion Accessories</li><li>Sports & Fitness</li></ul>
      <h3>Why Zelvomart?</h3>
      <ul><li>Cash on Delivery across Pakistan where available</li><li>Quality checking before dispatch</li><li>WhatsApp and phone support</li><li>Clear order confirmation and delivery updates</li></ul>
      <h3>Our promise</h3>
      <p>We keep the experience straightforward and customer-focused. If you need help choosing a product or checking an order, our support team is only a message away.</p>
    `,
  },
  "contact-us": {
    title: "Contact Us",
    bodyHtml: `
      <h2>We are here to help</h2>
      <p>Need help with an order, product details, delivery status or a general question? Contact the Zelvomart team through the channel that is easiest for you.</p>
      <h3>Customer support</h3>
      <ul><li><strong>Phone:</strong> +92 300-2026711</li><li><strong>WhatsApp:</strong> +92 300-2026711</li><li><strong>Email:</strong> zelvomart@gmail.com</li><li><strong>Service area:</strong> Pakistan</li></ul>
      <h3>Working hours</h3><p>Monday to Saturday — 10:00 AM to 8:00 PM.</p>
      <h3>For order support</h3><p>Please keep your order number and phone number ready so our team can find your order quickly.</p>
      <p><a href="https://wa.me/923002026711"><strong>Chat with us on WhatsApp →</strong></a></p>
    `,
  },
  faq: {
    title: "Frequently Asked Questions",
    bodyHtml: `<h2>Common questions</h2><h3>Do you offer Cash on Delivery?</h3><p>Yes, Cash on Delivery is available for most orders across Pakistan.</p><h3>How can I track my order?</h3><p>Use the Track Order page with your order number and phone, or contact us on WhatsApp.</p><h3>How long does delivery take?</h3><p>Delivery time depends on city and courier coverage. Our team confirms expected timing before or after dispatch.</p><h3>Do you check products before dispatch?</h3><p>Products are quality checked before dispatch where applicable.</p><h3>Can I order on WhatsApp?</h3><p>Yes. Send the product name or link to our WhatsApp number and our team can guide you.</p><h3>What if I receive the wrong or damaged product?</h3><p>Contact support as soon as possible with your order number and clear photos of the received item.</p>`,
  },
  "privacy-policy": { title: "Privacy Policy", bodyHtml: `<h2>Your privacy matters</h2><p>Zelvomart uses customer information to process orders, deliver parcels, provide support and improve the shopping experience.</p><h3>Information we may collect</h3><ul><li>Name and contact details</li><li>Delivery address and city</li><li>Order and product information</li><li>Basic website analytics and marketing attribution data</li><li>Privacy-masked session replay data such as clicks, scrolling and page navigation; form input values are masked</li></ul><h3>How we use it</h3><p>Information is used for order confirmation, delivery, customer support and store operations. We do not sell customer information.</p><h3>Questions</h3><p>Contact zelvomart@gmail.com if you have a privacy-related question.</p>` },
  "returns-exchange": { title: "Returns & Exchange", bodyHtml: `<h2>Returns & Exchange</h2><p>If you receive a damaged, defective or incorrect item, contact our support team within 48 hours of delivery with your order number and clear photos or video.</p><h3>Before returning an item</h3><ul><li>Keep original packaging where possible</li><li>Do not intentionally damage or alter the product</li><li>Provide order details and evidence of the issue</li></ul><h3>Resolution</h3><p>Depending on the case, our team may offer troubleshooting, replacement, exchange or another appropriate resolution.</p>` },
  "shipping-delivery": { title: "Shipping & Delivery", bodyHtml: `<h2>Delivery across Pakistan</h2><p>Zelvomart ships orders to supported cities across Pakistan. Cash on Delivery is available where courier service supports it.</p><h3>Order confirmation</h3><p>Orders may be confirmed by phone or WhatsApp before dispatch.</p><h3>Delivery time</h3><p>Typical delivery depends on destination city and courier operations. Remote locations may take longer.</p><h3>Tracking</h3><p>Once a tracking number is available, you can use the Track Order page or contact support for an update.</p>` },
  terms: { title: "Terms & Conditions", bodyHtml: `<h2>Terms & Conditions</h2><p>By browsing or ordering from Zelvomart, you agree to our store, payment, delivery and return terms.</p><h3>Orders</h3><p>Orders remain subject to stock availability, price verification and confirmation.</p><h3>Cash on Delivery</h3><p>Cash on Delivery is offered where supported. Customers should provide accurate contact and delivery information.</p><h3>Product information</h3><p>We aim to keep product descriptions and images accurate. Small presentation differences may occur.</p>` },
  "terms-conditions": { title: "Terms & Conditions", bodyHtml: `<h2>Terms & Conditions</h2><p>By browsing or ordering from Zelvomart, you agree to our store, payment, delivery and return terms.</p><h3>Orders</h3><p>Orders remain subject to stock availability, price verification and confirmation.</p><h3>Cash on Delivery</h3><p>Cash on Delivery is offered where supported. Customers should provide accurate contact and delivery information.</p><h3>Product information</h3><p>We aim to keep product descriptions and images accurate. Small presentation differences may occur.</p>` },
};
