import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listPages } from "../../../../lib/pages"
import { pageLocales } from "../../../../lib/serialize"

/** GET /store/link-in-bio/pages — the published pages (handle + locales); a storefront probes this to detect the plugin */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rows = await listPages(req.scope)
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ pages: rows.filter((p) => p.published).map((p) => ({ id: p.id, handle: p.handle, locales: pageLocales(p), noindex: !!p.noindex, updated_at: new Date(p.updated_at).toISOString() })) })
}
