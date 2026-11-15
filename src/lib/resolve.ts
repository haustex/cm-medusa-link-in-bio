import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, getTotalVariantAvailability, getVariantAvailability, QueryContext } from "@medusajs/framework/utils"
import type { EntityInfo, PostInfo, ProductInfo } from "./types"

type Query = {
  graph: (q: { entity: string; fields: string[]; filters?: Record<string, unknown>; context?: Record<string, unknown>; pagination?: Record<string, unknown> }) => Promise<{ data: any[] }>
}
const query = (container: MedusaContainer) => container.resolve<Query>(ContainerRegistrationKeys.QUERY)

export type PriceContext = { region_id: string; currency_code: string } | null

/** The region's id + currency, or null when unknown (prices are then left out) */
export async function regionContext(container: MedusaContainer, regionId: string | undefined): Promise<PriceContext> {
  if (!regionId) return null
  const { data } = await query(container).graph({ entity: "region", fields: ["id", "currency_code"], filters: { id: regionId } })
  const r = data[0]
  return r ? { region_id: r.id, currency_code: r.currency_code } : null
}

/**
 * Products by id with the lowest price in the region and stock. `salesChannelId`: the publishable key's channel
 * (when it has exactly one) scopes products and availability like the Store API does; otherwise every published
 * product counts and stock is summed over all locations.
 */
export async function resolveProducts(container: MedusaContainer, ids: string[], price: PriceContext, salesChannelId: string | null): Promise<Map<string, ProductInfo>> {
  const out = new Map<string, ProductInfo>()
  if (!ids.length) return out
  const q = query(container)
  const fields = ["id", "handle", "title", "thumbnail", "status", "variants.id", "variants.manage_inventory", "variants.allow_backorder", "sales_channels.id"]
  if (price) fields.push("variants.calculated_price.*")
  const filters: Record<string, unknown> = { id: ids, status: "published" }
  const { data } = await q.graph({
    entity: "product",
    fields,
    filters,
    ...(price ? { context: { variants: { calculated_price: QueryContext(price) } } } : {}),
  })
  const products = data.filter((p) => !salesChannelId || (p.sales_channels ?? []).some((s: { id: string }) => s.id === salesChannelId))
  const managed = products.flatMap((p) => (p.variants ?? []).filter((v: any) => v.manage_inventory).map((v: any) => v.id as string))
  let availability: Record<string, { availability: number | null }> = {}
  if (managed.length) {
    try {
      availability = salesChannelId ? await getVariantAvailability(q as any, { variant_ids: managed, sales_channel_id: salesChannelId }) : await getTotalVariantAvailability(q as any, { variant_ids: managed })
    } catch {
      availability = {}
    }
  }
  for (const p of products) {
    const variants: any[] = p.variants ?? []
    let min: { amount: number; original: number | null } | null = null
    for (const v of variants) {
      const cp = v.calculated_price
      if (!cp || typeof cp.calculated_amount !== "number") continue
      if (!min || cp.calculated_amount < min.amount) min = { amount: cp.calculated_amount, original: typeof cp.original_amount === "number" && cp.original_amount !== cp.calculated_amount ? cp.original_amount : null }
    }
    let stock: number | null = null
    let inStock = false
    for (const v of variants) {
      if (!v.manage_inventory || v.allow_backorder) {
        inStock = true
        continue
      }
      const a = availability[v.id]?.availability ?? 0
      stock = (stock ?? 0) + a
      if (a > 0) inStock = true
    }
    out.set(p.id, {
      id: p.id,
      handle: p.handle,
      title: p.title,
      thumbnail: p.thumbnail ?? null,
      price: price && min ? { amount: min.amount, currency_code: price.currency_code, original_amount: min.original } : null,
      in_stock: inStock,
      stock,
    })
  }
  return out
}

export async function resolveCollections(container: MedusaContainer, ids: string[]): Promise<Map<string, EntityInfo>> {
  const out = new Map<string, EntityInfo>()
  if (!ids.length) return out
  const { data } = await query(container).graph({ entity: "product_collection", fields: ["id", "handle", "title", "metadata"], filters: { id: ids } })
  for (const c of data) out.set(c.id, { id: c.id, handle: c.handle, title: c.title, thumbnail: typeof c.metadata?.image === "string" ? c.metadata.image : null })
  return out
}

export async function resolveCategories(container: MedusaContainer, ids: string[]): Promise<Map<string, EntityInfo>> {
  const out = new Map<string, EntityInfo>()
  if (!ids.length) return out
  const { data } = await query(container).graph({ entity: "product_category", fields: ["id", "handle", "name", "is_active", "is_internal", "metadata"], filters: { id: ids } })
  for (const c of data) {
    if (c.is_active === false || c.is_internal === true) continue
    out.set(c.id, { id: c.id, handle: c.handle, title: c.name, thumbnail: typeof c.metadata?.image === "string" ? c.metadata.image : null })
  }
  return out
}

