export function money(value: number | string | { toString(): string } | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function percentageOff(regular: number, sale?: number | null) {
  if (!sale || sale >= regular || regular <= 0) return 0;
  return Math.round(((regular - sale) / regular) * 100);
}
