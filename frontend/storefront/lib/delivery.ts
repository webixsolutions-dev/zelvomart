import { site } from "./site";

/** Adds working days (Monday–Saturday; Sundays are skipped). */
export function addWorkingDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left--;
  }
  return d;
}

export function shortDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Latest expected delivery for an order placed now, from the delivery days in Settings (2–7 working days fallback). */
export function deliverBy(from = new Date(), maxDays: number = site.shipping.maxDays) {
  return addWorkingDays(from, maxDays);
}
