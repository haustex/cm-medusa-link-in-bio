import type { MedusaContainer } from "@medusajs/framework/types"
import { LINK_IN_BIO_MODULE } from "../modules/link-in-bio"
import { cleanLocales, normalizeLocale } from "./locales"
import { getOptions } from "./options"
import { pageChanged } from "./revalidate"
import type { PageRow, PageTranslationRow } from "./types"
import { filesAfterUrlChange, releaseAllFiles } from "./uploads"
import { cleanFocus, cleanHandle, cleanHeroRatio, cleanProfileStyle, cleanSocials, cleanTheme, cleanUrl, LibRuleError, str, strOrNull } from "./validate"

export const PAGE_RELATIONS = ["translations"]

type Service = {
  listLibPages: (f: Record<string, unknown>, c?: Record<string, unknown>) => Promise<PageRow[]>
  retrieveLibPage: (id: string, c?: Record<string, unknown>) => Promise<PageRow>
  createLibPages: (d: Record<string, unknown>) => Promise<PageRow>
  updateLibPages: (d: Record<string, unknown>) => Promise<PageRow>
  deleteLibPages: (ids: string[]) => Promise<void>
  listLibPageTranslations: (f: Record<string, unknown>, c?: Record<string, unknown>) => Promise<PageTranslationRow[]>
  createLibPageTranslations: (d: Record<string, unknown>[]) => Promise<PageTranslationRow[]>
  updateLibPageTranslations: (d: Record<string, unknown>[]) => Promise<PageTranslationRow[]>
  deleteLibPageTranslations: (ids: string[]) => Promise<void>
}
export const service = (container: MedusaContainer) => container.resolve<Service>(LINK_IN_BIO_MODULE)

export type PageInput = {
  handle?: string
  name?: string
  locales?: unknown
  published?: boolean
  noindex?: boolean
  avatar?: string | null
  profile_style?: string
  hero?: string | null
  hero_ratio?: string
  hero_avatar?: boolean
  qr_logo?: string | null
  /** { avatar?: { x, y }, hero?: { x, y } } in percent; a slot set to null goes back to the centre */
  focus?: { avatar?: unknown; hero?: unknown }
  socials?: unknown
  theme?: unknown
  utm?: boolean
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  og_image?: string | null
  metadata?: Record<string, unknown> | null
  translations?: Record<string, { title?: string; bio?: string | null; seo_title?: string | null; seo_description?: string | null; avatar_alt?: string | null; hero_alt?: string | null }>
}

/** Focal points merged over the stored ones; a slot sent as null goes back to the centre (stored as null: JSON columns merge on update) */
function focusOf(input: PageInput["focus"], base: PageRow["focus"]): PageRow["focus"] {
  const out = { ...(base ?? {}) }
  for (const slot of ["avatar", "hero"] as const) {
    if (!input || !(slot in input)) continue
    out[slot] = cleanFocus(input[slot])
  }
  return out
}

const image = (v: unknown, field: string): string | null => {
  if (v === null || v === undefined || v === "") return null
  const u = cleanUrl(v)
  if (!u) throw new LibRuleError("invalid_url", `${field} must be an absolute http(s) address`, field)
  return u
}

export async function getPage(container: MedusaContainer, id: string): Promise<PageRow> {
  const [row] = await service(container).listLibPages({ id }, { relations: PAGE_RELATIONS, take: 1 })
  if (!row) throw new LibRuleError("not_found", "Page not found")
  return row
}

async function assertHandle(container: MedusaContainer, handle: string, exceptId?: string) {
  const o = getOptions(container)
  if (o.reserved_handles.includes(handle)) throw new LibRuleError("reserved_handle", `"${handle}" is reserved`, handle)
  const [taken] = await service(container).listLibPages({ handle }, { take: 1 })
  if (taken && taken.id !== exceptId) throw new LibRuleError("handle_taken", `A page with handle "${handle}" exists`, handle)
}

/** Translations: every page locale may have a title; the default locale must */
async function writeTranslations(container: MedusaContainer, page: PageRow, locales: string[], input: PageInput["translations"] | undefined, existing: PageTranslationRow[]) {
  const svc = service(container)
  const creates: Record<string, unknown>[] = []
  const updates: Record<string, unknown>[] = []
  for (const [rawCode, t] of Object.entries(input ?? {})) {
    const code = normalizeLocale(rawCode)
    if (!code || !locales.includes(code)) throw new LibRuleError("invalid_locale", `Locale "${rawCode}" is not one of the page's locales`, rawCode)
    const row = existing.find((e) => e.locale === code)
    const data: Record<string, unknown> = {}
    if (t.title !== undefined) data.title = str(t.title, 120)
    if (t.bio !== undefined) data.bio = strOrNull(t.bio, 600)
    if (t.seo_title !== undefined) data.seo_title = strOrNull(t.seo_title, 200)
    if (t.seo_description !== undefined) data.seo_description = strOrNull(t.seo_description, 400)
    if (t.avatar_alt !== undefined) data.avatar_alt = strOrNull(t.avatar_alt, 200)
    if (t.hero_alt !== undefined) data.hero_alt = strOrNull(t.hero_alt, 200)
    if (row) updates.push({ id: row.id, ...data })
    else creates.push({ page_id: page.id, locale: code, title: str(t.title, 120) || page.name, ...data })
  }
  // locales that were removed lose their text
  const gone = existing.filter((e) => !locales.includes(e.locale)).map((e) => e.id)
  if (gone.length) await svc.deleteLibPageTranslations(gone)
  if (updates.length) await svc.updateLibPageTranslations(updates)
  if (creates.length) await svc.createLibPageTranslations(creates)
  // the default locale always has a row (title = page name until written)
  const have = [...existing.filter((e) => !gone.includes(e.id)).map((e) => e.locale), ...creates.map((c) => c.locale as string)]
  if (!have.includes(locales[0])) await svc.createLibPageTranslations([{ page_id: page.id, locale: locales[0], title: page.name }])
}

