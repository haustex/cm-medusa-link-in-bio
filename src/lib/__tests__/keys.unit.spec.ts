import { KEY_RE, newKey } from "../keys"

describe("newKey", () => {
  it("8 readable characters, unique enough", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const k = newKey()
      expect(k).toMatch(KEY_RE)
      expect(k).toHaveLength(8)
      expect(k).not.toMatch(/[01OIl]/)
      seen.add(k)
    }
    expect(seen.size).toBe(2000)
  })
})
