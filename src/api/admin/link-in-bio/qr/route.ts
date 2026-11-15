import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { withRules } from "../../../_lib"
import { getItem } from "../../../../lib/items"
import { getOptions } from "../../../../lib/options"
import { getPage } from "../../../../lib/pages"
import { qrPng, qrSvg } from "../../../../lib/qr"
import { pageLocales } from "../../../../lib/serialize"
import { matchLocale } from "../../../../lib/locales"
import { pageUrl, redirectUrl } from "../../../../lib/urls"
import { LibRuleError } from "../../../../lib/validate"

type Q = { page_id?: string; item_id?: string; locale?: string; format?: "svg" | "png"; size?: number; download?: boolean }

/**
 * GET ?page_id=…&locale=… | ?item_id=…  [&format=svg|png&size=1024&download=1]
 * The encoded URL is computed here from the stored page/item, never taken from the query.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    const q = (req.validatedQuery ?? {}) as Q
    const o = getOptions(req.scope)
    let url: string | null = null
    let name = "qr"
    if (q.item_id) {
      const [item] = await req.scope.resolve<any>("linkInBio").listLibItems({ id: q.item_id }, { take: 1 })
      if (!item) throw new LibRuleError("not_found", "Item not found")
      await getItem(req.scope, item.page_id, item.id)
      url = redirectUrl(o, item.key)
      name = `link-${item.key}`
      if (!url) throw new LibRuleError("invalid", "No redirect address: set storefront.url or backend_url in the plugin options", "redirect_url")
    } else if (q.page_id) {
      const page = await getPage(req.scope, q.page_id)
      const locales = pageLocales(page)
      const locale = matchLocale(q.locale, locales)
      url = pageUrl(o, page.handle, locale, locales[0])
      name = `${page.handle}-${locale}`
      if (!url) throw new LibRuleError("invalid", "No page address: set storefront.url in the plugin options", "storefront_url")
    } else throw new LibRuleError("invalid", "page_id or item_id is required")
    const format = q.format === "png" ? "png" : "svg"
    const disposition = q.download ? `attachment; filename="${name}.${format}"` : "inline"
    res.setHeader("Cache-Control", "no-store")
    res.setHeader("Content-Disposition", disposition)
    res.setHeader("X-QR-URL", url)
    if (format === "png") {
      res.setHeader("Content-Type", "image/png")
      res.end(await qrPng(url, q.size ?? 1024))
    } else {
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8")
      res.end(await qrSvg(url))
    }
  })
}
