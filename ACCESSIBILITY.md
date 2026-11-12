# Accessibility

The site should be usable without sight, with low vision, with limited hand movement, with colour-vision differences and with motion sensitivity. A shortfall is a bug (see Reporting a barrier).

## Target

[WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA. MIDB has not been audited by a third party and makes no conformance claim.

## What the site does

- **Theme:** light and dark. The first visit follows the system setting, and the choice is kept in the browser.
- **Motion:** every animation and transition is gated on `prefers-reduced-motion` (`.claude/rules/code-standards.md`, Components).
- **Status:** status is always written out. Each verdict and source state is a labelled badge, never a colour alone.
- **Focus and loading:** keyboard focus has a visible ring (`src/app.css`). Streamed data fills reserved space and marks itself `aria-busy` instead of moving the page.
- **Content warnings:** content warnings are plain text on the page, not hidden behind hover.

## Known gaps

- **No automated check yet.** No automated accessibility audit runs in CI. The Playwright e2e specs cover layout only.
- **Sign-in:** the sign-in screen is Hanko's web component, and its accessibility is Hanko's.

## Reporting a barrier

[Open an accessibility issue](https://github.com/Against-Misogyny-in-Movies/MIDB/issues/new?template=accessibility.yml) with the page, the browser and device, the assistive technology and its version, what happened and what was expected. Barriers are treated as bugs. This is a volunteer project, so there is no fixed response time.
