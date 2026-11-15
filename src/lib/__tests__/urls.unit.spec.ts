import { resolveOptions } from "../options"
import { internalUrl, pageUrl, redirectUrl, whatsappUrl } from "../urls"

const o = resolveOptions({ storefront: { url: "https://shop.test/", locales: { en: { prefix: "/us" } } } })

describe("urls", () => {
  it("page: main handle at /links, others at /links/{handle}, locale prefix", () => {
    expect(pageUrl(o, "links", "id", "id")).toBe("https://shop.test/links")
    expect(pageUrl(o, "links", "en", "id")).toBe("https://shop.test/us/links")
    expect(pageUrl(o, "ramadan-2026", "en", "id")).toBe("https://shop.test/us/links/ramadan-2026")
    expect(pageUrl(resolveOptions({}), "links", "id", "id")).toBeNull()
  })
  it("internal links and the redirect", () => {
    expect(internalUrl(o, "product", "tray jati", "id", "id")).toBe("https://shop.test/products/tray%20jati")
    expect(internalUrl(o, "post", "merawat-talenan", "en", "id")).toBe("https://shop.test/us/blog/merawat-talenan")
    expect(redirectUrl(o, "abc23456")).toBe("https://shop.test/l/abc23456")
    expect(redirectUrl(resolveOptions({ backend_url: "https://api.shop.test" }), "k")).toBe("https://api.shop.test/l/k")
    expect(redirectUrl(resolveOptions({ redirect_url: "https://go.shop.test/{key}" }), "k")).toBe("https://go.shop.test/k")
    expect(redirectUrl(resolveOptions({}), "k")).toBeNull()
  })
  it("whatsapp", () => {
    expect(whatsappUrl("6285111663330", "Halo Haus Kayu")).toBe("https://wa.me/6285111663330?text=Halo+Haus+Kayu")
  })
  it("options defaults", () => {
    const d = resolveOptions(undefined)
    expect(d.storefront.paths.main).toBe("/links")
    expect(d.utm).toEqual({ source: "link-in-bio", medium: "social" })
    expect(d.clicks).toEqual({ enabled: true, flush_ms: 5000, count_bots: false, respect_dnt: true })
    expect(d.rate_limit).toEqual({ window_seconds: 600, max: 300 })
    expect(d.showCredit).toBe(false)
  })
})
