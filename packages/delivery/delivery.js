/**
 * The one delivery rule, used by the backend (the fee saved on the order) and the storefront (the fee shown in the
 * cart drawer, cart, checkout and WhatsApp text), so the two can never disagree.
 *
 * Free delivery when EVERY item in the cart has free delivery, or when the subtotal (after bundle savings, before
 * any coupon) reaches the free-delivery amount from Admin -> Settings -> Delivery. A mixed cart pays the normal fee.
 */
const FREE_SHIPPING_ABOVE = 8000;
const DEFAULT_DELIVERY_CHARGE = 190;

function positive(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * The charge comes only from Admin -> Settings -> Delivery. It never defaults to free: an empty or zero charge falls
 * back to DEFAULT_DELIVERY_CHARGE, an empty free-above amount to FREE_SHIPPING_ABOVE.
 */
function resolveDeliveryPolicy(rule) {
  return {
    flatRate: positive(rule && rule.flatRate) || DEFAULT_DELIVERY_CHARGE,
    threshold: positive(rule && rule.freeAbove) || FREE_SHIPPING_ABOVE,
  };
}

function quoteFromPolicy(subtotal, everyItemFreeShipping, policy) {
  const qualifiesByTotal = subtotal >= policy.threshold;
  const fee = qualifiesByTotal || everyItemFreeShipping ? 0 : policy.flatRate;
  return { flatRate: policy.flatRate, threshold: policy.threshold, fee, qualifiesByTotal, everyItemFreeShipping };
}

/** Delivery for a cart: `items` carry each line's free-delivery flag. An empty cart costs nothing. */
function deliveryForCart(items, subtotal, policy) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return { flatRate: policy.flatRate, threshold: policy.threshold, fee: 0, qualifiesByTotal: false, everyItemFreeShipping: false };
  return quoteFromPolicy(subtotal, list.every((item) => Boolean(item && item.freeShipping)), policy);
}

function quoteDelivery(subtotal, everyItemFreeShipping, rule) {
  return quoteFromPolicy(subtotal, everyItemFreeShipping, resolveDeliveryPolicy(rule));
}

function amountUntilFreeShipping(subtotal, threshold) {
  if (subtotal >= threshold) return 0;
  return Math.max(0, Math.ceil(threshold - subtotal));
}

exports.FREE_SHIPPING_ABOVE = FREE_SHIPPING_ABOVE;
exports.DEFAULT_DELIVERY_CHARGE = DEFAULT_DELIVERY_CHARGE;
exports.resolveDeliveryPolicy = resolveDeliveryPolicy;
exports.quoteFromPolicy = quoteFromPolicy;
exports.deliveryForCart = deliveryForCart;
exports.quoteDelivery = quoteDelivery;
exports.amountUntilFreeShipping = amountUntilFreeShipping;
