# Contributing

Thank you for helping! Bug reports, fixes and translations (Admin texts in `src/admin/i18n/json`) are welcome.
For larger changes please open an issue first, so we can agree on the approach. Two things are not up for
discussion: the redirect only ever goes to a stored URL (no parameter decides the target), and nothing about a
visitor is stored with a click.

## Setup

Node.js 20.19+ or 22.12+, Docker (for the end-to-end Postgres).

```bash
npm ci
npm run build
```

## Checks

Every pull request runs these in CI, against Medusa 2.19.0 and 2.22.2:

```bash
npm run lint
npm run typecheck        # the plugin and the Admin extension
npm run test:unit
npm run build
npm run pack:check       # what `npm pack` would publish
npm run test:e2e
```

To try another Medusa release locally: `node scripts/use-medusa.mjs 2.22.2` (not saved; `npm ci` goes back).

## End-to-end tests

`integration-tests/e2e.mjs` creates a fresh database, migrates, starts Medusa on port 9700 with the plugin, then
drives the Admin API (pages, every item type, reorder, search, stats, QR), the Store API (locales, prices and stock
per region, UTM, scheduling) and the redirect `/l/{key}` (bots, DNT, dead links, rate limit).

```bash
docker run -d --name rw-spike-pg -e POSTGRES_PASSWORD=spike -e POSTGRES_DB=rw_spike \
  -p 127.0.0.1:55436:5432 postgres:17-alpine
npm run build && npm run test:e2e
```

`LIB_ADMIN=1 LIB_KEEP=1 npm run test:e2e` builds the Admin too (CI does this on the latest Medusa) and keeps the
server running on http://127.0.0.1:9700/app (login `admin@e2e.test` / `e2e-password-123`) to look at the Link in bio
pages. With the Admin built, the suite also checks that `@medusajs/admin-bundler` resolves `medusa-link-in-bio/admin`.

The app installs the plugin from its `npm pack` tarball (unpacked into `integration-tests/app/node_modules`), so the
tests see exactly what a user installs; the dependencies are symlinked from the plugin's `node_modules`, and the
unpacked package is linked back as `node_modules/medusa-link-in-bio` in the plugin folder so the Admin bundler can
resolve it (that symlink is the only thing the suite touches outside `integration-tests/`).

The suite removes its own folders (`integration-tests/.state`, `app/node_modules`, the built server's
`node_modules`) through one guarded function that refuses any path outside `integration-tests/`.

Every Medusa command goes through `scripts/guard.mjs`, which refuses any database other than `127.0.0.1:55436`,
any Redis other than `127.0.0.1:56383` and HTTP ports below 9700.

## Database changes

Models live in `src/modules/link-in-bio/models`. After a change:

```bash
export DATABASE_URL=postgres://postgres:spike@127.0.0.1:55436/rw_spike REDIS_URL=redis://127.0.0.1:56383
npm run db:generate
```

and commit the new migration with the model change.

## Releasing

Bump `version` in package.json, add the CHANGELOG entry, tag `vX.Y.Z` and push the tag: `release.yml` runs the
full CI suite and publishes to npm through trusted publishing (OIDC, provenance attached).
