# Design

The visual system of MIDB, as built. The landing page has its own pinned system, described last. Tokens live in `src/app.css`; the rules agents follow are in `AGENTS.md` (_Components_, _Styling_).

## Idea

A title page reads like a content-advice notice: what the title is, the verdict, then the evidence. The interface stays quiet so the two verdicts carry the colour. Type does the hierarchy; hairlines do the structure; boxes are rare.

## Colour

Restrained: tinted neutrals plus one brand colour. Every value is defined once with `light-dark()`, so both themes come from the same token.

| Role          | Token                                                            | Use                                                                             |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Ground        | `--surface`, `--surface-raised`, `--surface-sunken`              | Page, popovers and inputs, tracks and row hovers                                |
| Text          | `--ink`, `--ink-muted`                                           | Body and headings; secondary text and field names                               |
| Lines         | `--border`, `--border-strong`                                    | Hairline separators; input borders                                              |
| Brand         | `--brand`, `--brand-strong`                                      | Links, focus rings, active states, the women data series. Nothing else.         |
| Accent        | `--accent`                                                       | Non-binary data series, avatar details                                          |
| Status        | `--success`, `--warn`, `--danger`, `--info` + `-soft`            | Verdicts and per-item signals only. Solid token on its soft fill passes 4.5:1.  |
| Gender series | `--seg-female`, `--seg-male`, `--seg-nonbinary`, `--seg-unknown` | Representation bars and swatches. Men are neutral: no value judgment by colour. |

## Type

One family: **Archivo**, variable width and weight.

- Display: `.display`, `font-stretch: 72%`, weight 760–800, line-height 1.05. Titles, section headings, the wordmark. Sizes: landing headline `clamp(3rem, 10vw, 5.75rem)`, title `clamp(1.75rem, 6vw, 3.25rem)`, section `text-2xl`.
- Body: normal width, 400–600, line-height 1.55, measure capped near 65ch.
- Field names: `.label`, small, muted, sentence case. Never uppercase or letter-spaced.
- Numbers: `tabular-nums` wherever values line up.

## Structure

- Sections: `<details>` blocks separated by `border-t` hairlines, heading row = display title + status text + chevron (`collapsibleSection`).
- The only filled blocks are the two verdicts (tone soft fill, `rounded-md`) and explainer figures on `/resources` (`--surface-sunken`).
- Tables are real tables with hairline rows (cast/crew, DDD).
- Bands on the landing page: heading in a 14rem left column, content to its right, one column on phones.

## Components with a signature

- **Verdict** (`verdictCard`): axis name, tier in its tone (condensed), two-line summary, and a disclosure listing the signals. Fixed height so DDD streaming never shifts the page.
- **Source index** (`sourceIndex`): three anchors with the headline value of each source, values replaced in place.
- **Marker rows**: a 1.375rem round marker, soft tint + solid glyph when active, hairline ring when not (Bechdel ladder in brand, UM flags in warn/success).

## Motion

`0.15s ease` colour and chevron transitions, a 2px brand navigation bar, a pulsing skeleton for the DDD stream. All gated on `prefers-reduced-motion`. No entrances, lifts or glows.

## Browser surfaces

Focus rings (2px brand outline, 2px offset), selection (brand at 24%), caret (brand), scrollbars (`--border-strong`), `select` and the Hanko sign-in/profile elements are themed from the tokens in the base layer.

## Avoid

Kickers above headings, uppercase tracked labels, icons in tinted circles, coloured side borders over 1px, gradients, hover lifts and glows, pulsing badges, arrow glyphs as icons, grids of identical icon cards, and placeholders for features that do not exist.

## Landing page

The landing page (`/`) follows a pinned style reference (Podscan.fm): a quiet data console on a white canvas, zinc greys, one emerald action colour, and four categorical hues. Its tokens are the `--l-*` custom properties scoped to `.landing` in `app.css`, with dark values via `light-dark()`. Nothing outside `.landing` uses them.

- **Type.** Inter Tight 700 for the hero (60px, line-height 1) and section titles (36px), 600 for card headings; system UI stack for everything else, tracked tight (-0.025em). Monospace only for the year tiles.
- **Colour.** Canvas `#ffffff` / `#09090b`, fog `#f4f4f5`, ink `#18181b`, graphite `#52525b`, slate `#71717a`, hairline `#e5e7eb`. Emerald `#059669` for icons and focus; filled buttons use `#047857` so white text passes 4.5:1 (the reference's `#059669` gives 3.77:1). Source hues: Bechdel Test emerald, Unconsenting Media violet `#9333ea`, Does the Dog Die blue `#2563eb`, TMDB pink `#db2777`.
- **Badges.** Pills (radius 9999px): positive green, amber, negative rose, grey for no data. The same three tones mark the six verdict tiers.
- **Shapes.** Buttons 8px, cards and inputs 12px, pills 9999px. Hairline borders do the separation; the one large shadow (`0 25px 50px -12px`) lifts the data card.
- **Layout.** Centred hero stack, then the floating data card, a 4-up source grid (2-up, then 1-up on smaller screens), a fog plate, a one-line About. 64px between sections.
- **Data first.** The hero's stat line and the data card show real seeded values (`$lib/server/data/catalogue.ts`). No invented numbers, no decorative imagery.
