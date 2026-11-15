/**
 * Layout rules the plugin needs that the Admin's own stylesheet may not contain (arbitrary grid templates); the
 * utility classes used elsewhere exist because @medusajs/admin-bundler scans the plugin's Admin bundle.
 */
export const LibStyles = () => (
  <style>{`
.lib-cols-editor { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
.lib-cols-2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.lib-row { display: grid; grid-template-columns: 24px 44px minmax(0, 1fr) auto; gap: 12px; align-items: center; }
.lib-bars { display: flex; align-items: flex-end; gap: 2px; height: 48px; }
.lib-bars > span { flex: 1 1 0; min-width: 2px; background: var(--fg-interactive); border-radius: 2px 2px 0 0; opacity: .85; }
.lib-swatch { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border-base); padding: 0; cursor: pointer; }
.lib-swatch::-webkit-color-swatch-wrapper { padding: 0 }
.lib-swatch::-webkit-color-swatch { border: none; border-radius: 6px }
.lib-drag { cursor: grab; touch-action: none; color: var(--fg-muted); }
.lib-drag:active { cursor: grabbing }
.lib-preview { border-radius: 12px; padding: 24px 16px; min-height: 320px; }
.lib-preview a, .lib-preview button { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; text-decoration: none; font: inherit; text-align: left; }
@media (min-width: 1024px) {
  .lib-cols-editor { grid-template-columns: minmax(0, 1fr) 360px; }
  .lib-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`}</style>
)
