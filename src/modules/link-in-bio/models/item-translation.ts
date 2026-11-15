import { model } from "@medusajs/framework/utils"
import Item from "./item"

const ItemTranslation = model
  .define("lib_item_translation", {
    id: model.id({ prefix: "libitt" }).primaryKey(),
    locale: model.text(),
    /** Button text; products, collections and posts show their own title when empty */
    label: model.text().nullable(),
    /** Small second line */
    note: model.text().nullable(),
    item: model.belongsTo(() => Item, { mappedBy: "translations" }),
  })
  .indexes([{ on: ["item_id", "locale"], unique: true, where: "deleted_at IS NULL" }])

export default ItemTranslation
