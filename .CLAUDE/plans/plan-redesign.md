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

## Site-wide system (follow-up)

The user asked to carry the landing's system to every page, keeping the purple palette. Done:

- Global tokens and classes in `app.css`: Inter Tight replaces Archivo for `.display`, system UI text tracked -0.02em, `.card`, `.btn` variants, `.disk`, `--src-*` shades, `--brand-wash`, shadows. The `.landing`-scoped tokens are gone.
- `ui/badge.svelte` + `$lib/media/utils/tones.ts` (tested): one badge and one value → tone mapping, mirroring `verdict.ts`.
- Sticky 64px header with an ink logo pill and an ink "Sign in" pill; anchored sections and sticky columns offset by 5rem.
- Title pages: section cards with source icon disks and toned status badges; the source index becomes a stat line; verdicts, poster and tables on 12px radii and pill bars; DDD categories and UM candidates as badges.
- Methodology: one card per topic with its icon disk; tier legend as badges on a lilac plate.
- Error, sign-in (floating card), profile (form card, account list card, ghost Sign out), history and settings pages.
- Bug fixed: `LogoutButton` created its Hanko client at render, which needs `document`; since Sign out moved onto the server-rendered `/user/profile`, that page would have returned a 500. The client is now created on click.

## Landing hero: live sentence (follow-up)

The user asked for a better motto, phrase or visual. Eight directions were rendered with real data (phrases, logo, verdicts, oversized search, live sentence, content-advice card, Bechdel chart); the user picked the live sentence and asked to improve it:

- Only films with both a Bechdel rating and an Unconsenting Media entry (`requireUmEntry`), so no sentence ends in "no entry".
- `filmSentence()` (tested) builds the clauses and picks "and" / "but".
- The film title links to its page (or searches when it has no TMDB id).
- Clauses as coloured text with a highlighter stroke in their badge tone, instead of filled blocks.
- All sentences stacked in one grid cell: zero layout shift.
- Title chips as the pager; the active chip's fill is the timer. Pauses on hover, focus and a pause button (WCAG 2.2.2); no rotation under reduced motion.
- A visually hidden `h1` keeps the site's name for assistive tech and search; it shows when the database is down.
- The "Popular films" data card is retired: it listed the same films the hero now cycles through.

## Landing sections in the hero's voice (follow-up)

The user asked to restyle the sections under the hero to match it, then narrowed it: keep the cards and the hero.

- `.highlight` + `.tone-*` and `.chip` move from `filmSentences.svelte` into `app.css`, so the hero and the sections share one highlighter stroke and one pill link.
- Source cards: icon disk, then one Inter Tight sentence opening with the source name highlighted in its violet shade. The Bechdel and Unconsenting Media sentences carry the real counts, so the separate stat line under the search bar is gone. Methodology and the source's domain are chips.
- Verdicts: the lilac plate holds a lead sentence beside three tier sentences, each tier highlighted in its badge tone (mirrors `SAFETY_META` / `REP_META` and `tones.ts`).
- About: one centred sentence and a Source code chip.
- The "Popular films" card stays retired: the hero cycles through the same films.

## Status colours on the palette (follow-up)

The user found the green / amber / red break the violet system but kept them because they carry meaning. Three token-only variants were rendered on the landing and a title page: A (jade, copper, raspberry: same meanings, hues pulled toward the violet), B (violet for good, colour only to warn), C (violet to rose, all analogous). Picked B:

- `--success` is `--brand` (soft: brand 16% on `--surface-raised`, the strength of the source highlights, so the pill still reads on a lilac plate). A good value reads in the site's own colour; only caution (`--warn`, copper) and harm (`--danger`, raspberry) leave the palette, so they stand out more than before.
- C was dropped: caution (orchid) and harm (raspberry) were close to the same pink, and that is the distinction the product cannot blur.
- Colour-blind check (Machado 2009 simulation, OKLab distance x100): good vs harmful under deuteranopia goes from 5.8 (green / red) to 21.6; caution vs harmful from 1.0 to 11.1, because harm is now darker than caution, not only a different hue.
- Contrast: every solid token passes 4.5:1 on its soft fill and on `--surface` in both themes (lowest: light copper on its fill, 4.65).
- No copy names a colour, so no wording changed. Tier names always carry the meaning; colour is never the only signal.
