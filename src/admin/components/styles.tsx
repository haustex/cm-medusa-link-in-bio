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
.lib-drop { position: relative; flex: none; max-width: 100%; overflow: hidden; border: 1px dashed var(--border-strong); border-radius: 10px; background: var(--bg-subtle); }
.lib-drop-round { border-radius: 50%; }
.lib-drop-over { border-color: var(--fg-interactive); background: var(--bg-interactive); }
.lib-drop-empty, .lib-focus { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 8px; border: 0; background: transparent; font: inherit; }
.lib-focus img { display: block; width: 100%; height: 100%; object-fit: cover; }
.lib-focus-dot { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.6), inset 0 0 0 1px rgba(0,0,0,.6); pointer-events: none; }
.lib-qr-preview { display: flex; align-items: center; justify-content: center; padding: 16px; border-radius: 12px; background-color: #e5e5e5; background-image: linear-gradient(45deg, #d4d4d4 25%, transparent 25%, transparent 75%, #d4d4d4 75%), linear-gradient(45deg, #d4d4d4 25%, transparent 25%, transparent 75%, #d4d4d4 75%); background-size: 16px 16px; background-position: 0 0, 8px 8px; }
.lib-seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--bg-subtle); border: 1px solid var(--border-base); }
.lib-seg button { min-height: 36px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; font: inherit; color: var(--fg-subtle); cursor: pointer; }
.lib-seg button[aria-pressed="true"] { background: var(--bg-base); color: var(--fg-base); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
@media (min-width: 1024px) {
  .lib-cols-editor { grid-template-columns: minmax(0, 1fr) 360px; }
  .lib-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`}</style>
)
