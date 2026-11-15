import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { LINK_IN_BIO_MODULE } from "../modules/link-in-bio"
import { newKey } from "./keys"
import { normalizeLocale } from "./locales"
import { getPage } from "./pages"
import { pageChanged } from "./revalidate"
import { ITEM_TYPES, UTM_TYPES, type ItemRow, type ItemTranslationRow, type ItemType, type PageRow, type Target } from "./types"
import { cleanDate, cleanEmail, cleanPhone, cleanUrl, LibRuleError, str, strOrNull } from "./validate"

export const ITEM_RELATIONS = ["translations"]

type Service = {
  listLibItems: (f: Record<string, unknown>, c?: Record<string, unknown>) => Promise<ItemRow[]>
  createLibItems: (d: Record<string, unknown>) => Promise<ItemRow>
  updateLibItems: (d: Record<string, unknown> | Record<string, unknown>[]) => Promise<ItemRow | ItemRow[]>
  deleteLibItems: (ids: string[]) => Promise<void>
  createLibItemTranslations: (d: Record<string, unknown>[]) => Promise<ItemTranslationRow[]>
  updateLibItemTranslations: (d: Record<string, unknown>[]) => Promise<ItemTranslationRow[]>
  deleteLibItemTranslations: (ids: string[]) => Promise<void>
}
const service = (container: MedusaContainer) => container.resolve<Service>(LINK_IN_BIO_MODULE)

export type ItemInput = {
  type?: ItemType
  target?: Record<string, unknown>
  enabled?: boolean
  starts_at?: string | null
  ends_at?: string | null
  image?: string | null
  icon?: string | null
  style?: string | null
  utm?: boolean | null
  metadata?: Record<string, unknown> | null
  translations?: Record<string, { label?: string | null; note?: string | null }>
  /** Insert position (0 = top); default: after the last item */
  rank?: number
}

const id = (v: unknown, field: string): string => {
  const s = str(v, 80)
  if (!s || !/^[\w-]+$/.test(s)) throw new LibRuleError("invalid_target", `${field} is required`, field)
  return s
}

/** The target an item type needs, cleaned; anything else is dropped */
export function cleanTarget(type: ItemType, raw: Record<string, unknown> | undefined): Target {
  const t = raw ?? {}
  switch (type) {
    case "link": {
      const url = cleanUrl(t.url)
      if (!url) throw new LibRuleError("invalid_url", "url must be an absolute http(s) address", "url")
      return { url }
    }
    case "product":
      return { product_id: id(t.product_id, "product_id") }
    case "collection":
      return { collection_id: id(t.collection_id, "collection_id") }
    case "category":
      return { category_id: id(t.category_id, "category_id") }
    case "promo": {
      const code = str(t.code, 64).toUpperCase().replace(/\s+/g, "")
      if (!code) throw new LibRuleError("invalid_target", "code is required", "code")
      const url = t.url ? cleanUrl(t.url) : null
      if (t.url && !url) throw new LibRuleError("invalid_url", "url must be an absolute http(s) address", "url")
      return { code, url }
    }
    case "post": {
      if (t.latest === true) return { post_id: null, latest: true }
      return { post_id: id(t.post_id, "post_id") }
    }
    case "whatsapp": {
      const phone = cleanPhone(t.phone)
      if (!phone) throw new LibRuleError("invalid_target", "phone must be an international number", "phone")
      return { phone, text: strOrNull(t.text, 500) }
    }
    case "contact": {
      if (t.kind === "tel") {
        const phone = cleanPhone(t.value)
        if (!phone) throw new LibRuleError("invalid_target", "value must be a phone number", "value")
        return { kind: "tel", value: "+" + phone }
      }
      if (t.kind === "mailto") {
        const email = cleanEmail(t.value)
        if (!email) throw new LibRuleError("invalid_target", "value must be an e-mail address", "value")
        return { kind: "mailto", value: email }
      }
      throw new LibRuleError("invalid_target", "kind must be tel or mailto", "kind")
    }
    case "header":
    case "divider":
      return {}
  }
}

const image = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null
  const u = cleanUrl(v)
  if (!u) throw new LibRuleError("invalid_url", "image must be an absolute http(s) address", "image")
  return u
}

function checkDates(starts: Date | null, ends: Date | null) {
  if (starts && ends && ends <= starts) throw new LibRuleError("invalid_date", "ends_at must be after starts_at", "ends_at")
}

async function writeTranslations(container: MedusaContainer, item: ItemRow, locales: string[], input: ItemInput["translations"], existing: ItemTranslationRow[]) {
  const svc = service(container)
  const creates: Record<string, unknown>[] = []
  const updates: Record<string, unknown>[] = []
  for (const [rawCode, t] of Object.entries(input ?? {})) {
    const code = normalizeLocale(rawCode)
    if (!code || !locales.includes(code)) throw new LibRuleError("invalid_locale", `Locale "${rawCode}" is not one of the page's locales`, rawCode)
    const data: Record<string, unknown> = {}
    if (t.label !== undefined) data.label = strOrNull(t.label, 120)
    if (t.note !== undefined) data.note = strOrNull(t.note, 200)
    const row = existing.find((e) => e.locale === code)
    if (row) updates.push({ id: row.id, ...data })
    else creates.push({ item_id: item.id, locale: code, label: null, note: null, ...data })
  }
  if (updates.length) await svc.updateLibItemTranslations(updates)
  if (creates.length) await svc.createLibItemTranslations(creates)
}