export async function createPage(container: MedusaContainer, input: PageInput): Promise<PageRow> {
  const svc = service(container)
  const name = str(input.name, 120)
  if (!name) throw new LibRuleError("invalid", "name is required", "name")
  const handle = cleanHandle(input.handle ?? name)
  if (!handle) throw new LibRuleError("invalid_handle", "handle must be letters, digits and hyphens", "handle")
  await assertHandle(container, handle)
  const locales = cleanLocales(input.locales ?? ["en"])
  const o = getOptions(container)
  const page = await svc.createLibPages({
    handle,
    name,
    locales,
    published: input.published === true,
    noindex: input.noindex === true,
    avatar: image(input.avatar, "avatar"),
    profile_style: cleanProfileStyle(input.profile_style),
    hero: image(input.hero, "hero"),
    hero_ratio: cleanHeroRatio(input.hero_ratio),
    hero_avatar: input.hero_avatar === true,
    qr_logo: image(input.qr_logo, "qr_logo"),
    focus: focusOf(input.focus, null),
    files: null,
    socials: cleanSocials(input.socials),
    theme: cleanTheme(input.theme),
    utm: input.utm !== false,
    utm_source: strOrNull(input.utm_source, 80) ?? o.utm.source,
    utm_medium: strOrNull(input.utm_medium, 80) ?? o.utm.medium,
    utm_campaign: strOrNull(input.utm_campaign, 80),
    og_image: image(input.og_image, "og_image"),
    metadata: input.metadata ?? null,
  })
  await writeTranslations(container, page, locales, input.translations, [])
  pageChanged(container, handle)
  return getPage(container, page.id)
}

export async function updatePage(container: MedusaContainer, id: string, input: PageInput): Promise<PageRow> {
  const svc = service(container)
  const page = await getPage(container, id)
  const data: Record<string, unknown> = { id }
  if (input.name !== undefined) {
    const name = str(input.name, 120)
    if (!name) throw new LibRuleError("invalid", "name is required", "name")
    data.name = name
  }
  if (input.handle !== undefined) {
    const handle = cleanHandle(input.handle)
    if (!handle) throw new LibRuleError("invalid_handle", "handle must be letters, digits and hyphens", "handle")
    if (handle !== page.handle) await assertHandle(container, handle, id)
    data.handle = handle
  }
  const locales = input.locales !== undefined ? cleanLocales(input.locales) : (page.locales as string[])
  if (input.locales !== undefined) data.locales = locales
  if (input.published !== undefined) data.published = input.published === true
  if (input.noindex !== undefined) data.noindex = input.noindex === true
  // a pasted URL over an upload: the upload is deleted and its id forgotten
  let files = page.files ?? null
  for (const slot of ["avatar", "hero", "qr_logo"] as const) {
    if (input[slot] === undefined) continue
    const url = image(input[slot], slot)
    data[slot] = url
    const next = await filesAfterUrlChange(container, { ...page, files }, slot, url)
    if (next) files = next
  }
  if (files !== (page.files ?? null)) data.files = files
  if (input.profile_style !== undefined) data.profile_style = cleanProfileStyle(input.profile_style, cleanProfileStyle(page.profile_style))
  if (input.hero_ratio !== undefined) data.hero_ratio = cleanHeroRatio(input.hero_ratio, cleanHeroRatio(page.hero_ratio))
  if (input.hero_avatar !== undefined) data.hero_avatar = input.hero_avatar === true
  if (input.focus !== undefined) data.focus = focusOf(input.focus, page.focus)
  if (input.socials !== undefined) data.socials = cleanSocials(input.socials)
  if (input.theme !== undefined) data.theme = cleanTheme(input.theme, cleanTheme(page.theme))
  if (input.utm !== undefined) data.utm = input.utm !== false
  if (input.utm_source !== undefined) data.utm_source = strOrNull(input.utm_source, 80)
  if (input.utm_medium !== undefined) data.utm_medium = strOrNull(input.utm_medium, 80)
  if (input.utm_campaign !== undefined) data.utm_campaign = strOrNull(input.utm_campaign, 80)
  if (input.og_image !== undefined) data.og_image = image(input.og_image, "og_image")
  if (input.metadata !== undefined) data.metadata = input.metadata
  if (Object.keys(data).length > 1) await svc.updateLibPages(data)
  if (input.translations !== undefined || input.locales !== undefined) {
    await writeTranslations(container, { ...page, ...data } as PageRow, locales, input.translations, page.translations ?? [])
  }
  pageChanged(container, (data.handle as string | undefined) ?? page.handle, { previous: page.handle })
  return getPage(container, id)
}

export async function deletePage(container: MedusaContainer, id: string): Promise<void> {
  const page = await getPage(container, id)
  await service(container).deleteLibPages([id])
  await releaseAllFiles(container, page)
  pageChanged(container, page.handle, { all: true })
}

export async function listPages(container: MedusaContainer): Promise<PageRow[]> {
  return service(container).listLibPages({}, { relations: PAGE_RELATIONS, order: { created_at: "ASC" }, take: 200 })
}

export async function pageByHandle(container: MedusaContainer, handle: string): Promise<PageRow | null> {
  const [row] = await service(container).listLibPages({ handle }, { relations: PAGE_RELATIONS, take: 1 })
  return row ?? null
}
