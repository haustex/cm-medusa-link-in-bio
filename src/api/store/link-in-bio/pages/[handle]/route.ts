import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { salesChannelOf } from "../../../../_lib"
import { matchLocale } from "../../../../../lib/locales"
import { pageByHandle } from "../../../../../lib/pages"
import { pageLocales } from "../../../../../lib/serialize"
import { storePage } from "../../../../../lib/store"
import type { StorePageQueryType } from "../../../../validators"

/**
 * GET /store/link-in-bio/pages/{handle}?locale=id&region_id=reg_…
 * The published page in one locale with its visible items; products carry price (for the region) and stock.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const page = await pageByHandle(req.scope, String(req.params.handle).toLowerCase())
  if (!page || !page.published) {
    res.status(404).json({ type: "not_found", message: "Page not found" })
    return
  }
  const q = (req.validatedQuery ?? {}) as StorePageQueryType
  const locales = pageLocales(page)
  const header = typeof req.headers["x-medusa-locale"] === "string" ? req.headers["x-medusa-locale"] : undefined
  const locale = matchLocale(q.locale || header || (req as MedusaRequest & { locale?: string }).locale, locales)
  const view = await storePage(req.scope, page, { locale, region_id: q.region_id, sales_channel_id: salesChannelOf(req) })
  res.setHeader("Cache-Control", "public, max-age=60")
  if (view.noindex) res.setHeader("X-Robots-Tag", "noindex")
  res.json({ page: view })
}
