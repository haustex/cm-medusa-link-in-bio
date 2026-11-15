import { Button, Drawer, Input, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { api, errorOf, fromLocalInput, pageKey, toLocalInput, type AdminConfig, type AdminItem, type AdminItemInput, type AdminPage, type ItemType, type SearchResult } from "../lib/api"
import { Picker, Thumb, type PickType } from "./picker"
import { Field } from "./states"

const TYPES: ItemType[] = ["link", "product", "collection", "category", "promo", "post", "whatsapp", "contact", "header", "divider"]
const PICKED: Record<string, PickType> = { product: "product", collection: "collection", category: "category", post: "post" }
const TARGET_ID: Record<PickType, string> = { product: "product_id", collection: "collection_id", category: "category_id", post: "post_id" }

type Draft = {
  type: ItemType
  target: Record<string, string | boolean | null>
  picked: { title: string; thumbnail: string | null } | null
  translations: Record<string, { label: string; note: string }>
  enabled: boolean
  starts_at: string
  ends_at: string
  image: string
  icon: string
  featured: boolean
  utm: "follow" | "on" | "off"
}

function fromItem(item: AdminItem | null, locales: string[]): Draft {
  const tr: Draft["translations"] = {}
  for (const l of locales) tr[l] = { label: item?.translations[l]?.label ?? "", note: item?.translations[l]?.note ?? "" }
  const target = { ...(item?.target as Record<string, string | boolean | null> | undefined) }
  return {
    type: item?.type ?? "link",
    target,
    picked: item?.resolved && !item.resolved.missing ? { title: item.resolved.title, thumbnail: item.resolved.thumbnail } : null,
    translations: tr,
    enabled: item?.enabled ?? true,
    starts_at: toLocalInput(item?.starts_at),
    ends_at: toLocalInput(item?.ends_at),
    image: item?.image ?? "",
    icon: item?.icon ?? "",
    featured: item?.style === "featured",
    utm: item?.utm === true ? "on" : item?.utm === false ? "off" : "follow",
  }
}

function toInput(d: Draft, isNew: boolean): AdminItemInput {
  const translations: AdminItemInput["translations"] = {}
  for (const [l, t] of Object.entries(d.translations)) translations[l] = { label: t.label || null, note: t.note || null }
  return {
    ...(isNew ? { type: d.type } : {}),
    target: d.target,
    translations,
    enabled: d.enabled,
    starts_at: fromLocalInput(d.starts_at),
    ends_at: fromLocalInput(d.ends_at),
    image: d.image || null,
    icon: d.icon || null,
    style: d.featured ? "featured" : "normal",
    utm: d.utm === "on" ? true : d.utm === "off" ? false : null,
  }
}

export function ItemForm({ page, item, config, open, onClose }: { page: AdminPage; item: AdminItem | null; config: AdminConfig | undefined; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const isNew = !item
  const [d, setD] = useState<Draft>(() => fromItem(item, page.locales))
  const [pick, setPick] = useState(false)
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const setTarget = (patch: Record<string, string | boolean | null>) => setD((x) => ({ ...x, target: { ...x.target, ...patch } }))
  const setT = (l: string, k: "label" | "note", v: string) => setD((x) => ({ ...x, translations: { ...x.translations, [l]: { ...x.translations[l], [k]: v } } }))
  const save = useMutation({
    mutationFn: () => (item ? api.updateItem(page.id, item.id, toInput(d, false)) : api.createItem(page.id, toInput(d, true))),
    onSuccess: () => {
      toast.success(t(item ? "lib.item.saved" : "lib.item.created"))
      qc.invalidateQueries({ queryKey: pageKey(page.id) })
      onClose()
    },
    onError: (e) => {
      const { code } = errorOf(e)
      toast.error(t(code ? `lib.errors.${code}` : "lib.errors.unknown"))
    },
  })
  const pickType = PICKED[d.type]
  const clickable = !["header", "divider"].includes(d.type)
  const utmable = !["header", "divider", "whatsapp", "contact"].includes(d.type)
  const onPick = (r: SearchResult) => {
    if (!pickType) return
    setTarget({ [TARGET_ID[pickType]]: r.id, ...(pickType === "post" ? { latest: false } : {}) })
    set({ picked: { title: r.title, thumbnail: r.thumbnail } })
  }
  return (
    <Drawer open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{t(item ? "lib.item.edit" : "lib.item.add")}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          <Field label={t("lib.item.type")} hint={t(`lib.item.typeHint.${d.type}`, { defaultValue: "" }) || undefined}>
            <Select value={d.type} disabled={!isNew} onValueChange={(v) => set({ type: v as ItemType, target: {}, picked: null })}>
              <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
              <Select.Content>
                {TYPES.filter((x) => x !== "post" || config?.blog !== false).map((x) => <Select.Item key={x} value={x}>{t(`lib.item.types.${x}`)}</Select.Item>)}
              </Select.Content>
            </Select>
          </Field>

          {d.type === "link" && (
            <Field label={t("lib.item.url")}>
              <Input type="url" required inputMode="url" value={String(d.target.url ?? "")} onChange={(e) => setTarget({ url: e.target.value })} placeholder="https://" style={{ height: 44 }} />
            </Field>
          )}
          {pickType && (
            <Field label={t(`lib.item.types.${d.type}`)}>
              {d.type === "post" && (
                <label className="flex items-center justify-between gap-3 py-1">
                  <Text size="small">{t("lib.item.latest")}</Text>
                  <Switch checked={d.target.latest === true} onCheckedChange={(v) => setTarget(v ? { latest: true, post_id: null } : { latest: false })} />
                </label>
              )}
              {d.target.latest !== true && (
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Thumb src={d.picked?.thumbnail} />
                  <Text size="small" className="min-w-0 flex-1 truncate">{d.picked?.title || (d.target[TARGET_ID[pickType]] ? String(d.target[TARGET_ID[pickType]]) : "—")}</Text>
                  <Button type="button" variant="secondary" size="small" onClick={() => setPick(true)}>{d.picked ? t("lib.item.change") : t("lib.item.pick")}</Button>
                </div>
              )}
              <Picker type={pickType} open={pick} onClose={() => setPick(false)} onPick={onPick} />
            </Field>
          )}
          {d.type === "promo" && (
            <div className="lib-cols-2">
              <Field label={t("lib.item.code")}>
                <Input required value={String(d.target.code ?? "")} onChange={(e) => setTarget({ code: e.target.value.toUpperCase() })} style={{ height: 44 }} autoCapitalize="characters" />
              </Field>
              <Field label={t("lib.item.promoUrl")}>
                <Input type="url" inputMode="url" value={String(d.target.url ?? "")} onChange={(e) => setTarget({ url: e.target.value || null })} placeholder="https://" style={{ height: 44 }} />
              </Field>
            </div>
          )}
          {d.type === "whatsapp" && (
            <>
              <Field label={t("lib.item.phone")} hint={t("lib.item.phoneHint")}>
                <Input required inputMode="tel" value={String(d.target.phone ?? "")} onChange={(e) => setTarget({ phone: e.target.value })} style={{ height: 44 }} />
              </Field>
              <Field label={t("lib.item.text")}>
                <Textarea rows={2} value={String(d.target.text ?? "")} onChange={(e) => setTarget({ text: e.target.value || null })} />
              </Field>
            </>
          )}
          {d.type === "contact" && (
            <div className="lib-cols-2">
              <Field label={t("lib.item.contactKind")}>
                <Select value={String(d.target.kind ?? "tel")} onValueChange={(v) => setTarget({ kind: v })}>
                  <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="tel">{t("lib.item.tel")}</Select.Item>
                    <Select.Item value="mailto">{t("lib.item.mailto")}</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              <Field label={t("lib.item.value")}>
                <Input required value={String(d.target.value ?? "")} onChange={(e) => setTarget({ value: e.target.value, kind: String(d.target.kind ?? "tel") })} style={{ height: 44 }} />
              </Field>
            </div>
          )}

          {d.type !== "divider" &&
            page.locales.map((l) => (
              <div key={l} className="flex flex-col gap-2 rounded-md border px-3 py-2">
                <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">{l}{l === page.default_locale ? ` · ${t("lib.defaultLocale")}` : ""}</Text>
                <Field label={t("lib.item.label")} hint={pickType ? t("lib.item.labelHint") : undefined}>
                  <Input maxLength={120} value={d.translations[l]?.label ?? ""} onChange={(e) => setT(l, "label", e.target.value)} style={{ height: 44 }} required={d.type === "header" && l === page.default_locale} />
                </Field>
                {d.type !== "header" && (
                  <Field label={t("lib.item.note")}>
                    <Input maxLength={200} value={d.translations[l]?.note ?? ""} onChange={(e) => setT(l, "note", e.target.value)} style={{ height: 44 }} />
                  </Field>
                )}
              </div>
            ))}

          {clickable && (
            <>
              <div className="lib-cols-2">
                <Field label={t("lib.item.image")} hint={t("lib.item.imageHint")}>
                  <Input type="url" inputMode="url" value={d.image} onChange={(e) => set({ image: e.target.value })} placeholder="https://" style={{ height: 44 }} />
                </Field>
                <Field label={t("lib.item.icon")} hint={t("lib.item.iconHint")}>
                  <Input maxLength={64} value={d.icon} onChange={(e) => set({ icon: e.target.value })} style={{ height: 44 }} />
                </Field>
              </div>
              <Field label={t("lib.item.style")}>
                <Select value={d.featured ? "featured" : "normal"} onValueChange={(v) => set({ featured: v === "featured" })}>
                  <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="normal">{t("lib.item.normal")}</Select.Item>
                    <Select.Item value="featured">{t("lib.item.featured")}</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              {utmable && (
              <Field label={t("lib.item.utm")}>
                <Select value={d.utm} onValueChange={(v) => set({ utm: v as Draft["utm"] })}>
                  <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="follow">{t("lib.item.utmFollow")}</Select.Item>
                    <Select.Item value="on">{t("lib.item.utmOn")}</Select.Item>
                    <Select.Item value="off">{t("lib.item.utmOff")}</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              )}
            </>
          )}

          <div className="flex flex-col gap-3 rounded-md border px-3 py-2">
            <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">{t("lib.item.schedule")}</Text>
            <label className="flex items-center justify-between gap-3">
              <Text size="small">{t("lib.item.enabled")}</Text>
              <Switch checked={d.enabled} onCheckedChange={(v) => set({ enabled: v })} />
            </label>
            <div className="lib-cols-2">
              <Field label={t("lib.item.startsAt")}>
                <Input type="datetime-local" value={d.starts_at} onChange={(e) => set({ starts_at: e.target.value })} style={{ height: 44 }} />
              </Field>
              <Field label={t("lib.item.endsAt")}>
                <Input type="datetime-local" value={d.ends_at} onChange={(e) => set({ ends_at: e.target.value })} style={{ height: 44 }} />
              </Field>
            </div>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={onClose} style={{ minHeight: 40 }}>{t("lib.cancel")}</Button>
          <Button onClick={() => save.mutate()} isLoading={save.isPending} style={{ minHeight: 40 }}>{t(isNew ? "lib.add" : "lib.save")}</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
