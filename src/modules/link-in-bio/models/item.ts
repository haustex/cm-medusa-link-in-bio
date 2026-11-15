import { model } from "@medusajs/framework/utils"
import ItemTranslation from "./item-translation"
import Page from "./page"

/**
 * One row of a page. `type` says what it is; `target` carries what that type needs:
 *   link      { url }
 *   product   { product_id }                    live price + stock per region at read time
 *   collection{ collection_id }
 *   category  { category_id }
 *   promo     { code, url? }                    copy-to-clipboard; optional link
 *   post      { post_id } | { latest: true }    medusa-blog-seo article (optional dependency)
 *   whatsapp  { phone, text? }                  wa.me link
 *   contact   { kind: "tel" | "mailto", value }
 *   header    {}                                a heading between links (label only)
 *   divider   {}
 * The public link of every clickable item is /l/{key} (counted, 302 to the real URL).
 */
const Item = model
  .define("lib_item", {
    id: model.id({ prefix: "libit" }).primaryKey(),
    /** Short public key for /l/{key} */
    key: model.text(),
    type: model.enum(["link", "product", "collection", "category", "promo", "post", "whatsapp", "contact", "header", "divider"]),
    target: model.json(),
    /** Position on the page, low first */
    rank: model.number().default(0),
    enabled: model.boolean().default(true),
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    /** Image shown left of the label (any https URL); products/posts use their own when null */
    image: model.text().nullable(),
    /** Lucide icon name or emoji, when there is no image */
    icon: model.text().nullable(),
    /** Visual emphasis: "normal" | "featured" (larger, with image) */
    style: model.text().nullable(),
    /** null = follow the page's `utm` setting */
    utm: model.boolean().nullable(),
    metadata: model.json().nullable(),
    page: model.belongsTo(() => Page, { mappedBy: "items" }),
    translations: model.hasMany(() => ItemTranslation, { mappedBy: "item" }),
  })
  .indexes([{ on: ["key"], unique: true, where: "deleted_at IS NULL" }, { on: ["page_id", "rank"] }])
  .cascades({ delete: ["translations"] })

export default Item
