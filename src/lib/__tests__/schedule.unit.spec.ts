import { isVisible, visibility } from "../schedule"

const now = new Date("2026-11-15T10:00:00Z")
const h = (n: number) => new Date(now.getTime() + n * 3600_000)

describe("schedule", () => {
  it("enabled without dates is live", () => {
    expect(isVisible({ enabled: true, starts_at: null, ends_at: null }, now)).toBe(true)
    expect(visibility({ enabled: true, starts_at: null, ends_at: null }, now)).toBe("live")
  })
  it("hidden beats everything", () => {
    expect(isVisible({ enabled: false, starts_at: null, ends_at: null }, now)).toBe(false)
    expect(visibility({ enabled: false, starts_at: h(-1), ends_at: h(1) }, now)).toBe("hidden")
  })
  it("start in the future = scheduled, end passed = expired (end is exclusive, start inclusive)", () => {
    expect(visibility({ enabled: true, starts_at: h(1), ends_at: null }, now)).toBe("scheduled")
    expect(isVisible({ enabled: true, starts_at: now, ends_at: null }, now)).toBe(true)
    expect(visibility({ enabled: true, starts_at: null, ends_at: h(-1) }, now)).toBe("expired")
    expect(isVisible({ enabled: true, starts_at: null, ends_at: now }, now)).toBe(false)
    expect(isVisible({ enabled: true, starts_at: h(-1).toISOString(), ends_at: h(1).toISOString() }, now)).toBe(true)
  })
})
