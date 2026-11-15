import { visibility } from "./schedule"
import type { ItemRow, ItemTranslationRow, PageRow, PageTranslationRow } from "./types"
import { cleanSocials, cleanTheme } from "./validate"

const iso = (d: Date | string | null | undefined): string | null => (d == null ? null : d instanceof Date ? d.toISOString() : new Date(d).toISOString())

export function pageLocales(p: Pick<PageRow, "locales">): string[] {
  return Array.isArray(p.locales) && p.locales.length ? (p.locales as string[]) : ["en"]
}

const byLocale = <T extends { locale: string }>(rows: T[] | undefined): Record<string, T> => Object.fromEntries((rows ?? []).map((r) => [r.locale, r]))

export type AdminPage = {
  id: string
  handle: string
  name: string
  locales: string[]
  default_locale: string
  published: boolean
  noindex: boolean
  avatar: string | null
  socials: ReturnType<typeof cleanSocials>
  theme: ReturnType<typeof cleanTheme>
  utm: boolean
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  og_image: string | null
  metadata: Record<string, unknown> | null
  translations: Record<string, Omit<PageTranslationRow, "id" | "locale" | "page_id">>
  created_at: string
  updated_at: string
  /** Filled by the route: public URL per locale, counts */
  urls?: Record<string, string>
  item_count?: number
  clicks_7d?: number
  clicks_30d?: number
}

export function toAdminPage(p: PageRow): AdminPage {
  const locales = pageLocales(p)
  const t = byLocale(p.translations)
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    locales,
    default_locale: locales[0],
    published: !!p.published,
    noindex: !!p.noindex,
    avatar: p.avatar ?? null,
    socials: cleanSocials(p.socials),
    theme: cleanTheme(p.theme),
    utm: p.utm !== false,
    utm_source: p.utm_source ?? null,
    utm_medium: p.utm_medium ?? null,
    utm_campaign: p.utm_campaign ?? null,
    og_image: p.og_image ?? null,
    metadata: p.metadata ?? null,
    translations: Object.fromEntries(Object.entries(t).map(([l, r]) => [l, { title: r.title, bio: r.bio ?? null, seo_title: r.seo_title ?? null, seo_description: r.seo_description ?? null }])),
    created_at: iso(p.created_at)!,
    updated_at: iso(p.updated_at)!,
  }
}

export type AdminItem = {
  id: string
  key: string
  type: ItemRow["type"]
  target: ItemRow["target"]
  rank: number
  enabled: boolean
  starts_at: string | null
  ends_at: string | null
  visibility: "live" | "scheduled" | "expired" | "hidden"
  image: string | null
  icon: string | null
  style: string | null
  utm: boolean | null
  metadata: Record<string, unknown> | null
  translations: Record<string, Omit<ItemTranslationRow, "id" | "locale" | "item_id">>
  created_at: string
  updated_at: string
  /** Filled by the route */
  href?: string | null
  clicks_7d?: number
  clicks_30d?: number
  clicks_total?: number
  /** Resolved title/thumbnail of a product, collection, category or post for the Admin list */
  resolved?: { title: string; thumbnail: string | null; handle: string; missing?: boolean } | null
}

export function toAdminItem(i: ItemRow, now = new Date()): AdminItem {
  const t = byLocale(i.translations)
  return {
    id: i.id,
    key: i.key,
    type: i.type,
    target: i.target ?? {},
    rank: i.rank ?? 0,
    enabled: i.enabled !== false,
    starts_at: iso(i.starts_at),
    ends_at: iso(i.ends_at),
    visibility: visibility(i, now),
    image: i.image ?? null,
    icon: i.icon ?? null,
    style: i.style ?? null,
    utm: i.utm ?? null,
    metadata: i.metadata ?? null,
    translations: Object.fromEntries(Object.entries(t).map(([l, r]) => [l, { label: r.label ?? null, note: r.note ?? null }])),
    created_at: iso(i.created_at)!,
    updated_at: iso(i.updated_at)!,
  }
}

/** Text in the asked locale, else the default locale's, else the first that has one */
export function pick<T extends { locale: string }>(rows: T[] | undefined, locale: string, defaultLocale: string): T | null {
  const r = rows ?? []
  return r.find((x) => x.locale === locale) ?? r.find((x) => x.locale === defaultLocale) ?? r[0] ?? null
}
