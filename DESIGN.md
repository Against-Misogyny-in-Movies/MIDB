# Design

The visual system of MIDB, as built. Tokens and shared classes live in `src/app.css`; the rules agents follow are in `.claude/rules/style-standards.md` and `.claude/rules/code-standards.md` (Components).

## Idea

A quiet data console on the project's violet palette. Layout, type and components follow a pinned style reference (Podscan.fm, supplied by the maintainer); colour stays MIDB's own. The data is the hero: verdicts, sources and their values carry the colour, everything else stays neutral.

## Colour

Restrained: tinted neutrals, one violet for actions, four violet shades for sources. A good value stays violet; colour leaves the palette only to warn (copper for caution, raspberry for harm). Every value is defined once with `light-dark()`, so both themes come from the same token.

| Role          | Token                                                                                                                    | Use                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ground        | `--surface`, `--surface-raised`, `--surface-sunken`                                                                      | Page; cards, header, inputs; tracks and row hovers                                                                                                    |
| Text          | `--ink`, `--ink-muted`                                                                                                   | Body and headings; secondary text and field names                                                                                                     |
| Lines         | `--border`, `--border-strong`                                                                                            | Hairlines and card edges; hover and input borders                                                                                                     |
| Brand         | `--brand`, `--brand-strong`, `--on-brand`, `--brand-wash`                                                                | The main button, links, focus, active states, the women data series                                                                                   |
| Ink fill      | `--ink`, `--on-ink`                                                                                                      | The logo pill, the nav "Sign in" pill                                                                                                                 |
| Sources       | `--src-bechdel`, `--src-um`, `--src-ddd`, `--src-tmdb`                                                                   | Icon disks and stat icons: four shades of the violet                                                                                                  |
| Status        | `--success`, `--warn`, `--danger` + `-soft`, `--secondary-soft`                                                          | Verdicts and badges only. `--success` is the brand violet; `--warn` copper, `--danger` a darker raspberry. Solid on soft passes 4.5:1 in both themes. |
| Gender series | `--seg-female`, `--seg-male`, `--seg-nonbinary`, `--seg-unknown`                                                         | Representation bars and swatches. Men are neutral.                                                                                                    |
| Avatars       | `--avatar-plate`, `--avatar-face`, `--avatar-hair`, `--avatar-dress`, `--avatar-mark`, `--avatar-light`, `--avatar-line` | Profile portraits only: a violet ramp. Every face takes the one `--avatar-face` tone.                                                                 |

## Type

- **Display:** Inter Tight 700 (`.display`, `--font-display`), self-hosted from `static/fonts` (600 and 700 in the latin, latin-ext and vietnamese subsets, `font-display: swap`, the latin files preloaded). Hero 60px at line-height 1; page titles 30–60px; section and card headings 18–24px at 600.
- **Text:** the system UI stack (`--font-body`) at 16px / 1.5, tracked tight (-0.02em) so it reads as data. 14px for labels and buttons, 12px for captions.
- **Mono:** the system mono stack (`--font-mono`), only for year tiles.
- Field names are sentence case, never uppercase. Numbers are tabular.

## Shapes and elevation

- Radius: 8px buttons, 12px cards and inputs, 9999px pills, badges and the logo.
- Hairline borders do the separation. `--shadow-subtle` under the sticky header, `--shadow-md` for dropdowns and the poster, `--shadow-float` for one floating surface (the sign-in card), `--shadow-brand` on the brand button's hover.

## Components

