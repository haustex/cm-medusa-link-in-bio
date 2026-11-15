import { model } from "@medusajs/framework/utils"

/**
 * Clicks per item per UTC day. Nothing else is stored about a click: no IP, no user agent, no cookie, no referrer.
 * Rows are written by the redirect route in batches (lib/clicks.ts).
 */
const ClickDay = model
  .define("lib_click_day", {
    id: model.id({ prefix: "libck" }).primaryKey(),
    page_id: model.text(),
    item_id: model.text(),
    /** YYYY-MM-DD (UTC) */
    day: model.text(),
    count: model.number().default(0),
  })
  .indexes([{ on: ["item_id", "day"], unique: true }, { on: ["page_id", "day"] }])

export default ClickDay
