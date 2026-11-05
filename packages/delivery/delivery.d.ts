export const FREE_SHIPPING_ABOVE: number;
export const DEFAULT_DELIVERY_CHARGE: number;

export type DeliverySettings = {
  mode?: string;
  flatRate?: number | null;
  freeAbove?: number | null;
};

export type DeliveryPolicy = {
  flatRate: number;
  threshold: number;
};

export type DeliveryQuote = DeliveryPolicy & {
  fee: number;
  qualifiesByTotal: boolean;
  everyItemFreeShipping: boolean;
};

export function resolveDeliveryPolicy(rule?: DeliverySettings | null): DeliveryPolicy;
export function quoteFromPolicy(subtotal: number, everyItemFreeShipping: boolean, policy: DeliveryPolicy): DeliveryQuote;
export function deliveryForCart(items: { freeShipping?: boolean | null }[], subtotal: number, policy: DeliveryPolicy): DeliveryQuote;
export function quoteDelivery(subtotal: number, everyItemFreeShipping: boolean, rule?: DeliverySettings | null): DeliveryQuote;
export function amountUntilFreeShipping(subtotal: number, threshold: number): number;

export const ADVANCE_DISCOUNT_DEFAULT: number;
export type AdvancePolicy = { discount: number; minSubtotal: number };
export function resolveAdvancePolicy(settings?: { discount?: number | null; minSubtotal?: number | null } | null): AdvancePolicy;
export function advanceDiscountFor(subtotal: number, payableBefore: number, policy: AdvancePolicy): number;
export function amountUntilAdvanceDiscount(subtotal: number, policy: AdvancePolicy): number;
