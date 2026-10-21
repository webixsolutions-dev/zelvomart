/**
 * Artwork in `frontend/public/images/zelvomart` (WebP, each under 150 KB).
 * `src` is the public path (spaces and "&" left intact) for next/image.
 * `href` is encoded for CSS and plain <img>/icon links.
 */
function asset(file: string) {
  const src = `/images/zelvomart/${file}`;
  return {
    src,
    href: encodeURI(src).replace(/&/g, "%26"),
  };
}

const heroOnline = asset("online-shopping-in-pakistan-zelvomart.webp");
const heroOnlineMobile = asset("online-shopping-in-pakistan-zelvomart-mbl.webp");
const heroHousehold = asset("items-for-you-and-your-household-delivered-by-zelvomart.webp");
const heroHouseholdMobile = asset("items-for-you-and-your-household-delivered-by-zelvomart-mbl.webp");
const heroFitness = asset("move-more-train-better-fitness-and-sports-gear-at-zelvomart.webp");
const heroFitnessMobile = asset("move-more-train-better-fitness-and-sports-gear-at-zelvomart-mbl.webp");
const deal = asset("deal-you-all-actually-want-on-zelvomart.webp");
const dealMobile = asset("deal-you-all-actually-want-on-zelvomart-mbl.webp");
const dealsArtwork = asset("whatsapp-image-2026-10-10-at-11-03-02-pm.webp");
const bestSelling = asset("best-selling-zelvomart.webp");
const newArrival = asset("new-arrival-zelvomart.webp");
const shop = asset("shop-zelvomart.webp");
const discount = asset("discount-zelvomart.webp");
const favicon = asset("fav-icon-zelvomart.webp");
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
    "fashion-accessories": asset("fashion-accessories-zelvomart.webp"),
    "home-living": asset("home-and-living-zelvomart.webp"),
    "home-decor": asset("home-decor-zelvomart.webp"),
    "beauty-personal-care": asset("beauty-and-personal-care-zelvomart.webp"),
    "tech-gadgets": asset("tech-and-gadgets-zelvomart.webp"),
    "sports-fitness": asset("sports-and-fitness-zelvomart.webp"),
    "kids-toys": asset("kids-and-toys-zelvomart.webp"),
  },
} as const;

export const categoryImageSrc: Record<string, string> = Object.fromEntries(
  Object.entries(storeImages.categories).map(([slug, image]) => [slug, image.src]),
);

export const categoryImageFallback = storeImages.categories["home-living"].src;
