import { cleanEmail, cleanHandle, cleanHex, cleanPhone, cleanSocials, cleanTheme, cleanUrl } from "../validate"

describe("cleanUrl", () => {
  it("accepts http(s) and normalizes", () => {
    expect(cleanUrl(" https://Example.com/a b?x=1 ")).toBe("https://example.com/a%20b?x=1")
    expect(cleanUrl("http://example.com")).toBe("http://example.com/")
  })
  it("refuses other schemes, credentials, garbage", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.y", "mailto:a@b.c", "//example.com", "example.com", "https://user:pw@example.com", "https://", "", 42, null, "https://example.com/\u0000"]) {
      expect(cleanUrl(bad)).toBeNull()
    }
    expect(cleanUrl("https://example.com/" + "a".repeat(2100))).toBeNull()
  })
})

describe("cleanHandle", () => {
  it("slugifies", () => {
    expect(cleanHandle(" Summer Sale_2026 ")).toBe("summer-sale-2026")
    expect(cleanHandle("--links--")).toBe("links")
    expect(cleanHandle("Café!")).toBe("caf")
  })
  it("refuses empty / too long", () => {
    expect(cleanHandle("!!!")).toBeNull()
    expect(cleanHandle("a".repeat(70))).toBeNull()
    expect(cleanHandle(undefined)).toBeNull()
  })
})

describe("cleanHex / cleanTheme", () => {
  it("expands short hex, keeps defaults otherwise", () => {
    expect(cleanHex("#FFF")).toBe("#ffffff")
    expect(cleanHex("0c0c0c")).toBe("#0c0c0c")
    expect(cleanHex("red")).toBeNull()
    expect(cleanTheme({ background: "#fff", radius: "huge", button: "outline" })).toEqual({ background: "#ffffff", text: "#0c0c0c", accent: "#0c0c0c", radius: "md", button: "outline" })
  })
})

describe("cleanSocials", () => {
  it("keeps known networks with safe URLs, email as mailto", () => {
    expect(cleanSocials([{ network: "instagram", url: "https://instagram.com/hauskayu" }, { network: "email", url: "Hi@Example.com" }, { network: "myspace", url: "https://x.y" }, { network: "tiktok", url: "javascript:1" }, "junk"])).toEqual([
      { network: "instagram", url: "https://instagram.com/hauskayu" },
      { network: "email", url: "mailto:Hi@Example.com" },
    ])
  })
})

describe("phone / email", () => {
  it("digits only, no leading zeros", () => {
    expect(cleanPhone("+62 851-1166-3330")).toBe("6285111663330")
    expect(cleanPhone("0812")).toBeNull()
    expect(cleanEmail(" a@b.co ")).toBe("a@b.co")
    expect(cleanEmail("nope")).toBeNull()
  })
})
