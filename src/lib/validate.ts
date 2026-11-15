/**
 * Input rules. Links: only http(s), no credentials, no control characters, at most 2048 characters; the redirect
 * route never sends a visitor anywhere but to a URL that passed this check and was stored by an admin.
 */
export const MAX_URL = 2048

export class LibRuleError extends Error {
  constructor(
    public code: "not_found" | "invalid_url" | "invalid_handle" | "handle_taken" | "invalid_locale" | "invalid_target" | "invalid_date" | "invalid" | "reserved_handle" | "invalid_image" | "file_too_large",
    message: string,
    public detail?: string
  ) {
    super(message)
  }
}

/** A safe absolute http(s) URL or null */
export function cleanUrl(input: unknown): string | null {
  if (typeof input !== "string") return null
  const s = input.trim()
  if (!s || s.length > MAX_URL || /[\u0000-\u001f\u007f]/.test(s)) return null
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null
  if (u.username || u.password || !u.hostname) return null
  return u.href
}

/** Like cleanUrl but throws the rule error the Admin translates */
export function requireUrl(input: unknown, field = "url"): string {
  const url = cleanUrl(input)
  if (!url) throw new LibRuleError("invalid_url", `${field} must be an absolute http(s) address`, field)
  return url
}

export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

/** Lower-case letters, digits and hyphens, 1–64 characters */
export function cleanHandle(input: unknown): string | null {
  if (typeof input !== "string") return null
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
  return HANDLE_RE.test(s) ? s : null
}

export const str = (v: unknown, max = 200): string => (typeof v === "string" ? v.trim().slice(0, max) : "")
export const strOrNull = (v: unknown, max = 200): string | null => str(v, max) || null

/** "#rgb" / "#rrggbb" → "#rrggbb" lower-case, else null */
export function cleanHex(input: unknown): string | null {
  if (typeof input !== "string") return null
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
  if (!m) return null
  const h = m[1].toLowerCase()
  return "#" + (h.length === 3 ? h.split("").map((c) => c + c).join("") : h)
}

/** ISO date string → Date, null for empty, throws for garbage */
export function cleanDate(input: unknown, field: string): Date | null {
  if (input === null || input === undefined || input === "") return null
  const d = new Date(typeof input === "string" || typeof input === "number" ? input : NaN)
  if (Number.isNaN(d.getTime())) throw new LibRuleError("invalid_date", `${field} is not a date`, field)
  return d
}

/** Digits only, 7–15 (E.164 without the plus) */
export function cleanPhone(input: unknown): string | null {
  if (typeof input !== "string") return null
  const d = input.replace(/[^\d]/g, "").replace(/^0+/, "")
  return d.length >= 7 && d.length <= 15 ? d : null
}

export function cleanEmail(input: unknown): string | null {
  if (typeof input !== "string") return null
  const s = input.trim()
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null
}

export const SOCIAL_NETWORKS = ["instagram", "tiktok", "facebook", "x", "youtube", "pinterest", "linkedin", "threads", "whatsapp", "telegram", "shopee", "tokopedia", "etsy", "email", "website"] as const
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]

export type Social = { network: SocialNetwork; url: string }

/** Social icons: known network + safe URL (email → mailto: is allowed there) */
export function cleanSocials(input: unknown): Social[] {
  const out: Social[] = []
  for (const raw of Array.isArray(input) ? input.slice(0, 20) : []) {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const network = SOCIAL_NETWORKS.find((n) => n === r.network)
    if (!network) continue
    let url: string | null = null
    if (network === "email") {
      const e = cleanEmail(typeof r.url === "string" ? r.url.replace(/^mailto:/i, "") : r.url)
      url = e ? `mailto:${e}` : null
    } else url = cleanUrl(r.url)
    if (!url) continue
    out.push({ network, url })
  }
  return out
}

export type Theme = { background: string; text: string; accent: string; radius: "none" | "sm" | "md" | "full"; button: "solid" | "outline" | "soft" }
export const DEFAULT_THEME: Theme = { background: "#ffffff", text: "#0c0c0c", accent: "#0c0c0c", radius: "md", button: "solid" }

export function cleanTheme(input: unknown, base: Theme = DEFAULT_THEME): Theme {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  return {
    background: cleanHex(r.background) ?? base.background,
    text: cleanHex(r.text) ?? base.text,
    accent: cleanHex(r.accent) ?? base.accent,
    radius: r.radius === "none" || r.radius === "sm" || r.radius === "md" || r.radius === "full" ? r.radius : base.radius,
    button: r.button === "outline" || r.button === "soft" || r.button === "solid" ? r.button : base.button,
  }
}

export const PROFILE_STYLES = ["circle", "hero"] as const
export type ProfileStyle = (typeof PROFILE_STYLES)[number]
export const HERO_RATIOS = ["16:9", "3:2"] as const
export type HeroRatio = (typeof HERO_RATIOS)[number]
export const cleanProfileStyle = (v: unknown, fallback: ProfileStyle = "circle"): ProfileStyle => (PROFILE_STYLES.find((x) => x === v) ?? fallback)
export const cleanHeroRatio = (v: unknown, fallback: HeroRatio = "16:9"): HeroRatio => (HERO_RATIOS.find((x) => x === v) ?? fallback)

/** Focal point of an image in percent of its width and height, { x: 50, y: 50 } is the centre */
export type Focus = { x: number; y: number }
export function cleanFocus(input: unknown): Focus | null {
  if (!input || typeof input !== "object") return null
  const r = input as Record<string, unknown>
  const n = (v: unknown) => {
    const x = typeof v === "number" ? v : Number(v)
    return Number.isFinite(x) ? Math.min(100, Math.max(0, Math.round(x))) : null
  }
  const x = n(r.x), y = n(r.y)
  return x === null || y === null ? null : { x, y }
}
