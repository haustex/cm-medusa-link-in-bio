import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminItemView, withRules } from "../../../../../_lib"
import { createItem, listItems } from "../../../../../../lib/items"
import type { AdminItemBodyType } from "../../../../../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    const rows = await listItems(req.scope, req.params.id)
    res.json({ items: rows.map((i) => adminItemView(req, i)) })
  })
}

export async function POST(req: AuthenticatedMedusaRequest<AdminItemBodyType>, res: MedusaResponse) {
  await withRules(res, async () => {
    const item = await createItem(req.scope, req.params.id, req.validatedBody ?? {})
    res.status(201).json({ item: adminItemView(req, item) })
  })
}
