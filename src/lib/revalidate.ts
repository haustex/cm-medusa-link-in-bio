import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getOptions } from "./options"

/**
 * With `revalidate.url` set: public changes (a page or its items) are batched (delay_ms) and sent as one
 *   POST { link_in_bio: { handles: ["links", …], all } }
 * with the secret in the `x-revalidate-secret` header (or `revalidate.header`). A storefront re-renders the pages
 * it serves for those handles (Kiln: /links, /links/{handle} in every market). Without the option nothing happens.
 */
type Batch = { handles: Set<string>; all: boolean; timer: NodeJS.Timeout | null }
const batch: Batch = { handles: new Set(), all: false, timer: null }

async function flush(container: MedusaContainer) {
  const o = getOptions(container).revalidate
  const body = { link_in_bio: { handles: [...batch.handles].slice(0, 100), all: batch.all } }
  batch.handles = new Set()
  batch.all = false
  batch.timer = null
  if (!o) return
  let logger: Logger | null = null
  try {
    logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  } catch {}
  try {
    const res = await fetch(o.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(o.secret ? { [o.header]: o.secret } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    logger?.info(`[link-in-bio] revalidate ${res.status} handles=${body.link_in_bio.handles.join(",") || "-"} all=${body.link_in_bio.all}`)
  } catch (e) {
    logger?.warn(`[link-in-bio] revalidate failed: ${(e as Error).message}`)
  }
}

/** Marks a page (by handle) as changed; `previous` when the handle itself changed; `all` for a deleted page */
export function pageChanged(container: MedusaContainer, handle: string | null, extra: { previous?: string | null; all?: boolean } = {}) {
  const o = getOptions(container).revalidate
  if (!o) return
  if (handle) batch.handles.add(handle)
  if (extra.previous && extra.previous !== handle) batch.handles.add(extra.previous)
  if (extra.all) batch.all = true
  if (!batch.timer) {
    batch.timer = setTimeout(() => void flush(container), o.delay_ms)
    batch.timer.unref?.()
  }
}

/** For tests: send what is pending now */
export const flushRevalidate = (container: MedusaContainer) => flush(container)
