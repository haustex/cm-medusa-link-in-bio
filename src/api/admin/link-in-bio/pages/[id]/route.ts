import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminItemView, adminPageView, withRules } from "../../../../_lib"
import { pageStats } from "../../../../../lib/clicks"
import { listItems } from "../../../../../lib/items"
import { deletePage, getPage, updatePage } from "../../../../../lib/pages"
import { resolveAll } from "../../../../../lib/store"
import { pageLocales } from "../../../../../lib/serialize"
import type { AdminPageBodyType } from "../../../../validators"

/** The page with its items (resolved titles for products/collections/categories/posts) and click totals */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    const page = await getPage(req.scope, req.params.id)
    const rows = await listItems(req.scope, page.id)
    const def = pageLocales(page)[0]
    const r = await resolveAll(req.scope, rows, { locale: def, sales_channel_id: null }, def)
    const stats = await pageStats(req.scope, page.id, 30)
    const items = rows.map((it) => {
      const v = adminItemView(req, it)
      const t = it.target as Record<string, any>
      const hit = it.type === "product" ? r.products.get(t.product_id) : it.type === "collection" ? r.collections.get(t.collection_id) : it.type === "category" ? r.categories.get(t.category_id) : it.type === "post" ? (t.latest ? r.latest : r.posts.get(t.post_id)) : undefined
      const resolved = ["product", "collection", "category", "post"].includes(it.type) ? (hit ? { title: hit.title, thumbnail: "thumbnail" in hit ? hit.thumbnail : (hit as any).cover ?? null, handle: "handle" in hit ? hit.handle : (hit as any).slug } : { title: "", thumbnail: null, handle: "", missing: true }) : null
      const s = stats.items[it.id]
      return { ...v, resolved, clicks_7d: s?.clicks_7d ?? 0, clicks_30d: s?.clicks_30d ?? 0, clicks_total: s?.clicks_total ?? 0 }
    })
    res.json({ page: { ...adminPageView(req, page), item_count: rows.length, clicks_7d: stats.clicks_7d, clicks_30d: stats.clicks_30d }, items })
  })
}

export async function POST(req: AuthenticatedMedusaRequest<AdminPageBodyType>, res: MedusaResponse) {
  await withRules(res, async () => {
    const page = await updatePage(req.scope, req.params.id, req.validatedBody ?? {})
    res.json({ page: adminPageView(req, page) })
  })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    await deletePage(req.scope, req.params.id)
    res.json({ id: req.params.id, object: "link_in_bio_page", deleted: true })
  })
}
