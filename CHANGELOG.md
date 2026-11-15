# Changelog

All notable changes to medusa-link-in-bio. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org).

## [0.2.0] — 2026-11-15

### Added
- Image uploads per page in the Admin (drag and drop or file picker) through Medusa's File Module: an avatar and a
  hero header image, plus a logo for the page's QR codes. JPEG, PNG, WebP and AVIF by magic bytes, at most 5 MB,
  SVG refused (413 `file_too_large`, 400 `invalid_image`). Replacing or removing deletes the previous upload; pasting
  another URL over an upload deletes it too; deleting the page deletes its files. `POST`/`DELETE
  /admin/link-in-bio/pages/{id}/upload?slot=avatar|hero|qr_logo`; SDK `upload()` / `removeUpload()`.
- Profile styles per page: `profile_style` `circle` (as before) or `hero` (the header image full width, fading into
  the page colour, the name and bio right under it), `hero_ratio` `16:9` | `3:2`, `hero_avatar` (off by default;
  on, the avatar sits small over the hero's lower edge), focal points `focus.avatar` / `focus.hero` (percent, set by
  clicking the preview), alt texts `avatar_alt` / `hero_alt` per locale. All of it in
  the Store API, so a storefront can draw the page without layout shift and crop around the focal point.
- QR codes drawn by the plugin: round modules, rounded finder eyes, error correction H, a centre logo on a white
  badge (plugin option `qr.logo`, or the page's upload; `logo=brand|page|none`), light or dark theme
  (`theme=light|dark`; dark = white on a black rounded card with transparent corners), SVG and PNG up to 4096 px.
  Every variant is decoded with jsQR in the unit and E2E suites; the Admin warns that some older scanners do not
  read inverted codes.
- Admin: "Images" section in the page form (style, hero with ratio, avatar, focal points, alt texts, or a pasted
  URL), QR drawer with theme, logo and PNG size.

### Changed
- `sharp` and `multer` are dependencies of the plugin now (PNG rendering of the QR codes, multipart uploads).
- Database: migration `Migration20261115101742` adds the image columns to `lib_page` and the alt texts to
  `lib_page_translation` (`npx medusa db:migrate`).

## [0.1.1] — 2026-11-15

- First release through the GitHub Actions workflow (npm trusted publishing, provenance). No code changes since 0.1.0
  besides the Admin's plural forms for item and click counts.

## [0.1.0] — 2026-11-15

First release.

- Pages with handle, avatar, display name and bio per locale, SEO fields, social icons, colours and shape, published
  flag, `noindex`, share image; any number of pages.
- Items ordered by drag and drop: link, product (live price for the region + stock), collection, category, promo
  code, medusa-blog-seo article (one or the latest), WhatsApp, contact, heading, divider; label and second line per
  locale, image or icon, featured size, visible switch, show-from / hide-after schedule.
- Click counting through the redirect `/l/{key}` (302): per item and UTC day only, no cookies or personal data,
  bots and DNT/GPC visitors not counted, buffered writes; 7/30-day and total counts and a daily chart in the Admin.
- Automatic UTM parameters (page and item switches, never over existing `utm_*`).
- QR codes per page (per locale) and per link, SVG and PNG.
- `revalidate` option: batched `POST { link_in_bio: { handles, all } }` to the storefront after public changes.
- Store API (`/store/link-in-bio/pages`, `/store/link-in-bio/pages/{handle}`), Admin API, typed SDK
  (`medusa-link-in-bio/sdk`), Admin UI in English and Indonesian.
- Safety: `http(s)`-only URLs, no open redirect, per-IP rate limit, 410 for anything unavailable.

[0.2.0]: https://github.com/haustex/cm-medusa-link-in-bio/releases/tag/v0.2.0
[0.1.1]: https://github.com/haustex/cm-medusa-link-in-bio/releases/tag/v0.1.1
[0.1.0]: https://github.com/haustex/cm-medusa-link-in-bio/releases/tag/v0.1.0
