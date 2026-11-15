import { defineMiddlewares, validateAndTransformBody, validateAndTransformQuery, type MedusaNextFunction, type MedusaRequest, type MedusaResponse } from "@medusajs/framework/http"
import { getOptions } from "../lib/options"
import { clientKey, rateLimit } from "../lib/rate-limit"
import { AdminItemBody, AdminPageBody, AdminQrQuery, AdminReorderBody, AdminSearchQuery, AdminStatsQuery, StorePageQuery } from "./validators"

/** Per-IP limit on the public routes (redirect + store reads); the Admin is authenticated and not limited here */
async function limited(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const o = getOptions(req.scope)
  try {
    await rateLimit(req.scope, clientKey(req.ip, "public"), o.rate_limit.max, o.rate_limit.window_seconds)
  } catch (e) {
    if ((e as { code?: string }).code !== "RATE_LIMITED") return next(e)
    res.setHeader("Retry-After", String(o.rate_limit.window_seconds))
    res.setHeader("Cache-Control", "no-store")
    res.status(429).json({ type: "rate_limited", message: "Too many requests, try again later" })
    return
  }
  next()
}

export default defineMiddlewares({
  routes: [
    { matcher: "/l/:key", method: "GET", middlewares: [limited] },
    { matcher: "/store/link-in-bio/pages", method: "GET", middlewares: [limited] },
    { matcher: "/store/link-in-bio/pages/:handle", method: "GET", middlewares: [limited, validateAndTransformQuery(StorePageQuery, {})] },
    { matcher: "/admin/link-in-bio/pages", method: "POST", middlewares: [validateAndTransformBody(AdminPageBody)] },
    { matcher: "/admin/link-in-bio/pages/:id", method: "POST", middlewares: [validateAndTransformBody(AdminPageBody)] },
    { matcher: "/admin/link-in-bio/pages/:id/items", method: "POST", middlewares: [validateAndTransformBody(AdminItemBody)] },
    { matcher: "/admin/link-in-bio/pages/:id/items/reorder", method: "POST", middlewares: [validateAndTransformBody(AdminReorderBody)] },
    { matcher: "/admin/link-in-bio/pages/:id/items/:itemId", method: "POST", middlewares: [validateAndTransformBody(AdminItemBody)] },
    { matcher: "/admin/link-in-bio/pages/:id/stats", method: "GET", middlewares: [validateAndTransformQuery(AdminStatsQuery, {})] },
    { matcher: "/admin/link-in-bio/qr", method: "GET", middlewares: [validateAndTransformQuery(AdminQrQuery, {})] },
    { matcher: "/admin/link-in-bio/search", method: "GET", middlewares: [validateAndTransformQuery(AdminSearchQuery, {})] },
  ],
})
