import { Button, Drawer, Select, Text } from "@medusajs/ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { qrSrc, type AdminConfig, type AdminItem, type AdminPage, type QrLogo, type QrTheme } from "../lib/api"
import { UploadSlot } from "./upload-slot"

const SIZES = [1024, 2048, 4096]

/**
 * QR of the page (per language) or of one link: light (black on white) or dark (white on a black rounded card),
 * with the brand logo (plugin option), this page's own logo (uploaded here) or none in the centre. Downloads as
 * SVG (print) or PNG up to 4096 px.
 */
export function QrDialog({ page, item, config, open, onClose, onPage }: { page: AdminPage; item: AdminItem | null; config: AdminConfig | undefined; open: boolean; onClose: () => void; onPage: (p: AdminPage) => void }) {
  const { t } = useTranslation()
  const [locale, setLocale] = useState(page.default_locale)
  const [theme, setTheme] = useState<QrTheme>("light")
  const [logo, setLogo] = useState<QrLogo | null>(null)
  const [size, setSize] = useState(1024)
  const params = item ? { item_id: item.id } : { page_id: page.id, locale }
  const url = item ? item.href : page.urls?.[locale]
  const brand = !!config?.qr.brand_logo
  const own = !!page.qr_logo
  const effectiveLogo: QrLogo = logo ?? (own ? "page" : brand ? "brand" : "none")
  const img = { ...params, theme, logo: effectiveLogo }
  const Seg = <T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) => (
    <div className="lib-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
  return (
    <Drawer open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{t(item ? "lib.qr.item" : "lib.qr.page")}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          {url ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {!item && page.locales.length > 1 && (
                  <Select value={locale} onValueChange={setLocale}>
                    <Select.Trigger style={{ height: 40, width: 120 }} aria-label={t("lib.qr.locale")}><Select.Value /></Select.Trigger>
                    <Select.Content>{page.locales.map((l) => <Select.Item key={l} value={l}>{l}</Select.Item>)}</Select.Content>
                  </Select>
                )}
                <Seg<QrTheme> label={t("lib.qr.theme")} value={theme} onChange={setTheme} options={[{ value: "light", label: t("lib.qr.light") }, { value: "dark", label: t("lib.qr.dark") }]} />
                <Seg<QrLogo>
                  label={t("lib.qr.logo")}
                  value={effectiveLogo}
                  onChange={setLogo}
                  options={[...(brand ? [{ value: "brand" as const, label: t("lib.qr.logoBrand") }] : []), ...(own ? [{ value: "page" as const, label: t("lib.qr.logoPage") }] : []), { value: "none" as const, label: t("lib.qr.logoNone") }]}
                />
              </div>
              <div className="lib-qr-preview">
                <img key={JSON.stringify(img)} src={qrSrc({ ...img, format: "svg", size: 512 })} alt="" width={256} height={256} />
              </div>
              {theme === "dark" && <Text size="xsmall" className="text-ui-fg-muted">{t("lib.qr.darkWarning")}</Text>}
              <Text size="xsmall" className="text-ui-fg-muted break-all">{t("lib.qr.encodes", { url })}</Text>
              <div className="flex flex-wrap items-center gap-2">
                <a href={qrSrc({ ...img, format: "svg", download: true })} download><Button variant="secondary" style={{ minHeight: 40 }}>{t("lib.qr.svg")}</Button></a>
                <a href={qrSrc({ ...img, format: "png", size, download: true })} download><Button variant="secondary" style={{ minHeight: 40 }}>{t("lib.qr.png")}</Button></a>
                <Select value={String(size)} onValueChange={(v) => setSize(Number(v))}>
                  <Select.Trigger style={{ height: 40, width: 120 }} aria-label={t("lib.qr.size")}><Select.Value /></Select.Trigger>
                  <Select.Content>{SIZES.map((s) => <Select.Item key={s} value={String(s)}>{s} px</Select.Item>)}</Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-2 border-t pt-4">
                <Text size="small" weight="plus">{t("lib.qr.logoPage")}</Text>
                <Text size="xsmall" className="text-ui-fg-muted">{t("lib.qr.logoHint")}</Text>
                <UploadSlot page={page} slot="qr_logo" config={config} url={page.qr_logo ?? ""} ratio={1} compact onPage={(p) => { onPage(p); if (p.qr_logo) setLogo("page"); else if (logo === "page") setLogo(null) }} />
              </div>
            </>
          ) : (
            <Text size="small" className="text-ui-fg-subtle">{t("lib.page.noStorefront")}</Text>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}
