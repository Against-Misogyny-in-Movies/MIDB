# Plan: whole-site redesign (Impeccable)

Driven by the Impeccable design skill (`.claude/skills/impeccable`, installed in this PR): `distill` + `quieter` over every surface, then `polish`. The skill's launcher binary could not run in the cloud sandbox, so its references (`craft-floor.md`, `distill.md`, `quieter.md`, `new-work.md`) were applied by hand.

## Why

The UI carried the stock look AI tools ship by default: an italic serif kicker above every heading, Newsreader display serif, tiny uppercase letter-spaced labels on every field, icons in tinted circles on every card, three identical icon cards, a colored left border on the verdict cards, gradient chips with a pulsing badge and hover lift, `→`/`↗` text glyphs as icons. It also shipped elements that did nothing: Blog and About links that 404, a comments skeleton that loads forever, a "Rate a film yourself" link with no rating UI behind it, a submit button on a live search, a mobile back-to-top button, and nine unused `ui/` primitives.

## Direction

Mode: the title pages are **Read/Operate** (a reference checked before pressing play), the landing page a quiet **Persuade**, `/resources` **Read**.

- **Thesis.** A title page reads like a content-advice notice: what it is, the verdict, the evidence. Not a dashboard of cards.
- **Own world.** Plain ground, ink type, hairline rules instead of boxes. One brand violet (kept: the project's existing purple) for links, focus and the "women" data series only. Status colors appear only where they carry a verdict.
- **Type.** One family, Archivo. Display is Archivo condensed (`font-stretch: 72%`) at 750–800 weight, echoing film credits and certificates; body is Archivo at normal width. Labels are sentence case, never uppercase-tracked. Numbers are tabular.
- **First viewport (title page).** Poster beside the title at every width (small on phones), meta line (year, genres), overview, then the two verdicts and a three-item source index that jumps to each section. Facts (budget, runtime…) move to a closing "Details" list.

## Removed

- Comments skeleton (no comments feature yet; it implied loading that never finishes).
- Blog / About nav and footer links (routes do not exist).
- "Rate a film yourself" landing link (no rating UI exists).
- Metric chips + pulsing badge (replaced by a plain source index).
- Verdict hover popover (replaced by an inline disclosure that works on touch).
- DDD fixed-position comment tooltip (comments expand inline at every width).
- Back-to-top button, hero search wrapper and its submit button.
- Unused primitives: `ui/` (button, linkButton, checkboxTile, radioTile, tile, tileGrid, skeleton, block, tooltip, progressbar, backToTop), `movies/media/tile`, `movies/sections/description`, `search/searchForm`, with their stories and tests.
- Verdict `icon` field (nothing renders it now).

## Added

- TMDB attribution in the footer (required by the TMDB API terms).
- Movie runtime and full release date in the details list (already in the data, never shown).
- Title overview under the title (already in the data, never shown).
- Global base styles for focus rings, selection, links, `select`, scrollbars.
- `PRODUCT.md` / `DESIGN.md` for the Impeccable skill.

## Steps

1. Tokens + base styles (`app.css`, `app.html`).
2. Shell: layout, navbar, menu, search, footer, progress bar, theme toggle.
3. Landing, search field and results.
4. Title pages: header, verdict, source index, representation, metric sections, details.
5. Resources page.
6. Error, auth, user pages.
7. Delete dead code; update tests, e2e specs, `architecture.md`, `AGENTS.md` styling rules.
8. Verify: check, lint, unit, db, build; screenshots light/dark, desktop/mobile.

## Copy pass (follow-up)

Same skill, `clarify` reference. Every user-facing string rewritten to essentials, third person, one term per concept (film / series, verdict, warning, flag, concern, source).

- Landing: the motto "Know before you watch." and its subhead are replaced by one plain headline stating what the site covers ("Sexual violence warnings and representation of women in films and series"). "What we check" becomes "Sources" (adds TMDB, which feeds the representation verdict); "How MIDB is built" becomes a one-sentence "About".
- `/resources` ("Methodology"): taglines and the four template subheadings per source removed; each source is two or three plain paragraphs; the verdict tier rules are stated directly from `verdict.ts`.
- Removed claims the code does not back: "ratings submitted by the MIDB community" (no rating UI) and DDD warnings "sorted by margin of the vote and grouped by category" (the client does neither).
- Verdict summaries and signal labels shortened; em dashes removed from signal labels ("Women in cast", "Women in top 5 billed", "Women in key crew").
- Title pages: DDD "trigger tags" → "warnings"; no-data lines shortened; `<title>` added to film and series pages.
- `AGENTS.md` copy rules: third person on the landing page too, no slogans, essentials only, terminology list.

- No "How …" phrasing anywhere: the nav item, page title and every "How it works / How this works / How verdicts work / How it is used" link are now "Methodology".

## Landing page redesign (follow-up)

The landing now follows a pinned style reference (Podscan.fm, supplied by the user): white canvas, zinc greys, one emerald action, Inter Tight display. Mapped onto MIDB without inventing claims:

- Hero: headline, search bar with a working emerald Search button (`MovieSearchState.submit()`), stat line of real counts (`getCatalogueCounts`).
- Floating data card (the reference's live feed): most IMDb-voted rated films with Bechdel and UM badges (`getMostVotedRatedFilms`). Rows without a TMDB id run their title through search, so the card works before `db:backfill:tmdb`.
- Four source cards with categorical icon disks; a fog plate with the six verdict tiers; one-line About.
- Palette scoped to `.landing` (`--l-*`), with dark values. Button fill `#047857` instead of `#059669` for AA contrast.
- Found while checking the data: `title_bechdel.num_votes` is IMDb's vote count, so the Bechdel section's "Based on N votes." mislabelled it. Line removed.
- Follow-up from the user: "use the purple colour palette". The landing keeps the reference's layout and type but now uses the site tokens: violet Search button, links and stat icons, four violet shades for the source disks, a lilac wash for the verdict plate and year tiles. The emerald, zinc and pure-white canvas are gone. Verdict and data badges keep the status colours (green / amber / red) because they carry meaning, as on the title pages.
