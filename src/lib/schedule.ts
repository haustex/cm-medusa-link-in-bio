export type Scheduled = { enabled: boolean; starts_at: Date | string | null; ends_at: Date | string | null }

const at = (v: Date | string | null): number | null => (v === null || v === undefined ? null : v instanceof Date ? v.getTime() : new Date(v).getTime())

/** Shown to visitors now: switched on, start reached (or none), end not reached (or none) */
export function isVisible(item: Scheduled, now: Date = new Date()): boolean {
  if (!item.enabled) return false
  const t = now.getTime()
  const s = at(item.starts_at)
  const e = at(item.ends_at)
  if (s !== null && !Number.isNaN(s) && s > t) return false
  if (e !== null && !Number.isNaN(e) && e <= t) return false
  return true
}

/** For the Admin list: "live" | "scheduled" | "expired" | "hidden" */
export function visibility(item: Scheduled, now: Date = new Date()): "live" | "scheduled" | "expired" | "hidden" {
  if (!item.enabled) return "hidden"
  const t = now.getTime()
  const s = at(item.starts_at)
  const e = at(item.ends_at)
  if (e !== null && e <= t) return "expired"
  if (s !== null && s > t) return "scheduled"
  return "live"
}
