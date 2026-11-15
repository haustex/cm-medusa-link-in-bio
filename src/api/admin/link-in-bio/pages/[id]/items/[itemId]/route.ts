import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminItemView, withRules } from "../../../../../../_lib"
import { deleteItem, getItem, updateItem } from "../../../../../../../lib/items"
import type { AdminItemBodyType } from "../../../../../../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    res.json({ item: adminItemView(req, await getItem(req.scope, req.params.id, req.params.itemId)) })
  })
}

export async function POST(req: AuthenticatedMedusaRequest<AdminItemBodyType>, res: MedusaResponse) {
  await withRules(res, async () => {
    res.json({ item: adminItemView(req, await updateItem(req.scope, req.params.id, req.params.itemId, req.validatedBody ?? {})) })
  })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    await deleteItem(req.scope, req.params.id, req.params.itemId)
    res.json({ id: req.params.itemId, object: "link_in_bio_item", deleted: true })
  })
}
