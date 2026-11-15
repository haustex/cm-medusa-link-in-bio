import type { Social, Theme } from "./validate"

export type ItemType = "link" | "product" | "collection" | "category" | "promo" | "post" | "whatsapp" | "contact" | "header" | "divider"
export const ITEM_TYPES: ItemType[] = ["link", "product", "collection", "category", "promo", "post", "whatsapp", "contact", "header", "divider"]
/** Types that are a link a visitor can follow (counted through /l/{key}) */
export const CLICKABLE: ItemType[] = ["link", "product", "collection", "category", "promo", "post", "whatsapp", "contact"]
/** Types whose destination is a web page that can carry UTM parameters (not chats, calls or e-mail) */
export const UTM_TYPES: ItemType[] = ["link", "product", "collection", "category", "promo", "post"]

export type Target =
  | { url: string }
  | { product_id: string }
  | { collection_id: string }
  | { category_id: string }
  | { code: string; url?: string | null }
  | { post_id: string | null; latest?: boolean }
  | { phone: string; text?: string | null }
  | { kind: "tel" | "mailto"; value: string }
  | Record<string, never>

export type PageRow = {
  id: string
  handle: string
  name: string
  locales: string[]
  published: boolean
  noindex: boolean
  avatar: string | null
  socials: Social[] | null
  theme: Theme | null
  utm: boolean
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  og_image: string | null
  metadata: Record<string, unknown> | null
  created_at: Date | string
  updated_at: Date | string
  translations?: PageTranslationRow[]
  items?: ItemRow[]
}
export type PageTranslationRow = { id: string; locale: string; title: string; bio: string | null; seo_title: string | null; seo_description: string | null; page_id?: string }

export type ItemRow = {
  id: string
  key: string
  type: ItemType
  target: Target
  rank: number
  enabled: boolean
  starts_at: Date | string | null
  ends_at: Date | string | null
  image: string | null
  icon: string | null
  style: string | null
  utm: boolean | null
  metadata: Record<string, unknown> | null
  page_id: string
  created_at: Date | string
  updated_at: Date | string
  translations?: ItemTranslationRow[]
}
export type ItemTranslationRow = { id: string; locale: string; label: string | null; note: string | null; item_id?: string }

/** What the Store API knows about a product at read time */
export type ProductInfo = {
  id: string
  handle: string
  title: string
  thumbnail: string | null
  /** Lowest variant price in the region, minor units per Medusa (amount as the Pricing Module returns it) */
  price: { amount: number; currency_code: string; original_amount: number | null } | null
  /** false when every managed variant is out of stock (and none allows backorders) */
  in_stock: boolean
  /** Sum of available units over managed variants; null when nothing is managed */
  stock: number | null
}
export type EntityInfo = { id: string; handle: string; title: string; thumbnail: string | null }
export type PostInfo = { id: string; slug: string; title: string; excerpt: string; cover: string | null; published_at: string | null }
