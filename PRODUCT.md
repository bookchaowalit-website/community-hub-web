# Community Hub — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `community`, evidence Live→Prototype: the forum,
> boards, threads, profiles and support-request claims were removed) on 2026-10-23.

## What it is

A client-only directory of community rooms for one person's practice, kept in this browser's `localStorage`.

## Who it is for

A solo practitioner who wants one calm list of the channels they use, and a portfolio visitor looking at the UI.

## What works today

1. One seed room (Discord, "Daily standups"); add rooms with a name (≤ 80), description (≤ 280), state (Draft, Active,
   Done) and an optional absolute http(s) link. Unsafe or relative links are rejected with a form error.
2. Search the index by name or description, open one room, change its state, open its link in a new tab, remove it.
3. Export the directory as versioned JSON; import a backup, which is validated and merged by id with a status notice.
4. Saved data is repaired on load (bad JSON, unknown states, impossible dates, overlong text).
5. `/api/mcp` answers JSON-RPC with `describe_directory` and `validate_room`; unknown tools and methods return
   JSON-RPC errors. It never receives the visitor's entries.
6. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No forum, boards, threaded discussions, user profiles, membership or moderation.
- No account, sharing or sync; clearing site data deletes the directory unless it was exported.

## Live URL and deploy state

- Live: https://community.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-community-frontend` is deployed by CLI only. Its Git link names the old repository
  (`bookchaowalit/bookchaowalit-community-frontend`), so a push to `main` does not deploy. The last production deploy
  is the CVE patch (2026-10-23 12:12, CLI, commit f22f0fc); later commits (Vitest, Sentry, canonical origin fix) stay
  undeployed until the owner reconnects Vercel Git to this repository (owner action D9).
- `NEXT_PUBLIC_SENTRY_DSN` is set on the Vercel project (Sentry project `community-hub-web`, org `personal-yu0`); it
  takes effect on the next deploy.

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route. No server storage, no personal data collected.
