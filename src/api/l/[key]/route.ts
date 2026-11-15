import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { doNotTrack, isBot } from "../../../lib/bots"
import { recordClick } from "../../../lib/clicks"
import { itemByKey } from "../../../lib/items"
import { KEY_RE } from "../../../lib/keys"
import { matchLocale } from "../../../lib/locales"
import { getOptions } from "../../../lib/options"
import { getPage } from "../../../lib/pages"
import { isVisible } from "../../../lib/schedule"
import { pageLocales } from "../../../lib/serialize"
import { destination } from "../../../lib/store"

const NO_STORE = "no-store, max-age=0"

/**
 * GET /l/{key}[?l=en] — counts the click and answers 302 to the item's stored destination (UTM applied). The visitor
 * is only ever sent to a URL an admin saved; nothing in the request chooses the target. Bots (by user agent) and
 * visitors with DNT/GPC are redirected but not counted. A storefront proxies its own /l/{key} here.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", NO_STORE)
  res.setHeader("Referrer-Policy", "no-referrer-when-downgrade")
  res.setHeader("X-Robots-Tag", "noindex")
  const key = String(req.params.key ?? "")
  if (!KEY_RE.test(key)) {
    res.status(404).json({ type: "not_found", message: "Unknown link" })
    return
  }
  const item = await itemByKey(req.scope, key)
  if (!item) {
    res.status(404).json({ type: "not_found", message: "Unknown link" })
    return
  }
  const page = await getPage(req.scope, item.page_id)
  if (!page.published || !isVisible(item)) {
    res.status(410).json({ type: "not_found", message: "This link is no longer available" })
    return
  }
  const locales = pageLocales(page)
  const header = typeof req.headers["x-medusa-locale"] === "string" ? req.headers["x-medusa-locale"] : undefined
  const locale = matchLocale(typeof req.query.l === "string" ? req.query.l : header, locales)
  const url = await destination(req.scope, page, item, locale)
  if (!url) {
    res.status(410).json({ type: "not_found", message: "This link is no longer available" })
    return
  }
  const o = getOptions(req.scope)
  if (o.clicks.enabled && (o.clicks.count_bots || !isBot(req.headers["user-agent"])) && !(o.clicks.respect_dnt && doNotTrack(req.headers))) {
    recordClick(req.scope, page.id, item.id)
  }
  res.redirect(302, url)
}