/* ---------- medusa-blog-seo (optional) ---------- */

const BLOG_MODULE = "blogSeo"
type BlogService = { listBseoPosts: (f: Record<string, unknown>, c?: Record<string, unknown>) => Promise<any[]> }

/** medusa-blog-seo is installed next to this plugin */
export function hasBlog(container: MedusaContainer): boolean {
  try {
    return !!container.resolve(BLOG_MODULE)
  } catch {
    return false
  }
}

function postInfo(p: any, locale: string, defaultLocale: string | null): PostInfo | null {
  const tr: any[] = p.translations ?? []
  const t = tr.find((x) => x.locale === locale) ?? (defaultLocale ? tr.find((x) => x.locale === defaultLocale) : null) ?? tr[0]
  if (!t?.slug) return null
  return { id: p.id, slug: t.slug, title: t.title ?? "", excerpt: t.excerpt ?? "", cover: p.cover ?? null, published_at: p.published_at ? new Date(p.published_at).toISOString() : null }
}

/** Published posts by id (text in `locale`, falling back to any translation) */
export async function resolvePosts(container: MedusaContainer, ids: string[], locale: string, defaultLocale: string | null = null): Promise<Map<string, PostInfo>> {
  const out = new Map<string, PostInfo>()
  if (!ids.length || !hasBlog(container)) return out
  const svc = container.resolve<BlogService>(BLOG_MODULE)
  const rows = await svc.listBseoPosts({ id: ids, status: "published", published_at: { $lte: new Date() } }, { relations: ["translations"], take: ids.length })
  for (const p of rows) {
    const info = postInfo(p, locale, defaultLocale)
    if (info) out.set(p.id, info)
  }
  return out
}

/** The newest published post that has text in `locale` (or any text when none has) */
export async function latestPost(container: MedusaContainer, locale: string, defaultLocale: string | null = null): Promise<PostInfo | null> {
  if (!hasBlog(container)) return null
  const svc = container.resolve<BlogService>(BLOG_MODULE)
  const rows = await svc.listBseoPosts({ status: "published", published_at: { $lte: new Date() } }, { relations: ["translations"], order: { published_at: "DESC" }, take: 20 })
  const exact = rows.find((p) => (p.translations ?? []).some((t: any) => t.locale === locale && t.slug))
  const p = exact ?? rows[0]
  return p ? postInfo(p, locale, defaultLocale) : null
}

/** Admin pickers: search by title */
export async function searchCatalog(container: MedusaContainer, type: "product" | "collection" | "category" | "post", q: string, limit = 20): Promise<{ id: string; title: string; handle: string; thumbnail: string | null; extra?: string }[]> {
  const like = q.trim() ? { $ilike: `%${q.trim().replace(/[%_]/g, "")}%` } : undefined
  if (type === "product") {
    const { data } = await query(container).graph({ entity: "product", fields: ["id", "title", "handle", "thumbnail", "status"], filters: { status: "published", ...(like ? { title: like } : {}) }, pagination: { take: limit, order: { title: "ASC" } } })
    return data.map((p) => ({ id: p.id, title: p.title, handle: p.handle, thumbnail: p.thumbnail ?? null }))
  }
  if (type === "collection") {
    const { data } = await query(container).graph({ entity: "product_collection", fields: ["id", "title", "handle"], filters: like ? { title: like } : {}, pagination: { take: limit, order: { title: "ASC" } } })
    return data.map((c) => ({ id: c.id, title: c.title, handle: c.handle, thumbnail: null }))
  }
  if (type === "category") {
    const { data } = await query(container).graph({ entity: "product_category", fields: ["id", "name", "handle", "is_internal", "is_active"], filters: { is_internal: false, is_active: true, ...(like ? { name: like } : {}) }, pagination: { take: limit, order: { name: "ASC" } } })
    return data.map((c) => ({ id: c.id, title: c.name, handle: c.handle, thumbnail: null }))
  }
  if (!hasBlog(container)) return []
  const svc = container.resolve<BlogService>(BLOG_MODULE)
  const rows = await svc.listBseoPosts({ status: "published", ...(like ? { translations: { title: like } } : {}) }, { relations: ["translations"], order: { published_at: "DESC" }, take: limit })
  return rows.map((p) => {
    const t = (p.translations ?? [])[0] ?? {}
    return { id: p.id, title: t.title ?? "", handle: t.slug ?? "", thumbnail: p.cover ?? null, extra: p.published_at ? new Date(p.published_at).toISOString().slice(0, 10) : undefined }
  })
}
