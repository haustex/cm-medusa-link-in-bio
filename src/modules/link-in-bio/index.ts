import { Module } from "@medusajs/framework/utils"
import LinkInBioModuleService from "./service"

/** Module key and table prefix (`lib_*`) are unique on purpose so the plugin sits next to anything a project has. */
export const LINK_IN_BIO_MODULE = "linkInBio"

export default Module(LINK_IN_BIO_MODULE, {
  service: LinkInBioModuleService,
})

export type { default as LinkInBioModuleService } from "./service"
