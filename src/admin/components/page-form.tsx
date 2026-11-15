import { Trash } from "@medusajs/icons"
import { Button, IconButton, Input, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { api, errorOf, pageKey, PAGES_KEY, type AdminConfig, type AdminPage, type AdminPageInput, type Focus, type HeroRatio, type ProfileStyle, type Social, type SocialNetwork, type Theme } from "../lib/api"
import { Field } from "./states"
import { UploadSlot } from "./upload-slot"

type Draft = {
  name: string
  handle: string
  locales: string
  published: boolean
  noindex: boolean
  avatar: string
  profile_style: ProfileStyle
  hero: string
  hero_ratio: HeroRatio
  focus: { avatar: Focus | null; hero: Focus | null }
  og_image: string
  translations: Record<string, { title: string; bio: string; seo_title: string; seo_description: string; avatar_alt: string; hero_alt: string }>
  socials: Social[]
  theme: Theme
  utm: boolean
  utm_source: string
  utm_medium: string
  utm_campaign: string
}

const fromPage = (p: AdminPage): Draft => ({
  name: p.name,
  handle: p.handle,
  locales: p.locales.join(", "),
  published: p.published,
  noindex: p.noindex,
  avatar: p.avatar ?? "",
  profile_style: p.profile_style ?? "circle",
  hero: p.hero ?? "",
  hero_ratio: p.hero_ratio ?? "16:9",
  focus: { avatar: p.focus?.avatar ?? null, hero: p.focus?.hero ?? null },
  og_image: p.og_image ?? "",
  translations: Object.fromEntries(p.locales.map((l) => [l, { title: p.translations[l]?.title ?? "", bio: p.translations[l]?.bio ?? "", seo_title: p.translations[l]?.seo_title ?? "", seo_description: p.translations[l]?.seo_description ?? "", avatar_alt: p.translations[l]?.avatar_alt ?? "", hero_alt: p.translations[l]?.hero_alt ?? "" }])),
  socials: p.socials,
  theme: p.theme,
  utm: p.utm,
  utm_source: p.utm_source ?? "",
  utm_medium: p.utm_medium ?? "",
  utm_campaign: p.utm_campaign ?? "",
})

function toInput(d: Draft): AdminPageInput {
  const locales = d.locales.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean)
  const translations: AdminPageInput["translations"] = {}
  for (const [l, t] of Object.entries(d.translations)) if (locales.includes(l)) translations[l] = { title: t.title, bio: t.bio || null, seo_title: t.seo_title || null, seo_description: t.seo_description || null, avatar_alt: t.avatar_alt || null, hero_alt: t.hero_alt || null }
  return {
    name: d.name,
    handle: d.handle,
    locales,
    published: d.published,
    noindex: d.noindex,
    avatar: d.avatar || null,
    profile_style: d.profile_style,
    hero: d.hero || null,
    hero_ratio: d.hero_ratio,
    focus: d.focus,
    og_image: d.og_image || null,
    translations,
    socials: d.socials,
    theme: d.theme,
    utm: d.utm,
    utm_source: d.utm_source || null,
    utm_medium: d.utm_medium || null,
    utm_campaign: d.utm_campaign || null,
  }
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-3 border-t px-6 py-4">
    <Text size="small" weight="plus">{title}</Text>
    {children}
  </div>
)

