import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { withRules } from "../../../../../_lib"
import { flushClicks, pageStats } from "../../../../../../lib/clicks"
import { getPage } from "../../../../../../lib/pages"

/** GET ?days=30 — totals per item and the daily series of the page */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await withRules(res, async () => {
    const page = await getPage(req.scope, req.params.id)
    await flushClicks(req.scope) // what this process still buffers
    const days = Number((req.validatedQuery as { days?: number })?.days ?? 30)
    res.json({ stats: await pageStats(req.scope, page.id, days) })
  })
}
