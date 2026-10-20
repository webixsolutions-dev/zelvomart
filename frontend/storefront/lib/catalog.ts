/**
 * Mock catalog. Shape mirrors what the backend/API should eventually return,
 * so swapping this file for a fetch layer is the only change pages need.
 * Product photos are concept crops — replace with real SKU photography.
 */

export type CategoryId =
  | "home-living"
  | "home-decor"
  | "beauty"
  | "tech"
  | "fashion"
  | "fitness"
  | "kids";

export type Category = {
  id: CategoryId;
  /** URL segment, spelled out from `name` (e.g. Tech & Gadgets → tech-and-gadgets). */
  slug: string;
  name: string;
  short: string;
  tagline: string;
  intro: string;
  label: string;
  image: string;
  tile: string;
  banner: string;
  bannerMobile: string;
  seoTitle: string;
  seoDescription: string;
  /** Paragraph shown under the product grid on the category page. */
  about: string;
};

/** A colour or size option. `imageUrl` switches the gallery and shows an image swatch; `soldOut` crosses a size out. */
export type Variant = { name: string; swatch?: string; imageUrl?: string; soldOut?: boolean };

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: CategoryId;
  price: number;
  compare?: number;
  image: string;
  badge?: "Bestseller" | "New in" | "Popular" | "Gift pick" | "Limited";
  isNew?: boolean;
  isBestseller?: boolean;
  tagline: string;
  description: string;
  highlights: string[];
  idealFor: string[];
  specs: [string, string][];
  inBox: string[];
  /** `kind` picks the layout; when omitted, labels containing "size" show size chips and everything else colour options. */
  variants?: { label: string; kind?: "colour" | "size"; options: Variant[] };
  /** "Choose your bundle" (Buy 1 / Buy 2) shows only when this is on. */
  bundleEnabled?: boolean;
  /** Discount on the Buy 2 bundle, in percent. */
  bundleDiscountPercent?: number;
  keywords: string[];
  /** Omitted products are treated as in stock. */
  inStock?: boolean;
  /** Average of approved reviews (0–5) and how many there are. Omitted = no reviews yet. */
  rating?: number;
  reviewCount?: number;
  /** Meta title written for this product in the admin (without "| Zelvomart"). Falls back to "{name} Price in Pakistan". */
  seoTitle?: string;
  /** Meta description written for this product in the admin (140–155 characters). */
  seoDescription?: string;
};

const img = (name: string) => `/images/products/${name}.webp`;

