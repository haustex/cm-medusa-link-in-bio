# Changelog

All notable changes to medusa-link-in-bio. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org).

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

[0.1.0]: https://github.com/haustex/cm-medusa-link-in-bio/releases/tag/v0.1.0
