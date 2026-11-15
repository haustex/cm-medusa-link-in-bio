import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminPageView, withRules } from "../../../_lib"
import { pagesStats } from "../../../../lib/clicks"
import { listItems } from "../../../../lib/items"
import { createPage, listPages } from "../../../../lib/pages"
import type { AdminPageBodyType } from "../../../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const rows = await listPages(req.scope)
  const stats = await pagesStats(req.scope)
  const pages = await Promise.all(
    rows.map(async (p) => {
      const items = await listItems(req.scope, p.id)
      return { ...adminPageView(req, p), item_count: items.length, clicks_7d: stats[p.id]?.clicks_7d ?? 0, clicks_30d: stats[p.id]?.clicks_30d ?? 0 }
    })
  )
  res.json({ pages })
}

export async function POST(req: AuthenticatedMedusaRequest<AdminPageBodyType>, res: MedusaResponse) {
  await withRules(res, async () => {
    const page = await createPage(req.scope, req.validatedBody ?? {})
    res.status(201).json({ page: adminPageView(req, page) })
  })
}
