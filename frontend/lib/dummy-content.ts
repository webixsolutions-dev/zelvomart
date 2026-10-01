import type { Product } from "@/types/product";

export const CATEGORY_BLURBS: Record<string, string> = {
  "home-living": "Smart tools for everyday use",
  "home-decor": "Decorate your happy place",
  "beauty-personal-care": "Look good, feel confident",
  "tech-gadgets": "Everyday tech, made easy",
  "fashion-accessories": "Bags, jewelry & more",
  "sports-fitness": "Gear up, stay active",
  "kids-toys": "Fun that keeps them busy",
};

function makeProduct(id: string, slug: string, name: string, price: number, image: string, categoryName: string, categorySlug: string, salePrice?: number): Product {
  const regularPrice = salePrice ? Math.max(price, salePrice) : price;
  const currentPrice = salePrice ?? price;
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
    shortDescription: `${name} available with Cash on Delivery.`,
    description: `${name} dummy showcase product for the Zelvomart storefront.`,
    hasOptions: false,
    variants: [],
    bundleEnabled: false,
    reviews: [],
    permalink: `/product/${slug}/`,
  };
}

export const DUMMY_PRODUCTS: Record<string, Product[]> = {
  best: [
    makeProduct("b1", "cordless-neck-shoulder-massager", "Cordless Neck & Shoulder Kneading Massager", 6499, "/images/categories/home-living.svg", "Beauty & Wellness", "beauty-personal-care"),
    makeProduct("b2", "adjustable-hand-gripper", "Adjustable Hand Gripper", 1499, "/images/categories/sports-fitness.svg", "Sports & Fitness", "sports-fitness"),
    makeProduct("b3", "emelie-matte-liquid-lipgloss", "Emelie Matte Liquid Lipgloss", 999, "/images/categories/beauty-personal-care.svg", "Beauty & Wellness", "beauty-personal-care"),
    makeProduct("b4", "emelie-lip-eye-pencil", "Emelie Paris Matte Lip & Eye Pencil", 999, "/images/categories/beauty-personal-care.svg", "Beauty & Wellness", "beauty-personal-care"),
    makeProduct("b5", "portable-mini-blender", "Portable Mini Blender", 2199, "/images/categories/tech-gadgets.svg", "Tech & Gadgets", "tech-gadgets"),
    makeProduct("b6", "foldable-laundry-basket", "Foldable Laundry Basket", 1799, "/images/categories/home-living.svg", "Home & Living", "home-living"),
    makeProduct("b7", "kids-shape-sorting-train", "Kids Shape Sorting Train", 1599, "/images/categories/kids-toys.svg", "Kids & Toys", "kids-toys"),
    makeProduct("b8", "wireless-desk-lamp", "Wireless Desk Lamp", 2899, "/images/categories/home-decor.svg", "Home Decor", "home-decor"),
  ],
  fashion: [
    makeProduct("f1", "classic-gold-watch-set", "Classic Gold Watch Set", 2499, "/images/categories/fashion-accessories.svg", "Fashion Accessories", "fashion-accessories", 3199),
    makeProduct("f2", "crystal-jewelry-set", "Crystal Jewelry Set", 2199, "/images/categories/fashion-accessories.svg", "Fashion Accessories", "fashion-accessories", 2799),
    makeProduct("f3", "elegant-bracelet-watch", "Elegant Bracelet Watch", 2399, "/images/categories/fashion-accessories.svg", "Fashion Accessories", "fashion-accessories", 2999),
    makeProduct("f4", "gold-charm-set", "Gold Charm Set", 1999, "/images/categories/fashion-accessories.svg", "Fashion Accessories", "fashion-accessories", 2499),
  ],
  beauty: [
    makeProduct("bw1", "shoulder-massager", "Cordless Neck & Shoulder Massager", 6499, "/images/categories/beauty-personal-care.svg", "Beauty & Wellness", "beauty-personal-care"),
    makeProduct("bw2", "hand-gripper-fitness", "Adjustable Hand Gripper", 1499, "/images/categories/sports-fitness.svg", "Beauty & Wellness", "beauty-personal-care"),
    makeProduct("bw3", "matte-liquid-lipgloss", "Emelie Matte Liquid Lipgloss", 999, "/images/categories/beauty-personal-care.svg", "Beauty & Wellness", "beauty-personal-care"),
    makeProduct("bw4", "lip-eye-pencil", "Emelie Paris Matte Lip & Eye Pencil", 999, "/images/categories/beauty-personal-care.svg", "Beauty & Wellness", "beauty-personal-care"),
  ],
};