export const categories: Category[] = [
  {
    id: "home-living",
    slug: "home-and-living",
    name: "Home & Living",
    short: "Home & Living",
    tagline: "Practical essentials for everyday life.",
    intro:
      "Everyday essentials for the kitchen, storage and daily routines, chosen to make home life simpler.",
    label: "Daily essentials",
    image: "/categories/home-living-600.webp",
    tile: "/images/categories/home-living.webp",
    banner: "/images/banners/desktop/category-home-living.webp",
    bannerMobile: "/images/banners/mobile/category-home-living.webp",
    seoTitle: "Tumblers, Storage & Home Essentials in Pakistan",
    seoDescription:
      "Shop insulated tumblers, storage organisers and everyday home and kitchen essentials at Zelvomart, chosen for daily use. Order online across Pakistan.",
    about:
      "The Home & Living range at Zelvomart covers the things you reach for every day: insulated tumblers and drinkware, storage organisers, kitchen helpers and household essentials. Every product page lists the size, material and what comes in the box, so you know exactly what you are ordering. New pieces are added regularly as we find items that earn their place in a Pakistani home.",
  },
  {
    id: "home-decor",
    slug: "home-decor",
    name: "Home Decor",
    short: "Home Decor",
    tagline: "Beautiful details that feel like home.",
    intro:
      "Decor pieces that add warmth, light and character to bedrooms, lounges and work corners.",
    label: "Refresh your space",
    image: "/categories/home-decor-600.webp",
    tile: "/images/categories/home-decor.webp",
    banner: "/images/banners/desktop/category-home-decor.webp",
    bannerMobile: "/images/banners/mobile/category-home-decor.webp",
    seoTitle: "Lamps, Humidifiers & Home Decor in Pakistan",
    seoDescription:
      "Table lamps, mist humidifiers and modern decor accents from Zelvomart that make any room feel calm and finished. Cash on Delivery across Pakistan.",
    about:
      "The Home Decor range at Zelvomart brings together table lamps, mist humidifiers, diffusers and decor accents for bedrooms, lounges and work corners. We choose pieces that look good and do a job, such as soft evening light or a calmer room. Each listing shows real photos, sizes and what is included, and our team on WhatsApp can help you choose.",
  },
  {
    id: "beauty",
    slug: "beauty-and-personal-care",
    name: "Beauty & Personal Care",
    short: "Beauty",
    tagline: "Everyday beauty and self-care picks.",
    intro:
      "Makeup, fragrance and daily care essentials, with shade, size and usage details on every product.",
    label: "Beauty staples",
    image: "/categories/beauty-600.webp",
    tile: "/images/categories/beauty.webp",
    banner: "/images/banners/desktop/category-beauty.webp",
    bannerMobile: "/images/banners/mobile/category-beauty.webp",
    seoTitle: "Lipgloss, Perfume & Skincare Online in Pakistan",
    seoDescription:
      "Shop lipgloss, perfume, makeup and daily skincare essentials at Zelvomart, with shade, size and full details on every product. Order online in Pakistan.",
    about:
      "The Beauty & Personal Care range at Zelvomart covers lipgloss, lip and eye pencils, perfume and everyday skincare. Every listing gives the shade or size, how to use it and what is in the pack, so you can choose with confidence. If you are unsure which shade suits you, message us on WhatsApp before you order.",
  },
  {
    id: "tech",
    slug: "tech-and-gadgets",
    name: "Tech & Gadgets",
    short: "Tech",
    tagline: "Smart tech for your everyday routine.",
    intro:
      "Practical everyday tech for work, travel and home, explained in plain language.",
    label: "Useful gadgets",
    image: "/categories/tech-600.webp",
    tile: "/images/categories/tech.webp",
    banner: "/images/banners/desktop/category-tech.webp",
    bannerMobile: "/images/banners/mobile/category-tech.webp",
    seoTitle: "Earbuds, Smart Watches & Gadgets in Pakistan",
    seoDescription:
      "Buy wireless earbuds, headphones, smart watches and everyday gadgets at Zelvomart, with clear specs on every product. Order online or on WhatsApp.",
    about:
      "The Tech & Gadgets range at Zelvomart is for useful everyday tech: wireless earbuds, over-ear headphones, smart watches and handy gadgets for work, travel and home. Each product page lists battery life, connectivity and what is in the box, in plain language rather than jargon.",
  },
  {
    id: "fashion",
    slug: "fashion-accessories",
    name: "Fashion Accessories",
    short: "Fashion",
    tagline: "Accessories for every mood and moment.",
    intro:
      "Bags, jewellery and accessories for everyday wear, office days and special occasions.",
    label: "Wear your style",
    image: "/categories/fashion-600.webp",
    tile: "/images/categories/fashion.webp",
    banner: "/images/banners/desktop/category-fashion.webp",
    bannerMobile: "/images/banners/mobile/category-fashion.webp",
    seoTitle: "Handbags, Clutches & Jewellery Sets in Pakistan",
    seoDescription:
      "Shop women’s handbags, clutches and jewellery gift sets at Zelvomart, for office days, Eid and weddings. Cash on Delivery available all over Pakistan.",
    about:
      "The Fashion Accessories range at Zelvomart includes women’s handbags, clutches, jewellery sets and watch gift sets for everyday wear, office days and occasions like Eid and weddings. Each listing shows colours, sizes and exactly how many pieces come in a set, with real photos of the item.",
  },
  {
    id: "fitness",
    slug: "sports-and-fitness",
    name: "Sports & Fitness",
    short: "Fitness",
    tagline: "Make every move count.",
    intro:
      "Workout and fitness gear for home training and active days, compact enough for any space.",
    label: "Fitness favourites",
    image: "/categories/fitness-600.webp",
    tile: "/images/categories/fitness.webp",
    banner: "/images/banners/desktop/category-fitness.webp",
    bannerMobile: "/images/banners/mobile/category-fitness.webp",
    seoTitle: "Yoga Mats, Grippers & Fitness Gear in Pakistan",
    seoDescription:
      "Hand grippers, yoga mats and home workout gear from Zelvomart, compact enough for any room and built for daily training. Order online across Pakistan.",
    about:
      "The Sports & Fitness range at Zelvomart is built around home workouts and active days: hand grippers, yoga mats, workout kits and gear that fits a small space and a busy schedule. Every product page explains what it trains, how to use it safely and what comes in the box.",
  },
  {
    id: "kids",
    slug: "kids-and-toys",
    name: "Kids & Toys",
    short: "Kids",
    tagline: "More playful moments, more creativity.",
    intro:
      "Creative, screen-free toys and kids’ essentials that keep children playing and learning.",
    label: "Play & create",
    image: "/categories/kids-600.webp",
    tile: "/images/categories/kids.webp",
    banner: "/images/banners/desktop/category-kids.webp",
    bannerMobile: "/images/banners/mobile/category-kids.webp",
    seoTitle: "Kids Toys, Magnetic Tiles & Plush in Pakistan",
    seoDescription:
      "Magnetic building tiles, soft plush toys and screen-free toys for kids at Zelvomart, ideal for gifts. Shop online in Pakistan with Cash on Delivery.",
    about:
      "The Kids & Toys range at Zelvomart focuses on creative, screen-free play: magnetic building tiles, soft plush toys and learning toys that keep children busy and thinking. Each listing gives the suggested age, the number of pieces and safety notes, so parents know exactly what they are buying.",
  },
];

