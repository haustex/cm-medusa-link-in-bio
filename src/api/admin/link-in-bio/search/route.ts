import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { searchCatalog } from "../../../../lib/resolve"

/** GET ?type=product|collection|category|post&q=… — for the Admin's pickers */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const q = (req.validatedQuery ?? {}) as { type: "product" | "collection" | "category" | "post"; q?: string; limit?: number }
  res.json({ results: await searchCatalog(req.scope, q.type, q.q ?? "", q.limit ?? 20) })
}
