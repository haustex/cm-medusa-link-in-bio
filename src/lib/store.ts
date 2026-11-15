import type { MedusaContainer } from "@medusajs/framework/types"
import { listItems } from "./items"
import { getOptions, type ResolvedOptions } from "./options"
import { latestPost, regionContext, resolveCategories, resolveCollections, resolvePosts, resolveProducts } from "./resolve"
import { isVisible } from "./schedule"
import { pageLocales, pick } from "./serialize"
import { CLICKABLE, UTM_TYPES, type EntityInfo, type ItemRow, type PageRow, type PostInfo, type ProductInfo } from "./types"
import { internalUrl, pageUrl, redirectUrl, whatsappUrl } from "./urls"
import { withUtm, type UtmParams } from "./utm"
import { cleanSocials, cleanTheme } from "./validate"

export type StoreItem = {
  id: string
  key: string
  type: ItemRow["type"]
  label: string
  note: string | null
  image: string | null
  icon: string | null
  style: "normal" | "featured"
  /** The counted link (/l/{key}); null for headers and dividers */
  href: string | null
  /** Where href ends up (the storefront may show the host); null for promo codes without a link */
  url: string | null
  product?: ProductInfo
  collection?: EntityInfo
  category?: EntityInfo
  post?: PostInfo
  promo?: { code: string }
  whatsapp?: { phone: string }
  contact?: { kind: "tel" | "mailto"; value: string }
  starts_at?: string | null
  ends_at?: string | null
}

export type StorePage = {
  id: string
  handle: string
  locale: string
  default_locale: string
  locales: string[]
  title: string
  bio: string | null
  seo_title: string
  seo_description: string | null
  avatar: string | null
  og_image: string | null
  noindex: boolean
  socials: ReturnType<typeof cleanSocials>
  theme: ReturnType<typeof cleanTheme>
  /** Public URL per locale (hreflang), when storefront.url is configured */
  urls: Record<string, string>
  items: StoreItem[]
  updated_at: string
}

export type ResolveContext = { locale: string; region_id?: string; sales_channel_id: string | null }

function utmFor(page: PageRow, item: ItemRow, o: ResolvedOptions): UtmParams | null {
  const on = item.utm ?? page.utm !== false
  if (!on || !UTM_TYPES.includes(item.type)) return null
  return { source: page.utm_source ?? o.utm.source, medium: page.utm_medium ?? o.utm.medium, campaign: page.utm_campaign ?? page.handle, content: item.key }
}

/**
 * The real destination of an item in a locale (what /l/{key} redirects to), UTM applied. Null when the target
 * no longer exists (deleted product, unpublished post) or cannot be built (no storefront.url for internal links).
 */
export async function destination(container: MedusaContainer, page: PageRow, item: ItemRow, locale: string, resolved?: Resolved): Promise<string | null> {
  const o = getOptions(container)
  const def = pageLocales(page)[0]
  const r = resolved ?? (await resolveAll(container, [item], { locale, sales_channel_id: null }, def))
  const t = item.target as Record<string, any>
  let url: string | null = null
  switch (item.type) {
    case "link":
      url = t.url ?? null
      break
    case "product": {
      const p = r.products.get(t.product_id)
      url = p ? internalUrl(o, "product", p.handle, locale, def) : null
      break
    }
    case "collection": {
      const c = r.collections.get(t.collection_id)
      url = c ? internalUrl(o, "collection", c.handle, locale, def) : null
      break
    }
    case "category": {
      const c = r.categories.get(t.category_id)
      url = c ? internalUrl(o, "category", c.handle, locale, def) : null
      break
    }
    case "promo":
      url = t.url ?? null
      break
    case "post": {
      const p = t.latest ? r.latest : r.posts.get(t.post_id)
      url = p ? internalUrl(o, "post", p.slug, locale, def) : null
      break
    }
    case "whatsapp":
      url = whatsappUrl(t.phone, t.text ?? null)
      break
    case "contact":
      return t.kind === "tel" ? `tel:${t.value}` : `mailto:${t.value}` // no UTM on these
    default:
      return null
  }
  return url ? withUtm(url, utmFor(page, item, o)) : null
}

export type Resolved = { products: Map<string, ProductInfo>; collections: Map<string, EntityInfo>; categories: Map<string, EntityInfo>; posts: Map<string, PostInfo>; latest: PostInfo | null }

