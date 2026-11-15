import { MedusaService } from "@medusajs/framework/utils"
import { ClickDay, Item, ItemTranslation, Page, PageTranslation } from "./models"

/** Keys match the DML model names (lib_page → LibPage): `listLibPages`, `createLibItems`, … */
class LinkInBioModuleService extends MedusaService({
  LibPage: Page,
  LibPageTranslation: PageTranslation,
  LibItem: Item,
  LibItemTranslation: ItemTranslation,
  LibClickDay: ClickDay,
}) {}

export default LinkInBioModuleService
