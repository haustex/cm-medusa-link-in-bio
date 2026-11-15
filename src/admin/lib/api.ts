import { linkInBioAdmin } from "../../sdk"
import { sdk } from "./client"

export type { AdminConfig, AdminItem, AdminItemInput, AdminPage, AdminPageInput, Focus, HeroRatio, ImageSlot, ItemType, PageStats, ProfileStyle, QrLogo, QrTheme, SearchResult, Social, SocialNetwork, Theme } from "../../sdk"
export const api = linkInBioAdmin(sdk)

export const KEY = ["link-in-bio"]
export const CONFIG_KEY = [...KEY, "config"]
export const PAGES_KEY = [...KEY, "pages"]
export const pageKey = (id: string | undefined) => [...KEY, "page", id]
export const statsKey = (id: string | undefined, days: number) => [...KEY, "stats", id, days]

export const lang = (l: string) => (l.startsWith("id") ? "id" : "en")
export function formatDateTime(iso: string | null | undefined, l: string) {
  if (!iso) return "–"
  return new Intl.DateTimeFormat(l === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
}
export const formatNumber = (n: number, l: string) => new Intl.NumberFormat(l === "id" ? "id-ID" : "en-US").format(n)
/** ISO date → value of <input type="datetime-local"> in the browser's time zone */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ""
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
/** datetime-local value → ISO (null when empty) */
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

export const RULE_CODES = ["not_found", "invalid_url", "invalid_handle", "handle_taken", "reserved_handle", "invalid_locale", "invalid_target", "invalid_date", "invalid_image", "file_too_large", "invalid"] as const
export function errorOf(e: unknown): { code: string | null; message: string } {
  const err = e as { message?: string; code?: string; status?: number }
  const m = err?.message ?? String(e)
  const code = err?.code ?? (RULE_CODES.find((c) => m.startsWith(c)) ?? null)
  return { code, message: m }
}

/** Where a QR image can be fetched (same origin as the Admin's API) */
export const qrSrc = (params: Parameters<typeof api.qrUrl>[0]) => api.qrUrl(params, (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, ""))
