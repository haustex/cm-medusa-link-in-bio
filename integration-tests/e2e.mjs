// End-to-end check of the plugin inside a real Medusa app (integration-tests/app): fresh database, migrations,
// server on port 9700, then the Admin API (pages, items, reorder, QR, search, stats), the Store API (page per
// locale, product price + stock, UTM, scheduling) and the counting redirect /l/{key} (bots, DNT, dead links,
// rate limit).
//
// Usage (plugin built first with `npm run build`):
//   docker run -d --name rw-spike-pg -e POSTGRES_PASSWORD=spike -e POSTGRES_DB=rw_spike -p 127.0.0.1:55436:5432 postgres:17-alpine
//   node integration-tests/e2e.mjs
//
// LIB_PG_CONTAINER: name of the Postgres container (default rw-spike-pg). LIB_KEEP=1 keeps the server running.
// LIB_ADMIN=1 also builds the Admin and checks the bundle. Every medusa command goes through scripts/guard.mjs.
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN_DIR = path.resolve(HERE, "..")
const APP_DIR = path.join(HERE, "app")
const STATE_DIR = path.join(HERE, ".state")
const GUARD = path.join(PLUGIN_DIR, "scripts/guard.mjs")
const MEDUSA = path.join(PLUGIN_DIR, "node_modules/.bin/medusa")
const NPM = process.platform === "win32" ? "npm.cmd" : "npm"
const PACKAGE = "medusa-link-in-bio"

const DB_NAME = "lib_e2e"
const PG_CONTAINER = process.env.LIB_PG_CONTAINER || "rw-spike-pg"
const PORT = 9700
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN = { email: "admin@e2e.test", password: "e2e-password-123" }
const KEEP = process.env.LIB_KEEP === "1"
const RATE_MAX = 400
const HOOK_PORT = 9701

const env = {
  ...process.env,
  DATABASE_URL: `postgres://postgres:spike@127.0.0.1:55436/${DB_NAME}`,
  REDIS_URL: "redis://127.0.0.1:56383",
  PORT: String(PORT),
  LIB_PLUGIN_DIR: PACKAGE,
  LIB_CREDIT: "1",
  LIB_RATE_MAX: String(RATE_MAX),
  LIB_REVALIDATE_URL: `http://127.0.0.1:${HOOK_PORT}/api/revalidate`,
  NODE_ENV: "development",
}
// REDIS_URL only satisfies the guard; the test app uses the in-memory event bus and workflow engine

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: APP_DIR, env, stdio: "inherit", ...opts })
  if (r.status !== 0) throw new Error(`failed: ${cmd} ${args.join(" ")}`)
}
const guarded = (...args) => run("node", [GUARD, MEDUSA, ...args])

/** The only paths this script ever removes: non-empty, absolute, inside integration-tests/ (never the plugin, never /) */
function inside(p) {
  if (!p || !path.isAbsolute(p) || !p.startsWith(HERE + path.sep) || p === HERE) throw new Error(`refusing to remove ${JSON.stringify(p)}: not inside ${HERE}`)
  return p
}
const rmGuarded = (p) => fs.rmSync(inside(p), { recursive: true, force: true })

/** The app gets the plugin the way a user does: the `npm pack` tarball unpacked into app/node_modules */
function installPlugin() {
  const target = path.join(APP_DIR, "node_modules")
  rmGuarded(target)
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(path.join(PLUGIN_DIR, "node_modules"))) {
    if ([".package-lock.json", ".cache", ".vite", ".bin", PACKAGE].includes(entry)) continue
    fs.symlinkSync(path.join(PLUGIN_DIR, "node_modules", entry), path.join(target, entry))
  }
  const pack = spawnSync(NPM, ["pack", "--ignore-scripts", "--json", "--pack-destination", STATE_DIR], { cwd: PLUGIN_DIR, encoding: "utf8" })
  if (pack.status !== 0) throw new Error(`npm pack failed: ${pack.stderr}`)
  const tgz = path.join(STATE_DIR, JSON.parse(pack.stdout)[0].filename)
  const dest = path.join(target, PACKAGE)
  fs.mkdirSync(dest)
  run("tar", ["-xzf", tgz, "-C", dest, "--strip-components=1"])
  const selfLink = path.join(PLUGIN_DIR, "node_modules", PACKAGE)
  let stat
  try {
    stat = fs.lstatSync(selfLink)
  } catch {}
  if (stat && !stat.isSymbolicLink()) throw new Error(`${selfLink} exists and is not a symlink from an earlier run; remove it by hand`)
  if (stat) fs.unlinkSync(selfLink)
  fs.symlinkSync(dest, selfLink)
}

/** After `medusa build` with the Admin: the bundler could resolve the package */
function checkAdminBuild(serverDir) {
  section("admin build")
  const bundlerPkg = fs.realpathSync(path.join(PLUGIN_DIR, "node_modules/@medusajs/admin-bundler/package.json"))
  let resolved
  try {
    resolved = createRequire(bundlerPkg).resolve(`${PACKAGE}/admin`)
  } catch (e) {
    resolved = String(e.code || e)
  }
  const installed = path.join(APP_DIR, "node_modules", PACKAGE)
  check(`@medusajs/admin-bundler resolves ${PACKAGE}/admin to the installed package`, resolved.startsWith(installed + path.sep), resolved)
  const assets = path.join(serverDir, "public/admin/assets")
  const js = fs.readdirSync(assets).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n")
  check("Admin bundle contains the plugin's route and strings", /link-in-bio/.test(js) && /Link in bio/.test(js))
}