- **Header:** sticky, 64px, `--surface-raised` with a hairline. The logo is "MIDB" in an ink pill; "Sign in" is an ink pill button at the right edge.
- **Card** (`.card`): the one container. Metric sections are `<details>` cards with a source icon disk, an 18px title, a status `Badge` and a chevron.
- **Section footer:** under a metric section's body, the source link with its "Updated <date>" (`.label`, `tabular-nums`, a `·` between) as one item, then Methodology as its own. The date shows only beside a source link and only when a sync is recorded; the group wraps as a unit, so the date never pairs with Methodology.
- **Badge** (`ui/badge.svelte`): pill with a tone from `tones.ts`: violet (`pos`, `brand`), copper (`mid`), raspberry (`neg`), grey (`neutral`). The tones mirror `verdict.ts`, so a badge and the verdict above it never disagree.
- **Buttons** (`.btn`): brand for the one main action per view, ink for a secondary filled action, ghost beside a filled one. A disabled button is the same shape at 55% opacity with a not-allowed cursor. On a coarse pointer (`(pointer: coarse)`) every button is 44px tall, the pill included.
- **Input** (`.input`): a 44px text field, 12px radius, `--border-strong` hairline that darkens on hover and turns brand with a soft ring on focus; the colour change is gated on `prefers-reduced-motion`.
- **Notice** (`ui/notice.svelte`): an inline message in a 12px-radius plate, `--danger-soft` with `--danger` text for an error, `--success-soft` with `--success` for a confirmation and `--warn-soft` with `--warn` for a warning that needs no action from the reader (the moderators' stale-sync line, and the outcome of a comment that is held or rejected). It sits beside the action it reports on.
- **Plate** (`.plate`): a `--surface-sunken` block, 12px radius, 16px padding, under the row it acts on. The delete confirmation, the report form and a moderator's action panel use it; it is never nested in another plate and never holds a card.
- **Verdict:** a soft-tone callout with the axis, the tier in its tone (24px Inter Tight), a two-line summary and a disclosure listing the signals. Fixed height so the DDD stream never shifts the page.
- **Stat line:** source icon + label + value, used for the title page's source index.
- **Highlight** (`.highlight` + `.tone-*`): a term in its colour over a soft highlighter stroke. Status tones (`pos`, `mid`, `neg`, `neutral`) for values, source tones (`bechdel`, `um`, `ddd`, `tmdb`) for source names. Used in sentences on the landing; badges stay the form for values in data views.
- **Chip** (`.chip`): a 30px hairline pill for secondary links (Methodology, a source's domain) and the hero's film pager.
- **Comments** (`comments/`): the last section card on a title page, a header-only `CollapsibleSection` with no icon disk.
  - A composer (a `.input` grown to three rows, the brand `Comment` button, a `tabular-nums` counter), a sort toggle (two `.chip`s; the pressed one takes a `--brand` border and text), then threads separated by hairlines. While the check runs, the field is read-only, the button reads "Checking…" in the sunken ink-muted look and a polite status line under the composer says so; that slot keeps a notice's height (one line, three on a phone) until the outcome `Notice` (success for a posted comment, warn for one held or rejected) replaces the line in place. The list sits in a slot with a reserved height and `aria-busy`, with the pulsing three-row skeleton, so the section never shifts when it fills.
  - A comment: a 28px avatar, the display name at 600, a `Badge` for "You" or the author's role, the date, then the text. Replies are one level, indented under a 1px `--border` rule that sits under the avatar, with "in reply to @name" in `.label` for a reply to a reply. A removed comment with replies is one muted line.
  - **Quiet action** (`comments/commentAction`): 14px 500 `--ink-muted` text with no fill until hover (`--surface-sunken`), 32px tall and 44px on a coarse pointer. Votes are square icon actions (`ri-arrow-up-line`, `ri-arrow-down-line`) around a `tabular-nums` score; the reader's own vote is `--brand` on a 14% brand tint, set through `aria-pressed`. A comment the reader wrote has "Score n" in muted text and no vote buttons.
  - The author's own unpublished comments carry a status `Badge` from `commentStatusTone` (copper "Awaiting review", raspberry "Rejected", with the reason leading the `.label` line, then who sees it).
  - Every failure shows as a `Notice` under the control that caused it, naming what failed; none is a toast or a banner.
- **MIDB community reports** (`movies/metrics/communityReportsSection`): a metric section card after Unconsenting Media, closed by default, with a total in its badge. Counts are hairline rows (name at 600, figures in muted text with `tabular-nums` `--ink` digits, no coloured digits); the sexual row opens onto the eight concern flags in the marker language, a raised flag in `--warn`. The sexual row carries a "Show concerns" label beside its chevron. Under them, "This account’s report" with a status `Badge` and Edit, or the sign-in link; the form is a `.plate` of radio groups with one `.btn--brand` Save, and Delete replaces the actions row in place with a sentence and a confirming `.btn--ink` beside Cancel. "Counts look wrong" is a `.link` that opens a note plate. The counts slot reserves the full height of the counts (five category rows and the framing row), so nothing below it moves when they arrive.
- **Moderation** (`/user/moderation`): a 48rem column. Tabs are `.chip`s with a count (the selected one in `--brand`); the stale-sync warning is a `warn` `Notice` above them. Each queue is one `.card` of hairline-separated rows: the author line (avatar, name, comment count, date, status badge), the title link, the text, the classifier's categories as neutral `Badge`s only when present, the open reports as a reason `Badge`, its note and its date, then the actions. Approve and Dismiss are `.btn--ink`, the rest `.btn--ghost`; no row holds a brand button. Hide, reject, mute, ban and Reject all (the community reports of an account) open a `.plate` with a sentence that names the consequence, a reason where one is kept, and the confirming `.btn--ink` beside Cancel. In the community-report answers table, a flag where the reader and Unconsenting Media differ carries a `mid` `Badge` "Differs" and sorts first; a flag the reader was not asked reads "Not asked".
- **Avatar** (`user/avatars/`): a round tonal portrait of a feminist figure on the 40-unit `Portrait` grid. Each figure differs by hair, headwear, glasses and dress, the traits that survive at 24px; eyes, mouth and fine marks draw only from 32px up (`PORTRAIT_DETAIL_MIN` in `#lib/media/utils/avatars.ts`). Sizes: 24px in the navbar and moderation rows, 28px on a comment, 48px in the picker, 64px on the profile. An account with no choice gets the neutral outline.
- **Marker rows:** a 1.375rem round marker, soft tint + solid glyph when active, hairline ring when not (Bechdel ladder in brand, UM concerns in warn, the `noRape` reassurance in success).
- **Search bar:** 12px input with a leading icon and the brand Search button inside it (landing); a compact field in the header elsewhere.

## Pages

- **Landing:** the hero is a sentence about a real film ("Inception passes the Bechdel Test and has no Unconsenting Media concerns."), its clauses in their badge tones with a highlighter stroke, cycling through popular films with the titles as chips that double as the timer; then the search bar. The sections keep their cards and the hero's voice: Inter Tight sentences with highlighted terms and chip links. Four source cards (icon disk, the source name highlighted in its shade, real counts in the sentence); a lilac Verdicts plate with each tier highlighted in its tone; one centred About sentence. Everything shown is real (`#lib/server/data/catalogue.ts`).
- **Title page:** poster beside the title, a neutral `Badge` under the meta line that links to the MIDB community reports section ("N community reports", or "MIDB community reports" when the count is unavailable; it keeps its size while loading), overview, the two verdicts, the source stat line, then section cards: Bechdel Test, Unconsenting Media, MIDB community reports, Does the Dog Die, Cast and crew, Details, Comments.
- **Methodology:** title and lede, a sticky "On this page" list, then one card per topic with its icon disk.
- **Account, sign-in, errors:** centred columns of cards; the sign-in card floats. It stacks full-width actions: provider buttons in ink, a hairline "or", the passkey sign-in in brand and passkey sign-up in ghost; the Turnstile widget appears under them with its 65px slot reserved. The sign-in methods page is one card of hairline-separated rows (icon, name, "Added" date, ghost actions), with confirmations and renames in a `--surface-sunken` plate under the row. Each result (failure or confirmation) shows as a `Notice` beside its action: inside the open plate, under the row, or under the add and link buttons when the row is gone, never at the top of the page.

## Motion

One authored moment: the landing hero's sentence change (a 0.5s fade with a slight rise and blur, timed by the active chip's fill). Otherwise `0.15s ease` on colour, border and chevron changes, a 2px brand navigation bar, a pulsing skeleton while Does the Dog Die streams. All gated on `prefers-reduced-motion`. No entrances, lifts or glows.

## Browser surfaces

Focus rings (2px brand outline), selection (brand at 24%), caret (brand), scrollbars (`--border-strong`), and `select` (8px radius) are themed from the tokens in the base layer.

## Avoid

Green or red for "good" and "bad" (the status tokens carry that), kickers above headings, uppercase tracked labels, coloured side borders over 1px, gradients, hover lifts and glows, pulsing badges, arrow glyphs as icons, decorative imagery, hues outside the violet shades and status tokens, and placeholders for features that do not exist.