export const products: Product[] = [
  {
    id: "handbag",
    slug: "textured-handbag-with-shoulder-strap",
    sku: "ZLV-FA-1001",
    name: "Textured Handbag with Shoulder Strap",
    category: "fashion",
    price: 2899,
    compare: 3499,
    image: img("handbag"),
    badge: "Popular",
    isBestseller: true,
    tagline: "Structured enough for the office, relaxed enough for the weekend.",
    description:
      "A quilted-texture handbag with a sturdy top handle and a detachable shoulder strap, sized for the everyday essentials — phone, wallet, keys, sunglasses and a small pouch. The structured silhouette keeps its shape on the go, while gold-tone hardware adds a polished finish that pairs with both western and eastern wear.",
    highlights: [
      "Quilted textured finish with gold-tone hardware",
      "Top handle plus detachable, adjustable shoulder strap",
      "Roomy main compartment with inner slip pocket",
      "Secure zip closure for daily commutes",
    ],
    idealFor: ["Office & university days", "Dinners and family events", "Gifting for birthdays and Eid"],
    specs: [
      ["Style", "Structured top-handle handbag"],
      ["Carry options", "Hand carry, shoulder"],
      ["Closure", "Zip"],
      ["Material", "PU leather (verify per SKU)"],
      ["Approx. size", "28 × 20 × 12 cm"],
    ],
    inBox: ["1 × Handbag", "1 × Shoulder strap", "Dust bag (where available)"],
    variants: {
      label: "Colour",
      options: [
        { name: "Nude Beige", swatch: "#d9bfa3" },
        { name: "Midnight Black", swatch: "#1f2328" },
        { name: "Blush", swatch: "#e8b4b2" },
      ],
    },
    keywords: ["bag", "purse", "women", "handbag", "shoulder bag", "ladies bag"],
  },
  {
    id: "tumbler",
    slug: "1200ml-insulated-tumbler-with-handle",
    sku: "ZLV-HL-2001",
    name: "1200ml Insulated Tumbler with Handle",
    category: "home-living",
    price: 1999,
    compare: 2499,
    image: img("insulated-tumbler"),
    badge: "Bestseller",
    isBestseller: true,
    tagline: "Big-capacity hydration that keeps up with Pakistani summers.",
    description:
      "A 1200ml double-wall stainless steel tumbler built for long days. The vacuum insulation keeps water and iced drinks cold for hours and chai hot through the morning, while the comfortable side handle and car-cup-friendly base make it easy to carry from home to office to gym.",
    highlights: [
      "Generous 1200ml (40oz) capacity — fewer refills",
      "Double-wall vacuum insulation, no outside condensation",
      "Ergonomic handle and cup-holder friendly base",
      "Leak-resistant lid with straw opening",
    ],
    idealFor: ["Office desks and long commutes", "Gym and outdoor days", "Staying hydrated in summer heat"],
    specs: [
      ["Capacity", "1200ml"],
      ["Body", "Stainless steel, double-wall"],
      ["Lid", "Press-fit lid with straw"],
      ["Care", "Hand wash recommended"],
    ],
    inBox: ["1 × Tumbler", "1 × Lid", "1 × Reusable straw"],
    variants: {
      label: "Colour",
      options: [
        { name: "Cream", swatch: "#efe6d6" },
        { name: "Sage", swatch: "#9caf98" },
        { name: "Blush Pink", swatch: "#eab5bd" },
        { name: "Charcoal", swatch: "#3a3f45" },
      ],
    },
    bundleEnabled: true,
    bundleDiscountPercent: 10,
    keywords: ["bottle", "tumbler", "water bottle", "stanley", "flask", "cup", "mug"],
  },
  {
    id: "magnetic-toy",
    slug: "magnetic-building-blocks-set",
    sku: "ZLV-KT-7001",
    name: "Magnetic Building Blocks Set",
    category: "kids",
    price: 2349,
    compare: 2799,
    image: img("magnetic-building-set"),
    badge: "Bestseller",
    isBestseller: true,
    tagline: "Click, build, rebuild — creativity that never runs out.",
    description:
      "Colourful translucent magnetic tiles that snap together to build houses, towers, cars and anything in between. Kids learn shapes, colours and early engineering through hands-on play, and the pieces store flat once the castle comes down.",
    highlights: [
      "Strong magnets for satisfying, stable builds",
      "Bright translucent colours that glow in daylight",
      "Builds 2D patterns and 3D structures",
      "Encourages screen-free, open-ended play",
    ],
    idealFor: ["Ages 3+ (check pack guidance)", "Birthday and Eid gifts", "Play dates and quiet afternoons"],
    specs: [
      ["Recommended age", "3 years and above"],
      ["Material", "ABS plastic with embedded magnets"],
      ["Pieces", "Varies by pack (shown at checkout)"],
      ["Safety", "Adult supervision for younger kids"],
    ],
    inBox: ["Magnetic tiles set", "Storage box (where available)"],
    keywords: ["toy", "kids", "magnetic tiles", "building blocks", "stem", "lego", "educational"],
  },
  {
    id: "gripper",
    slug: "adjustable-hand-gripper",
    sku: "ZLV-SF-6001",
    name: "Adjustable Hand Gripper",
    category: "fitness",
    price: 1299,
    compare: 1599,
    image: img("hand-gripper"),
    isBestseller: true,
    tagline: "Pocket-sized grip training for stronger hands and forearms.",
    description:
      "An adjustable-resistance hand gripper that grows with your strength. Dial up the tension as you progress, train during breaks or while watching TV, and build the grip strength that helps with lifting, sports and everyday carrying.",
    highlights: [
      "Adjustable resistance — start light, progress steadily",
      "Non-slip ergonomic handles",
      "Compact enough for a desk drawer or gym bag",
      "Great for rehab-style light training (consult a professional)",
    ],
    idealFor: ["Home and office workouts", "Climbers, lifters and cricketers", "Desk-job wrist breaks"],
    specs: [
      ["Resistance", "Adjustable (range varies by model)"],
      ["Handles", "Non-slip foam/rubber grip"],
      ["Spring", "Steel coil"],
    ],
    inBox: ["1 × Hand gripper"],
    keywords: ["gripper", "hand grip", "forearm", "exercise", "gym", "workout"],
  },
  {
    id: "lipgloss",
    slug: "emelie-matte-liquid-lipgloss",
    sku: "ZLV-BP-3001",
    name: "Emelie Matte Liquid Lipgloss",
    category: "beauty",
    price: 1499,
    compare: 1799,
    image: img("lip-gloss"),
    badge: "New in",
    isNew: true,
    isBestseller: true,
    tagline: "Soft-matte colour with an easy, everyday glide.",
    description:
      "A liquid lip colour that applies smooth and sets to a soft matte finish. The precise applicator makes outlining easy, and the buildable formula lets you go from a subtle day tint to a bolder evening look in a second coat.",
    highlights: [
      "Soft-matte finish that feels light on lips",
      "Precision doe-foot applicator",
      "Buildable colour — sheer to full coverage",
      "Slim tube that fits any clutch",
    ],
    idealFor: ["Everyday office looks", "Evening and event makeup", "Beauty gift bundles"],
    specs: [
      ["Finish", "Matte"],
      ["Format", "Liquid lip colour"],
      ["Ingredients", "As printed on pack"],
    ],
    inBox: ["1 × Liquid lipgloss"],
    variants: {
      label: "Shade",
      options: [
        { name: "Rose Nude", swatch: "#c48a83" },
        { name: "Mauve", swatch: "#9d6470" },
        { name: "Brick Red", swatch: "#9c3b33" },
        { name: "Berry", swatch: "#7a2a46" },
      ],
    },
    keywords: ["lipstick", "lip gloss", "makeup", "matte", "cosmetics"],
  },
  {
    id: "humidifier",
    slug: "colour-changing-h2o-humidifier-with-mist",
    sku: "ZLV-HD-4001",
    name: "Colour Changing H2O Humidifier with Mist",
    category: "home-decor",
    price: 2199,
    compare: 2599,
    image: img("humidifier"),
    badge: "New in",
    isNew: true,
    isBestseller: true,
    tagline: "Soft mist and mood lighting for calmer evenings.",
    description:
      "A compact tabletop humidifier that releases a fine cool mist while cycling through soft ambient colours. Add a few drops of water-safe aroma oil for a spa-like bedroom, or leave it on your desk to ease dry air from the AC.",
    highlights: [
      "Ultra-fine cool mist for dry, air-conditioned rooms",
      "Colour-changing LED mood light",
      "Quiet operation suited to bedrooms",
      "USB powered — desk, bedside or car",
    ],
    idealFor: ["Bedrooms and nurseries", "Workspaces with AC", "Calming gifts"],
    specs: [
      ["Power", "USB (adapter not always included)"],
      ["Light", "Multi-colour LED"],
      ["Mist", "Cool mist, continuous/intermittent"],
      ["Placement", "Tabletop"],
    ],
    inBox: ["1 × Humidifier", "1 × USB cable", "Spare cotton wick"],
    keywords: ["humidifier", "diffuser", "aroma", "mist", "night light", "decor"],
  },
  {
    id: "earbuds",
    slug: "wireless-everyday-earbuds",
    sku: "ZLV-TG-5001",
    name: "Wireless Everyday Earbuds",
    category: "tech",
    price: 2499,
    image: img("wireless-earbuds"),
    badge: "New in",
    isNew: true,
    isBestseller: true,
    tagline: "Cable-free sound for calls, commutes and playlists.",
    description:
      "True-wireless earbuds with a pocketable charging case. Pair once and they reconnect automatically when you open the lid — perfect for Zoom calls, Spotify on the commute and YouTube before bed.",
    highlights: [
      "True wireless with auto-pairing on open",
      "Built-in mic for calls and voice notes",
      "Touch controls for tracks and calls",
      "Compact charging case for on-the-go top-ups",
    ],
    idealFor: ["Work calls and online classes", "Commutes and travel", "Light workouts"],
    specs: [
      ["Connectivity", "Bluetooth (version per model)"],
      ["Controls", "Touch"],
      ["Charging", "Charging case, USB-C/micro-USB per model"],
      ["Compatibility", "Android & iOS"],
    ],
    inBox: ["2 × Earbuds", "1 × Charging case", "1 × Charging cable", "Spare ear tips"],
    keywords: ["earbuds", "airpods", "bluetooth", "headphones", "wireless", "tws"],
  },
  {
    id: "jewellery",
    slug: "rhinestone-watch-and-jewellery-gift-set",
    sku: "ZLV-FA-1002",
    name: "Rhinestone Watch & Jewellery Gift Set",
    category: "fashion",
    price: 2499,
    compare: 2999,
    image: img("jewellery-set"),
    badge: "Gift pick",
    isBestseller: true,
    tagline: "A coordinated set that arrives ready to gift.",
    description:
      "A matching watch and jewellery set with rhinestone detailing — a complete look in one box. Ideal when you want a gift that feels considered: birthdays, anniversaries, Eid and wedding-season surprises.",
    highlights: [
      "Coordinated watch, necklace and earrings",
      "Rhinestone accents with a gold-tone finish",
      "Presentation box for easy gifting",
      "Dresses up both casual and formal outfits",
    ],
    idealFor: ["Birthday & anniversary gifts", "Eid and wedding season", "Treat-yourself moments"],
    specs: [
      ["Set contents", "Watch + jewellery pieces (varies by set)"],
      ["Finish", "Gold-tone with rhinestones"],
      ["Watch", "Quartz analogue"],
    ],
    inBox: ["Watch", "Jewellery pieces", "Gift box"],
    keywords: ["jewellery", "jewelry", "watch", "gift set", "necklace", "earrings", "women"],
  },
  {
    id: "watch",
    slug: "everyday-smart-watch",
    sku: "ZLV-TG-5002",
    name: "Everyday Smart Watch",
    category: "tech",
    price: 2999,
    image: img("smart-watch"),
    isNew: true,
    tagline: "Notifications, steps and style on your wrist.",
    description:
      "A sleek smart watch that keeps you on top of calls and messages, tracks daily steps and activity, and swaps straps to match your outfit. Pairs with the companion app on Android and iOS.",
    highlights: [
      "Call and message notifications",
      "Step, activity and sleep tracking",
      "Customisable watch faces",
      "Interchangeable strap",
    ],
    idealFor: ["Daily activity tracking", "Busy professionals", "Gifts for him or her"],
    specs: [
      ["Display", "Colour touch display"],
      ["Compatibility", "Android & iOS via app"],
      ["Charging", "Magnetic charger"],
      ["Features", "Vary by selected model"],
    ],
    inBox: ["1 × Smart watch", "1 × Charging cable"],
    variants: {
      label: "Strap",
      options: [
        { name: "Black", swatch: "#1f2328" },
        { name: "Rose Pink", swatch: "#e4a9a6" },
        { name: "Stone Grey", swatch: "#a6adb4" },
      ],
    },
    keywords: ["smartwatch", "smart watch", "fitness tracker", "watch", "apple watch"],
  },
  {
    id: "headphones",
    slug: "wireless-over-ear-headphones",
    sku: "ZLV-TG-5003",
    name: "Wireless Over-Ear Headphones",
    category: "tech",
    price: 3299,
    compare: 3999,
    image: img("over-ear-headphones"),
    badge: "Popular",
    tagline: "Cushioned comfort for long listening sessions.",
    description:
      "Over-ear wireless headphones with soft cushioned ear cups and an adjustable headband. Fold them into your bag, connect over Bluetooth and settle in for movies, lectures or a long playlist.",
    highlights: [
      "Plush over-ear cushions for all-day comfort",
      "Wireless Bluetooth with optional wired mode",
      "Foldable design for travel",
      "On-cup controls and built-in mic",
    ],
    idealFor: ["Study and work-from-home", "Gaming and movies", "Travel"],
    specs: [
      ["Type", "Over-ear, closed-back"],
      ["Connectivity", "Bluetooth + AUX (per model)"],
      ["Controls", "On-cup buttons"],
    ],
    inBox: ["1 × Headphones", "1 × Charging cable", "1 × AUX cable (where available)"],
    keywords: ["headphones", "headset", "bluetooth", "over ear", "wireless"],
  },
  {
    id: "skincare",
    slug: "daily-skincare-essentials-kit",
    sku: "ZLV-BP-3002",
    name: "Daily Skincare Essentials Kit",
    category: "beauty",
    price: 1799,
    image: img("beauty-skincare"),
    isNew: true,
    tagline: "A simple three-step routine you'll actually stick to.",
    description:
      "A curated skincare edit that covers the basics — cleanse, treat and moisturise. Designed for people who want a consistent routine without a crowded shelf. Always patch test new products first.",
    highlights: [
      "Cleanse → treat → moisturise routine in one kit",
      "Travel-friendly sizes",
      "Elegant packaging — ready to gift",
      "Full ingredient list on every pack",
    ],
    idealFor: ["Starting a skincare routine", "Travel bags", "Self-care gifts"],
    specs: [
      ["Skin type", "As stated on each product"],
      ["Contents", "Varies by kit (confirm on listing)"],
      ["Usage", "Patch test before first use"],
    ],
    inBox: ["Skincare essentials (see listing)"],
    keywords: ["skincare", "serum", "moisturiser", "face", "beauty kit"],
  },
  {
    id: "storage",
    slug: "home-storage-organiser",
    sku: "ZLV-HL-2002",
    name: "Woven Home Storage Organiser",
    category: "home-living",
    price: 1599,
    image: img("home-storage"),
    isNew: true,
    tagline: "Calm, clutter-free shelves in minutes.",
    description:
      "A woven-look storage organiser that tidies toys, toiletries, chargers or throws while looking good out in the open. Lightweight, easy to move and sized for shelves, wardrobes and bathroom counters.",
    highlights: [
      "Natural woven aesthetic that suits any room",
      "Lightweight and easy to reposition",
      "Fits shelves, wardrobes and counters",
      "Lid keeps contents dust-free (where included)",
    ],
    idealFor: ["Living rooms and bedrooms", "Bathroom and vanity storage", "Kids' rooms"],
    specs: [
      ["Material", "Varies by model"],
      ["Approx. size", "Check listing before ordering"],
      ["Care", "Wipe clean"],
    ],
    inBox: ["1 × Storage organiser"],
    variants: {
      label: "Size",
      kind: "size",
      options: [{ name: "S" }, { name: "M" }, { name: "L", soldOut: true }],
    },
    bundleEnabled: true,
    bundleDiscountPercent: 10,
    keywords: ["storage", "basket", "organiser", "organizer", "box", "home"],
  },
  {
    id: "lamp",
    slug: "modern-ceramic-table-lamp",
    sku: "ZLV-HD-4002",
    name: "Modern Ceramic Table Lamp",
    category: "home-decor",
    price: 3199,
    image: img("table-lamp"),
    tagline: "Warm, low-glare light that makes a room feel finished.",
    description:
      "A ribbed ceramic-look base with a soft fabric shade that diffuses light into a warm glow. Place it on a bedside table, console or study desk for cosy evening lighting that's easier on the eyes than overhead tube lights.",
    highlights: [
      "Ribbed base with a soft linen-look shade",
      "Warm, diffused light for evenings",
      "Fits standard E27 bulbs (verify per model)",
      "Works with bedside, console and study tables",
    ],
    idealFor: ["Bedrooms and lounges", "Reading corners", "House-warming gifts"],
    specs: [
      ["Base", "Ceramic-look finish"],
      ["Shade", "Fabric"],
      ["Bulb", "E27, not always included"],
      ["Power", "Standard Pakistani socket"],
    ],
    inBox: ["1 × Lamp base", "1 × Shade"],
    keywords: ["lamp", "table lamp", "light", "bedside lamp", "decor"],
  },
  {
    id: "teddy",
    slug: "soft-teddy-bear-plush-toy",
    sku: "ZLV-KT-7002",
    name: "Soft Teddy Bear Plush Toy",
    category: "kids",
    price: 1299,
    image: img("teddy-bear"),
    isNew: true,
    tagline: "A huggable friend for naps, play and bedtime.",
    description:
      "A super-soft teddy bear with a classic bow and a cuddle-ready size. Made for little hands and big hugs — and just as popular as a sweet gift for someone special.",
    highlights: [
      "Ultra-soft plush fabric",
      "Classic gingham bow",
      "Cuddle-friendly size",
      "Gift-ready for birthdays and newborns",
    ],
    idealFor: ["Toddlers and young kids", "Newborn gifts", "Valentine's and birthdays"],
    specs: [
      ["Material", "Plush polyester"],
      ["Recommended age", "Check label"],
      ["Care", "Surface wash"],
    ],
    inBox: ["1 × Teddy bear"],
    keywords: ["teddy", "bear", "plush", "soft toy", "stuffed toy", "gift"],
  },
  {
    id: "yoga",
    slug: "fitness-yoga-mat-and-accessories",
    sku: "ZLV-SF-6002",
    name: "Yoga Mat & Accessories Set",
    category: "fitness",
    price: 2899,
    image: img("sports-yoga"),
    tagline: "Everything you need to roll out and start moving.",
    description:
      "A non-slip yoga mat paired with essential accessories for stretching, pilates and mobility work. Cushioning protects knees and wrists on hard floors, and the carry strap makes it easy to take to the park or gym.",
    highlights: [
      "Non-slip textured surface",
      "Cushioned for knees and wrists",
      "Accessories for stretching and mobility",
      "Lightweight with carry strap",
    ],
    idealFor: ["Yoga and pilates", "Home stretching routines", "Post-workout recovery"],
    specs: [
      ["Mat thickness", "Varies by kit"],
      ["Surface", "Non-slip texture"],
      ["Contents", "Mat + accessories (see listing)"],
    ],
    inBox: ["1 × Yoga mat", "Accessories as listed"],
    keywords: ["yoga mat", "exercise mat", "pilates", "fitness", "stretching"],
  },
  {
    id: "clutch",
    slug: "everyday-fashion-clutch",
    sku: "ZLV-FA-1003",
    name: "Everyday Fashion Clutch",
    category: "fashion",
    price: 1899,
    compare: 2299,
    image: img("fashion-clutch"),
    isNew: true,
    tagline: "Slim, elegant and sized for the essentials.",
    description:
      "A compact clutch that holds your phone, cards, keys and lipstick without the bulk. Carry it by hand for weddings and dinners, or clip on the chain for a hands-free evening.",
    highlights: [
      "Slim profile with structured shape",
      "Optional chain strap (where included)",
      "Fits large smartphones",
      "Pairs with eastern and western outfits",
    ],
    idealFor: ["Weddings and dawats", "Dinners and parties", "Gifting"],
    specs: [
      ["Style", "Clutch"],
      ["Closure", "Snap / zip (per model)"],
      ["Approx. size", "24 × 14 cm"],
    ],
    inBox: ["1 × Clutch", "Chain strap (where included)"],
    variants: {
      label: "Colour",
      options: [
        { name: "Champagne", swatch: "#e5d3b5" },
        { name: "Black", swatch: "#1f2328" },
        { name: "Rose Gold", swatch: "#d7a99a" },
      ],
    },
    keywords: ["clutch", "purse", "wallet", "bag", "wedding", "party bag"],
  },
  {
    id: "fitness-kit",
    slug: "home-workout-starter-kit",
    sku: "ZLV-SF-6003",
    name: "Home Workout Starter Kit",
    category: "fitness",
    price: 4499,
    compare: 5299,
    image: img("fitness-kit"),
    badge: "Limited",
    isNew: true,
    tagline: "A full-body home gym that fits in one corner.",
    description:
      "Dumbbells, resistance bands, grip trainers and a shaker bottle — a starter kit that covers strength, toning and mobility without a gym membership. Build a routine at home on your own schedule.",
    highlights: [
      "Strength, toning and mobility in one kit",
      "Colour-coded resistance bands",
      "Hex dumbbells that don't roll away",
      "Shaker bottle for post-workout drinks",
    ],
    idealFor: ["Beginners building a routine", "Small apartments", "Fitness gifts"],
    specs: [
      ["Dumbbell weight", "Per kit (shown at checkout)"],
      ["Bands", "Light / medium / heavy"],
      ["Includes", "Dumbbells, bands, grippers, shaker"],
    ],
    inBox: ["Dumbbells pair", "Resistance bands", "Hand grippers", "Shaker bottle"],
    keywords: ["dumbbell", "home gym", "resistance band", "workout kit", "fitness"],
  },
  {
    id: "home-bundle",
    slug: "calm-corner-home-bundle",
    sku: "ZLV-HL-2003",
    name: "Calm Corner Home Bundle",
    category: "home-living",
    price: 5999,
    compare: 6999,
    image: img("home-living-picks"),
    badge: "Gift pick",
    tagline: "Lamp, mist and a tumbler — your cosy corner, sorted.",
    description:
      "Our most-loved home picks in one bundle: a warm table lamp, a mist humidifier and an insulated tumbler with handle. Build a calm reading or work-from-home corner in one order — and save compared to buying separately.",
    highlights: [
      "Three home favourites in one order",
      "Better value than buying individually",
      "Coordinated neutral palette",
      "A thoughtful house-warming gift",
    ],
    idealFor: ["Work-from-home setups", "New homes and hostels", "House-warming gifts"],
    specs: [
      ["Bundle", "Table lamp + humidifier + tumbler"],
      ["Palette", "Cream, sand and natural tones"],
      ["Note", "Individual item specs on each listing"],
    ],
    inBox: ["Table lamp", "Mist humidifier", "Insulated tumbler"],
    keywords: ["bundle", "home", "gift", "lamp", "humidifier", "tumbler", "set"],
  },
  {
    id: "perfume",
    slug: "rose-blush-eau-de-parfum",
    sku: "ZLV-BP-3003",
    name: "Rose Blush Eau de Parfum",
    category: "beauty",
    price: 3499,
    compare: 3999,
    image: img("perfume"),
    badge: "Gift pick",
    isNew: true,
    tagline: "Soft florals that linger from morning to evening.",
    description:
      "A feminine floral fragrance with a soft rose heart and a warm, powdery finish. Elegant enough for events and gentle enough for everyday wear, in a faceted glass bottle that looks beautiful on a vanity.",
    highlights: [
      "Rose-led floral fragrance profile",
      "Eau de parfum concentration",
      "Faceted glass bottle with gold-tone cap",
      "Elegant gift presentation",
    ],
    idealFor: ["Everyday signature scent", "Weddings and evenings", "Gifts for her"],
    specs: [
      ["Concentration", "Eau de Parfum"],
      ["Fragrance family", "Floral"],
      ["Volume", "As printed on pack"],
    ],
    inBox: ["1 × Perfume bottle", "Gift box (where available)"],
    keywords: ["perfume", "fragrance", "scent", "women", "edp", "gift"],
  },
  {
    id: "toy-blocks",
    slug: "magnetic-tiles-playhouse-set",
    sku: "ZLV-KT-7003",
    name: "Magnetic Tiles Playhouse Set (Large)",
    category: "kids",
    price: 3999,
    compare: 4699,
    image: img("toy-blocks"),
    badge: "Popular",
    tagline: "More pieces, bigger builds, longer play.",
    description:
      "A larger magnetic tile set with extra shapes for towers, playhouses and marble-run-style builds. Ideal for siblings to share, and big enough for kids to grow into as their building gets more ambitious.",
    highlights: [
      "Larger piece count for bigger builds",
      "Mix of squares, triangles and special shapes",
      "Great for siblings and group play",
      "Builds STEM confidence through play",
    ],
    idealFor: ["Ages 3+ (check pack)", "Siblings and play dates", "Birthday gifts"],
    specs: [
      ["Recommended age", "3 years and above"],
      ["Material", "ABS plastic with magnets"],
      ["Pieces", "Varies by pack"],
    ],
    inBox: ["Magnetic tiles set", "Storage bag/box (where available)"],
    keywords: ["magnetic tiles", "toy", "kids", "building", "stem", "blocks"],
  },
];

