# Community Hub

A browser-only directory of community rooms (channels and resources): add a room with a name, short description,
state and optional http(s) link, search the index, change state, remove, and back it up as JSON. Everything lives in
this browser's `localStorage`; there is no forum, membership or sync.

Live: https://community.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does

- Add rooms (name up to 80 characters, description up to 280, state Draft / Active / Done, optional link).
- Links must be absolute http(s); `javascript:`, `data:` and relative links are rejected. "Open channel" opens the
  saved link in a new tab.
- Search by name or description; change state; remove an entry.
- Export the directory as JSON and import a backup (validated, merged by id). Corrupt saved data is repaired on load.
- `/api/mcp` JSON-RPC tools: `describe_directory` (storage format, limits, seed room) and `validate_room` (same rules
  as the add form). The server never sees your entries.

## What it does not do

- No forum, boards, threads, profiles, accounts, membership or sync between devices.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: directory rules, MCP handler + route, robots/sitemap/origin, home render, Sentry scrubbing
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (with a line-coverage gate) and the shared security
scan on every push and PR to `main`.

## Configuration

- `NEXT_PUBLIC_SITE_URL` (optional): canonical origin for metadata, `/sitemap.xml` and `/robots.txt`. Defaults to
  `https://community.bookchaowalit.com`.
- `NEXT_PUBLIC_SENTRY_DSN` (optional): turns on error reporting; unset means Sentry is off.

## Code map

- `lib/channels.ts`: room rules, URL sanitising, stored-data repair, search, JSON export/import (used by the page and
  the MCP route).
- `lib/mcp.ts` + `app/api/mcp/route.ts`: stateless JSON-RPC endpoint.
- `lib/site.ts`: canonical origin.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped.
- `app/more-projects/page.tsx`: portfolio link page (copied per repository, not a package).
