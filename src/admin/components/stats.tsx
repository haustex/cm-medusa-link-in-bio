import { Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { api, formatNumber, lang, statsKey } from "../lib/api"

/** Totals and a 30-day bar chart of a page's clicks */
export function Stats({ pageId, enabled }: { pageId: string; enabled: boolean }) {
  const { t, i18n } = useTranslation()
  const l = lang(i18n.language)
  const { data } = useQuery({ queryKey: statsKey(pageId, 30), queryFn: () => api.stats(pageId, 30), enabled })
  const s = data?.stats
  const max = Math.max(1, ...(s?.days ?? []).map((d) => d.count))
  return (
    <Container className="flex flex-col gap-3 px-6 py-4">
      <Heading level="h2">{t("lib.stats.title")}</Heading>
      {!enabled ? (
        <Text size="small" className="text-ui-fg-subtle">{t("lib.clicksOff")}</Text>
      ) : (
        <>
          <div className="flex gap-6">
            {([["clicks7", s?.clicks_7d], ["clicks30", s?.clicks_30d], ["clicksTotal", s?.clicks_total]] as const).map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <Text size="xsmall" className="text-ui-fg-muted">{t(`lib.${k}`)}</Text>
                <Text size="large" weight="plus" className="tabular-nums">{formatNumber(v ?? 0, l)}</Text>
              </div>
            ))}
          </div>
          <div className="lib-bars" aria-label={t("lib.stats.days", { count: 30 })} title={t("lib.stats.days", { count: 30 })}>
            {(s?.days ?? []).map((d) => <span key={d.day} style={{ height: `${Math.max(4, Math.round((d.count / max) * 100))}%` }} title={`${d.day}: ${d.count}`} />)}
          </div>
          <Text size="xsmall" className="text-ui-fg-muted">{t("lib.stats.privacy")}</Text>
        </>
      )}
    </Container>
  )
}
