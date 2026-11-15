import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { flushClicks, pendingClicks } from "medusa-link-in-bio/lib/clicks"

/** Writes buffered click counts now (tests do not wait for the timer) */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const pending = pendingClicks()
  const written = await flushClicks(req.scope)
  res.json({ ok: true, pending, written })
}
