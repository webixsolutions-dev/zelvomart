import { site } from "./site";

/** Store settings from the backend (Admin → Settings and Cities); see lib/backend.ts. */
export type StoreSettings = {
  phone?: string;
  email?: string;
  whatsapp?: string;
  flatFee?: number;
  freeOver?: number;
  /** City name (lower case) → [min, max] working days. */
  cities?: Record<string, [number, number]>;
};

/** "0300-2026711" → "+92 300 2026711" */
function phoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("92") ? digits.slice(2) : digits.replace(/^0/, "");
  return local.length === 10 ? `+92 ${local.slice(0, 3)} ${local.slice(3)}` : phone;
}

/** Writes the backend values into the design's `site` object; anything missing keeps the design value. */
export function applyStoreSettings(s: StoreSettings) {
  const target = site as unknown as {
    phoneDisplay: string;
    whatsappNumber: string;
    email: string;
    shipping: { flatFee: number; freeOver: number; cities?: Record<string, string> };
  };
  if (s.phone) target.phoneDisplay = phoneDisplay(s.phone);
  if (s.whatsapp) target.whatsappNumber = s.whatsapp;
  if (s.email) target.email = s.email;
  if (s.flatFee) target.shipping.flatFee = s.flatFee;
  if (s.freeOver) target.shipping.freeOver = s.freeOver;
  if (s.cities) {
    target.shipping.cities = Object.fromEntries(
      Object.entries(s.cities).map(([city, [min, max]]) => [city, min === max ? `${max} working days` : `${min}–${max} working days`]),
    );
  }
}
