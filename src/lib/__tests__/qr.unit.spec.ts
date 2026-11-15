import jsQR from "jsqr"
import sharp from "sharp"
import { logoZone, qrModules, qrPng, qrSvg } from "../qr"

/**
 * Decodes a PNG the way a phone would: grey pixels; `inverted` = a reader that also tries light-on-dark codes
 * ("attemptBoth": jsQR 1.4's "onlyInvert" never builds the inverted matrix and throws), else dark-on-light only.
 */
async function decode(png: Buffer, inverted: boolean): Promise<string | null> {
  const { data, info } = await sharp(png).flatten({ background: inverted ? "#000000" : "#ffffff" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const r = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, { inversionAttempts: inverted ? "attemptBoth" : "dontInvert" })
  return r?.data ?? null
}

const URL_SHORT = "https://storefront.e2e.test/links"
const URL_LONG = "https://storefront.e2e.test/us/links/ramadan-2026?utm_source=link-in-bio&utm_medium=social&utm_campaign=print"
let logo: Buffer

beforeAll(async () => {
  // a square logo with transparent corners, like a brand mark
  logo = await sharp({ create: { width: 240, height: 240, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><circle cx="120" cy="120" r="100" fill="#c0392b"/><path d="M80 150 L110 90 L130 90 L100 150z M130 150 L160 90 L180 90 L150 150z" fill="#fff"/></svg>'), top: 0, left: 0 }])
    .png()
    .toBuffer()
})

describe("qr matrix", () => {
  it("uses error correction H and leaves room for the logo", () => {
    const { size } = qrModules(URL_SHORT)
    expect(size).toBeGreaterThanOrEqual(25)
    const z = logoZone(size)
    expect(z.side % 2).toBe(1)
    expect(z.side * z.side).toBeLessThan(size * size * 0.08) // ≈ 5 % of the modules, far under what H recovers
    expect(Number.isInteger(z.start)).toBe(true)
  })
})

describe("qr svg", () => {
  it("light: white background, black dots and eyes, no script", async () => {
    const svg = await qrSvg(URL_SHORT, { theme: "light", px: 512 })
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('fill="#000000"')
    expect(svg).toContain('width="512"')
    expect(svg).not.toMatch(/<script|onload|javascript:/i)
    expect(svg).not.toContain("<image")
  })
  it("dark: rounded black card, white modules; logo embedded as a PNG data URL on a white badge", async () => {
    const svg = await qrSvg(URL_SHORT, { theme: "dark", logo })
    expect(svg).toContain('fill="#000000"')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('<image href="data:image/png;base64,')
  })
  it("ignores a logo that is not a raster image", async () => {
    const svg = await qrSvg(URL_SHORT, { logo: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>") })
    expect(svg).not.toContain("<image")
  })
})

describe("qr png decodes", () => {
  const sizes = [256, 512, 1024]
  for (const theme of ["light", "dark"] as const) {
    for (const withLogo of [false, true]) {
      for (const size of sizes) {
        for (const [name, text] of [["short", URL_SHORT], ["long", URL_LONG]] as const) {
          it(`${theme}${withLogo ? " + logo" : ""} ${size}px ${name}`, async () => {
            const png = await qrPng(text, size, { theme, logo: withLogo ? logo : null })
            const meta = await sharp(png).metadata()
            expect(meta.width).toBe(size)
            expect(meta.height).toBe(size)
            expect(await decode(png, theme === "dark")).toBe(text)
          })
        }
      }
    }
  }
  it("a dark code is not read without inversion (why the Admin warns about older scanners)", async () => {
    const png = await qrPng(URL_SHORT, 512, { theme: "dark" })
    expect(await decode(png, false)).toBeNull()
  })
})
