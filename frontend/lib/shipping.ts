// The one delivery rule, shared with the backend (packages/delivery): the fee shown is the fee the order saves.
export {
  FREE_SHIPPING_ABOVE,
  DEFAULT_DELIVERY_CHARGE,
  resolveDeliveryPolicy,
  quoteFromPolicy,
  deliveryForCart,
  quoteDelivery,
  amountUntilFreeShipping,
} from "@zelvomart/delivery";
export type { DeliverySettings, DeliveryPolicy, DeliveryQuote } from "@zelvomart/delivery";
