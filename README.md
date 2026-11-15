<p align="center">
  <a href="https://hauskayu.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg">
      <img src="docs/logo.svg" alt="Haus Kayu" width="260">
    </picture>
  </a>
</p>

# medusa-link-in-bio

**The link in your Instagram, TikTok or WhatsApp profile, served by your Medusa store.** Pages with a profile and
drag-and-drop items: plain links, products with live price and stock for the visitor's region, collections,
categories, promo codes to copy, blog articles (medusa-blog-seo), WhatsApp and contact, headings. Several pages
(per campaign, per market), text per language, show/hide on a schedule, click counts without cookies, automatic
UTM, QR codes, a typed Store API and a storefront integration for Kiln.
<br>Tautan di profil Instagram, TikTok, atau WhatsApp yang disajikan toko Medusa Anda: halaman profil dengan item
drag-and-drop (tautan, produk dengan harga dan stok live, koleksi, kategori, kode promo, artikel, WhatsApp,
kontak), banyak halaman, teks per bahasa, jadwal tampil, klik terhitung tanpa cookie, UTM otomatis, kode QR.

[![npm](https://img.shields.io/npm/v/medusa-link-in-bio)](https://www.npmjs.com/package/medusa-link-in-bio)
[![CI](https://github.com/haustex/cm-medusa-link-in-bio/actions/workflows/ci.yml/badge.svg)](https://github.com/haustex/cm-medusa-link-in-bio/actions/workflows/ci.yml)
[![Medusa](https://img.shields.io/badge/Medusa-2.19%20%E2%80%93%202.22-7c3aed)](https://medusajs.com)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

### Compatibility

| Plugin | Medusa | Node | Tested in CI on |
| --- | --- | --- | --- |
| 0.1.x – 0.2.x | 2.19.0 or newer 2.x (`^2.19.0`) | 20.19+ or 22.12+ | Medusa 2.19.0 and 2.22.2 |

No other service needed (images go through Medusa's File Module, whichever provider the project uses). With Redis as Medusa's Cache Module the rate limit is shared by every server process.
[medusa-blog-seo](https://github.com/haustex/cm-medusa-blog-seo) is optional (the "Article" item type).

### Quick start

```bash
npm install medusa-link-in-bio
```

```ts
// medusa-config.ts
plugins: [
  {
    resolve: "medusa-link-in-bio",
    options: {
      storefront: {
        url: "https://your-store.com",            // where the pages are served
        locales: { en: { prefix: "/us" } },        // per-locale prefix or origin (optional)
      },
    },
  },
],
```

```bash
npx medusa db:migrate
```

Open **Link in bio** in the Admin sidebar, create the page `links`, add items, publish. The storefront reads
`GET /store/link-in-bio/pages/links?locale=id&region_id=…` and renders it; every item links to `/l/{key}`, which
counts the click and redirects. [Kiln](https://github.com/haustex/sf-medusa-kiln) ships the page at `/links`
out of the box; for any other storefront see [Storefront](#storefront).

---

## English

### Features

- **Pages**: handle (`links`, `ramadan-2026`, …), internal name, display name and bio per locale, SEO
  title/description, social icons (Instagram, TikTok, Facebook, X, YouTube, Pinterest, LinkedIn, Threads, WhatsApp,
  Telegram, Shopee, Tokopedia, Etsy, e-mail, website), colours and shape (background, text, buttons; square to pill;
  solid/outline/soft), published flag, `noindex`, optional share image. As many pages as you like.
- **Profile images** uploaded in the Admin (drag and drop or file picker) and stored through Medusa's File Module —
  local `static`, S3, R2, whatever the project uses: an **avatar** (round) and a **hero** header image. JPEG, PNG,
  WebP or AVIF recognised by their first bytes (the file name and declared type are not trusted), at most 5 MB, SVG
  never. Preview with a focal point set by clicking (kept in view when the storefront crops: avatar 1:1, hero 16:9
  or 3:2), alt text per locale. Replacing or removing deletes the previous file, so nothing piles up; pasting an
  external URL instead still works. Two **profile styles** per page: *circle* (the avatar, or the initials) and
  *hero* (the header image full width, fading into the page colour, the avatar small over its edge).
- **Items**, drag-and-drop ordered, each with label and second line per locale, optional image or icon, "featured"
  size, visible switch and a show-from / hide-after schedule:
  - **Link**: any `http(s)` URL.
  - **Product**: picked from the catalogue; the Store API returns title, thumbnail, the lowest variant price in the
    visitor's region (`region_id`) and stock (`in_stock`, units) scoped to the publishable key's sales channel.
  - **Collection** / **Category**: title + storefront URL.
  - **Promo code**: the code to copy, optionally with a link that opens the shop with it.
  - **Article**: a medusa-blog-seo post, or "always the latest"; title, excerpt, cover, slug per locale.
  - **WhatsApp**: `wa.me` link with a prefilled message. **Contact**: phone (`tel:`) or e-mail (`mailto:`).
  - **Heading** and **Divider** to group links.
- **Clicks** are counted on the server by the redirect `GET /l/{key}` (302). Stored: item, UTC day, count. Not
  stored: IP, user agent, referrer, cookies, fingerprints. Known bots and link previewers (via
  [isbot](https://www.npmjs.com/package/isbot)) and visitors sending `DNT: 1` or `Sec-GPC: 1` are redirected but not
  counted. The Admin shows 7-day, 30-day and total counts per item and page, and a 30-day bar chart.
- **UTM**: `utm_source=link-in-bio&utm_medium=social&utm_campaign={page handle}&utm_content={item key}` are added to
  product, collection, category, article, promo and plain links, unless the link already carries its own `utm_*`
  parameters. Names are options; switch off per page or per item. Never added to WhatsApp, `tel:` or `mailto:`.
- **QR codes** in the Admin for every page (per language) and every link, drawn by the plugin from the module
  matrix with error correction H: round dots, rounded "eyes", a **logo** in the centre on a clean white badge (the
  brand logo from the `qr.logo` option, or one uploaded per page; about 5 % of the area), a proper quiet zone.
  **Light** (black on white) or **dark** theme (white on a black rounded card, corners transparent — the Admin
  notes that some older scanners cannot read inverted codes). SVG for print and PNG at 1024, 2048 or 4096 px.
  Every variant is decoded in the test suite (jsQR) at 256–1024 px, with and without logo.
- **Security**: only absolute `http(s)` URLs without credentials are accepted (no `javascript:`, `data:`, relative
  paths); the redirect only ever sends a visitor to a URL an admin saved, nothing in the request chooses the target;
  per-IP rate limit on the public routes (300 requests / 10 minutes by default, hash of the address in the cache
  only); unpublished pages, hidden, scheduled, expired items and deleted targets answer 410; QR codes are generated
  from stored data, not from a URL in the query. Every write is an Admin route.
- **Typed SDK** (`medusa-link-in-bio/sdk`) for the Store and Admin endpoints; Admin in English and Indonesian.

### Plugin options

```ts
{
  resolve: "medusa-link-in-bio",
  options: {
    storefront: {
      url: "https://your-store.com",
      locales: { en: { prefix: "/us" }, de: { origin: "https://your-store.de" } },
      main_handle: "links",                   // served at paths.main instead of paths.page
      paths: {
        main: "/links",
        page: "/links/{handle}",
        product: "/products/{handle}",
        collection: "/collections/{handle}",
        category: "/categories/{handle}",
        post: "/blog/{slug}",
      },
    },
    redirect_url: "https://your-store.com/l/{key}",   // default: storefront.url + /l/{key}, else backend_url + /l/{key}
    backend_url: "https://api.your-store.com",        // for the fallback redirect address
    utm: { source: "link-in-bio", medium: "social" },
    clicks: { enabled: true, flush_ms: 5000, count_bots: false, respect_dnt: true },
    rate_limit: { window_seconds: 600, max: 300 },    // 0 disables
    reserved_handles: ["admin"],
    revalidate: { url: "https://your-store.com/api/revalidate", secret: process.env.REVALIDATE_SECRET },
    qr: { logo: "https://your-store.com/brand/mark.png" }, // centre logo of the QR codes (https URL or absolute file path)
    showCredit: false,                                // "Link in bio by Haus Kayu" under the Admin pages
  },
}
```

`qr.logo` is a square PNG/JPEG/WebP (an https URL fetched and cached for ten minutes, or an absolute path on the
server) drawn in the centre of every QR code on a white badge; a page can upload its own in the Admin instead. The
images themselves (avatar, hero, QR logo) are stored through the File Module, so configure a provider with public
URLs the storefront can reach (the default local provider serves `./static`).

`revalidate` tells the storefront about public changes: every change to a page or its items within `delay_ms`
(default 2000) becomes one `POST { link_in_bio: { handles: ["links", …], all } }` to `url`, with the secret in the
`x-revalidate-secret` header (`header` renames it). `all` is set when a page was deleted. Kiln's `/api/revalidate`
takes this payload and re-renders `/links` and `/links/{handle}` in every market; another storefront can do the same.

`storefront.url` is what makes internal links (products, collections, articles, the pages themselves) and the
default redirect address; without it those items have no destination and are left out of the public page.

### Storefront

The redirect lives on the backend (`/l/{key}`). To keep links on your own domain, proxy `/l/*` to it and forward
`User-Agent`, `DNT`, `Sec-GPC` and the visitor's address (Kiln does this with `markets.passthrough`); otherwise
set `redirect_url` to the backend's public `/l/{key}`.

```ts
import Medusa from "@medusajs/js-sdk"
import { linkInBioStore } from "medusa-link-in-bio/sdk"

const sdk = new Medusa({ baseUrl: BACKEND_URL, publishableKey: KEY })
const { page } = await linkInBioStore(sdk).page("links", { locale: "id", region_id })
// page.title, page.bio, page.avatar, page.theme, page.socials, page.urls (per locale, for hreflang)
for (const item of page.items) {
  // item.type, item.label, item.note, item.image, item.href (the counted link) , item.url (where it ends up)
  // item.product?.price.amount / currency_code, item.product?.in_stock, item.promo?.code, item.post?.excerpt …
}
```

A page can be rendered without any client-side JavaScript except a "copy" button for promo codes; `page.noindex`
says whether to add `<meta name="robots" content="noindex">`. `GET /store/link-in-bio/pages` lists the published
pages (handle, locales), which is also how a storefront detects the plugin.

### Store API

| Route | Answer |
| --- | --- |
| `GET /store/link-in-bio/pages` | `{ pages: [{ id, handle, locales, noindex, updated_at }] }` published pages |
| `GET /store/link-in-bio/pages/{handle}?locale=&region_id=` | `{ page }` in one locale (`?locale`, `x-medusa-locale`, else the page's default); visible items only |
| `GET /l/{key}[?l=locale]` | 302 to the item's destination; 404 unknown key; 410 unavailable |

Both store routes need the publishable API key; `/l/{key}` does not.

### Admin API

`/admin/link-in-bio/config`, `/pages` (GET, POST), `/pages/{id}` (GET with items + counts, POST, DELETE),
`/pages/{id}/items` (GET, POST), `/pages/{id}/items/{itemId}` (GET, POST, DELETE), `/pages/{id}/items/reorder`
(POST `{ ids }`), `/pages/{id}/upload?slot=avatar|hero|qr_logo` (POST multipart field `file`; DELETE removes the
image), `/pages/{id}/stats?days=30`,
`/qr?page_id=&locale=|item_id=&format=svg|png&size=&download=1&theme=light|dark&logo=brand|page|none`,
`/search?type=product|collection|category|post&q=`. Page fields for the images: `avatar`, `hero`, `qr_logo` (URLs),
`profile_style` (`circle` | `hero`), `hero_ratio` (`16:9` | `3:2`), `focus: { avatar, hero }` (`{ x, y }` in
percent, null = centre), `uploads` (which of them the plugin owns), translations `avatar_alt` / `hero_alt`. Rule
violations answer `{ code, message, detail }` with codes `invalid_url`, `invalid_handle`, `handle_taken`,
`reserved_handle`, `invalid_locale`, `invalid_target`, `invalid_date`, `invalid_image`, `file_too_large` (413),
`invalid`, `not_found`. `linkInBioAdmin(sdk)` in `medusa-link-in-bio/sdk` wraps all of them (`upload(id, slot,
file)`, `removeUpload`, `qrUrl({ theme, logo })`).

### Limits

- Clicks are buffered in memory for `clicks.flush_ms` (5 s) before they are written; a crash in that window loses
  those few counts. Counts are per UTC day.
- A page lists up to 500 items; the Admin shows up to 200 pages.
- Product stock follows the publishable key's sales channel when the key has exactly one; otherwise it is summed over
  all stock locations.

### FAQ

**Why a redirect instead of counting in the browser?** It works without JavaScript, counts taps from in-app
browsers that block scripts, and needs no cookie banner: nothing about the visitor is stored.

**Can I use my own domain for the short links?** Yes: proxy `/l/*` from the storefront to the backend (Kiln does),
or set `redirect_url` to any address that forwards to the backend's `/l/{key}`.

**What happens to a link when the product is deleted or the article unpublished?** It disappears from the page and
`/l/{key}` answers 410 until you point the item elsewhere. The Admin marks such items "Target missing".

---

## Bahasa Indonesia

### Fitur

- **Halaman**: handle (`links`, `ramadan-2026`, …), nama internal, nama tampil dan bio per bahasa, judul dan
  deskripsi SEO, ikon sosial, warna dan bentuk (latar, teks, tombol; siku sampai pil), status tayang, `noindex`,
  gambar bagikan opsional. Jumlah halaman bebas.
- **Gambar profil** diunggah dari Admin (drag & drop / pilih file) lewat File Module Medusa (lokal, S3, R2 — apa pun
  yang dipakai proyek): **avatar** (bulat) dan **hero** (gambar header). JPEG/PNG/WebP/AVIF dikenali dari magic
  bytes, maks 5 MB, SVG ditolak. Pratinjau dengan titik fokus (klik gambar; dipakai saat dipotong: avatar 1:1, hero
  16:9 atau 3:2), teks alt per bahasa. Ganti/hapus menghapus file lama (tidak ada file yatim). Dua **gaya profil**
  per halaman: *lingkaran* (avatar atau inisial) dan *hero* (header lebar penuh yang memudar ke warna latar, avatar
  kecil menimpa tepi bawahnya).
- **Item** diurutkan drag-and-drop, masing-masing dengan label dan baris kedua per bahasa, gambar atau ikon, ukuran
  unggulan, saklar tampil, dan jadwal tampil-mulai / sembunyikan-setelah: tautan, produk (harga terendah di region
  pengunjung + stok, live), koleksi, kategori, kode promo (disalin sekali ketuk, opsional dengan tautan), artikel
  medusa-blog-seo (pilih satu atau selalu yang terbaru), WhatsApp (`wa.me` dengan pesan), kontak (telepon/e-mail),
  judul, pemisah.
- **Klik** dihitung di server lewat redirect `GET /l/{key}` (302). Disimpan: item, hari UTC, jumlah. Tidak disimpan:
  IP, user agent, referrer, cookie. Bot dan pratinjau tautan serta pengunjung dengan `DNT: 1` / `Sec-GPC: 1` tetap
  diarahkan tapi tidak dihitung. Admin menampilkan 7 hari, 30 hari, total, dan grafik batang 30 hari.
- **UTM** otomatis (`utm_source`, `utm_medium`, `utm_campaign` = handle halaman, `utm_content` = key item) untuk
  tautan web; tautan yang sudah punya `utm_*` dibiarkan; bisa dimatikan per halaman atau per item.
- **Kode QR** per halaman (per bahasa) dan per tautan, digambar plugin sendiri (koreksi kesalahan H): modul titik
  bulat, "mata" kotak membulat, logo di tengah pada lencana putih bersih (logo brand dari opsi `qr.logo` atau unggahan
  per halaman), quiet zone cukup. Tema **terang** (hitam di putih) atau **gelap** (putih di kartu hitam membulat;
  Admin mengingatkan sebagian pemindai lama tidak membaca kode terbalik). SVG untuk cetak, PNG 1024/2048/4096 px.
  Semua varian diuji decode (jsQR) di rangkaian tes.
- **Keamanan**: hanya URL `http(s)` absolut tanpa kredensial; redirect hanya ke URL yang disimpan admin (bukan open
  redirect); rate limit per IP di route publik; halaman tidak tayang / item tersembunyi / kedaluwarsa menjawab 410.

### Pasang

```bash
npm install medusa-link-in-bio
```

```ts
plugins: [{ resolve: "medusa-link-in-bio", options: { storefront: { url: "https://toko-anda.com", locales: { en: { prefix: "/us" } } } } }]
```

```bash
npx medusa db:migrate
```

Buka **Link in bio** di Admin, buat halaman `links`, tambah item, tayangkan. Storefront membaca
`/store/link-in-bio/pages/links?locale=id&region_id=…`; setiap item mengarah ke `/l/{key}` yang menghitung klik
lalu mengarahkan ke tujuan. Kiln sudah menyajikan halamannya di `/links` (dan `/us/links`).

### Alur

1. Admin membuat halaman dan item; tautan internal (produk, koleksi, artikel) dibentuk dari `storefront.url` +
   pola path + prefix bahasa.
2. Pengunjung membuka `/links`; storefront mengambil halaman per bahasa dan region, menampilkan harga dan stok.
3. Pengunjung mengetuk item → `/l/{key}` di storefront → diteruskan ke backend → hitungan hari itu +1 → 302 ke tujuan
   dengan UTM.
4. Admin melihat klik per item dan per hari, mengunduh QR untuk kemasan atau kartu.

---

## Development

```bash
npm ci
npm run build
npm run lint && npm run typecheck && npm run test:unit
npm run test:e2e            # Postgres on the spike port, see CONTRIBUTING.md
```

The end-to-end suite starts Medusa with the plugin, creates a region, products with stock, a collection and a
category, then drives the Admin API (pages, items of every type, reorder, QR, search, stats), the Store API (locales,
prices, stock, UTM, scheduling) and the redirect (bots, DNT, dead links, rate limit), on Medusa 2.19.0 and 2.22.2
in CI.

## Built for hauskayu.com

Built and used in production by [Haus Kayu](https://hauskayu.com), handmade teak homeware from Jepara:
[hauskayu.com/links](https://hauskayu.com/links) runs on this plugin and the Kiln storefront.

## Other plugins by Haus Kayu

- [medusa-blog-seo](https://github.com/haustex/cm-medusa-blog-seo): multilingual blog with SEO built in.
- [medusa-reviews-wishlist](https://github.com/haustex/sp-medusa-reviews-wishlist): verified product reviews with
  photos, review-request e-mails and wishlists.
- [medusa-storage-r2](https://github.com/haustex/fs-medusa-r2): Cloudflare R2 file storage configured from the Admin.
- [medusa-payment-doit](https://github.com/haustex/pg-medusa-doit): doit.id payments (QRIS, Virtual Account) for Indonesia.
- [medusa-payment-manual-transfer](https://github.com/haustex/pg-medusa-manual-transfer): manual bank transfer with
  payment-proof upload and admin verification.
- [medusa-fulfillment-zone-rate](https://github.com/haustex/fl-medusa-zone-rate): calculated shipping by zone and
  chargeable weight, with shipment tracking.

## Support

- Issues and feature requests: [GitHub issues](https://github.com/haustex/cm-medusa-link-in-bio/issues)
- E-mail: [dev@hauskayu.com](mailto:dev@hauskayu.com)

## License

[MIT](LICENSE) © Haus Kayu
