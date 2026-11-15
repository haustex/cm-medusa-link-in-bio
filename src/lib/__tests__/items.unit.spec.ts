import { cleanTarget } from "../items"
import { LibRuleError } from "../validate"

describe("cleanTarget", () => {
  it("per type", () => {
    expect(cleanTarget("link", { url: "https://a.b/c", junk: 1 })).toEqual({ url: "https://a.b/c" })
    expect(cleanTarget("product", { product_id: "prod_1" })).toEqual({ product_id: "prod_1" })
    expect(cleanTarget("promo", { code: " hemat 10 " })).toEqual({ code: "HEMAT10", url: null })
    expect(cleanTarget("post", { latest: true })).toEqual({ post_id: null, latest: true })
    expect(cleanTarget("whatsapp", { phone: "+62 851 1166 3330", text: "Halo" })).toEqual({ phone: "6285111663330", text: "Halo" })
    expect(cleanTarget("contact", { kind: "tel", value: "0812-3456-7890" })).toEqual({ kind: "tel", value: "+81234567890" })
    expect(cleanTarget("contact", { kind: "mailto", value: "a@b.co" })).toEqual({ kind: "mailto", value: "a@b.co" })
    expect(cleanTarget("header", { url: "x" })).toEqual({})
  })
  it("refuses bad input with the right code", () => {
    const code = (fn: () => unknown) => {
      try {
        fn()
      } catch (e) {
        return (e as LibRuleError).code
      }
      return "ok"
    }
    expect(code(() => cleanTarget("link", { url: "javascript:1" }))).toBe("invalid_url")
    expect(code(() => cleanTarget("product", {}))).toBe("invalid_target")
    expect(code(() => cleanTarget("promo", { code: "", url: "https://x.y" }))).toBe("invalid_target")
    expect(code(() => cleanTarget("promo", { code: "A", url: "ftp://x.y" }))).toBe("invalid_url")
    expect(code(() => cleanTarget("whatsapp", { phone: "12" }))).toBe("invalid_target")
    expect(code(() => cleanTarget("contact", { kind: "sms", value: "1" }))).toBe("invalid_target")
  })
})