function psql(sql, db) {
  if (!db) {
    run("docker", ["exec", PG_CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql])
    return ""
  }
  const out = spawnSync("docker", ["exec", PG_CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { encoding: "utf8" })
  if (out.status !== 0) throw new Error(`psql failed: ${out.stderr}`)
  return out.stdout.trim()
}

async function waitForPostgres() {
  const started = Date.now()
  let last = ""
  while (Date.now() - started < 60_000) {
    const q = spawnSync("docker", ["exec", PG_CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-tAc", "select 1"], { encoding: "utf8" })
    if (q.status === 0 && q.stdout.trim() === "1") return
    last = (q.stderr || q.stdout).trim()
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Postgres container "${PG_CONTAINER}" not ready after 60 s (last: ${last || "no answer"}).`)
}

let failures = 0
let passes = 0
function check(name, ok, detail) {
  if (ok) passes++
  else failures++
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${ok || detail === undefined ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 900)}`}`)
}
const section = (t) => console.log(`\n${t}`)

const ctx = { admin: {}, pk: null, serverDir: APP_DIR }
const BROWSER_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

/** store: publishable key; raw: no JSON */
async function api(method, url, { body, headers = {}, store = false, admin = true, redirect = "manual" } = {}) {
  const h = { ...headers }
  if (body !== undefined) h["content-type"] = "application/json"
  if (store && ctx.pk) h["x-publishable-api-key"] = ctx.pk
  else if (!store && admin && ctx.admin.authorization) h.authorization = ctx.admin.authorization
  const res = await fetch(BASE + url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect })
  const buf = Buffer.from(await res.arrayBuffer())
  const text = buf.toString("utf8")
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json, text, buf, headers: res.headers }
}

/** Multipart upload of one image into a page slot (the Admin sends the same request through the SDK) */
async function upload(pageId, slot, buf, filename, type = "application/octet-stream") {
  const form = new FormData()
  form.append("file", new Blob([buf], { type }), filename)
  const res = await fetch(`${BASE}/admin/link-in-bio/pages/${pageId}/upload?slot=${slot}`, { method: "POST", headers: { authorization: ctx.admin.authorization }, body: form })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json }
}
const require_ = createRequire(import.meta.url)
const sharp = require_(path.join(PLUGIN_DIR, "node_modules/sharp"))
const jsQR = require_(path.join(PLUGIN_DIR, "node_modules/jsqr"))
/** Test images straight from sharp: the same 64×48 picture in four formats */
async function images() {
  const base = sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 200, g: 60, b: 30, alpha: 1 } } })
  return { png: await base.clone().png().toBuffer(), jpg: await base.clone().jpeg().toBuffer(), webp: await base.clone().webp().toBuffer(), avif: await base.clone().avif().toBuffer() }
}
async function decodeQr(png, inverted) {
  const { data, info } = await sharp(png).flatten({ background: inverted ? "#000000" : "#ffffff" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, { inversionAttempts: inverted ? "attemptBoth" : "dontInvert" })?.data ?? null
}
/** Where the test app's local File Module provider writes public files */
const staticFile = (url) => path.join(ctx.serverDir, "static", path.basename(new URL(url).pathname))

async function login() {
  const auth = await api("POST", "/auth/user/emailpass", { body: ADMIN, admin: false })
  if (!auth.json?.token) throw new Error(`login failed: ${JSON.stringify(auth.json)}`)
  ctx.admin = { authorization: `Bearer ${auth.json.token}` }
}

async function fail(name, r) {
  check(name, false, r.json ?? r)
  throw new Error(`setup failed at: ${name}`)
}

/** Publishable key, a USD region, a stock location, two products (one with managed stock) and a collection */
async function setupStore() {
  const sc = (await api("GET", "/admin/sales-channels")).json.sales_channels[0]
  const key = (await api("POST", "/admin/api-keys", { body: { title: "e2e", type: "publishable" } })).json.api_key
  await api("POST", `/admin/api-keys/${key.id}/sales-channels`, { body: { add: [sc.id] } })
  ctx.pk = key.token
  let r = await api("POST", "/admin/regions", { body: { name: "US", currency_code: "usd", countries: ["us"] } })
  if (!r.json.region) await fail("region", r)
  const region = r.json.region
  r = await api("POST", "/admin/stock-locations", { body: { name: "Jepara" } })
  const location = r.json.stock_location
  await api("POST", `/admin/stock-locations/${location.id}/sales-channels`, { body: { add: [sc.id] } })
  const mk = async (title, managed, price) => {
    const res = await api("POST", "/admin/products", { body: { title, status: "published", sales_channels: [{ id: sc.id }], options: [{ title: "Size", values: ["One"] }], variants: [{ title: "One", options: { Size: "One" }, manage_inventory: managed, prices: [{ currency_code: "usd", amount: price }] }] } })
    if (!res.json.product) await fail(`product ${title}`, res)
    return res.json.product
  }
  const product = await mk("Teak chopping board", false, 20)
  const product2 = await mk("Teak tray", true, 45)
  // stock for product2: inventory item + level at the location
  r = await api("GET", `/admin/products/${product2.id}?fields=variants.inventory_items.inventory_item_id`)
  const invId = r.json.product.variants[0].inventory_items?.[0]?.inventory_item_id
  if (invId) await api("POST", `/admin/inventory-items/${invId}/location-levels`, { body: { location_id: location.id, stocked_quantity: 7 } })
  r = await api("POST", "/admin/collections", { body: { title: "Kitchen", handle: "kitchen" } })
  const collection = r.json.collection
  r = await api("POST", "/admin/product-categories", { body: { name: "Boards", handle: "boards", is_active: true } })
  const category = r.json.product_category
  return { sc, region, product, product2, collection, category }
}

const flush = () => api("POST", "/admin/e2e/flush", { body: {} })

/** Stand-in for the storefront's revalidate endpoint */
const hooks = []
function startHookServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let data = ""
      req.on("data", (c) => (data += c))
      req.on("end", () => {
        let body
        try {
          body = JSON.parse(data)
        } catch {
          body = data
        }
        hooks.push({ url: req.url, secret: req.headers["x-revalidate-secret"], body })
        res.writeHead(200, { "content-type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
      })
    })
    server.listen(HOOK_PORT, "127.0.0.1", () => resolve(server))
  })
}
async function waitHook(pred, ms = 4000) {
  const started = Date.now()
  while (Date.now() - started < ms) {
    const hit = hooks.find(pred)
    if (hit) return hit
    await new Promise((r) => setTimeout(r, 100))
  }
  return null
}

async function checks() {
  await login()
  const store = await setupStore()

  section("Config")
  let r = await api("GET", "/admin/link-in-bio/config")
  check("config: credit on (test app), no blog, storefront + redirect template, networks, revalidate", r.status === 200 && r.json.show_credit === true && r.json.blog === false && r.json.storefront_url === "https://storefront.e2e.test" && r.json.redirect_url === "https://storefront.e2e.test/l/{key}" && r.json.networks.includes("instagram") && r.json.revalidate === true, r.json)

  section("Pages")
  r = await api("GET", "/admin/link-in-bio/pages")
  check("no pages yet", r.status === 200 && r.json.pages.length === 0, r.json)
  r = await api("POST", "/admin/link-in-bio/pages", { body: { name: "Haus Kayu", handle: "Links", locales: ["id", "en", "ID"], translations: { id: { title: "// Haus Kayu", bio: "Furnitur jati dari Jepara" }, en: { title: "Haus Kayu", bio: "Teak furniture from Jepara" } }, socials: [{ network: "instagram", url: "https://instagram.com/hauskayu" }, { network: "tiktok", url: "javascript:alert(1)" }, { network: "email", url: "halo@hauskayu.com" }], theme: { background: "#FFF", text: "#0c0c0c", accent: "#0C0C0C", radius: "md" } } })
  check("page created: handle lower-cased, locales deduped (id default), bad social dropped, email → mailto, theme cleaned", r.status === 201 && r.json.page.handle === "links" && r.json.page.locales.join() === "id,en" && r.json.page.default_locale === "id" && r.json.page.socials.length === 2 && r.json.page.socials[1].url === "mailto:halo@hauskayu.com" && r.json.page.theme.background === "#ffffff" && r.json.page.published === false, r.json)
  const page = r.json.page
  check("public urls per locale from storefront options (en under /us, main handle at /links)", page.urls.id === "https://storefront.e2e.test/links" && page.urls.en === "https://storefront.e2e.test/us/links", page.urls)
  r = await api("POST", "/admin/link-in-bio/pages", { body: { name: "Dup", handle: "links" } })
  check("duplicate handle → 409", r.status === 409 && r.json.code === "handle_taken", r.json)
  r = await api("POST", "/admin/link-in-bio/pages", { body: { name: "Admin", handle: "admin" } })
  check("reserved handle refused", r.status === 400 && r.json.code === "reserved_handle", r.json)
  r = await api("POST", "/admin/link-in-bio/pages", { body: { name: "", handle: "x" } })
  check("name required", r.status === 400, r.json)
  r = await api("POST", "/admin/link-in-bio/pages", { body: { name: "Campaign", handle: "ramadan-2026", locales: ["en"], published: true, avatar: "ftp://x" } })
  check("bad avatar URL refused", r.status === 400 && r.json.code === "invalid_url", r.json)
  r = await api("POST", "/admin/link-in-bio/pages", { body: { name: "Campaign", handle: "ramadan-2026", locales: ["en"], published: true } })
  const page2 = r.json.page
  check("second page (published, en only) with its own address (en still under /us: storefront routing)", r.status === 201 && page2.urls.en === "https://storefront.e2e.test/us/links/ramadan-2026" && page2.translations.en.title === "Campaign", r.json)
  r = await api("POST", `/admin/link-in-bio/pages/${page.id}`, { body: { translations: { fr: { title: "Bonjour" } } } })
  check("translation in a locale the page does not have → 400", r.status === 400 && r.json.code === "invalid_locale", r.json)
  r = await api("POST", `/admin/link-in-bio/pages/${page.id}`, { body: { utm_campaign: "bio", noindex: true, translations: { en: { seo_title: "Haus Kayu — links" } } } })
  check("page updated (utm_campaign, noindex, en seo_title)", r.status === 200 && r.json.page.utm_campaign === "bio" && r.json.page.noindex === true && r.json.page.translations.en.seo_title === "Haus Kayu — links" && r.json.page.translations.id.bio === "Furnitur jati dari Jepara", r.json)
  let hook = await waitHook((h) => h.body?.link_in_bio?.handles?.includes("links"))
  check("page changes → one batched revalidate call { link_in_bio: { handles } } with the secret", !!hook && hook.secret === "e2e-revalidate" && hook.url === "/api/revalidate" && hook.body.link_in_bio.handles.includes("ramadan-2026"), hooks)
  hooks.length = 0

  section("Items")
  const add = (body) => api("POST", `/admin/link-in-bio/pages/${page.id}/items`, { body })
  r = await add({ type: "link", target: { url: "javascript:alert(1)" } })
  check("javascript: link refused", r.status === 400 && r.json.code === "invalid_url", r.json)
  r = await add({ type: "link", target: { url: "data:text/html,hi" } })
  check("data: link refused", r.status === 400, r.json)
  r = await add({ type: "link", target: { url: "https://instagram.com/hauskayu?utm_source=ig" }, translations: { id: { label: "Instagram" }, en: { label: "Instagram" } }, icon: "instagram" })
  check("link item created with a key and href", r.status === 201 && /^[23456789a-zA-Z]{8}$/.test(r.json.item.key) && r.json.item.href === `https://storefront.e2e.test/l/${r.json.item.key}` && r.json.item.visibility === "live", r.json)
  const ig = r.json.item
  r = await add({ type: "product", target: { product_id: store.product.id }, style: "featured" })
  check("product item (label empty → product title later)", r.status === 201 && r.json.item.type === "product" && r.json.item.style === "featured", r.json)
  const prodItem = r.json.item
  r = await add({ type: "product", target: { product_id: store.product2.id } })
  const prodItem2 = r.json.item
  r = await add({ type: "product", target: { product_id: "prod_gone" } })
  const ghost = r.json.item
  r = await add({ type: "collection", target: { collection_id: store.collection.id } })
  const coll = r.json.item
  r = await add({ type: "category", target: { category_id: store.category.id } })
  const cat = r.json.item
  r = await add({ type: "promo", target: { code: " hemat 10 " }, translations: { id: { label: "Diskon 10%" } } })
  check("promo item: code cleaned", r.status === 201 && r.json.item.target.code === "HEMAT10" && r.json.item.target.url === null, r.json)
  const promo = r.json.item
  r = await add({ type: "promo", target: { code: "WELCOME", url: "https://storefront.e2e.test/?discount=WELCOME" } })
  const promo2 = r.json.item
  r = await add({ type: "whatsapp", target: { phone: "+62 851-1166-3330", text: "Halo Haus Kayu" }, translations: { id: { label: "Chat WhatsApp" } } })
  check("whatsapp item: phone digits", r.status === 201 && r.json.item.target.phone === "6285111663330", r.json)
  const wa = r.json.item
  r = await add({ type: "contact", target: { kind: "mailto", value: "halo@hauskayu.com" } })
  const mail = r.json.item
  r = await add({ type: "header", translations: { id: { label: "Belanja" }, en: { label: "Shop" } } })
  check("header item has no href", r.status === 201 && r.json.item.href === null && r.json.item.utm === null, r.json)
  const header = r.json.item
  r = await add({ type: "divider" })
  const divider = r.json.item
  r = await add({ type: "post", target: { latest: true } })
  check("post item accepted even without medusa-blog-seo", r.status === 201 && r.json.item.target.latest === true, r.json)
  const post = r.json.item
  const inOneHour = new Date(Date.now() + 3600_000).toISOString()
  const anHourAgo = new Date(Date.now() - 3600_000).toISOString()
  r = await add({ type: "link", target: { url: "https://example.com/soon" }, starts_at: inOneHour })
  check("scheduled item", r.status === 201 && r.json.item.visibility === "scheduled", r.json)
  const soon = r.json.item
  r = await add({ type: "link", target: { url: "https://example.com/gone" }, ends_at: anHourAgo })
  check("expired item", r.status === 201 && r.json.item.visibility === "expired", r.json)
  const gone = r.json.item
  r = await add({ type: "link", target: { url: "https://example.com/off" }, enabled: false })
  const off = r.json.item
  r = await add({ type: "link", target: { url: "https://example.com/x" }, starts_at: inOneHour, ends_at: anHourAgo })
  check("end before start refused", r.status === 400 && r.json.code === "invalid_date", r.json)
  r = await add({ type: "whatsapp", target: { phone: "12" } })
  check("bad phone refused", r.status === 400 && r.json.code === "invalid_target", r.json)
  r = await add({ type: "link", target: { url: "https://example.com/top" }, rank: 0, translations: { id: { label: "Teratas" } } })
  check("insert at rank 0", r.status === 201 && r.json.item.rank === 0, r.json)
  const top = r.json.item
  r = await api("GET", `/admin/link-in-bio/pages/${page.id}`)
  check("page view: items in order, resolved titles, ghost product flagged missing", r.status === 200 && r.json.items[0].id === top.id && r.json.items[1].id === ig.id && r.json.items.find((i) => i.id === prodItem.id).resolved.title === "Teak chopping board" && r.json.items.find((i) => i.id === ghost.id).resolved.missing === true && r.json.items.find((i) => i.id === coll.id).resolved.title === "Kitchen" && r.json.page.item_count === r.json.items.length, r.json.items.map((i) => [i.rank, i.type, i.resolved?.title]))
  r = await api("POST", `/admin/link-in-bio/pages/${page.id}/items/reorder`, { body: { ids: [ig.id, prodItem.id, top.id] } })
  check("reorder: listed ids first, rest keep their order, ranks 0..n-1", r.status === 200 && r.json.items.slice(0, 3).map((i) => i.id).join() === [ig.id, prodItem.id, top.id].join() && r.json.items.every((i, idx) => i.rank === idx), r.json.items.map((i) => [i.rank, i.type]))
  r = await api("POST", `/admin/link-in-bio/pages/${page.id}/items/reorder`, { body: { ids: ["libit_nope"] } })
  check("reorder with a foreign id → 404", r.status === 404, r.json)
  r = await api("POST", `/admin/link-in-bio/pages/${page.id}/items/${ig.id}`, { body: { type: "product" } })
  check("type cannot change", r.status === 400, r.json)
  r = await api("POST", `/admin/link-in-bio/pages/${page.id}/items/${ig.id}`, { body: { utm: false, translations: { en: { note: "Daily posts" } } } })
  check("item updated (utm off, en note)", r.status === 200 && r.json.item.utm === false && r.json.item.translations.en.note === "Daily posts" && r.json.item.translations.id.label === "Instagram", r.json)
  r = await api("DELETE", `/admin/link-in-bio/pages/${page.id}/items/${top.id}`)
  check("item deleted, ranks renumbered", r.status === 200 && (await api("GET", `/admin/link-in-bio/pages/${page.id}/items`)).json.items.every((i, idx) => i.rank === idx), r.json)
  hook = await waitHook((h) => h.body?.link_in_bio?.handles?.includes("links"))
  check("item changes → revalidate for the page's handle", !!hook, hooks)
  hooks.length = 0
  r = await api("GET", `/admin/link-in-bio/pages/${page2.id}/items/${ig.id}`)
  check("item of another page → 404", r.status === 404, r.json)

  section("Search")
  r = await api("GET", "/admin/link-in-bio/search?type=product&q=tray")
  check("product search", r.status === 200 && r.json.results.length === 1 && r.json.results[0].title === "Teak tray", r.json)
  r = await api("GET", "/admin/link-in-bio/search?type=collection")
  check("collection search (no q)", r.json.results.some((c) => c.handle === "kitchen"), r.json)
  r = await api("GET", "/admin/link-in-bio/search?type=post")
  check("post search without blog → empty", r.status === 200 && r.json.results.length === 0, r.json)
  r = await api("GET", "/admin/link-in-bio/search?type=nope")
  check("unknown type → 400", r.status === 400, r.json)

  section("Store: unpublished")
  r = await api("GET", "/store/link-in-bio/pages", { store: true })
  check("pages list: only the published one", r.status === 200 && r.json.pages.length === 1 && r.json.pages[0].handle === "ramadan-2026", r.json)
  r = await api("GET", "/store/link-in-bio/pages/links", { store: true })
  check("unpublished page → 404", r.status === 404, r.json)
  r = await api("GET", `/l/${ig.key}`, { admin: false })
  check("redirect of an unpublished page → 410", r.status === 410, r.json)
  r = await api("GET", "/store/link-in-bio/pages/links")
  check("store route needs the publishable key", r.status === 400 || r.status === 401, r.status)

  section("Store: published page")
  await api("POST", `/admin/link-in-bio/pages/${page.id}`, { body: { published: true } })
  r = await api("GET", `/store/link-in-bio/pages/links?region_id=${store.region.id}`, { store: true })
  check("page in the default locale (id): title, bio, theme, socials, urls, noindex header", r.status === 200 && r.json.page.locale === "id" && r.json.page.title === "// Haus Kayu" && r.json.page.theme.background === "#ffffff" && r.json.page.socials.length === 2 && r.json.page.urls.en === "https://storefront.e2e.test/us/links" && r.json.page.noindex === true && r.headers.get("x-robots-tag") === "noindex", r.json)
  const P = r.json.page
  const types = P.items.map((i) => i.type)
  check("hidden, scheduled, expired, ghost product and (bloglesss) post items are left out", !P.items.some((i) => [soon.id, gone.id, off.id, ghost.id, post.id].includes(i.id)), types)
  check("order kept: instagram, product, …", P.items[0].id === ig.id && P.items[1].id === prodItem.id, P.items.map((i) => i.type))
  const pi = P.items.find((i) => i.id === prodItem.id)
  check("product: title as label, price in USD (lowest variant), in stock (unmanaged), featured", pi && pi.label === "Teak chopping board" && pi.product.price.amount === 20 && pi.product.price.currency_code === "usd" && pi.product.in_stock === true && pi.product.stock === null && pi.style === "featured", pi)
  const pi2 = P.items.find((i) => i.id === prodItem2.id)
  check("product with managed stock: stock 7 for the key's sales channel", pi2 && pi2.product.stock === 7 && pi2.product.in_stock === true && pi2.product.price.amount === 45, pi2)
  check("product url: storefront product page with UTM (campaign from the page, content = key)", pi.url === `https://storefront.e2e.test/products/${store.product.handle}?utm_source=link-in-bio&utm_medium=social&utm_campaign=bio&utm_content=${prodItem.key}` && pi.href === `https://storefront.e2e.test/l/${prodItem.key}`, pi)
  const igi = P.items.find((i) => i.id === ig.id)
  check("link with its own utm + item utm off: untouched; label from translation", igi.url === "https://instagram.com/hauskayu?utm_source=ig" && igi.label === "Instagram" && igi.note === null, igi)
  const ci = P.items.find((i) => i.id === coll.id)
  check("collection: title + url", ci.label === "Kitchen" && ci.url.startsWith("https://storefront.e2e.test/collections/kitchen?utm_"), ci)
  const cati = P.items.find((i) => i.id === cat.id)
  check("category: name + url", cati.label === "Boards" && cati.url.startsWith("https://storefront.e2e.test/categories/boards?utm_"), cati)
  const pr = P.items.find((i) => i.id === promo.id)
  check("promo without link: code, no href/url", pr.promo.code === "HEMAT10" && pr.href === null && pr.url === null && pr.label === "Diskon 10%", pr)
  const pr2 = P.items.find((i) => i.id === promo2.id)
  check("promo with link: href + url with utm", pr2.href !== null && pr2.url.includes("discount=WELCOME") && pr2.url.includes("utm_campaign=bio"), pr2)
  const wai = P.items.find((i) => i.id === wa.id)
  check("whatsapp: wa.me link with text, no utm", wai.url === "https://wa.me/6285111663330?text=Halo+Haus+Kayu" && wai.whatsapp.phone === "6285111663330", wai)
  const mi = P.items.find((i) => i.id === mail.id)
  check("contact: mailto, label = address", mi.url === "mailto:halo@hauskayu.com" && mi.label === "halo@hauskayu.com", mi)
  const hi = P.items.find((i) => i.id === header.id)
  check("header: label, no href; divider present", hi.label === "Belanja" && hi.href === null && P.items.some((i) => i.id === divider.id), hi)
  r = await api("GET", `/store/link-in-bio/pages/links?locale=en-GB`, { store: true })
  check("en-GB → en: en title, en labels, note; untranslated label falls back to id", r.json.page.locale === "en" && r.json.page.title === "Haus Kayu" && r.json.page.seo_title === "Haus Kayu — links" && r.json.page.items.find((i) => i.id === header.id).label === "Shop" && r.json.page.items.find((i) => i.id === ig.id).note === "Daily posts" && r.json.page.items.find((i) => i.id === promo.id).label === "Diskon 10%", r.json.page.items.map((i) => i.label))
  check("en urls under /us; product without region_id has no price", r.json.page.items.find((i) => i.id === prodItem.id).url.startsWith("https://storefront.e2e.test/us/products/") && r.json.page.items.find((i) => i.id === prodItem.id).product.price === null, r.json.page.items.find((i) => i.id === prodItem.id))
  r = await api("GET", `/store/link-in-bio/pages/links`, { store: true, headers: { "x-medusa-locale": "en" } })
  check("x-medusa-locale header honoured", r.json.page.locale === "en", r.json.page.locale)
  r = await api("GET", `/store/link-in-bio/pages/LINKS?locale=xx`, { store: true })
  check("handle case-insensitive; unknown locale → default", r.status === 200 && r.json.page.locale === "id", r.json.page?.locale)
  r = await api("GET", "/store/link-in-bio/pages", { store: true })
  check("pages list now has both", r.json.pages.length === 2 && r.json.pages.find((p) => p.handle === "links").locales.join() === "id,en", r.json)

  section("Redirect /l/{key}")
  const go = (key, headers = {}, q = "") => api("GET", `/l/${key}${q}`, { admin: false, headers: { "user-agent": BROWSER_UA, ...headers } })
  r = await go(prodItem.key)
  check("302 to the product page with UTM, no-store, noindex", r.status === 302 && r.headers.get("location") === pi.url && /no-store/.test(r.headers.get("cache-control")) && r.headers.get("x-robots-tag") === "noindex", { status: r.status, location: r.headers.get("location") })
  r = await go(prodItem.key, {}, "?l=en")
  check("?l=en → the /us product page", r.status === 302 && r.headers.get("location").startsWith("https://storefront.e2e.test/us/products/"), r.headers.get("location"))
  r = await go(ig.key)
  check("instagram link: 302 to the stored URL untouched", r.status === 302 && r.headers.get("location") === "https://instagram.com/hauskayu?utm_source=ig", r.headers.get("location"))
  r = await go(wa.key)
  check("whatsapp: 302 to wa.me", r.status === 302 && r.headers.get("location").startsWith("https://wa.me/6285111663330"), r.headers.get("location"))
  r = await go(mail.key)
  check("contact: 302 to mailto:", r.status === 302 && r.headers.get("location") === "mailto:halo@hauskayu.com", r.headers.get("location"))
  r = await go(promo.key)
  check("promo without link → 410", r.status === 410, r.status)
  r = await go(header.key)
  check("header → 410 (nothing to open)", r.status === 410, r.status)
  r = await go(off.key)
  check("hidden item → 410", r.status === 410, r.status)
  r = await go(soon.key)
  check("scheduled item → 410", r.status === 410, r.status)
  r = await go(gone.key)
  check("expired item → 410", r.status === 410, r.status)
  r = await go(ghost.key)
  check("product that no longer exists → 410", r.status === 410, r.status)
  r = await go("nope1234")
  check("unknown key → 404", r.status === 404, r.status)
  r = await go("bad-key!")
  check("junk key → 404", r.status === 404, r.status)
  r = await go(prodItem.key, { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" })
  check("bot: still redirected", r.status === 302, r.status)
  r = await go(prodItem.key, { dnt: "1" })
  check("DNT: still redirected", r.status === 302, r.status)
  r = await go(prodItem.key, { "sec-gpc": "1" })
  check("GPC: still redirected", r.status === 302, r.status)
  r = await api("GET", `/l/${prodItem.key}`, { admin: false, redirect: "manual" })
  check("no user agent: redirected", r.status === 302, r.status)
  await go(ig.key)
  await go(ig.key)

  section("Clicks")
  r = await flush()
  check("flush wrote buffered counts", r.status === 200, r.json)
  r = await api("GET", `/admin/link-in-bio/pages/${page.id}/stats?days=7`)
  const s = r.json.stats
  check("stats: product 2 (browser + ?l=en; bot, DNT, GPC, empty UA not counted), instagram 3, whatsapp 1, mail 1 → page 7", s && s.items[prodItem.id]?.clicks_total === 2 && s.items[ig.id]?.clicks_total === 3 && s.items[wa.id]?.clicks_total === 1 && s.items[mail.id]?.clicks_total === 1 && s.clicks_total === 7 && s.clicks_7d === 7 && s.days.length === 7 && s.days.at(-1).count === 7, s)
  check("no personal data stored: only item_id, day, count", psql("select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_name = 'lib_click_day'", DB_NAME) === "count,created_at,day,deleted_at,id,item_id,page_id,updated_at", null)
  r = await api("GET", `/admin/link-in-bio/pages/${page.id}`)
  check("page view carries per-item counts", r.json.items.find((i) => i.id === ig.id).clicks_total === 3 && r.json.page.clicks_7d === 7, r.json.items.map((i) => [i.type, i.clicks_total]))
  r = await api("GET", "/admin/link-in-bio/pages")
  check("pages list carries 7/30-day counts", r.json.pages.find((p) => p.id === page.id).clicks_30d === 7 && r.json.pages.find((p) => p.id === page2.id).clicks_30d === 0, r.json.pages.map((p) => [p.handle, p.clicks_30d]))

  section("Uploads (avatar, hero, QR logo through the File Module)")
  const img = await images()
  r = await api("GET", `/admin/link-in-bio/pages/${page.id}`)
  check("page starts with circle style, no hero, nothing uploaded", r.json.page.profile_style === "circle" && r.json.page.hero === null && r.json.page.hero_ratio === "16:9" && r.json.page.uploads.avatar === false && r.json.page.focus.avatar === null, r.json.page)
  r = await upload(page.id, "avatar", img.png, "avatar.png", "image/png")
  check("PNG avatar uploaded: URL set (local provider: /static/{stamp}-lib-{handle}-avatar-{id}.png), marked as an upload", r.status === 200 && /^http:\/\/127\.0\.0\.1:9700\/static\/\d+-lib-links-avatar-[0-9a-f]{8}\.png$/.test(r.json.page.avatar ?? "") && r.json.page.uploads.avatar === true, r.json)
  const avatar1 = r.json.page.avatar
  check("…the file exists where the File Module put it", !!avatar1 && fs.existsSync(staticFile(avatar1)), avatar1 && staticFile(avatar1))
  r = await upload(page.id, "avatar", img.jpg, "photo.PNG", "image/png")
  check("JPEG bytes named .png: stored as .jpg (magic bytes, not the name); the previous avatar file is deleted", r.status === 200 && /\.jpg$/.test(r.json.page.avatar) && !fs.existsSync(staticFile(avatar1)), { avatar: r.json.page.avatar, oldExists: fs.existsSync(staticFile(avatar1)) })
  const avatar2 = r.json.page.avatar
  r = await upload(page.id, "hero", img.webp, "hero.webp", "image/webp")
  check("WebP hero uploaded", r.status === 200 && /\.webp$/.test(r.json.page.hero) && r.json.page.uploads.hero === true, r.json)
  r = await upload(page.id, "qr_logo", img.avif, "logo.avif", "image/avif")
  check("AVIF QR logo uploaded", r.status === 200 && /\.avif$/.test(r.json.page.qr_logo) && r.json.page.uploads.qr_logo === true, r.json)
  const qrLogo = r.json.page.qr_logo
  r = await upload(page.id, "avatar", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "logo.svg", "image/svg+xml")
  check("SVG refused (400 invalid_image)", r.status === 400 && r.json.code === "invalid_image", r.json)
  r = await upload(page.id, "avatar", Buffer.from("GIF89a" + "\0".repeat(40)), "a.gif", "image/gif")
  check("GIF refused", r.status === 400 && r.json.code === "invalid_image", r.json)
  r = await upload(page.id, "avatar", Buffer.concat([img.png, Buffer.alloc(5 * 1024 * 1024)]), "big.png", "image/png")
  check("over 5 MB → 413 file_too_large", r.status === 413 && r.json.code === "file_too_large", r.json)
  r = await upload(page.id, "banner", img.png, "a.png", "image/png")
  check("unknown slot → 400", r.status === 400, r.json)
  r = await fetch(`${BASE}/admin/link-in-bio/pages/${page.id}/upload?slot=avatar`, { method: "POST", body: new FormData() })
  check("upload needs an admin session", r.status === 401, r.status)
  check("avatar unchanged by the refused uploads", (await api("GET", `/admin/link-in-bio/pages/${page.id}`)).json.page.avatar === avatar2)
  r = await api("POST", `/admin/link-in-bio/pages/${page.id}`, { body: { profile_style: "hero", hero_ratio: "3:2", focus: { hero: { x: 30.6, y: 120 }, avatar: { x: "50", y: 20 } }, translations: { id: { avatar_alt: "Logo Haus Kayu", hero_alt: "Bengkel di Jepara" }, en: { hero_alt: "The workshop in Jepara" } } } })
  check("hero style, ratio, focal points (clamped/rounded) and alt texts saved", r.status === 200 && r.json.page.profile_style === "hero" && r.json.page.hero_ratio === "3:2" && r.json.page.focus.hero.x === 31 && r.json.page.focus.hero.y === 100 && r.json.page.focus.avatar.x === 50 && r.json.page.translations.id.hero_alt === "Bengkel di Jepara" && r.json.page.translations.en.avatar_alt === null, r.json.page)
  r = await api("POST", `/admin/link-in-bio/pages/${page.id}`, { body: { profile_style: "banner", hero_ratio: "4:3", focus: { hero: null } } })
  check("unknown style/ratio keep the current values; focus null → centre", r.json.page.profile_style === "hero" && r.json.page.hero_ratio === "3:2" && r.json.page.focus.hero === null && r.json.page.focus.avatar.y === 20, r.json.page)
  r = await api("GET", "/store/link-in-bio/pages/links?locale=id", { store: true })
  check("store page carries style, hero, ratio, focus and alt texts", r.status === 200 && r.json.page.profile_style === "hero" && r.json.page.hero_ratio === "3:2" && /\.webp$/.test(r.json.page.hero) && r.json.page.avatar === avatar2 && r.json.page.focus.avatar.y === 20 && r.json.page.avatar_alt === "Logo Haus Kayu" && r.json.page.hero_alt === "Bengkel di Jepara", r.json.page)
  r = await api("GET", "/store/link-in-bio/pages/links?locale=en", { store: true })
  check("…alt text per locale (en hero alt, avatar alt falls back to null)", r.json.page.hero_alt === "The workshop in Jepara" && r.json.page.avatar_alt === null, r.json.page)
  r = await api("POST", `/admin/link-in-bio/pages/${page.id}`, { body: { avatar: "https://cdn.example.com/other.png" } })
  check("pasting another URL over the uploaded avatar deletes the upload", r.status === 200 && r.json.page.avatar === "https://cdn.example.com/other.png" && r.json.page.uploads.avatar === false && !fs.existsSync(staticFile(avatar2)), { uploads: r.json.page.uploads, oldExists: fs.existsSync(staticFile(avatar2)) })
  const heroUrl = (await api("GET", `/admin/link-in-bio/pages/${page.id}`)).json.page.hero
  r = await api("DELETE", `/admin/link-in-bio/pages/${page.id}/upload?slot=hero`)
  check("remove hero: URL null, file deleted, hero focus forgotten", r.status === 200 && r.json.page.hero === null && r.json.page.uploads.hero === false && !fs.existsSync(staticFile(heroUrl)) && r.json.page.focus.hero === null, r.json.page)
  hook = await waitHook((h) => h.body?.link_in_bio?.handles?.includes("links"))
  check("uploads and removals revalidate the page", !!hook, hooks)
  hooks.length = 0
  r = await upload(page2.id, "avatar", img.png, "a.png", "image/png")
  const page2Avatar = r.json.page?.avatar
  check("page2 avatar uploaded (deleted with the page below)", r.status === 200 && !!page2Avatar && fs.existsSync(staticFile(page2Avatar)), r.json)

  section("QR")
  r = await api("GET", `/admin/link-in-bio/qr?page_id=${page.id}&locale=en`)
  check("page QR (svg) encodes the en address", r.status === 200 && /image\/svg\+xml/.test(r.headers.get("content-type")) && r.headers.get("x-qr-url") === "https://storefront.e2e.test/us/links" && /<svg/.test(r.text) && /no-store/.test(r.headers.get("cache-control")), { ct: r.headers.get("content-type"), url: r.headers.get("x-qr-url") })
  check("…light by default, with this page's uploaded logo on a white badge, nothing else embedded", /fill="#ffffff"/.test(r.text) && r.headers.get("x-qr-logo") === "page" && /<image href="data:image\/png;base64,/.test(r.text) && !/<script/.test(r.text), r.headers.get("x-qr-logo"))
  r = await api("GET", `/admin/link-in-bio/qr?page_id=${page.id}&locale=en&theme=dark&logo=none&format=png&size=512`)
  check("dark PNG without logo: 512 px, transparent corners, decodes (inverted) to the address", r.status === 200 && (await sharp(r.buf).metadata()).width === 512 && (await sharp(r.buf).metadata()).hasAlpha === true && r.headers.get("x-qr-logo") === "none" && (await decodeQr(r.buf, true)) === "https://storefront.e2e.test/us/links", { logo: r.headers.get("x-qr-logo") })
  check("…and is not read by a scanner that never inverts", (await decodeQr(r.buf, false)) === null)
  r = await api("GET", `/admin/link-in-bio/qr?page_id=${page.id}&locale=id&format=png&size=768&logo=page`)
  check("light PNG with the page logo decodes", (await decodeQr(r.buf, false)) === "https://storefront.e2e.test/links" && r.headers.get("x-qr-logo") === "page")
  r = await api("GET", `/admin/link-in-bio/qr?item_id=${prodItem.id}&format=png&theme=dark&download=1`)
  check("item QR dark download: file name says -dark, decodes to the redirect", r.status === 200 && /filename="link-.*-dark\.png"/.test(r.headers.get("content-disposition")) && (await decodeQr(r.buf, true)) === `https://storefront.e2e.test/l/${prodItem.key}`, r.headers.get("content-disposition"))
  r = await api("GET", `/admin/link-in-bio/qr?page_id=${page.id}&logo=brand`)
  check("logo=brand without qr.logo in the options → no logo", r.status === 200 && r.headers.get("x-qr-logo") === "none" && !/<image/.test(r.text), r.headers.get("x-qr-logo"))
  r = await api("GET", `/admin/link-in-bio/qr?page_id=${page.id}&theme=sepia`)
  check("unknown theme → 400", r.status === 400, r.status)
  check("the page's QR logo file is still there", fs.existsSync(staticFile(qrLogo)))
  r = await api("GET", `/admin/link-in-bio/qr?item_id=${prodItem.id}&format=png&size=256&download=1`)
  check("item QR (png, download) encodes the redirect", r.status === 200 && r.headers.get("content-type") === "image/png" && r.buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && r.headers.get("x-qr-url") === `https://storefront.e2e.test/l/${prodItem.key}` && /attachment; filename="link-/.test(r.headers.get("content-disposition")), { ct: r.headers.get("content-type"), cd: r.headers.get("content-disposition") })
  r = await api("GET", `/admin/link-in-bio/qr`)
  check("QR without id → 400", r.status === 400, r.json)
  r = await api("GET", `/admin/link-in-bio/qr?page_id=libpg_nope`)
  check("QR of unknown page → 404", r.status === 404, r.json)
  r = await api("GET", `/admin/link-in-bio/qr?page_id=${page.id}`, { admin: false })
  check("QR needs an admin session", r.status === 401, r.status)

  section("Delete page")
  r = await api("DELETE", `/admin/link-in-bio/pages/${page2.id}`)
  check("page2 deleted", r.status === 200 && r.json.deleted === true, r.json)
  check("…its uploaded avatar file is deleted with it", !!page2Avatar && !fs.existsSync(staticFile(page2Avatar)), page2Avatar)
  hook = await waitHook((h) => h.body?.link_in_bio?.all === true)
  check("deleted page → revalidate all", !!hook && hook.body.link_in_bio.handles.includes("ramadan-2026"), hooks)
  r = await api("GET", "/store/link-in-bio/pages/ramadan-2026", { store: true })
  check("…its store page is 404", r.status === 404, r.status)
  r = await api("GET", `/admin/link-in-bio/pages/${page2.id}`)
  check("…and the admin view too", r.status === 404, r.status)
  await api("POST", `/admin/link-in-bio/pages/${page.id}`, { body: { published: false } })
  r = await go(ig.key)
  check("unpublishing the page kills its links (410)", r.status === 410, r.status)
  await api("POST", `/admin/link-in-bio/pages/${page.id}`, { body: { published: true } })

  section("Rate limit")
  let last = 0
  for (let i = 0; i < RATE_MAX + 5; i++) {
    const x = await go(ig.key, { "user-agent": "curl/8" })
    last = x.status
    if (last === 429) break
  }
  check(`the ${RATE_MAX + 1}th public request from one IP → 429`, last === 429, last)
  r = await api("GET", "/store/link-in-bio/pages", { store: true })
  check("…the store API shares the counter", r.status === 429, r.status)
  r = await api("GET", `/admin/link-in-bio/pages/${page.id}`)
  check("…the Admin does not", r.status === 200, r.status)
}

async function main() {
  if (!fs.existsSync(path.join(PLUGIN_DIR, ".medusa/server/src/modules/link-in-bio/index.js"))) {
    throw new Error("Build the plugin first: npm run build")
  }
  rmGuarded(STATE_DIR)
  fs.mkdirSync(STATE_DIR, { recursive: true })
  installPlugin()
  await waitForPostgres()
  psql(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`)
  psql(`CREATE DATABASE ${DB_NAME}`)
  guarded("db:migrate")
  guarded("user", "-e", ADMIN.email, "-p", ADMIN.password)

  let serverDir = APP_DIR
  if (process.env.LIB_ADMIN === "1") {
    guarded("build")
    serverDir = path.join(APP_DIR, ".medusa/server")
    ctx.serverDir = serverDir
    rmGuarded(path.join(serverDir, "node_modules"))
    fs.symlinkSync(path.join(APP_DIR, "node_modules"), path.join(serverDir, "node_modules"))
    checkAdminBuild(serverDir)
  }
  const hookServer = await startHookServer()
  const log = fs.openSync(path.join(STATE_DIR, "server.log"), "w")
  const server = spawn("node", [GUARD, MEDUSA, "start"], { cwd: serverDir, env, stdio: ["ignore", log, log], detached: true })
  try {
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(`${BASE}/health`)).ok) break
      } catch {}
      if (i > 120) throw new Error("server did not start, see integration-tests/.state/server.log")
      await new Promise((r) => setTimeout(r, 1000))
    }
    await checks()
    if (KEEP) {
      fs.writeFileSync(path.join(STATE_DIR, "server.pid"), String(server.pid))
      console.log(`\nserver kept running on ${BASE} (pid ${server.pid}); stop with: kill -- -${server.pid}`)
      console.log(`\n${passes} passed, ${failures} failed`)
      process.exit(failures ? 1 : 0)
    }
  } finally {
    try {
      process.kill(-server.pid, "SIGTERM")
    } catch {}
    hookServer.close()
  }
  console.log(`\n${passes} passed, ${failures} failed`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
