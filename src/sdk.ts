/**
 * Typed helpers over `@medusajs/js-sdk` for the plugin's Store and Admin endpoints. Import from "medusa-link-in-bio/sdk":
 *
 *   import Medusa from "@medusajs/js-sdk"
 *   import { linkInBioStore } from "medusa-link-in-bio/sdk"
 *   const sdk = new Medusa({ baseUrl, publishableKey })
 *   const { page } = await linkInBioStore(sdk).page("links", { locale: "id", region_id })
 *
 * Only `sdk.client.fetch` is used, so any object with that shape works (your own fetch wrapper included).
 */
import type { AdminItem, AdminPage } from "./lib/serialize"
import type { StoreItem, StorePage } from "./lib/store"
import type { PageStats } from "./lib/clicks"
import type { ItemType, Target } from "./lib/types"
import type { Social, SocialNetwork, Theme } from "./lib/validate"

export type { AdminItem, AdminPage, StoreItem, StorePage, PageStats, ItemType, Target, Social, SocialNetwork, Theme }
export type { ProductInfo, EntityInfo, PostInfo } from "./lib/types"

export type FetchInit = { method?: string; body?: Record<string, any> | null; query?: Record<string, any>; headers?: Record<string, string>; cache?: RequestCache; next?: Record<string, unknown> }
export type FetchClient = { client: { fetch: <T>(path: string, init?: FetchInit) => Promise<T> } }
const bind = (sdk: FetchClient) => <T>(path: string, init?: FetchInit): Promise<T> => sdk.client.fetch<T>(path, init)

export type StorePageSummary = { id: string; handle: string; locales: string[]; noindex: boolean; updated_at: string }

export function linkInBioStore(sdk: FetchClient) {
  const f = bind(sdk)
  return {
    /** Published pages (handle + locales) */
    pages: (init?: Pick<FetchInit, "cache" | "next" | "headers">) => f<{ pages: StorePageSummary[] }>("/store/link-in-bio/pages", init),
    /** One page in a locale; `region_id` prices the products */
    page: (handle: string, query: { locale?: string; region_id?: string } = {}, init?: Pick<FetchInit, "cache" | "next" | "headers">) => f<{ page: StorePage }>(`/store/link-in-bio/pages/${encodeURIComponent(handle)}`, { query, ...init }),
  }
}

export type AdminConfig = { show_credit: boolean; storefront_url: string | null; main_handle: string; redirect_url: string | null; blog: boolean; clicks: boolean; utm: { source: string; medium: string }; networks: readonly SocialNetwork[]; revalidate: boolean }
export type AdminPageInput = {
  handle?: string
  name?: string
  locales?: string[]
  published?: boolean
  noindex?: boolean
  avatar?: string | null
  socials?: Social[]
  theme?: Partial<Theme>
  utm?: boolean
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  og_image?: string | null
  metadata?: Record<string, unknown> | null
  translations?: Record<string, { title?: string; bio?: string | null; seo_title?: string | null; seo_description?: string | null }>
}
export type AdminItemInput = {
  type?: ItemType
  target?: Record<string, unknown>
  enabled?: boolean
  starts_at?: string | null
  ends_at?: string | null
  image?: string | null
  icon?: string | null
  style?: "normal" | "featured" | null
  utm?: boolean | null
  metadata?: Record<string, unknown> | null
  translations?: Record<string, { label?: string | null; note?: string | null }>
  rank?: number
}
export type SearchResult = { id: string; title: string; handle: string; thumbnail: string | null; extra?: string }

export function linkInBioAdmin(sdk: FetchClient) {
  const f = bind(sdk)
  const pages = "/admin/link-in-bio/pages"
  return {
    config: () => f<AdminConfig>("/admin/link-in-bio/config"),
    listPages: () => f<{ pages: AdminPage[] }>(pages),
    getPage: (id: string) => f<{ page: AdminPage; items: AdminItem[] }>(`${pages}/${id}`),
    createPage: (body: AdminPageInput) => f<{ page: AdminPage }>(pages, { method: "POST", body }),
    updatePage: (id: string, body: AdminPageInput) => f<{ page: AdminPage }>(`${pages}/${id}`, { method: "POST", body }),
    deletePage: (id: string) => f<{ id: string; deleted: true }>(`${pages}/${id}`, { method: "DELETE" }),
    listItems: (pageId: string) => f<{ items: AdminItem[] }>(`${pages}/${pageId}/items`),
    createItem: (pageId: string, body: AdminItemInput) => f<{ item: AdminItem }>(`${pages}/${pageId}/items`, { method: "POST", body }),
    updateItem: (pageId: string, itemId: string, body: AdminItemInput) => f<{ item: AdminItem }>(`${pages}/${pageId}/items/${itemId}`, { method: "POST", body }),
    deleteItem: (pageId: string, itemId: string) => f<{ id: string; deleted: true }>(`${pages}/${pageId}/items/${itemId}`, { method: "DELETE" }),
    reorderItems: (pageId: string, ids: string[]) => f<{ items: AdminItem[] }>(`${pages}/${pageId}/items/reorder`, { method: "POST", body: { ids } }),
    stats: (pageId: string, days = 30) => f<{ stats: PageStats }>(`${pages}/${pageId}/stats`, { query: { days } }),
    search: (type: "product" | "collection" | "category" | "post", q = "", limit = 20) => f<{ results: SearchResult[] }>("/admin/link-in-bio/search", { query: { type, q, limit } }),
    /** URL of a QR image (the Admin links/downloads it; the session cookie authenticates) */
    qrUrl: (params: { page_id?: string; item_id?: string; locale?: string; format?: "svg" | "png"; size?: number; download?: boolean }, base = "") => {
      const q = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== false) q.set(k, String(v === true ? 1 : v))
      return `${base}/admin/link-in-bio/qr?${q}`
    },
  }
}
