# Community Hub — design direction

<!-- impeccable:design-schema 1 -->

## World

Community Hub is a neighborhood field note: a dark blue directory, warm coral wayfinding, and a small orbital motif that suggests rooms around a practice. The page has one index and one open room instead of a grid of generic resource cards.

## Direction contract

- Seed: `d150cb30`; assigned grounded candidate 3.
- First viewport: the room-finding thesis and signal-map motif establish the product before the directory.
- Form: searchable channel index, one active room panel, and an inline add form.
- Interaction: select a room, search, add a room, and remove a local entry.
- Material: ink navy, slate blue lines, paper-warm text, coral wayfinding, mint active signal.
- Responsive rule: the index moves above the open room and the add form stacks below.

## Constraints kept honest

Entries remain browser-local. The product does not claim membership, messaging, or synchronized community infrastructure.


---

## Storybook

Storybook 10 (`@storybook/nextjs-vite`) shows this design system with the app's real CSS, tokens and fonts.

```bash
npm run storybook        # http://localhost:6006
npm run build-storybook  # static build in storybook-static/ (CI: .github/workflows/storybook.yml)
```

- **Foundations/Tokens** reads every CSS custom property the app defines at runtime, so it never drifts from the code.
- **Design/DESIGN.md** renders this file.
- **Components/**, **Sections/** and **Pages/** show the UI with mock data only (no network, analytics off).
- Toolbar: locale, theme (light / dark, when the app has a dark theme), viewports 320 / 375 / 768 / 1440. The a11y panel runs axe (WCAG 2.2 AA).
- Rule: a new shared component or page section ships with a story in `stories/`.
