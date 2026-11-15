import { Trash } from "@medusajs/icons"
import { Button, IconButton, Input, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { api, errorOf, pageKey, PAGES_KEY, type AdminConfig, type AdminPage, type Focus, type ImageSlot } from "../lib/api"
import { Field } from "./states"

type Props = {
  page: AdminPage
  slot: ImageSlot
  config: AdminConfig | undefined
  /** Current image URL (the form's draft, so a pasted URL shows at once) */
  url: string
  /** Width / height the preview keeps (1 for the avatar) */
  ratio: number
  round?: boolean
  focus?: Focus | null
  onFocus?: (f: Focus) => void
  /** Alt text per locale (not for the QR logo) */
  alt?: Record<string, string>
  onAlt?: (locale: string, v: string) => void
  /** After an upload or a removal: the page as the server returns it */
  onPage: (p: AdminPage) => void
  compact?: boolean
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif"

/**
 * One image of the page: drop zone / file picker, preview with a focal point the admin sets by clicking, alt text
 * per locale, remove. The upload goes straight to the backend (File Module) and replaces the slot's previous file;
 * focus and alt are saved with the form.
 */
export function UploadSlot({ page, slot, config, url, ratio, round, focus, onFocus, alt, onAlt, onPage, compact }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const maxMb = Math.round((config?.upload.max_bytes ?? 5 * 1024 * 1024) / 1024 / 1024)
  const done = (r: { page: AdminPage }) => {
    onPage(r.page)
    qc.setQueryData<{ page: AdminPage; items: unknown[] }>(pageKey(page.id), (old) => (old ? { ...old, page: { ...old.page, ...r.page } } : old))
    qc.invalidateQueries({ queryKey: PAGES_KEY })
  }
  const failed = (e: unknown) => {
    const { code } = errorOf(e)
    toast.error(t(code ? `lib.errors.${code}` : "lib.errors.unknown"))
  }
  const upload = useMutation({ mutationFn: (file: File) => api.upload(page.id, slot, file), onSuccess: (r) => { toast.success(t("lib.upload.uploaded")); done(r) }, onError: failed })
  const remove = useMutation({ mutationFn: () => api.removeUpload(page.id, slot), onSuccess: (r) => { toast.success(t("lib.upload.removed")); done(r) }, onError: failed })
  const pick = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    if (f.size > (config?.upload.max_bytes ?? Infinity)) return toast.error(t("lib.errors.file_too_large"))
    if (!ACCEPT.split(",").includes(f.type)) return toast.error(t("lib.errors.invalid_image"))
    upload.mutate(f)
  }
  const setFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onFocus) return
    const r = e.currentTarget.getBoundingClientRect()
    onFocus({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) })
  }
  const f = focus ?? { x: 50, y: 50 }
  const width = compact ? 120 : round ? 160 : 320
  const busy = upload.isPending || remove.isPending
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start gap-3">
        <div
          className={`lib-drop ${over ? "lib-drop-over" : ""} ${round ? "lib-drop-round" : ""}`}
          style={{ width, aspectRatio: String(ratio) }}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files) }}
        >
          {url ? (
            <button type="button" className="lib-focus" onClick={setFocus} title={onFocus ? t("lib.upload.focusHint") : undefined} aria-label={onFocus ? t("lib.upload.focus") : t("lib.upload.preview")} style={{ cursor: onFocus ? "crosshair" : "default" }}>
              <img src={url} alt="" style={{ objectPosition: `${f.x}% ${f.y}%` }} />
              {onFocus && <span className="lib-focus-dot" style={{ left: `${f.x}%`, top: `${f.y}%` }} aria-hidden="true" />}
            </button>
          ) : (
            <button type="button" className="lib-drop-empty" onClick={() => input.current?.click()} disabled={busy}>
              <Text size="xsmall" className="text-ui-fg-muted text-center">{busy ? t("lib.loading") : t("lib.upload.drop")}</Text>
            </button>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="small" isLoading={upload.isPending} onClick={() => input.current?.click()} style={{ minHeight: 36 }}>{url ? t("lib.upload.replace") : t("lib.upload.choose")}</Button>
            {url && <IconButton type="button" variant="transparent" size="small" aria-label={t("lib.upload.remove")} isLoading={remove.isPending} onClick={() => remove.mutate()} style={{ minHeight: 36, minWidth: 36 }}><Trash /></IconButton>}
          </div>
          <Text size="xsmall" className="text-ui-fg-muted">{t("lib.upload.hint", { mb: maxMb })}</Text>
          {url && onFocus && <Text size="xsmall" className="text-ui-fg-muted">{t("lib.upload.focusHint")}</Text>}
          {url && !page.uploads[slot] && <Text size="xsmall" className="text-ui-fg-muted break-all">{t("lib.upload.external")}</Text>}
        </div>
      </div>
      {alt && onAlt && url && (
        <div className="lib-cols-2">
          {Object.keys(alt).map((l) => (
            <Field key={l} label={`${t("lib.upload.alt")} · ${l}`}>
              <Input maxLength={200} value={alt[l] ?? ""} onChange={(e) => onAlt(l, e.target.value)} style={{ height: 40 }} />
            </Field>
          ))}
        </div>
      )}
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { pick(e.target.files); e.target.value = "" }} />
    </div>
  )
}