/** Looks every referenced product, collection, category and post up in one go */
export async function resolveAll(container: MedusaContainer, items: ItemRow[], ctx: ResolveContext, defaultLocale: string): Promise<Resolved> {
  const ids = (type: ItemRow["type"], k: string) => items.filter((i) => i.type === type).map((i) => (i.target as any)[k]).filter((x): x is string => typeof x === "string" && !!x)
  const wantLatest = items.some((i) => i.type === "post" && (i.target as any).latest)
  const price = await regionContext(container, ctx.region_id)
  const [products, collections, categories, posts, latest] = await Promise.all([
    resolveProducts(container, ids("product", "product_id"), price, ctx.sales_channel_id),
    resolveCollections(container, ids("collection", "collection_id")),
    resolveCategories(container, ids("category", "category_id")),
    resolvePosts(container, ids("post", "post_id"), ctx.locale, defaultLocale),
    wantLatest ? latestPost(container, ctx.locale, defaultLocale) : Promise.resolve(null),
  ])
  return { products, collections, categories, posts, latest }
}

/** The public page in one locale: visible items only, dead targets left out */
export async function storePage(container: MedusaContainer, page: PageRow, ctx: ResolveContext, now = new Date()): Promise<StorePage> {
  const o = getOptions(container)
  const locales = pageLocales(page)
  const def = locales[0]
  const locale = ctx.locale
  const all = await listItems(container, page.id)
  const visible = all.filter((i) => isVisible(i, now))
  const r = await resolveAll(container, visible, ctx, def)
  const items: StoreItem[] = []
  for (const it of visible) {
    const tr = pick(it.translations, locale, def)
    const t = it.target as Record<string, any>
    const base: StoreItem = {
      id: it.id,
      key: it.key,
      type: it.type,
      label: tr?.label ?? "",
      note: tr?.note ?? null,
      image: it.image ?? null,
      icon: it.icon ?? null,
      style: it.style === "featured" ? "featured" : "normal",
      href: CLICKABLE.includes(it.type) ? redirectUrl(o, it.key) : null,
      url: null,
      ...(it.starts_at || it.ends_at ? { starts_at: it.starts_at ? new Date(it.starts_at).toISOString() : null, ends_at: it.ends_at ? new Date(it.ends_at).toISOString() : null } : {}),
    }
    switch (it.type) {
      case "product": {
        const p = r.products.get(t.product_id)
        if (!p) continue
        base.product = p
        base.label ||= p.title
        base.image ??= p.thumbnail
        break
      }
      case "collection": {
        const c = r.collections.get(t.collection_id)
        if (!c) continue
        base.collection = c
        base.label ||= c.title
        base.image ??= c.thumbnail
        break
      }
      case "category": {
        const c = r.categories.get(t.category_id)
        if (!c) continue
        base.category = c
        base.label ||= c.title
        base.image ??= c.thumbnail
        break
      }
      case "post": {
        const p = t.latest ? r.latest : r.posts.get(t.post_id)
        if (!p) continue
        base.post = p
        base.label ||= p.title
        base.note ??= p.excerpt || null
        base.image ??= p.cover
        break
      }
      case "promo":
        base.promo = { code: t.code }
        base.label ||= t.code
        if (!t.url) base.href = null
        break
      case "whatsapp":
        base.whatsapp = { phone: t.phone }
        base.label ||= "WhatsApp"
        break
      case "contact":
        base.contact = { kind: t.kind, value: t.value }
        base.label ||= t.value
        break
      case "link":
        base.label ||= safeHost(t.url)
        break
    }
    base.url = CLICKABLE.includes(it.type) ? await destination(container, page, it, locale, r) : null
    if (CLICKABLE.includes(it.type) && base.url === null && it.type !== "promo") continue // nowhere to send the visitor
    if (base.url === null) base.href = null
    items.push(base)
  }
  const tr = pick(page.translations, locale, def)
  const urls: Record<string, string> = {}
  for (const l of locales) {
    const u = pageUrl(o, page.handle, l, def)
    if (u) urls[l] = u
  }
  return {
    id: page.id,
    handle: page.handle,
    locale,
    default_locale: def,
    locales,
    title: tr?.title ?? page.name,
    bio: tr?.bio ?? null,
    seo_title: tr?.seo_title ?? tr?.title ?? page.name,
    seo_description: tr?.seo_description ?? tr?.bio ?? null,
    avatar: page.avatar ?? null,
    og_image: page.og_image ?? null,
    noindex: !!page.noindex,
    socials: cleanSocials(page.socials),
    theme: cleanTheme(page.theme),
    urls,
    items,
    updated_at: new Date(page.updated_at).toISOString(),
  }
}

function safeHost(url: unknown): string {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}
