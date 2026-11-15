import { Spinner } from "@medusajs/icons"
import { Label, Text } from "@medusajs/ui"

export const Loading = () => (
  <div className="flex items-center justify-center p-8">
    <Spinner className="animate-spin text-ui-fg-muted" />
  </div>
)

export const Field = ({ label, hint, children, htmlFor, inline }: { label: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string; inline?: boolean }) => (
  <div className={inline ? "flex items-center justify-between gap-3" : "flex flex-col gap-1"}>
    <div className="flex flex-col">
      <Label size="xsmall" weight="plus" htmlFor={htmlFor}>{label}</Label>
      {hint && inline ? <Text size="xsmall" className="text-ui-fg-muted">{hint}</Text> : null}
    </div>
    {children}
    {hint && !inline ? <Text size="xsmall" className="text-ui-fg-muted">{hint}</Text> : null}
  </div>
)