export function getCategory(id: string) {
  return categories.find((c) => c.id === id);
}

export function getCategoryBySlug(slug: string) {
  return categories.find((c) => c.slug === slug);
}

/** Public URL of a category page. */
export function categoryPath(id: string) {
  return `/category/${getCategory(id)?.slug ?? id}/`;
}

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function getProductById(id: string) {
  return products.find((p) => p.id === id);
}

export function productsIn(category: CategoryId) {
  return products.filter((p) => p.category === category);
}

export function isOnSale(p: Product) {
  return !!p.compare && p.compare > p.price;
}

/** "You may also like": same category first (current product left out), topped up with bestsellers. */
export function relatedProducts(p: Product, n = 4) {
  const same = products.filter((x) => x.category === p.category && x.id !== p.id);
  const best = products.filter((x) => x.isBestseller && x.id !== p.id && x.category !== p.category);
  const rest = products.filter((x) => x.id !== p.id && x.category !== p.category && !x.isBestseller);
  return [...same, ...best, ...rest].slice(0, n);
}

export function searchProducts(q: string) {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return products
    .map((p) => {
      const cat = getCategory(p.category)!;
      const hay = [p.name, cat.name, p.tagline, ...p.keywords].join(" ").toLowerCase();
      const score = terms.reduce(
        (s, t) => s + (p.name.toLowerCase().includes(t) ? 3 : 0) + (hay.includes(t) ? 1 : 0),
        0,
      );
      return { p, score, all: terms.every((t) => hay.includes(t)) };
    })
    .filter((r) => r.all)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.p);
}

