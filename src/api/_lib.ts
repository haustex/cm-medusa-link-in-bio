import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOptions } from "../lib/options"
import { pageLocales, toAdminItem, toAdminPage, type AdminItem, type AdminPage } from "../lib/serialize"
import { CLICKABLE, type ItemRow, type PageRow } from "../lib/types"
import { pageUrl, redirectUrl } from "../lib/urls"
import { LibRuleError } from "../lib/validate"

const STATUS: Record<LibRuleError["code"], number> = {
  not_found: 404,
  invalid_url: 400,
  invalid_handle: 400,
  handle_taken: 409,
  reserved_handle: 400,
  invalid_locale: 400,
  invalid_target: 400,
  invalid_date: 400,
  invalid: 400,
  invalid_image: 400,
  file_too_large: 413,
}

/** Runs a handler; rule violations answer with { type, code, message, detail } (the Admin translates by code) */
export async function withRules(res: MedusaResponse, run: () => Promise<void>) {
  try {
    await run()
  } catch (e) {
    if (e instanceof LibRuleError) {
      const status = STATUS[e.code] ?? 400
      res.status(status).json({ type: status === 404 ? "not_found" : "invalid_data", code: e.code, message: e.message, detail: e.detail ?? null })
      return
    }
    throw e
  }
}

/** Admin page shape + public URL per locale */
export function adminPageView(req: MedusaRequest, page: PageRow): AdminPage {
  const o = getOptions(req.scope)
  const view = toAdminPage(page)
  const locales = pageLocales(page)
  const urls: Record<string, string> = {}
  for (const l of locales) {
    const u = pageUrl(o, page.handle, l, locales[0])
    if (u) urls[l] = u
  }
  return { ...view, urls }
}

export function adminItemView(req: MedusaRequest, item: ItemRow): AdminItem {
  const o = getOptions(req.scope)
  return { ...toAdminItem(item), href: CLICKABLE.includes(item.type) ? redirectUrl(o, item.key) : null }
}

/** The sales channel of the publishable key when it has exactly one (scopes products and stock like the Store API) */
export function salesChannelOf(req: MedusaRequest): string | null {
  const ids = (req as MedusaRequest & { publishable_key_context?: { sales_channel_ids?: string[] } }).publishable_key_context?.sales_channel_ids ?? []
  return ids.length === 1 ? ids[0] : null
}

export const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "")
