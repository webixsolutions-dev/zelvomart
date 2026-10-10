/**
 * Artwork in `frontend/public/images/Zelvomart images`.
 * `src` is the public path (spaces and "&" left intact) for next/image.
 * `href` is encoded for CSS and plain <img>/icon links.
 */
function asset(file: string) {
  const src = `/images/Zelvomart images/${file}`;
  return {
    src,
    href: encodeURI(src).replace(/&/g, "%26"),
  };
}

const heroOnline = asset("Online Shopping in Pakistan  Zelvomart.png");
const heroOnlineMobile = asset("Online Shopping in Pakistan  Zelvomart mbl.png");
const heroHousehold = asset("Items for You and Your Household, Delivered by Zelvomart.png");
const heroHouseholdMobile = asset("Items for You and Your Household, Delivered by Zelvomart mbl.png");
const heroFitness = asset("Move More, Train Better Fitness & Sports Gear at Zelvomart.png");
const heroFitnessMobile = asset("Move More, Train Better Fitness & Sports Gear at Zelvomart mbl.png");
const deal = asset("Deal you all actually want on zelvomart.png");
const dealMobile = asset("Deal you all actually want on zelvomart mbl.png");
const dealsArtwork = asset("WhatsApp Image 2026-10-10 at 11.03.02 PM.jpeg");
const bestSelling = asset("Best Selling Zelvomart.png");
const newArrival = asset("New Arrival Zelvomart.png");
const shop = asset("Shop Zelvmart.png");
const discount = asset("Discount Zelvomart.png");
const favicon = asset("Fav-icon zelvomart.png");
const stepChoose = asset("01-choose.svg");
const stepConfirm = asset("02-confirm.svg");
const stepPacked = asset("03-checked-packed.svg");
const stepDelivered = asset("04-delivered-pay-cash.svg");

export const storeImages = {
  heroOnline,
  heroOnlineMobile,
  heroHousehold,
  heroHouseholdMobile,
  heroFitness,
  heroFitnessMobile,
  deal,
  dealMobile,
  dealsArtwork,
  bestSelling,
  newArrival,
  shop,
  discount,
  favicon,
  stepChoose,
  stepConfirm,
  stepPacked,
  stepDelivered,
  categories: {
    "fashion-accessories": asset("Fashion Accessories Zelvomart.png"),
    "home-living": asset("home and living zelvomart.png"),
    "home-decor": asset("Home Decor Zelvomart.png"),
    "beauty-personal-care": asset("Beauty & Personal Care Zelvomart.png"),
    "tech-gadgets": asset("Tech & Gadgets Zelvomart.png"),
    "sports-fitness": asset("Sports & Fitness Zelvomart.png"),
    "kids-toys": asset("Kids & Toys Zelvomart.png"),
  },
} as const;

export const categoryImageSrc: Record<string, string> = Object.fromEntries(
  Object.entries(storeImages.categories).map(([slug, image]) => [slug, image.src]),
);

export const categoryImageFallback = storeImages.categories["home-living"].src;