export type CollectionKey = "shop" | "new-arrivals" | "bestsellers" | "deals";

export const collections: Record<
  CollectionKey,
  {
    title: string;
    /** Full <title> text, brand included (set with `title.absolute`). */
    seoTitle: string;
    eyebrow: string;
    sub: string;
    banner: string;
    bannerMobile: string;
    seoDescription: string;
    filter: (p: Product) => boolean;
  }
> = {
  shop: {
    title: "Shop All Products",
    seoTitle: "Shop All Products Online in Pakistan | Zelvomart",
    eyebrow: "The full Zelvomart edit",
    sub: "Every Zelvomart product in one place, across all seven categories.",
    banner: "/extra/all-products-desktop.webp",
    bannerMobile: "/products/all-products-mobile.webp",
    seoDescription:
      "Browse every Zelvomart product in one place: home, decor, beauty, tech, fashion, fitness and kids. Order online or on WhatsApp and pay on delivery.",
    filter: () => true,
  },
  "new-arrivals": {
    title: "New Arrivals",
    seoTitle: "New Arrivals: Latest Products in Pakistan | Zelvomart",
    eyebrow: "Just landed",
    sub: "The latest additions to Zelvomart, newest first.",
    banner: "/extra/new-arrivals-desktop.webp",
    bannerMobile: "/products/new-arrivals-mobile.webp",
    seoDescription:
      "See what’s new at Zelvomart: the latest products added across home, beauty, tech, fashion, fitness and kids, delivered to your door anywhere in Pakistan.",
    filter: (p) => !!p.isNew,
  },
  bestsellers: {
    title: "Bestsellers",
    seoTitle: "Bestsellers: Most-Ordered Products | Zelvomart",
    eyebrow: "Customer favourites",
    sub: "The products Zelvomart customers order, reorder and gift most.",
    banner: "/extra/bestsellers-desktop.webp",
    bannerMobile: "/products/bestsellers-mobile.webp",
    seoDescription:
      "Zelvomart bestsellers: the products customers order and reorder most, across home, beauty, fashion, kids and more. Cash on Delivery across Pakistan.",
    filter: (p) => !!p.isBestseller,
  },
  deals: {
    title: "Deals & Offers",
    seoTitle: "Deals & Discount Offers in Pakistan | Zelvomart",
    eyebrow: "Better finds, better prices",
    sub: "Genuine discounts across our categories, with the regular price always shown.",
    banner: "/extra/deals-desktop.webp",
    bannerMobile: "/products/deals-mobile.webp",
    seoDescription:
      "Current deals at Zelvomart: genuine discounts on home, beauty, fashion and kids’ favourites, with the regular price always shown. Order online in Pakistan.",
    filter: isOnSale,
  },
};
