/** Match the email constraint, without treating unrelated Prisma failures as duplicates. */
export function isEmailConflict(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") return false;
  const meta = "meta" in error ? error.meta : undefined;
  if (!meta || typeof meta !== "object" || !("target" in meta)) return false;
  const targets = Array.isArray(meta.target) ? meta.target : [meta.target];
  return targets.some((target: unknown) => typeof target === "string" && /^(?:User_)?email(?:_key)?$/i.test(target));
}