export function PageForm({ page, config }: { page: AdminPage; config: AdminConfig | undefined }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [d, setD] = useState<Draft>(() => fromPage(page))
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const setT = (l: string, k: keyof Draft["translations"][string], v: string) => setD((x) => ({ ...x, translations: { ...x.translations, [l]: { ...(x.translations[l] ?? { title: "", bio: "", seo_title: "", seo_description: "", avatar_alt: "", hero_alt: "" }), [k]: v } } }))
  /** After an upload/removal the server already stored the URL; only the image fields of the draft follow (other edits stay) */
  const fromUpload = (p: AdminPage) => setD((x) => ({ ...x, avatar: p.avatar ?? "", hero: p.hero ?? "", focus: { avatar: p.focus?.avatar ?? x.focus.avatar, hero: p.focus?.hero ?? x.focus.hero } }))
  const altOf = (k: "avatar_alt" | "hero_alt") => Object.fromEntries(locales.map((l) => [l, d.translations[l]?.[k] ?? ""]))
  const setTheme = (patch: Partial<Theme>) => setD((x) => ({ ...x, theme: { ...x.theme, ...patch } }))
  const locales = d.locales.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean)
  const save = useMutation({
    mutationFn: () => api.updatePage(page.id, toInput(d)),
    onSuccess: (r) => {
      toast.success(t("lib.saved"))
      setD(fromPage(r.page))
      qc.invalidateQueries({ queryKey: pageKey(page.id) })
      qc.invalidateQueries({ queryKey: PAGES_KEY })
    },
    onError: (e) => {
      const { code } = errorOf(e)
      toast.error(t(code ? `lib.errors.${code}` : "lib.errors.unknown"))
    },
  })
  const networks = config?.networks ?? []
  const urlFor = (handle: string) => (config?.storefront_url ? `${config.storefront_url}${handle === (config.main_handle ?? "links") ? "/links" : `/links/${handle || "…"}`}` : "")
  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <div className="flex flex-col gap-3 px-6 py-4">
        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <Text size="small" weight="plus">{t("lib.page.published")}</Text>
            <Text size="xsmall" className="text-ui-fg-muted">{t("lib.page.publishedHint")}</Text>
          </span>
          <Switch checked={d.published} onCheckedChange={(v) => set({ published: v })} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <Text size="small" weight="plus">{t("lib.page.noindex")}</Text>
          <Switch checked={d.noindex} onCheckedChange={(v) => set({ noindex: v })} />
        </label>
        <Field label={t("lib.page.name")} hint={t("lib.page.nameHint")}>
          <Input required maxLength={120} value={d.name} onChange={(e) => set({ name: e.target.value })} style={{ height: 44 }} />
        </Field>
        <Field label={t("lib.page.handle")} hint={config?.storefront_url ? t("lib.page.handleHint", { url: urlFor(d.handle) }) : t("lib.page.noStorefront")}>
          <Input required maxLength={64} value={d.handle} autoCapitalize="none" spellCheck={false} onChange={(e) => set({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })} style={{ height: 44 }} />
        </Field>
        <Field label={t("lib.page.locales")} hint={t("lib.page.localesHint")}>
          <Input required value={d.locales} autoCapitalize="none" spellCheck={false} onChange={(e) => set({ locales: e.target.value })} style={{ height: 44 }} />
        </Field>
      </div>

      <Section title={t("lib.page.images")}>
        <Field label={t("lib.page.profileStyle")} hint={t(d.profile_style === "hero" ? "lib.page.profileStyleHeroHint" : "lib.page.profileStyleCircleHint")}>
          <Select value={d.profile_style} onValueChange={(v) => set({ profile_style: v as ProfileStyle })}>
            <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="circle">{t("lib.page.profileCircle")}</Select.Item>
              <Select.Item value="hero">{t("lib.page.profileHero")}</Select.Item>
            </Select.Content>
          </Select>
        </Field>
        {d.profile_style === "hero" && (
          <>
            <Field label={t("lib.page.hero")} hint={t("lib.page.heroHint")}>
              <UploadSlot page={page} slot="hero" config={config} url={d.hero} ratio={d.hero_ratio === "3:2" ? 3 / 2 : 16 / 9} focus={d.focus.hero} onFocus={(f) => set({ focus: { ...d.focus, hero: f } })} alt={altOf("hero_alt")} onAlt={(l, v) => setT(l, "hero_alt", v)} onPage={fromUpload} />
            </Field>
            <div className="lib-cols-2">
              <Field label={t("lib.page.heroRatio")}>
                <Select value={d.hero_ratio} onValueChange={(v) => set({ hero_ratio: v as HeroRatio })}>
                  <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="16:9">16:9</Select.Item>
                    <Select.Item value="3:2">3:2</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              <Field label={t("lib.page.heroUrl")}>
                <Input type="url" inputMode="url" value={d.hero} onChange={(e) => set({ hero: e.target.value })} placeholder="https://" style={{ height: 44 }} />
              </Field>
            </div>
          </>
        )}
        <Field label={t("lib.page.avatar")} hint={t(d.profile_style === "hero" ? "lib.page.avatarHeroHint" : "lib.page.avatarHint")}>
          <UploadSlot page={page} slot="avatar" config={config} url={d.avatar} ratio={1} round focus={d.focus.avatar} onFocus={(f) => set({ focus: { ...d.focus, avatar: f } })} alt={altOf("avatar_alt")} onAlt={(l, v) => setT(l, "avatar_alt", v)} onPage={fromUpload} />
        </Field>
        <Field label={t("lib.page.avatarUrl")}>
          <Input type="url" inputMode="url" value={d.avatar} onChange={(e) => set({ avatar: e.target.value })} placeholder="https://" style={{ height: 44 }} />
        </Field>
        <Field label={t("lib.page.ogImage")} hint={t("lib.page.ogImageHint")}>
          <Input type="url" inputMode="url" value={d.og_image} onChange={(e) => set({ og_image: e.target.value })} placeholder="https://" style={{ height: 44 }} />
        </Field>
      </Section>

      {locales.map((l) => (
        <Section key={l} title={`${l}${l === locales[0] ? ` · ${t("lib.defaultLocale")}` : ""}`}>
          <Field label={t("lib.page.title")}>
            <Input required={l === locales[0]} maxLength={120} value={d.translations[l]?.title ?? ""} onChange={(e) => setT(l, "title", e.target.value)} style={{ height: 44 }} />
          </Field>
          <Field label={t("lib.page.bio")}>
            <Textarea rows={3} maxLength={600} value={d.translations[l]?.bio ?? ""} onChange={(e) => setT(l, "bio", e.target.value)} />
          </Field>
          <Field label={t("lib.page.seoTitle")}>
            <Input maxLength={200} value={d.translations[l]?.seo_title ?? ""} onChange={(e) => setT(l, "seo_title", e.target.value)} style={{ height: 44 }} />
          </Field>
          <Field label={t("lib.page.seoDescription")}>
            <Textarea rows={2} maxLength={400} value={d.translations[l]?.seo_description ?? ""} onChange={(e) => setT(l, "seo_description", e.target.value)} />
          </Field>
        </Section>
      ))}

      <Section title={t("lib.page.socials")}>
        {d.socials.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Select value={s.network} onValueChange={(v) => set({ socials: d.socials.map((x, j) => (j === i ? { ...x, network: v as SocialNetwork } : x)) })}>
              <Select.Trigger style={{ height: 44, width: 150 }} aria-label={t("lib.page.network")}><Select.Value /></Select.Trigger>
              <Select.Content>{networks.map((n) => <Select.Item key={n} value={n}>{n}</Select.Item>)}</Select.Content>
            </Select>
            <Input className="flex-1" value={s.url} placeholder={s.network === "email" ? "name@example.com" : "https://"} onChange={(e) => set({ socials: d.socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} style={{ height: 44 }} aria-label={t("lib.page.url")} />
            <IconButton type="button" variant="transparent" onClick={() => set({ socials: d.socials.filter((_, j) => j !== i) })} aria-label={t("lib.delete")}><Trash /></IconButton>
          </div>
        ))}
        <Button type="button" variant="secondary" size="small" onClick={() => set({ socials: [...d.socials, { network: "instagram", url: "" }] })} style={{ alignSelf: "flex-start", minHeight: 36 }}>{t("lib.page.addSocial")}</Button>
      </Section>

      <Section title={t("lib.page.theme")}>
        <div className="flex flex-wrap gap-4">
          {(["background", "text", "accent"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="color" className="lib-swatch" value={d.theme[k]} onChange={(e) => setTheme({ [k]: e.target.value })} aria-label={t(`lib.page.${k}`)} />
              <Text size="small">{t(`lib.page.${k}`)}</Text>
            </label>
          ))}
        </div>
        <div className="lib-cols-2">
          <Field label={t("lib.page.radius")}>
            <Select value={d.theme.radius} onValueChange={(v) => setTheme({ radius: v as Theme["radius"] })}>
              <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
              <Select.Content>
                {(["none", "sm", "md", "full"] as const).map((r) => <Select.Item key={r} value={r}>{t(`lib.page.radius${r[0].toUpperCase()}${r.slice(1)}`)}</Select.Item>)}
              </Select.Content>
            </Select>
          </Field>
          <Field label={t("lib.page.button")}>
            <Select value={d.theme.button} onValueChange={(v) => setTheme({ button: v as Theme["button"] })}>
              <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
              <Select.Content>
                {(["solid", "outline", "soft"] as const).map((b) => <Select.Item key={b} value={b}>{t(`lib.page.button${b[0].toUpperCase()}${b.slice(1)}`)}</Select.Item>)}
              </Select.Content>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title={t("lib.page.utm")}>
        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <Text size="small">{t("lib.page.utmOn")}</Text>
            <Text size="xsmall" className="text-ui-fg-muted">{t("lib.page.utmHint")}</Text>
          </span>
          <Switch checked={d.utm} onCheckedChange={(v) => set({ utm: v })} />
        </label>
        {d.utm && (
          <div className="lib-cols-2">
            <Field label={t("lib.page.utmSource")}>
              <Input value={d.utm_source} placeholder={config?.utm.source} onChange={(e) => set({ utm_source: e.target.value })} style={{ height: 44 }} />
            </Field>
            <Field label={t("lib.page.utmMedium")}>
              <Input value={d.utm_medium} placeholder={config?.utm.medium} onChange={(e) => set({ utm_medium: e.target.value })} style={{ height: 44 }} />
            </Field>
            <Field label={t("lib.page.utmCampaign")} hint={t("lib.page.utmCampaignHint")}>
              <Input value={d.utm_campaign} placeholder={d.handle} onChange={(e) => set({ utm_campaign: e.target.value })} style={{ height: 44 }} />
            </Field>
          </div>
        )}
      </Section>

      <div className="flex justify-end border-t px-6 py-4">
        <Button type="submit" isLoading={save.isPending} style={{ minHeight: 40 }}>{t("lib.save")}</Button>
      </div>
    </form>
  )
}
