import { cleanLocales, matchLocale, normalizeLocale } from "../locales"

describe("locales", () => {
  it("normalizes and dedupes", () => {
    expect(normalizeLocale("EN-us")).toBe("en-US")
    expect(normalizeLocale("x")).toBeNull()
    expect(cleanLocales(["id", "ID", "en", "bad!", { code: "de" }])).toEqual(["id", "en", "de"])
    expect(cleanLocales([])).toEqual(["en"])
  })
  it("matches exact, then language, then default (first locale)", () => {
    expect(matchLocale("en", ["id", "en"])).toBe("en")
    expect(matchLocale("en-GB", ["id", "en"])).toBe("en")
    expect(matchLocale("fr", ["id", "en"])).toBe("id")
    expect(matchLocale(undefined, ["id", "en"])).toBe("id")
  })
})
