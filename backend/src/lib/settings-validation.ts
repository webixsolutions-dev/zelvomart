import { z } from "zod";
const percent = z.number().finite().min(0).max(100);
const positive = z.number().finite().positive();
const schemas: Record<string, z.ZodType> = {
  "store.info": z.object({
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(7).max(30),
    email: z.email(),
    whatsapp: z
      .string()
      .trim()
      .regex(/^\+?[\d\s()-]{10,25}$/),
    country: z.literal("Pakistan"),
    supportHours: z.string().trim().max(80).optional(),
  }),
  "store.delivery": z.object({ mode: z.literal("FREE_ABOVE"), flatRate: positive, freeAbove: positive }),
  "store.bundleDefaultDiscountPercent": percent,
  "tracking.sessionReplayRetentionDays": z.number().int().min(1).max(90),
};
export function validateSettingsUpdate(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Settings must be an object.");
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    let schema = schemas[key];
    if (
      /^tracking\.(metaPixelEnabled|metaCapiEnabled|tiktokPixelEnabled|tiktokEventsApiEnabled|sessionReplayEnabled)$/.test(
        key,
      )
    )
      schema = z.boolean();
    else if (
      /^tracking\.(metaPixelId|tiktokPixelId|metaCapiToken|tiktokEventsApiToken|metaTestEventCode|tiktokTestEventCode)$/.test(
        key,
      ) ||
      /^marketing\.meta\.(adAccountId|pageId|instagramAccountId|accessToken)$/.test(key)
    )
      schema = z.string().trim().max(5000);
    // Other settings have dedicated admin workflows; this endpoint edits the Settings screen only.
    if (!schema) throw new Error(`Unsupported setting: ${key}`);
    const result = schema.safeParse(value);
    if (!result.success) throw new Error(`Invalid ${key}: ${result.error.issues[0]?.message}`);
    output[key] = result.data;
  }
  if (!Object.keys(output).length) throw new Error("No settings to save.");
  return output;
}
export function validateCitySettings(input: unknown) {
  const rows = z
    .array(
      z
        .object({
          name: z.string().trim().min(1).max(100),
          deliveryMinDays: z.number().int().min(1).max(90),
          deliveryMaxDays: z.number().int().min(1).max(90),
          active: z.boolean().default(true),
        })
        .refine((row) => row.deliveryMaxDays >= row.deliveryMinDays, {
          message: "Maximum days must be at least minimum days.",
        }),
    )
    .min(1)
    .max(1000)
    .parse(input);
  if (new Set(rows.map((row) => row.name.toLowerCase())).size !== rows.length)
    throw new Error("Duplicate city names are not allowed.");
  return rows;
}
