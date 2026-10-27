# Design

The visual system of MIDB, as built. Tokens and shared classes live in `src/app.css`; the rules agents follow are in `AGENTS.md` (_Components_, _Styling_).

## Idea

A quiet data console on the project's violet palette. Layout, type and components follow a pinned style reference (Podscan.fm, supplied by the maintainer); colour stays MIDB's own. The data is the hero: verdicts, sources and their values carry the colour, everything else stays neutral.

## Colour

Restrained: tinted neutrals, one violet for actions, four violet shades for sources, and the status colours only where a value is a real signal. Every value is defined once with `light-dark()`, so both themes come from the same token.

| Role          | Token                                                            | Use                                                                  |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Ground        | `--surface`, `--surface-raised`, `--surface-sunken`              | Page; cards, header, inputs; tracks and row hovers                   |
| Text          | `--ink`, `--ink-muted`                                           | Body and headings; secondary text and field names                    |
| Lines         | `--border`, `--border-strong`                                    | Hairlines and card edges; hover and input borders                    |
| Brand         | `--brand`, `--brand-strong`, `--on-brand`, `--brand-wash`        | The main button, links, focus, active states, the women data series  |
| Ink fill      | `--ink`, `--on-ink`                                              | The logo pill, the nav "Sign in" pill                                |
| Sources       | `--src-bechdel`, `--src-um`, `--src-ddd`, `--src-tmdb`           | Icon disks and stat icons: four shades of the violet                 |
| Status        | `--success`, `--warn`, `--danger` + `-soft`, `--secondary-soft`  | Verdicts and badges only. Solid on soft passes 4.5:1 in both themes. |
| Gender series | `--seg-female`, `--seg-male`, `--seg-nonbinary`, `--seg-unknown` | Representation bars and swatches. Men are neutral.                   |

## Type

- **Display:** Inter Tight 700 (`.display`, `--font-display`). Hero 60px at line-height 1; page titles 30–60px; section and card headings 18–24px at 600.
- **Text:** the system UI stack (`--font-body`) at 16px / 1.5, tracked tight (-0.02em) so it reads as data. 14px for labels and buttons, 12px for captions.
- **Mono:** the system mono stack (`--font-mono`), only for year tiles.
- Field names are sentence case, never uppercase. Numbers are tabular.

## Shapes and elevation

- Radius: 8px buttons, 12px cards and inputs, 9999px pills, badges and the logo.
- Hairline borders do the separation. `--shadow-subtle` under the sticky header, `--shadow-md` for dropdowns and the poster, `--shadow-float` for one floating surface (the sign-in card), `--shadow-brand` on the brand button's hover.

## Components

- **Header:** sticky, 64px, `--surface-raised` with a hairline. The logo is "MIDB" in an ink pill; "Sign in" is an ink pill button at the right edge.
- **Card** (`.card`): the one container. Metric sections are `<details>` cards with a source icon disk, an 18px title, a status `Badge` and a chevron.
- **Badge** (`ui/badge.svelte`): pill with a tone from `tones.ts`: green (`pos`), amber (`mid`), rose (`neg`), grey (`neutral`), violet (`brand`). The tones mirror `verdict.ts`, so a badge and the verdict above it never disagree.
- **Buttons** (`.btn`): brand for the one main action per view, ink for a secondary filled action, ghost beside a filled one.
- **Verdict:** a soft-tone callout with the axis, the tier in its tone (24px Inter Tight), a two-line summary and a disclosure listing the signals. Fixed height so the DDD stream never shifts the page.
- **Stat line:** source icon + label + value, used for the title page's source index.
- **Highlight** (`.highlight` + `.tone-*`): a term in its colour over a soft highlighter stroke. Status tones (`pos`, `mid`, `neg`, `neutral`) for values, source tones (`bechdel`, `um`, `ddd`, `tmdb`) for source names. Used in sentences on the landing; badges stay the form for values in data views.
- **Chip** (`.chip`): a 30px hairline pill for secondary links (Methodology, a source's domain) and the hero's film pager.
- **Marker rows:** a 1.375rem round marker, soft tint + solid glyph when active, hairline ring when not (Bechdel ladder in brand, UM flags in warn/success).
- **Search bar:** 12px input with a leading icon and the brand Search button inside it (landing); a compact field in the header elsewhere.

## Pages

- **Landing:** the hero is a sentence about a real film ("Inception passes the Bechdel Test and has no Unconsenting Media concerns."), its clauses in their badge tones with a highlighter stroke, cycling through popular films with the titles as chips that double as the timer; then the search bar. The sections keep their cards and the hero's voice: Inter Tight sentences with highlighted terms and chip links. Four source cards (icon disk, the source name highlighted in its shade, real counts in the sentence); a lilac Verdicts plate with each tier highlighted in its tone; one centred About sentence. Everything shown is real (`$lib/server/data/catalogue.ts`).
- **Title page:** poster beside the title, overview, the two verdicts, the source stat line, then section cards: Bechdel Test, Unconsenting Media, Does the Dog Die, Cast and crew, Details.
- **Methodology:** title and lede, a sticky "On this page" list, then one card per topic with its icon disk.
- **Account, sign-in, errors:** centred columns of cards; the sign-in card floats.

## Motion

One authored moment: the landing hero's sentence change (a 0.5s fade with a slight rise and blur, timed by the active chip's fill). Otherwise `0.15s ease` on colour, border and chevron changes, a 2px brand navigation bar, a pulsing skeleton while Does the Dog Die streams. All gated on `prefers-reduced-motion`. No entrances, lifts or glows.

## Browser surfaces

Focus rings (2px brand outline), selection (brand at 24%), caret (brand), scrollbars (`--border-strong`), `select` (8px radius) and the Hanko sign-in and profile elements are themed from the tokens in the base layer.

## Avoid

Kickers above headings, uppercase tracked labels, coloured side borders over 1px, gradients, hover lifts and glows, pulsing badges, arrow glyphs as icons, decorative imagery, hues outside the violet shades and status tokens, and placeholders for features that do not exist.
