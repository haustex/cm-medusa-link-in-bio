import { Button, Drawer, Select, Text } from "@medusajs/ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { qrSrc, type AdminItem, type AdminPage } from "../lib/api"

/** QR of the page (per language) or of one link; downloads as SVG or PNG */
export function QrDialog({ page, item, open, onClose }: { page: AdminPage; item: AdminItem | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [locale, setLocale] = useState(page.default_locale)
  const params = item ? { item_id: item.id } : { page_id: page.id, locale }
  const url = item ? item.href : page.urls?.[locale]
  return (
    <Drawer open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{t(item ? "lib.qr.item" : "lib.qr.page")}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col items-center gap-4 overflow-y-auto">
          {!item && page.locales.length > 1 && (
            <Select value={locale} onValueChange={setLocale}>
              <Select.Trigger style={{ height: 44, maxWidth: 240 }} aria-label={t("lib.qr.locale")}><Select.Value /></Select.Trigger>
              <Select.Content>{page.locales.map((l) => <Select.Item key={l} value={l}>{l}</Select.Item>)}</Select.Content>
            </Select>
          )}
          {url ? (
            <>
              <img src={qrSrc({ ...params, format: "svg" })} alt="" width={256} height={256} className="rounded-md border bg-white p-2" />
              <Text size="xsmall" className="text-ui-fg-muted break-all text-center">{t("lib.qr.encodes", { url })}</Text>
              <div className="flex gap-2">
                <a href={qrSrc({ ...params, format: "svg", download: true })} download><Button variant="secondary" style={{ minHeight: 40 }}>{t("lib.qr.svg")}</Button></a>
                <a href={qrSrc({ ...params, format: "png", size: 1024, download: true })} download><Button variant="secondary" style={{ minHeight: 40 }}>{t("lib.qr.png")}</Button></a>
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
