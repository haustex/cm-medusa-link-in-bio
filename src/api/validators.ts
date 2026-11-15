import { z } from "@medusajs/framework/zod"

/** Shapes only; the rules (URL safety, handles, locales, targets) are applied in src/lib/*. Unknown keys are dropped. */
const nullableString = (max: number) => z.string().max(max).nullable().optional()
const metadata = z.record(z.string(), z.unknown()).nullable().optional()

export const AdminPageBody = z.object({
  handle: z.string().max(80).optional(),
  name: z.string().max(200).optional(),
  locales: z.array(z.string().max(16)).max(20).optional(),
  published: z.boolean().optional(),
  noindex: z.boolean().optional(),
  avatar: nullableString(2048),
  socials: z.array(z.object({ network: z.string().max(32), url: z.string().max(2048) })).max(20).optional(),
  theme: z.object({ background: z.string().max(16).optional(), text: z.string().max(16).optional(), accent: z.string().max(16).optional(), radius: z.string().max(8).optional(), button: z.string().max(8).optional() }).optional(),
  utm: z.boolean().optional(),
  utm_source: nullableString(80),
  utm_medium: nullableString(80),
  utm_campaign: nullableString(80),
  og_image: nullableString(2048),
  metadata,
  translations: z.record(z.string().max(16), z.object({ title: z.string().max(200).optional(), bio: nullableString(1000), seo_title: nullableString(300), seo_description: nullableString(600) })).optional(),
})
export type AdminPageBodyType = z.infer<typeof AdminPageBody>

export const AdminItemBody = z.object({
  type: z.enum(["link", "product", "collection", "category", "promo", "post", "whatsapp", "contact", "header", "divider"]).optional(),
  target: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  starts_at: nullableString(40),
  ends_at: nullableString(40),
  image: nullableString(2048),
  icon: nullableString(64),
  style: nullableString(16),
  utm: z.boolean().nullable().optional(),
  metadata,
  translations: z.record(z.string().max(16), z.object({ label: nullableString(200), note: nullableString(300) })).optional(),
  rank: z.number().int().min(0).max(10_000).optional(),
})
export type AdminItemBodyType = z.infer<typeof AdminItemBody>

export const AdminReorderBody = z.object({ ids: z.array(z.string().max(64)).max(500) })
export type AdminReorderBodyType = z.infer<typeof AdminReorderBody>

export const AdminStatsQuery = z.object({ days: z.coerce.number().int().min(1).max(366).optional() })
export const AdminQrQuery = z.object({
  page_id: z.string().max(64).optional(),
  item_id: z.string().max(64).optional(),
  locale: z.string().max(16).optional(),
  format: z.enum(["svg", "png"]).optional(),
  size: z.coerce.number().int().min(128).max(4096).optional(),
  download: z.coerce.boolean().optional(),
})
export const AdminSearchQuery = z.object({ type: z.enum(["product", "collection", "category", "post"]), q: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(50).optional() })

export const StorePageQuery = z.object({ locale: z.string().max(16).optional(), region_id: z.string().max(64).optional() })
export type StorePageQueryType = z.infer<typeof StorePageQuery>
