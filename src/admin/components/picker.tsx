import { Drawer, Input, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { api, KEY, type SearchResult } from "../lib/api"

export type PickType = "product" | "collection" | "category" | "post"

/** Thumbnail of a product/article (or an empty box) */
export const Thumb = ({ src, size = 44, children }: { src: string | null | undefined; size?: number; children?: React.ReactNode }) => (
  <span style={{ width: size, height: size }} className="bg-ui-bg-subtle text-ui-fg-muted flex flex-none items-center justify-center overflow-hidden rounded-md border">
    {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : children}
  </span>
)

/** Pick one product, collection, category or article (search by title) */
export function Picker({ type, open, onClose, onPick }: { type: PickType; open: boolean; onClose: () => void; onPick: (r: SearchResult) => void }) {
  const { t } = useTranslation()
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  useEffect(() => {
    const h = setTimeout(() => setQ(input), 300)
    return () => clearTimeout(h)
  }, [input])
  useEffect(() => {
    if (!open) setInput("")
  }, [open])
  const { data, isLoading, isError } = useQuery({ queryKey: [...KEY, "search", type, q], queryFn: () => api.search(type, q), enabled: open, placeholderData: keepPreviousData })
  const rows = data?.results ?? []
  return (
    <Drawer open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{t(`lib.picker.${type}`)}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-3 overflow-y-auto">
          <Input type="search" autoFocus placeholder={t("lib.picker.search")} value={input} onChange={(e) => setInput(e.target.value)} style={{ height: 44 }} />
          {isError ? (
            <Text size="small" className="text-ui-fg-error">{t("lib.loadError")}</Text>
          ) : isLoading ? (
            <Text size="small" className="text-ui-fg-subtle">{t("lib.loading")}</Text>
          ) : !rows.length ? (
            <Text size="small" className="text-ui-fg-subtle">{t("lib.picker.empty")}</Text>
          ) : (
            <ul className="flex flex-col divide-y rounded-md border">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" className="hover:bg-ui-bg-base-hover flex w-full items-center gap-3 px-3 py-2 text-left" style={{ minHeight: 56 }} onClick={() => { onPick(r); onClose() }}>
                    <Thumb src={r.thumbnail} />
                    <span className="flex min-w-0 flex-col">
                      <Text size="small" weight="plus" className="truncate">{r.title || t("lib.untitled")}</Text>
                      <Text size="xsmall" className="text-ui-fg-muted truncate">{r.extra ? `${r.extra} · ` : ""}{r.handle}</Text>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}
