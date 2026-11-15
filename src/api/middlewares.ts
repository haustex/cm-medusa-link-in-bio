import { defineMiddlewares, validateAndTransformBody, validateAndTransformQuery, type MedusaNextFunction, type MedusaRequest, type MedusaResponse } from "@medusajs/framework/http"
import multer from "multer"
import { getOptions } from "../lib/options"
import { clientKey, rateLimit } from "../lib/rate-limit"
import { MAX_UPLOAD_BYTES } from "../lib/uploads"
import { AdminItemBody, AdminPageBody, AdminQrQuery, AdminReorderBody, AdminSearchQuery, AdminStatsQuery, AdminUploadQuery, StorePageQuery } from "./validators"

/** One image in the multipart field `file`, kept in memory (at most MAX_UPLOAD_BYTES; larger → 413 right here) */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }).single("file")
function imageUpload(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  upload(req as any, res as any, (err: unknown) => {
    if (!err) return next()
    const code = (err as { code?: string }).code
    const tooLarge = code === "LIMIT_FILE_SIZE"
    res.status(tooLarge ? 413 : 400).json({ type: "invalid_data", code: tooLarge ? "file_too_large" : "invalid", message: tooLarge ? `The image may be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB` : "Bad upload", detail: "file" })
  })
}

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
    { matcher: "/admin/link-in-bio/pages/:id/upload", method: "POST", middlewares: [validateAndTransformQuery(AdminUploadQuery, {}), imageUpload] },
    { matcher: "/admin/link-in-bio/pages/:id/upload", method: "DELETE", middlewares: [validateAndTransformQuery(AdminUploadQuery, {})] },
    { matcher: "/admin/link-in-bio/pages/:id/stats", method: "GET", middlewares: [validateAndTransformQuery(AdminStatsQuery, {})] },
    { matcher: "/admin/link-in-bio/qr", method: "GET", middlewares: [validateAndTransformQuery(AdminQrQuery, {})] },
    { matcher: "/admin/link-in-bio/search", method: "GET", middlewares: [validateAndTransformQuery(AdminSearchQuery, {})] },
  ],
})
