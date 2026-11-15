import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils"
import { getOptions } from "./options"

export const CLICK_TABLE = "lib_click_day"

/** YYYY-MM-DD in UTC */
export const dayOf = (d: Date = new Date()) => d.toISOString().slice(0, 10)

type Pending = { page_id: string; item_id: string; day: string; count: number }
const pending = new Map<string, Pending>()
let timer: NodeJS.Timeout | null = null

const pg = (container: MedusaContainer): Knex | null => {
  try {
    return container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  } catch {
    return null
  }
}
const logger = (container: MedusaContainer): Logger | null => {
  try {
    return container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  } catch {
    return null
  }
}

/** Writes the buffered counts: one upsert per (item, day) */
export async function flushClicks(container: MedusaContainer): Promise<number> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!pending.size) return 0
  const rows = [...pending.values()]
  pending.clear()
  const knex = pg(container)
  if (!knex) {
    logger(container)?.warn("[link-in-bio] no database connection to write click counts")
    return 0
  }
  const now = new Date()
  try {
    // the unique index on (item_id, day) is partial (deleted_at is null), so the conflict target names the predicate
    const values = rows.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ")
    const bindings = rows.flatMap((r) => [generateEntityId(undefined, "libck"), r.page_id, r.item_id, r.day, r.count, now, now])
    await knex.raw(
      `insert into ${CLICK_TABLE} (id, page_id, item_id, day, count, created_at, updated_at) values ${values}
       on conflict (item_id, day) where deleted_at is null do update set count = ${CLICK_TABLE}.count + excluded.count, updated_at = excluded.updated_at`,
      bindings
    )
  } catch (e) {
    logger(container)?.warn(`[link-in-bio] could not write click counts: ${(e as Error).message}`)
  }
  return rows.length
}

/** Counts one click; written with the next flush (options.clicks.flush_ms) */
export function recordClick(container: MedusaContainer, pageId: string, itemId: string, now: Date = new Date()): void {
  const o = getOptions(container)
  const day = dayOf(now)
  const k = `${itemId}|${day}`
  const p = pending.get(k) ?? { page_id: pageId, item_id: itemId, day, count: 0 }
  p.count++
  pending.set(k, p)
  if (o.clicks.flush_ms <= 0) {
    void flushClicks(container)
    return
  }
  if (!timer) {
    timer = setTimeout(() => void flushClicks(container), o.clicks.flush_ms)
    timer.unref?.()
  }
}

export type ItemStats = { clicks_7d: number; clicks_30d: number; clicks_total: number }
export type PageStats = { clicks_7d: number; clicks_30d: number; clicks_total: number; items: Record<string, ItemStats>; days: { day: string; count: number }[] }

/** Totals per item and per day for one page (last `days` days in the series) */
export async function pageStats(container: MedusaContainer, pageId: string, days = 30, now: Date = new Date()): Promise<PageStats> {
  const empty: PageStats = { clicks_7d: 0, clicks_30d: 0, clicks_total: 0, items: {}, days: [] }
  const knex = pg(container)
  if (!knex) return empty
  const since = (n: number) => dayOf(new Date(now.getTime() - (n - 1) * 86_400_000))
  const d7 = since(7)
  const d30 = since(30)
  const dN = since(Math.min(Math.max(days, 1), 366))
  const rows: { item_id: string; day: string; count: number | string }[] = await knex(CLICK_TABLE).select("item_id", "day", "count").where({ page_id: pageId })
  const out: PageStats = { ...empty, items: {}, days: [] }
  const perDay = new Map<string, number>()
  for (const r of rows) {
    const c = Number(r.count) || 0
    const it = (out.items[r.item_id] ??= { clicks_7d: 0, clicks_30d: 0, clicks_total: 0 })
    it.clicks_total += c
    out.clicks_total += c
    if (r.day >= d30) {
      it.clicks_30d += c
      out.clicks_30d += c
    }
    if (r.day >= d7) {
      it.clicks_7d += c
      out.clicks_7d += c
    }
    if (r.day >= dN) perDay.set(r.day, (perDay.get(r.day) ?? 0) + c)
  }
  for (let t = new Date(dN + "T00:00:00Z").getTime(); t <= now.getTime(); t += 86_400_000) {
    const day = dayOf(new Date(t))
    out.days.push({ day, count: perDay.get(day) ?? 0 })
  }
  return out
}

/** Totals per page (for the pages list) */
export async function pagesStats(container: MedusaContainer, now: Date = new Date()): Promise<Record<string, { clicks_7d: number; clicks_30d: number }>> {
  const knex = pg(container)
  if (!knex) return {}
  const d30 = dayOf(new Date(now.getTime() - 29 * 86_400_000))
  const d7 = dayOf(new Date(now.getTime() - 6 * 86_400_000))
  const rows: { page_id: string; day: string; count: number | string }[] = await knex(CLICK_TABLE).select("page_id", "day", "count").where("day", ">=", d30)
  const out: Record<string, { clicks_7d: number; clicks_30d: number }> = {}
  for (const r of rows) {
    const c = Number(r.count) || 0
    const p = (out[r.page_id] ??= { clicks_7d: 0, clicks_30d: 0 })
    p.clicks_30d += c
    if (r.day >= d7) p.clicks_7d += c
  }
  return out
}

/** For tests */
export function pendingClicks(): number {
  let n = 0
  for (const p of pending.values()) n += p.count
  return n
}
