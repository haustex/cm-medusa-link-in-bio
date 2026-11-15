import { doNotTrack, isBot } from "../bots"

describe("bots", () => {
  it("recognizes crawlers and previewers, not browsers", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true)
    expect(isBot("facebookexternalhit/1.1")).toBe(true)
    expect(isBot("WhatsApp/2.23.20.0")).toBe(true)
    expect(isBot("curl/8.5.0")).toBe(true)
    expect(isBot(undefined)).toBe(true)
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBe(false)
    expect(isBot("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 Instagram 300.0.0.0.0")).toBe(false)
  })
  it("DNT / GPC", () => {
    expect(doNotTrack({ dnt: "1" })).toBe(true)
    expect(doNotTrack({ "sec-gpc": "1" })).toBe(true)
    expect(doNotTrack({ dnt: "0" })).toBe(false)
    expect(doNotTrack({})).toBe(false)
  })
})
