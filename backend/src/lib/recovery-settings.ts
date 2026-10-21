export function recoveryDiscountPercent(value: unknown = 5) {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 1 || percent > 100)
    throw new Error("Recovery discount must be between 1% and 100%.");
  return percent;
}
