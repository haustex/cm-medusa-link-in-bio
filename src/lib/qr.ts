import fs from "node:fs/promises"
import QRCode from "qrcode"
import { getPositions } from "qrcode/lib/core/alignment-pattern"
import sharp from "sharp"
import { sniffImage } from "./uploads"

/**
 * QR codes drawn by the plugin itself from the module matrix (`qrcode` computes it, error correction H): round dots
 * for the data modules, rounded squares for the three finder "eyes", an optional logo in the centre on a clean white
 * badge (≈ 5 % of the area, well inside what level H recovers), a quiet zone of four modules. Two themes: light
 * (black on white) and dark (white modules on a black rounded card, corners transparent). SVG for print and PNG
 * (sharp rasterises the same SVG) for everything else. `qr.unit.spec.ts` decodes every variant with jsQR.
 */
export type QrTheme = "light" | "dark"
export type QrOptions = {
  theme?: QrTheme
  /** Raster logo bytes (PNG/JPEG/WebP/AVIF); anything else is ignored */
  logo?: Buffer | null
  /** width/height attributes of the SVG in px (the viewBox is in modules) */
  px?: number
}

export const QR_QUIET = 4
const DOT_R = 0.45
const COLORS: Record<QrTheme, { fg: string; bg: string }> = { light: { fg: "#000000", bg: "#ffffff" }, dark: { fg: "#ffffff", bg: "#000000" } }

export function qrModules(text: string): { size: number; dark: (row: number, col: number) => boolean; alignments: [number, number][] } {
  const q = QRCode.create(text, { errorCorrectionLevel: "H" })
  return { size: q.modules.size, dark: (row, col) => !!q.modules.get(row, col), alignments: getPositions(q.version) }
}

const inFinder = (r: number, c: number, n: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
const f = (v: number) => (Math.round(v * 1000) / 1000).toString()

/** A rounded rectangle as path data */
function rrect(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2)
  return `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(h - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-(w - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}v${f(-(h - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}z`
}

/** The logo as a PNG data URL, at most 512 px, alpha kept; null when the bytes are not a raster image */
export async function logoDataUrl(logo: Buffer): Promise<string | null> {
  if (!sniffImage(logo)) return null
  try {
    const png = await sharp(logo, { limitInputPixels: 40_000_000 }).rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).png().toBuffer()
    return `data:image/png;base64,${png.toString("base64")}`
  } catch {
    return null
  }
}

/** Side of the centre logo zone in modules (odd, ≥ 7, about 23 % of the grid) */
export const logoZone = (n: number): { start: number; side: number } => {
  let side = Math.round(n * 0.23)
  if (side % 2 === 0) side += 1
  side = Math.max(7, side)
  return { start: (n - side) / 2, side }
}

