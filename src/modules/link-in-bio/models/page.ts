import { model } from "@medusajs/framework/utils"
import Item from "./item"
import PageTranslation from "./page-translation"

/**
 * One link-in-bio page (a shop can have several: per campaign, per market). Name, bio and button text per locale
 * live in the translations; `locales` lists the locales the page is written in, the first one is the default.
 */
const Page = model
  .define("lib_page", {
    id: model.id({ prefix: "libpg" }).primaryKey(),
    /** Public address segment: /links/{handle}; "links" is the storefront's main page */
    handle: model.text(),
    /** Internal name shown in the Admin */
    name: model.text(),
    /** Locale codes in order, the first is the default ("id", "en") */
    locales: model.json(),
    published: model.boolean().default(false),
    /** Ask search engines not to index the public page */
    noindex: model.boolean().default(false),
    /** Avatar URL (an upload through the plugin or any https URL) */
    avatar: model.text().nullable(),
    /** "circle" (avatar only) or "hero" (wide header image fading into the background, avatar optional) */
    profile_style: model.text().default("circle"),
    /** Header image URL for the "hero" style */
    hero: model.text().nullable(),
    /** Aspect ratio the storefront reserves for the hero: "16:9" or "3:2" */
    hero_ratio: model.text().default("16:9"),
    /** Centre logo for this page's QR codes (upload); null = the brand logo from the plugin options */
    qr_logo: model.text().nullable(),
    /** Focal points in percent: { avatar?: { x, y }, hero?: { x, y } } */
    focus: model.json().nullable(),
    /** File Module ids of the uploads this page owns: { avatar?, hero?, qr_logo? } (deleted on replace/remove) */
    files: model.json().nullable(),
    /** Social icons under the bio: [{ network, url }] in order */
    socials: model.json().nullable(),
    /** Colours and shape: { background, text, accent, radius } (hex colours, radius "none" | "sm" | "md" | "full") */
    theme: model.json().nullable(),
    /** Append utm_source/utm_medium/utm_campaign to item links by default (items can opt out) */
    utm: model.boolean().default(true),
    utm_source: model.text().nullable(),
    utm_medium: model.text().nullable(),
    utm_campaign: model.text().nullable(),
    /** Public sharing image: left null the storefront draws one from avatar + name */
    og_image: model.text().nullable(),
    metadata: model.json().nullable(),
    translations: model.hasMany(() => PageTranslation, { mappedBy: "page" }),
    items: model.hasMany(() => Item, { mappedBy: "page" }),
  })
  .indexes([{ on: ["handle"], unique: true, where: "deleted_at IS NULL" }])
  .cascades({ delete: ["translations", "items"] })

export default Page