export async function listItems(container: MedusaContainer, pageId: string): Promise<ItemRow[]> {
  return service(container).listLibItems({ page_id: pageId }, { relations: ITEM_RELATIONS, order: { rank: "ASC", created_at: "ASC" }, take: 500 })
}

export async function getItem(container: MedusaContainer, pageId: string, itemId: string): Promise<ItemRow> {
  const [row] = await service(container).listLibItems({ id: itemId, page_id: pageId }, { relations: ITEM_RELATIONS, take: 1 })
  if (!row) throw new LibRuleError("not_found", "Item not found")
  return row
}

export async function itemByKey(container: MedusaContainer, key: string): Promise<ItemRow | null> {
  const [row] = await service(container).listLibItems({ key }, { take: 1 })
  return row ?? null
}

async function uniqueKey(container: MedusaContainer): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const key = newKey()
    if (!(await itemByKey(container, key))) return key
  }
  throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "could not allocate an item key")
}

/** Items with gaps closed: ranks 0..n-1 in the given order */
async function renumber(container: MedusaContainer, items: ItemRow[]) {
  const updates = items.map((it, i) => ({ id: it.id, rank: i })).filter((u, i) => items[i].rank !== u.rank)
  if (updates.length) await service(container).updateLibItems(updates)
}

export async function createItem(container: MedusaContainer, pageId: string, input: ItemInput): Promise<ItemRow> {
  const page: PageRow = await getPage(container, pageId)
  const type = ITEM_TYPES.find((t) => t === input.type)
  if (!type) throw new LibRuleError("invalid", `type must be one of ${ITEM_TYPES.join(", ")}`, "type")
  const target = cleanTarget(type, input.target)
  const starts = cleanDate(input.starts_at, "starts_at")
  const ends = cleanDate(input.ends_at, "ends_at")
  checkDates(starts, ends)
  const siblings = await listItems(container, pageId)
  const at = input.rank === undefined || input.rank === null ? siblings.length : Math.min(Math.max(Math.trunc(input.rank), 0), siblings.length)
  const item = await service(container).createLibItems({
    page_id: pageId,
    key: await uniqueKey(container),
    type,
    target,
    rank: at,
    enabled: input.enabled !== false,
    starts_at: starts,
    ends_at: ends,
    image: image(input.image),
    icon: strOrNull(input.icon, 64),
    style: input.style === "featured" ? "featured" : null,
    utm: UTM_TYPES.includes(type) ? (input.utm === true || input.utm === false ? input.utm : null) : null,
    metadata: input.metadata ?? null,
  })
  await writeTranslations(container, item, page.locales as string[], input.translations, [])
  if (at < siblings.length) {
    const ordered = [...siblings]
    ordered.splice(at, 0, item)
    await renumber(container, ordered)
  }
  pageChanged(container, page.handle)
  return getItem(container, pageId, item.id)
}

export async function updateItem(container: MedusaContainer, pageId: string, itemId: string, input: ItemInput): Promise<ItemRow> {
  const page = await getPage(container, pageId)
  const item = await getItem(container, pageId, itemId)
  const data: Record<string, unknown> = { id: itemId }
  if (input.type !== undefined && input.type !== item.type) throw new LibRuleError("invalid", "type cannot change; create a new item", "type")
  if (input.target !== undefined) data.target = cleanTarget(item.type, input.target)
  const starts = input.starts_at !== undefined ? cleanDate(input.starts_at, "starts_at") : item.starts_at ? new Date(item.starts_at) : null
  const ends = input.ends_at !== undefined ? cleanDate(input.ends_at, "ends_at") : item.ends_at ? new Date(item.ends_at) : null
  checkDates(starts, ends)
  if (input.starts_at !== undefined) data.starts_at = starts
  if (input.ends_at !== undefined) data.ends_at = ends
  if (input.enabled !== undefined) data.enabled = input.enabled !== false
  if (input.image !== undefined) data.image = image(input.image)
  if (input.icon !== undefined) data.icon = strOrNull(input.icon, 64)
  if (input.style !== undefined) data.style = input.style === "featured" ? "featured" : null
  if (input.utm !== undefined) data.utm = UTM_TYPES.includes(item.type) ? (input.utm === true || input.utm === false ? input.utm : null) : null
  if (input.metadata !== undefined) data.metadata = input.metadata
  if (Object.keys(data).length > 1) await service(container).updateLibItems(data)
  if (input.translations !== undefined) await writeTranslations(container, item, page.locales as string[], input.translations, item.translations ?? [])
  pageChanged(container, page.handle)
  return getItem(container, pageId, itemId)
}

export async function deleteItem(container: MedusaContainer, pageId: string, itemId: string): Promise<void> {
  const page = await getPage(container, pageId)
  await getItem(container, pageId, itemId)
  await service(container).deleteLibItems([itemId])
  await renumber(container, await listItems(container, pageId))
  pageChanged(container, page.handle)
}

/** New order: the ids given first (in that order), then the rest as they were */
export async function reorderItems(container: MedusaContainer, pageId: string, ids: string[]): Promise<ItemRow[]> {
  const page = await getPage(container, pageId)
  const items = await listItems(container, pageId)
  const byId = new Map(items.map((i) => [i.id, i]))
  const seen = new Set<string>()
  const ordered: ItemRow[] = []
  for (const i of ids) {
    const it = byId.get(i)
    if (!it) throw new LibRuleError("not_found", `Item ${i} is not on this page`, i)
    if (!seen.has(i)) {
      seen.add(i)
      ordered.push(it)
    }
  }
  for (const it of items) if (!seen.has(it.id)) ordered.push(it)
  await renumber(container, ordered)
  pageChanged(container, page.handle)
  return listItems(container, pageId)
}
