import { isbot } from "isbot"

/** Known crawlers, link previewers and monitoring tools (isbot's list) + an empty user agent */
export function isBot(userAgent: string | string[] | undefined): boolean {
  const ua = Array.isArray(userAgent) ? userAgent[0] : userAgent
  if (!ua || !ua.trim()) return true
  return isbot(ua)
}

/** The visitor asked not to be tracked: DNT: 1 (older browsers) or Sec-GPC: 1 (Global Privacy Control) */
export function doNotTrack(headers: Record<string, string | string[] | undefined>): boolean {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() === "1"
  return one(headers["dnt"]) || one(headers["sec-gpc"])
}
