import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Link as LinkIcon } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { CreditFooter } from "../../components/credit-footer"
import { Field, Loading } from "../../components/states"
import { LibStyles } from "../../components/styles"
import { api, CONFIG_KEY, errorOf, formatNumber, lang, PAGES_KEY } from "../../lib/api"

const PagesPage = () => {
  const { t, i18n } = useTranslation()
  const l = lang(i18n.language)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [locales, setLocales] = useState("en")
  const { data, isLoading, isError } = useQuery({ queryKey: PAGES_KEY, queryFn: api.listPages })
  const { data: config } = useQuery({ queryKey: CONFIG_KEY, queryFn: api.config, staleTime: Infinity })
  const create = useMutation({
    mutationFn: () => api.createPage({ name, handle: handle || undefined, locales: locales.split(/[,\s]+/).filter(Boolean), translations: { [locales.split(/[,\s]+/).filter(Boolean)[0] ?? "en"]: { title: name } } }),
    onSuccess: (r) => {
      toast.success(t("lib.page.created"))
      qc.invalidateQueries({ queryKey: PAGES_KEY })
      navigate(`/link-in-bio/${r.page.id}`)
    },
    onError: (e) => {
      const { code } = errorOf(e)
      toast.error(t(code ? `lib.errors.${code}` : "lib.errors.unknown"))
    },
  })
  const pages = data?.pages ?? []
  const first = !isLoading && !pages.length
  return (
    <div className="flex flex-col gap-y-3">
      <LibStyles />
      <Container className="divide-y p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex flex-col">
            <Heading level="h1">{t("lib.title")}</Heading>
            <Text size="small" className="text-ui-fg-subtle">{t("lib.description")}</Text>
          </div>
          <Button onClick={() => { setCreating(true); if (first) setHandle(config?.main_handle ?? "links") }} style={{ minHeight: 40 }}>{t("lib.newPage")}</Button>
        </div>
        {creating && (
          <form
            className="flex flex-col gap-3 px-6 py-4"
            onSubmit={(e) => {
              e.preventDefault()
              create.mutate()
            }}
          >
            <div className="lib-cols-2">
              <Field label={t("lib.page.name")}>
                <Input required autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} style={{ height: 44 }} />
              </Field>
              <Field label={t("lib.page.handle")} hint={config?.storefront_url ? `${config.storefront_url}${(handle || "…") === config.main_handle ? "/links" : `/links/${handle || "…"}`}` : undefined}>
                <Input maxLength={64} value={handle} autoCapitalize="none" spellCheck={false} placeholder={config?.main_handle ?? "links"} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} style={{ height: 44 }} />
              </Field>
              <Field label={t("lib.page.locales")} hint={t("lib.page.localesHint")}>
                <Input required value={locales} autoCapitalize="none" spellCheck={false} onChange={(e) => setLocales(e.target.value)} style={{ height: 44 }} />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit" isLoading={create.isPending} style={{ minHeight: 40 }}>{t("lib.add")}</Button>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)} style={{ minHeight: 40 }}>{t("lib.cancel")}</Button>
            </div>
          </form>
        )}
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <Text size="small" className="text-ui-fg-error px-6 py-4">{t("lib.loadError")}</Text>
        ) : !pages.length ? (
          <Text size="small" className="text-ui-fg-subtle px-6 py-6">{t("lib.empty")}</Text>
        ) : (
          <ul className="divide-y">
            {pages.map((p) => (
              <li key={p.id}>
                <Link to={`/link-in-bio/${p.id}`} className="hover:bg-ui-bg-base-hover flex items-center gap-4 px-6 py-3" style={{ minHeight: 56 }}>
                  <span className="bg-ui-bg-subtle flex size-10 flex-none items-center justify-center overflow-hidden rounded-full border">
                    {p.avatar ? <img src={p.avatar} alt="" className="size-full object-cover" /> : <LinkIcon className="text-ui-fg-muted" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <Text size="small" weight="plus" className="truncate">{p.name}</Text>
                      <Badge size="2xsmall" color={p.published ? "green" : "grey"}>{t(p.published ? "lib.published" : "lib.draft")}</Badge>
                    </span>
                    <Text size="xsmall" className="text-ui-fg-muted truncate">{p.urls?.[p.default_locale] ?? `/${p.handle}`} · {t("lib.items", { count: p.item_count ?? 0 })} · {p.locales.join(", ")}</Text>
                  </span>
                  {config?.clicks !== false && (
                    <span className="flex gap-4 text-right">
                      <span className="flex flex-col"><Text size="xsmall" className="text-ui-fg-muted">{t("lib.clicks7")}</Text><Text size="small" weight="plus" className="tabular-nums">{formatNumber(p.clicks_7d ?? 0, l)}</Text></span>
                      <span className="flex flex-col"><Text size="xsmall" className="text-ui-fg-muted">{t("lib.clicks30")}</Text><Text size="small" weight="plus" className="tabular-nums">{formatNumber(p.clicks_30d ?? 0, l)}</Text></span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
      <CreditFooter />
    </div>
  )
}

export const config = defineRouteConfig({ label: "Link in bio", icon: LinkIcon })
export const handle = { breadcrumb: () => "Link in bio" }
export default PagesPage
