import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChatBubbleLeftRight, DocumentText, DotsSix, Envelope, Link as LinkIcon, Minus, PencilSquare, Phone, ShoppingBag, Tag, Trash } from "@medusajs/icons"
import { Badge, IconButton, Switch, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { api, errorOf, formatNumber, lang, pageKey, type AdminItem, type AdminPage } from "../lib/api"
import { Thumb } from "./picker"

const ICONS: Record<AdminItem["type"], React.ComponentType<{ className?: string }>> = {
  link: LinkIcon,
  product: ShoppingBag,
  collection: ShoppingBag,
  category: ShoppingBag,
  promo: Tag,
  post: DocumentText,
  whatsapp: ChatBubbleLeftRight,
  contact: Envelope,
  header: Minus,
  divider: Minus,
}
const VIS_COLOR: Record<AdminItem["visibility"], "green" | "orange" | "grey" | "red"> = { live: "green", scheduled: "orange", hidden: "grey", expired: "red" }

export const itemLabel = (it: AdminItem, page: AdminPage, fallback: string) => it.translations[page.default_locale]?.label || Object.values(it.translations).find((x) => x.label)?.label || it.resolved?.title || (it.type === "promo" ? String((it.target as { code?: string }).code ?? "") : "") || (it.type === "link" ? host((it.target as { url?: string }).url) : "") || fallback

function host(url: unknown) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function Row({ it, page, onEdit, onQr, onDelete, onToggle, clicks }: { it: AdminItem; page: AdminPage; onEdit: () => void; onQr: () => void; onDelete: () => void; onToggle: (v: boolean) => void; clicks: boolean }) {
  const { t, i18n } = useTranslation()
  const l = lang(i18n.language)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: it.id })
  const Icon = ICONS[it.type]
  const Kind = it.type === "contact" && (it.target as { kind?: string }).kind === "tel" ? Phone : Icon
  const image = it.image ?? it.resolved?.thumbnail ?? null
  const divider = it.type === "divider"
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className="lib-row bg-ui-bg-base px-3 py-2">
      <button ref={setActivatorNodeRef} type="button" className="lib-drag flex items-center justify-center" aria-label={t("lib.item.dragHint")} title={t("lib.item.dragHint")} style={{ minHeight: 44 }} {...attributes} {...listeners}>
        <DotsSix />
      </button>
      <Thumb src={image}>{it.icon && !image ? <span className="text-base">{/^\p{Extended_Pictographic}/u.test(it.icon) ? it.icon : null}</span> : <Kind className="text-ui-fg-muted" />}</Thumb>
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <Text size="small" weight="plus" className={divider ? "text-ui-fg-muted truncate" : "truncate"}>{divider ? "— — —" : itemLabel(it, page, t("lib.untitled"))}</Text>
          {it.style === "featured" && <Badge size="2xsmall">{t("lib.item.featured").split(" ")[0]}</Badge>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <Text size="xsmall" className="text-ui-fg-muted">{t(`lib.item.types.${it.type}`)}</Text>
          {it.visibility !== "live" && <Badge size="2xsmall" color={VIS_COLOR[it.visibility]}>{t(`lib.item.${it.visibility}`)}</Badge>}
          {it.resolved?.missing && <Badge size="2xsmall" color="red">{t("lib.item.missing")}</Badge>}
          {clicks && it.href && <Text size="xsmall" className="text-ui-fg-muted tabular-nums">{t("lib.item.clicks", { count: it.clicks_30d ?? 0 })} · {t("lib.clicks30").toLowerCase()} · {formatNumber(it.clicks_total ?? 0, l)} {t("lib.clicksTotal").toLowerCase()}</Text>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Switch checked={it.enabled} onCheckedChange={onToggle} aria-label={t("lib.item.enabled")} />
        {it.href && (
          <IconButton variant="transparent" size="small" onClick={onQr} aria-label={t("lib.qr.item")} title={t("lib.qr.item")}>
            <span className="text-xs font-semibold">QR</span>
          </IconButton>
        )}
        <IconButton variant="transparent" size="small" onClick={onEdit} aria-label={t("lib.edit")} title={t("lib.edit")}><PencilSquare /></IconButton>
        <IconButton variant="transparent" size="small" onClick={onDelete} aria-label={t("lib.delete")} title={t("lib.delete")}><Trash /></IconButton>
      </div>
    </li>
  )
}

/** The page's items, sortable by drag (pointer or keyboard), with quick toggles */
export function ItemList({ page, items, clicks, onEdit, onQr }: { page: AdminPage; items: AdminItem[]; clicks: boolean; onEdit: (it: AdminItem) => void; onQr: (it: AdminItem) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const prompt = usePrompt()
  const [order, setOrder] = useState(items.map((i) => i.id))
  useEffect(() => setOrder(items.map((i) => i.id)), [items])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const refresh = () => qc.invalidateQueries({ queryKey: pageKey(page.id) })
  const fail = (e: unknown) => {
    const { code } = errorOf(e)
    toast.error(t(code ? `lib.errors.${code}` : "lib.errors.unknown"))
  }
  const reorder = useMutation({ mutationFn: (ids: string[]) => api.reorderItems(page.id, ids), onSuccess: refresh, onError: (e) => { fail(e); refresh() } })
  const toggle = useMutation({ mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.updateItem(page.id, id, { enabled }), onSuccess: refresh, onError: fail })
  const remove = useMutation({ mutationFn: (id: string) => api.deleteItem(page.id, id), onSuccess: () => { toast.success(t("lib.item.deleted")); refresh() }, onError: fail })
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)))
    setOrder(next)
    reorder.mutate(next)
  }
  const byId = new Map(items.map((i) => [i.id, i]))
  const rows = order.map((id) => byId.get(id)).filter((x): x is AdminItem => !!x)
  if (!rows.length) return <Text size="small" className="text-ui-fg-subtle px-6 py-6">{t("lib.item.empty")}</Text>
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col divide-y">
          {rows.map((it) => (
            <Row
              key={it.id}
              it={it}
              page={page}
              clicks={clicks}
              onEdit={() => onEdit(it)}
              onQr={() => onQr(it)}
              onToggle={(v) => toggle.mutate({ id: it.id, enabled: v })}
              onDelete={async () => {
                const ok = await prompt({ title: t("lib.delete"), description: t("lib.item.deleteConfirm"), confirmText: t("lib.delete"), cancelText: t("lib.cancel") })
                if (ok) remove.mutate(it.id)
              }}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
