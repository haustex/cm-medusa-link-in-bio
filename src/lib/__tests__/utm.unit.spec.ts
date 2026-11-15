import { hasUtm, withUtm } from "../utm"

const utm = { source: "link-in-bio", medium: "social", campaign: "links", content: "abc23456" }

describe("withUtm", () => {
  it("adds the four parameters", () => {
    const u = new URL(withUtm("https://shop.test/products/tray?ref=1", utm))
    expect(u.searchParams.get("ref")).toBe("1")
    expect(u.searchParams.get("utm_source")).toBe("link-in-bio")
    expect(u.searchParams.get("utm_medium")).toBe("social")
    expect(u.searchParams.get("utm_campaign")).toBe("links")
    expect(u.searchParams.get("utm_content")).toBe("abc23456")
  })
  it("leaves a link alone that has its own utm, or no utm wanted", () => {
    const own = "https://shop.test/?utm_source=newsletter"
    expect(withUtm(own, utm)).toBe(own)
    expect(hasUtm(own)).toBe(true)
    expect(withUtm("https://shop.test/", null)).toBe("https://shop.test/")
  })
  it("never touches non-http targets", () => {
    expect(withUtm("mailto:a@b.c", utm)).toBe("mailto:a@b.c")
    expect(withUtm("not a url", utm)).toBe("not a url")
  })
})
