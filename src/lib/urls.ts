import type { ResolvedOptions, ResolvedStorefront } from "./options"

/** Origin + prefix of a locale on the storefront ("https://shop.com", "https://shop.com/us") */
export function localeBase(s: ResolvedStorefront, locale: string, defaultLocale: string): string | null {
  if (!s.url) return null
  const l = s.locales[locale] ?? (locale !== defaultLocale ? undefined : { prefix: "" })
  const origin = (l?.origin ?? s.url).replace(/\/+$/, "")
  const prefix = (l?.prefix ?? "").replace(/\/+$/, "")
  return origin + (prefix && !prefix.startsWith("/") ? "/" + prefix : prefix)
}

const fill = (pattern: string, vars: Record<string, string>) => pattern.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(vars[k] ?? ""))

/** Public address of a page in a locale, null without `storefront.url` */
export function pageUrl(o: ResolvedOptions, handle: string, locale: string, defaultLocale: string): string | null {
  const base = localeBase(o.storefront, locale, defaultLocale)
  if (base === null) return null
  const p = o.storefront.paths
  return base + (handle === o.storefront.main_handle ? p.main : fill(p.page, { handle }))
}

export type InternalKind = "product" | "collection" | "category" | "post"

/** Storefront address of a product, collection, category or article in a locale */
export function internalUrl(o: ResolvedOptions, kind: InternalKind, slug: string, locale: string, defaultLocale: string): string | null {
  const base = localeBase(o.storefront, locale, defaultLocale)
  if (base === null) return null
  const p = o.storefront.paths
  return base + fill(p[kind], { handle: slug, slug })
}

/** The counting redirect for an item key */
export function redirectUrl(o: ResolvedOptions, key: string): string | null {
  return o.redirect_url ? o.redirect_url.replace("{key}", encodeURIComponent(key)) : null
}

export function whatsappUrl(phone: string, text: string | null): string {
  const u = new URL(`https://wa.me/${phone}`)
  if (text) u.searchParams.set("text", text)
  return u.href
}
