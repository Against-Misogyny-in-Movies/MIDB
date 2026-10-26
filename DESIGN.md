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

The landing page (`/`) takes its layout and type from a pinned style reference (Podscan.fm), on the site's violet palette: a quiet data console where the violet action carries the page. It uses the site tokens directly; the only extra tokens are the `--l-*` custom properties scoped to `.landing` in `app.css` (fonts, two shadows, the text colour on violet fills, a lilac wash, one violet shade per source).

- **Type.** Inter Tight 700 for the hero (60px, line-height 1) and section titles (36px), 600 for card headings; system UI stack for everything else, tracked tight (-0.025em). Monospace only for the year tiles.
- **Colour.** The site palette: `--surface` ground, `--surface-raised` cards and search bar, `--ink` / `--ink-muted` text, `--border` hairlines. `--brand` violet for the Search button, links, focus and stat icons. Sources get four violet shades: Bechdel Test `--brand`, Unconsenting Media `#4a0080`, Does the Dog Die `#a030d8`, TMDB `#2d0050` (lighter shades in dark mode, with dark glyphs). The verdict plate and year tiles use a lilac wash (8% brand).
- **Badges.** Pills (radius 9999px) keep the status colours because they carry meaning: `--success`, `--warn`, `--danger` on their soft fills, `--secondary-soft` for no data. The same tones mark the six verdict tiers, as on the title pages.
- **Shapes.** Buttons 8px, cards and inputs 12px, pills 9999px. Hairline borders do the separation; the one large shadow (`0 25px 50px -12px`) lifts the data card.
- **Layout.** Centred hero stack, then the floating data card, a 4-up source grid (2-up, then 1-up on smaller screens), a lilac plate, a one-line About. 64px between sections.
- **Data first.** The hero's stat line and the data card show real seeded values (`$lib/server/data/catalogue.ts`). No invented numbers, no decorative imagery.
