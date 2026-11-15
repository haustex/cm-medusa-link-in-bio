# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | yes |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Report it privately:

- through GitHub: **Security → Report a vulnerability** on
  [haustex/cm-medusa-link-in-bio](https://github.com/haustex/cm-medusa-link-in-bio/security), or
- by e-mail to [dev@hauskayu.com](mailto:dev@hauskayu.com), subject "Security: medusa-link-in-bio".

Include the plugin and Medusa versions, what an attacker can do, and steps to reproduce. We will confirm that we
received the report, keep you updated while we fix it, and credit you in the release notes if you wish.

## Scope

Of particular interest:

- making `/l/{key}` redirect anywhere other than the URL an admin saved for that item (open redirect), or to a
  non-`http(s)` scheme;
- storing a `javascript:`, `data:` or otherwise unsafe URL through the Admin API;
- reading or changing pages and items without an Admin login, or reading unpublished pages through the Store API;
- recovering anything about a visitor from the click tables (they hold item, day and count only);
- bypassing the rate limit on the public routes in a way that lets one client inflate counts cheaply;
- generating a QR code for a URL that is not one of the plugin's stored addresses.

## Operating the plugin safely

- Set `storefront.url` to your real origin; every internal link is built from it.
- Run Redis (Cache Module) in production so the rate limit is shared by every server process.
- Keep `count_bots` off; click counts are an indication, not an audit trail.