export async function qrSvg(text: string, options: QrOptions = {}): Promise<string> {
  const theme: QrTheme = options.theme === "dark" ? "dark" : "light"
  const { fg, bg } = COLORS[theme]
  const { size: n, dark, alignments } = qrModules(text)
  const total = n + 2 * QR_QUIET
  const logo = options.logo ? await logoDataUrl(options.logo) : null
  const zone = logo ? logoZone(n) : null
  const inLogo = (r: number, c: number) => !!zone && r >= zone.start && r < zone.start + zone.side && c >= zone.start && c < zone.start + zone.side
  // alignment patterns (5×5, used by readers to correct perspective) stay solid: a rounded ring and a centre square
  const inAlignment = (r: number, c: number) => alignments.some(([ar, ac]) => Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2)

  let dots = ""
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!dark(r, c) || inFinder(r, c, n) || inLogo(r, c) || inAlignment(r, c)) continue
      const cx = QR_QUIET + c + 0.5, cy = QR_QUIET + r + 0.5
      dots += `M${f(cx + DOT_R)} ${f(cy)}a${DOT_R} ${DOT_R} 0 1 0 ${f(-2 * DOT_R)} 0a${DOT_R} ${DOT_R} 0 1 0 ${f(2 * DOT_R)} 0z`
    }
  }
  // the three eyes: a rounded ring (outer minus inner, fill-rule evenodd) and a rounded pupil in its own path
  let rings = "", pupils = ""
  for (const [x0, y0] of [[0, 0], [n - 7, 0], [0, n - 7]] as const) {
    const x = QR_QUIET + x0, y = QR_QUIET + y0
    rings += rrect(x, y, 7, 7, 2.1) + rrect(x + 1, y + 1, 5, 5, 1.35)
    pupils += rrect(x + 2, y + 2, 3, 3, 0.9)
  }
  for (const [ar, ac] of alignments) {
    if (zone && inLogo(ar, ac)) continue // under the logo: level H covers it
    const x = QR_QUIET + ac - 2, y = QR_QUIET + ar - 2
    rings += rrect(x, y, 5, 5, 1.4) + rrect(x + 1, y + 1, 3, 3, 0.8)
    pupils += rrect(x + 2, y + 2, 1, 1, 0.3)
  }
  let badge = ""
  if (logo && zone) {
    const x = QR_QUIET + zone.start, s = zone.side, inset = s * 0.14
    badge = `<path d="${rrect(x, x, s, s, s * 0.22)}" fill="#ffffff"/><image href="${logo}" x="${f(x + inset)}" y="${f(x + inset)}" width="${f(s - 2 * inset)}" height="${f(s - 2 * inset)}" preserveAspectRatio="xMidYMid meet"/>`
  }
  const px = Math.min(Math.max(Math.round(options.px ?? 1024), 64), 8192)
  const back = theme === "dark" ? `<path d="${rrect(0, 0, total, total, QR_QUIET * 0.9)}" fill="${bg}"/>` : `<rect width="${total}" height="${total}" fill="${bg}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="geometricPrecision">${back}<path d="${dots}" fill="${fg}"/><path d="${rings}" fill="${fg}" fill-rule="evenodd"/><path d="${pupils}" fill="${fg}"/>${badge}</svg>`
}

/** PNG `size` pixels square (128–4096); the dark theme keeps transparent corners */
export async function qrPng(text: string, size = 1024, options: QrOptions = {}): Promise<Buffer> {
  const px = Math.min(Math.max(Math.round(size), 128), 4096)
  const svg = await qrSvg(text, { ...options, px })
  return sharp(Buffer.from(svg), { density: 300 }).resize(px, px, { fit: "fill" }).png().toBuffer()
}

/* ---------- logo sources ---------- */
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const LOGO_TTL = 10 * 60 * 1000
const logoCache = new Map<string, { at: number; buf: Buffer | null }>()

/** Bytes of a logo given as an https URL or an absolute file path; cached 10 min; null when unavailable */
export async function loadLogo(source: string | null | undefined): Promise<Buffer | null> {
  if (!source) return null
  const hit = logoCache.get(source)
  if (hit && Date.now() - hit.at < LOGO_TTL) return hit.buf
  let buf: Buffer | null = null
  try {
    if (/^https?:\/\//i.test(source)) {
      const res = await fetch(source, { signal: AbortSignal.timeout(8000), redirect: "follow" })
      const len = Number(res.headers.get("content-length") || 0)
      if (res.ok && len <= MAX_LOGO_BYTES) {
        const b = Buffer.from(await res.arrayBuffer())
        if (b.length <= MAX_LOGO_BYTES) buf = b
      }
    } else if (source.startsWith("/")) {
      const st = await fs.stat(source)
      if (st.isFile() && st.size <= MAX_LOGO_BYTES) buf = await fs.readFile(source)
    }
  } catch {
    buf = null
  }
  if (buf && !sniffImage(buf)) buf = null
  logoCache.set(source, { at: Date.now(), buf })
  return buf
}
