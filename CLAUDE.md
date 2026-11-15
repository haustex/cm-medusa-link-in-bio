# CLAUDE.md — medusa-link-in-bio (link-in-bio pages for Medusa v2, by Haus Kayu)

## ⚠️ Server rules (read before doing anything)

This host also runs the **hauskayu.com production store**.

- **Never** send requests to ports `9000`, `8000`, `8001`, `80`, `443`, `5432`, `6379` or any `*.hauskayu.com` domain from tests.
- **Never** touch the `hauskayu-*` containers or the `~/hauskayu` repo from this plugin's work.
- Test **only** on ports `9700+` and the `rw-spike-*` containers (Postgres `127.0.0.1:55436`, Redis `127.0.0.1:56383`).
- Every medusa/db command goes **through `scripts/guard.mjs`**.
- Any `rm` (in shell or in a script) is shown to the maintainer first, uses `${VAR:?}` guards and absolute paths
  inside the repo; `integration-tests/e2e.mjs` removes paths only through `rmGuarded()`.
- **Never commit** secrets or `.env` files. Do not publish to npm or push tags until the maintainer (Haus Kayu) says OK.

## Technical decisions

- One module `linkInBio`, tables `lib_page`, `lib_page_translation`, `lib_item`, `lib_item_translation`,
  `lib_click_day`. **Service keys = DML model names** (`LibPage` → `listLibPages`, …).
- Items have a short public `key` (8 chars, `src/lib/keys.ts`) for `/l/{key}`; the redirect (`src/api/l/[key]`)
  only ever uses the stored target through `destination()` in `src/lib/store.ts`; UTM via `src/lib/utm.ts`
  (never over existing `utm_*`, never on WhatsApp/tel/mailto: `UTM_TYPES`).
- Clicks: `src/lib/clicks.ts` buffers per (item, day) and upserts with raw SQL (`on conflict (item_id, day) where
  deleted_at is null`, because DML unique indexes are partial). `flush_ms: 0` writes at once (tests).
- Products: `query.graph` with `QueryContext({ region_id, currency_code })` for `calculated_price`,
  `getVariantAvailability` (one sales channel on the publishable key) or `getTotalVariantAvailability`.
- medusa-blog-seo is optional: `hasBlog()` resolves the `blogSeo` module; posts are read through its service.
- Rate limit (`src/lib/rate-limit.ts`, Cache Module or memory) answers 429 from the middleware itself
  (`MedusaError` would map to 400).
- Admin: Medusa UI + react-i18next (`src/admin/i18n`), dnd-kit for ordering, QR images fetched from
  `/admin/link-in-bio/qr` (session cookie).
- E2E (`integration-tests/e2e.mjs`): `LIB_ADMIN=1` also builds the Admin; the app's `/admin/e2e/flush` writes
  buffered clicks.

## Backlog

- Admin: live preview of the page in the editor; per-item link to the storefront's page.
- Store: per-day stats endpoint for a storefront dashboard.