export const STATIC_PAGES: Record<string, { title: string; bodyHtml: string }> = {
  "about-us": {
    title: "About Us",
    bodyHtml: `
      <h2>Welcome to Zelvomart</h2>
      <p>Zelvomart is a Pakistan-focused online shopping store built around practical products, quick support and Cash on Delivery convenience.</p>
      <h3>What we offer</h3>
      <ul>
        <li>Trending home, beauty, tech, fashion and fitness products</li>
        <li>Customer-friendly ordering through website and WhatsApp</li>
        <li>Quality checked products before dispatch</li>
        <li>Fast communication and order tracking support</li>
      </ul>
      <h3>Why customers choose us</h3>
      <p>We aim to keep the shopping experience simple: easy browsing, secure checkout, clear product pages and a strong focus on Cash on Delivery across Pakistan.</p>
    `,
  },
  "contact-us": {
    title: "Contact Us",
    bodyHtml: `
      <h2>We are here to help</h2>
      <p>If you want help with an order, product inquiry, shipping status or wholesale questions, reach out to us any time.</p>
      <h3>Support details</h3>
      <ul>
        <li><strong>Phone:</strong> 0300-2026711</li>
        <li><strong>WhatsApp:</strong> 923002026711</li>
        <li><strong>Email:</strong> zelvomart@gmail.com</li>
      </ul>
      <h3>Working hours</h3>
      <p>Monday to Saturday — 10:00 AM to 8:00 PM</p>
      <p>For faster response, message us on WhatsApp with your order number.</p>
    `,
  },
  faq: {
    title: "Frequently Asked Questions",
    bodyHtml: `
      <h2>Common questions</h2>
      <h3>Do you offer Cash on Delivery?</h3><p>Yes, Cash on Delivery is available for most orders across Pakistan.</p>
      <h3>How can I track my order?</h3><p>You can use the Track Order page or contact us on WhatsApp.</p>
      <h3>Do you check products before dispatch?</h3><p>Yes, products are checked before dispatch where applicable.</p>
      <h3>Can I order on WhatsApp?</h3><p>Yes, you can place or confirm orders through WhatsApp.</p>
    `,
  },
  "privacy-policy": { title: "Privacy Policy", bodyHtml: `<h2>Privacy Policy</h2><p>Your information is used only to process orders, provide support and improve our service. We do not sell customer data.</p><p>Order-related data such as your name, phone, address and product details are stored only for operational use.</p>` },
  "returns-exchange": { title: "Returns & Exchange", bodyHtml: `<h2>Returns & Exchange</h2><p>If you receive a damaged or incorrect item, contact support within 48 hours with photos and your order number. Our team will guide you about replacement or return eligibility.</p>` },
  "shipping-delivery": { title: "Shipping & Delivery", bodyHtml: `<h2>Shipping & Delivery</h2><p>We deliver across Pakistan. Delivery timelines vary by city and courier coverage. Most orders are confirmed by phone or WhatsApp before dispatch.</p>` },
  "terms-conditions": { title: "Terms & Conditions", bodyHtml: `<h2>Terms & Conditions</h2><p>By using Zelvomart, you agree to our order verification, stock confirmation, delivery and return policies.</p>` },
};
