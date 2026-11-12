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
- **Sign-in:** `/auth` and `/user/security` are MIDB's own pages. Buttons and fields have text labels, errors, confirmations and a failed load on `/user/security` are announced (`role="alert"` / `role="status"`), and every action works from the keyboard. Opening a rename or confirmation on `/user/security` moves focus into it, and closing it returns focus to the button that opened it, or to the list heading when the row is gone. On a touch screen every button is at least 44px tall. The Cloudflare Turnstile widget on sign-up is Cloudflare's, and its accessibility is theirs.

## Reporting a barrier

[Open an accessibility issue](https://github.com/Against-Misogyny-in-Movies/MIDB/issues/new?template=accessibility.yml) with the page, the browser and device, the assistive technology and its version, what happened and what was expected. Barriers are treated as bugs. This is a volunteer project, so there is no fixed response time.
