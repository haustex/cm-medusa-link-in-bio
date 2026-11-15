import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminPageView, withRules } from "../../../../../_lib"
import { getPage, service } from "../../../../../../lib/pages"
import { pageChanged } from "../../../../../../lib/revalidate"
import { removeUpload, storeUpload, type UploadInput } from "../../../../../../lib/uploads"
import type { AdminUploadQueryType } from "../../../../../validators"

/**
 * POST /admin/link-in-bio/pages/{id}/upload?slot=avatar|hero|qr_logo  (multipart, field `file`)
 * Stores the image through the File Module, replaces the slot's previous upload (deleted) and answers { page }.
 * JPEG, PNG, WebP or AVIF by magic bytes, at most 5 MB; SVG is refused.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    const { slot } = req.validatedQuery as AdminUploadQueryType
    const page = await getPage(req.scope, req.params.id)
    const file = (req as AuthenticatedMedusaRequest & { file?: UploadInput }).file
    await storeUpload(req.scope, service(req.scope), page, slot, file as UploadInput)
    pageChanged(req.scope, page.handle)
    res.json({ page: adminPageView(req, await getPage(req.scope, page.id)) })
  })
}

/** DELETE /admin/link-in-bio/pages/{id}/upload?slot=…: removes the image (and the upload, when the page owns it) */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    const { slot } = req.validatedQuery as AdminUploadQueryType
    const page = await getPage(req.scope, req.params.id)
    await removeUpload(req.scope, service(req.scope), page, slot)
    pageChanged(req.scope, page.handle)
    res.json({ page: adminPageView(req, await getPage(req.scope, page.id)) })
  })
}
