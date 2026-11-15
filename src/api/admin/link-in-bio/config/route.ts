import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOptions } from "../../../../lib/options"
import { hasBlog } from "../../../../lib/resolve"
import { SOCIAL_NETWORKS } from "../../../../lib/validate"

/** Non-secret plugin options the Admin pages adapt to */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const o = getOptions(req.scope)
  res.json({
    show_credit: o.showCredit,
    storefront_url: o.storefront.url,
    main_handle: o.storefront.main_handle,
    redirect_url: o.redirect_url,
    blog: hasBlog(req.scope),
    clicks: o.clicks.enabled,
    utm: o.utm,
    networks: SOCIAL_NETWORKS,
  })
}
