import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminItemView, withRules } from "../../../../../../_lib"
import { reorderItems } from "../../../../../../../lib/items"
import type { AdminReorderBodyType } from "../../../../../../validators"

/** POST { ids: [...] } — the items in their new order (ids not listed keep their relative order after them) */
export async function POST(req: AuthenticatedMedusaRequest<AdminReorderBodyType>, res: MedusaResponse) {
  await withRules(res, async () => {
    const rows = await reorderItems(req.scope, req.params.id, req.validatedBody?.ids ?? [])
    res.json({ items: rows.map((i) => adminItemView(req, i)) })
  })
}
