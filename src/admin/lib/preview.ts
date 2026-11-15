import type { AdminConfig } from "../../sdk"

/** The public address of a page for the hints under the handle fields (storefront.url + storefront.paths) */
export function pagePreviewUrl(config: AdminConfig | undefined, handle: string): string {
  if (!config?.storefront_url) return ""
  const h = handle || "…"
  const paths = config.paths ?? { main: "/links", page: "/links/{handle}" }
  return `${config.storefront_url}${h === (config.main_handle ?? "links") ? paths.main : paths.page.replace("{handle}", h)}`
}
