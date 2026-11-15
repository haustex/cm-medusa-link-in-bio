import fs from "node:fs"
import path from "node:path"
import type { ConfigModule, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const PACKAGE_NAME = "medusa-link-in-bio"

/** Where the storefront serves things, so the plugin can build the links it hands out and the Admin can preview them */
export type StorefrontOptions = {
  /** Public origin of the storefront, e.g. "https://example.com" (no trailing slash) */
  url?: string
  /** Per locale: a path prefix ("" for none, "/us") or a different origin ("https://example.de") */
  locales?: Record<string, { prefix?: string; origin?: string }>
  /** Handle of the page served at `paths.main` instead of `paths.page`. Default "links" */
  main_handle?: string
  paths?: {
    /** The main page. Default "/links" */
    main?: string
    /** Other pages, `{handle}` replaced. Default "/links/{handle}" */
    page?: string
    /** Default "/products/{handle}" */
    product?: string
    /** Default "/collections/{handle}" */
    collection?: string
    /** Default "/categories/{handle}" */
    category?: string
    /** medusa-blog-seo articles, `{slug}` replaced. Default "/blog/{slug}" */
    post?: string
  }
}

export type PluginOptions = {
  storefront?: StorefrontOptions
  /**
   * Public address of the counting redirect, `{key}` replaced. Default: `${storefront.url}/l/{key}` when the
   * storefront proxies /l to the backend (Kiln does), else the backend's own `/l/{key}` (needs `backend_url`).
   */
  redirect_url?: string
  /** Public URL of this Medusa server, for the fallback redirect address and the Admin's QR codes */
  backend_url?: string
  utm?: {
    /** Default "link-in-bio" */
    source?: string
    /** Default "social" */
    medium?: string
  }
  clicks?: {
    /** Count clicks at all. Default true */
    enabled?: boolean
    /** Buffer window before counts are written, ms. 0 writes at once. Default 5000 */
    flush_ms?: number
    /** Count requests whose user agent is a known bot/crawler. Default false */
    count_bots?: boolean
    /** Do not count visitors who send DNT: 1 or Sec-GPC: 1 (they are still redirected). Default true */
    respect_dnt?: boolean
  }
  rate_limit?: {
    /** Per IP on /l/{key} and the Store API. Default 600 */
    window_seconds?: number
    /** Default 300 requests per window; 0 disables */
    max?: number
  }
  /** Page handles that may not be used (route segments of the storefront). Default [] */
  reserved_handles?: string[]
  /** Show the small "by Haus Kayu" credit under the plugin's Admin pages. Default false */
  showCredit?: boolean
}

export type ResolvedStorefront = {
  url: string | null
  locales: Record<string, { prefix?: string; origin?: string }>
  main_handle: string
  paths: Required<NonNullable<StorefrontOptions["paths"]>>
}

export type ResolvedOptions = {
  storefront: ResolvedStorefront
  redirect_url: string | null
  backend_url: string | null
  utm: { source: string; medium: string }
  clicks: { enabled: boolean; flush_ms: number; count_bots: boolean; respect_dnt: boolean }
  rate_limit: { window_seconds: number; max: number }
  reserved_handles: string[]
  showCredit: boolean
}

function num(value: unknown, fallback: number, min = 0): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n >= min ? n : fallback
}
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const origin = (v: unknown): string | null => str(v)?.replace(/\/+$/, "") ?? null
const pathOf = (v: unknown, fallback: string): string => {
  const s = str(v)
  return s && s.startsWith("/") ? s.replace(/\/+$/, "") || "/" : fallback
}
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [])

export function resolveOptions(raw: PluginOptions | undefined): ResolvedOptions {
  const o = raw ?? {}
  const s = o.storefront ?? {}
  const p = s.paths ?? {}
  const c = o.clicks ?? {}
  const rl = o.rate_limit ?? {}
  const url = origin(s.url)
  const backend = origin(o.backend_url)
  const redirect = str(o.redirect_url) ?? (url ? `${url}/l/{key}` : backend ? `${backend}/l/{key}` : null)
  return {
    storefront: {
      url,
      locales: s.locales && typeof s.locales === "object" ? s.locales : {},
      main_handle: str(s.main_handle) ?? "links",
      paths: {
        main: pathOf(p.main, "/links"),
        page: pathOf(p.page, "/links/{handle}"),
        product: pathOf(p.product, "/products/{handle}"),
        collection: pathOf(p.collection, "/collections/{handle}"),
        category: pathOf(p.category, "/categories/{handle}"),
        post: pathOf(p.post, "/blog/{slug}"),
      },
    },
    redirect_url: redirect && redirect.includes("{key}") ? redirect : redirect ? `${redirect.replace(/\/+$/, "")}/{key}` : null,
    backend_url: backend,
    utm: { source: str(o.utm?.source) ?? "link-in-bio", medium: str(o.utm?.medium) ?? "social" },
    clicks: { enabled: c.enabled !== false, flush_ms: num(c.flush_ms, 5000), count_bots: c.count_bots === true, respect_dnt: c.respect_dnt !== false },
    rate_limit: { window_seconds: num(rl.window_seconds, 600, 1), max: num(rl.max, 300) },
    reserved_handles: list(o.reserved_handles).map((h) => h.toLowerCase()),
    showCredit: o.showCredit === true,
  }
}

type Entry = string | { resolve?: unknown; options?: unknown }

function packageNameAt(dir: string): string | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name ?? null
  } catch {
    return null
  }
}

/** A resolve string that points at this package: its name, a sub-path of it, or a local path to it */
export function isThisPackage(resolve: string): boolean {
  const r = resolve.replace(/\/+$/, "")
  if (r === PACKAGE_NAME || r.startsWith(`${PACKAGE_NAME}/`) || r.includes(`/${PACKAGE_NAME}`)) return true
  if (r.startsWith(".") || path.isAbsolute(r)) {
    for (let dir = path.resolve(r), i = 0; i < 6; i++, dir = path.dirname(dir)) {
      if (packageNameAt(dir) === PACKAGE_NAME) return true
    }
  }
  return false
}

const cache = new WeakMap<object, ResolvedOptions>()

/** The plugin's options (`plugins: [{ resolve, options }]`) with defaults applied; cached per container. */
export function getOptions(container: MedusaContainer): ResolvedOptions {
  const config: ConfigModule = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
  const hit = cache.get(config)
  if (hit) return hit
  let raw: PluginOptions | undefined
  for (const p of (config.plugins ?? []) as Entry[]) {
    const resolve = typeof p === "string" ? p : p.resolve
    if (typeof resolve === "string" && isThisPackage(resolve)) {
      raw = typeof p === "string" ? {} : ((p.options as PluginOptions) ?? {})
      break
    }
  }
  const resolved = resolveOptions(raw)
  cache.set(config, resolved)
  return resolved
}
