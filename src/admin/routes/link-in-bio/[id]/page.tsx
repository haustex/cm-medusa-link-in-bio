import { ArrowUpRightOnBox } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { CreditFooter } from "../../../components/credit-footer"
import { ItemForm } from "../../../components/item-form"
import { ItemList } from "../../../components/item-list"
import { PageForm } from "../../../components/page-form"
import { QrDialog } from "../../../components/qr-dialog"
import { Loading } from "../../../components/states"
import { Stats } from "../../../components/stats"
import { LibStyles } from "../../../components/styles"
import { api, CONFIG_KEY, errorOf, pageKey, PAGES_KEY, type AdminItem } from "../../../lib/api"

const PageEditor = () => {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const prompt = usePrompt()
  const { data, isLoading, isError } = useQuery({ queryKey: pageKey(id), queryFn: () => api.getPage(id!), enabled: !!id })
  const { data: config } = useQuery({ queryKey: CONFIG_KEY, queryFn: api.config, staleTime: Infinity })
  const [editing, setEditing] = useState<AdminItem | null | "new">(null)
  const [qr, setQr] = useState<AdminItem | null | "page">(null)
  const remove = useMutation({
    mutationFn: () => api.deletePage(id!),
    onSuccess: () => {
      toast.success(t("lib.page.deleted"))
      qc.invalidateQueries({ queryKey: PAGES_KEY })
      navigate("/link-in-bio")
    },
    onError: (e) => {
      const { code } = errorOf(e)
      toast.error(t(code ? `lib.errors.${code}` : "lib.errors.unknown"))
    },
  })
  if (isLoading) return <Loading />
  if (isError || !data) return <Text size="small" className="text-ui-fg-error px-6 py-4">{t("lib.loadError")}</Text>
  const { page, items } = data
  const publicUrl = page.urls?.[page.default_locale]
  const clicks = config?.clicks !== false
  return (
    <div className="flex flex-col gap-y-3">
      <LibStyles />
      <Link to="/link-in-bio" className="txt-compact-small text-ui-fg-subtle flex items-center gap-1" style={{ minHeight: 32 }}>← {t("lib.back")}</Link>
      <div className="lib-cols-editor">
        <div className="flex flex-col gap-3">
          <Container className="divide-y p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-2">
                  <Heading level="h1" className="truncate">{page.name}</Heading>
                  <Badge size="2xsmall" color={page.published ? "green" : "grey"}>{t(page.published ? "lib.published" : "lib.draft")}</Badge>
                </div>
                {publicUrl ? (
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-1 text-xs">
                    {publicUrl} <ArrowUpRightOnBox />
                  </a>
                ) : (
                  <Text size="xsmall" className="text-ui-fg-muted">{t("lib.page.noStorefront")}</Text>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setQr("page")} style={{ minHeight: 40 }}>{t("lib.qr.title")}</Button>
                <Button onClick={() => setEditing("new")} style={{ minHeight: 40 }}>{t("lib.item.add")}</Button>
              </div>
            </div>
            <ItemList page={page} items={items} clicks={clicks} onEdit={(it) => setEditing(it)} onQr={(it) => setQr(it)} />
          </Container>
          <Stats pageId={page.id} enabled={clicks} />
        </div>
        <div className="flex flex-col gap-3">
          <Container className="p-0">
            <div className="px-6 py-4">
              <Heading level="h2">{t("lib.page.profile")}</Heading>
            </div>
            <PageForm key={page.id} page={page} config={config} />
          </Container>
          <div className="flex justify-end">
            <Button
              variant="danger"
              size="small"
              onClick={async () => {
                const ok = await prompt({ title: t("lib.delete"), description: t("lib.page.deleteConfirm"), confirmText: t("lib.delete"), cancelText: t("lib.cancel") })
                if (ok) remove.mutate()
              }}
              style={{ minHeight: 36 }}
            >
              {t("lib.delete")}
            </Button>
          </div>
        </div>
      </div>
      {editing !== null && <ItemForm key={editing === "new" ? "new" : editing.id} page={page} item={editing === "new" ? null : editing} config={config} open onClose={() => setEditing(null)} />}
      {qr !== null && <QrDialog page={page} item={qr === "page" ? null : qr} config={config} open onClose={() => setQr(null)} onPage={(p) => qc.setQueryData<typeof data>(pageKey(id), (old) => (old ? { ...old, page: { ...old.page, ...p } } : old))} />}
      <CreditFooter />
    </div>
  )
}

export const handle = { breadcrumb: () => "Link in bio" }
export default PageEditor
