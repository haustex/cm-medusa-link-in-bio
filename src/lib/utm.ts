/**
 * UTM parameters are added to a link only when it carries none of its own (an admin's hand-written campaign
 * link wins). Keys: utm_source, utm_medium, utm_campaign (the page handle), utm_content (the item key).
 */
export type UtmParams = { source: string; medium: string; campaign: string; content?: string }

export function hasUtm(url: string): boolean {
  try {
    for (const k of new URL(url).searchParams.keys()) if (k.toLowerCase().startsWith("utm_")) return true
  } catch {}
  return false
}

export function withUtm(url: string, utm: UtmParams | null): string {
  if (!utm || hasUtm(url)) return url
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return url
  u.searchParams.set("utm_source", utm.source)
  u.searchParams.set("utm_medium", utm.medium)
  u.searchParams.set("utm_campaign", utm.campaign)
  if (utm.content) u.searchParams.set("utm_content", utm.content)
  return u.href
}
