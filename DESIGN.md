# Design

Since 2026-11-19 the community hub uses the shared **App shell** (see `APP-SHELL.md`; `app/app-shell.css` and `components/app-shell.tsx` are copied byte for byte
from the reference site). It replaced the earlier one-off look, whose small uppercase labels, unloaded or
render-blocking fonts and low-contrast text failed the design floor (review 2026-11-11).

- Sidebar of states (All / Draft / Active / Done with counts; a pill row on phones), head with h1, count,
  search and **Add a room**, the composer in place (name, what happens here, optional link, state). A bad
  link shows an error under the fields instead of failing silently.
- Rows: name, one line of description, date added, an "Open room" link when one is saved (44px, opens in a
  new tab and says so), a state picker that reads like a status pill (text + tint, a real 44px select) and
  Remove. Removing is undoable for a few seconds; no confirm dialog.
- Backup section: Export JSON and Import JSON as 44px plain buttons with a status line.
- The empty directory says rooms are kept in this browser only and how to start (add or import); the
  decorative orbit is gone, so the rooms are in the first phone viewport.

Floor: Geist via `next/font` (variable on `<html>`), text ≥ 12px, controls ≥ 44px, 4.5:1 text contrast in
light and dark, 3px focus ring, forced-colors support, no horizontal scroll at 320px. `/more-projects`
redirects (308) to https://bookchaowalit.com/ and the footer links there.
