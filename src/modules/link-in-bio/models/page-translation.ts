import { model } from "@medusajs/framework/utils"
import Page from "./page"

const PageTranslation = model
  .define("lib_page_translation", {
    id: model.id({ prefix: "libpgt" }).primaryKey(),
    locale: model.text(),
    /** Display name under the avatar */
    title: model.text(),
    bio: model.text().nullable(),
    /** <title> / og:title; falls back to title */
    seo_title: model.text().nullable(),
    seo_description: model.text().nullable(),
    page: model.belongsTo(() => Page, { mappedBy: "translations" }),
  })
  .indexes([{ on: ["page_id", "locale"], unique: true, where: "deleted_at IS NULL" }])

export default PageTranslation
