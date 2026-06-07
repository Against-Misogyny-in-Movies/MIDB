# Verdict cards — reveal contributing signals on hover/tap

## Context

The two-axis verdict (Content Safety + Women's Representation) shipped and works: a user can
tell at first gaze whether a title is safe/sexist. But there's a refinement issue.

The scorers cram detail into the `summary` string — e.g. the harmful summary is
`"Depicts sexual assault or abuse. (37 community trigger warnings)"`. The card clamps
`.summary` to **one line**, so that trailing detail is **cut off with an ellipsis**. The user
wants:

1. The summary to read cleanly on first render (no mid-sentence cutoff).
2. To see **which specific signals** drove each verdict — but **only on hover/tap**, so first
   render stays light and not data-heavy.

Decisions (confirmed with the user):
- **Hover detail = named signals + their state.** Safety lists each true UM flag by its human
  label + a "N community trigger warnings" line; Representation lists each present sub-signal
  ("Cast — 22%", "Leads — 1/5 women", "Crew — 30%", "Bechdel — 1/3").
- **Interaction = hover + tap**, reusing the dual pattern already in
  `movies/metrics/dddTags.svelte`: desktop reveals on mouseenter/focus, touch reveals an inline
  panel on tap.
- First render shows only label + clean summary + confidence line; the breakdown is hover/tap
  only.

The fix: move per-signal detail out of `summary` into a structured `signals: VerdictSignal[]`
on `AxisVerdict`, and render it in a per-card popover (desktop) / inline panel (touch).

---

## 1. `verdict.ts` — structured signals (the data change)

### New type + field
```ts
export interface VerdictSignal {
  label: string;        // "Rape on screen", "Cast — women"
  detail: string;       // "Flagged", "22%", "1/5 women", "3/3"
  present: boolean;     // true = contributing; false = informational "clear" line
  tone?: VerdictTone;   // per-signal color; falls back to card tone when omitted
}
```
Add `signals: VerdictSignal[]` to `AxisVerdict` (inherited by `SafetyVerdict`/`RepVerdict`).

### Module-scope helpers
- `UM_LABELS: Record<UmFlagKey, string>` built once from `UM_FLAGS` (`./metrics`) via
  `Object.fromEntries`.
- `subTone(score: number | null): VerdictTone` — `2→success`, `1→warn`, `0→danger`,
  `null→neutral`.

### `scoreSafety` changes
- **Delete the `dddNote` suffix.** Clean the three `SAFETY_META` summaries to count-free
  sentences ("Depicts sexual assault or abuse.", etc.).
- Build `signals`:
  1. Each TRUE UM flag, iterating `UM_FLAGS` in declaration order (stable), **skipping
     `noRape`** (mirrors `umFlagCount`): `{ label: UM_LABELS[key], detail: 'Flagged',
     present: true, tone: harmful→'danger' / caution→'warn' / else 'neutral' }`.
  2. DDD line when `ddd.tags.length > 0`: `{ label: 'Community trigger warnings',
     detail: \`${n} warning${n===1?'':'s'}\`, present: true, tone: dddEscalates ? 'danger' :
     'neutral' }` (reuse the existing `dddEscalates`).
  3. Safe/no-concern case (tier safe, no flags pushed): single sentinel
     `{ label: 'No sexual violence flagged', detail: 'Clear', present: false, tone: 'success' }`
     so the panel is never empty.
  - Unknown branch returns `signals: []` (card hides the trigger when empty).

### `scoreRepresentation` changes
- Compute raw shares once (`femaleShare(cast)`, `leadsFemaleShare(castMembers)`,
  `directorOrCrewShare(crew, crewDepartments)`) — reuse the same calls that feed `scoreShare`.
- Build `signals` (before the `signalsPresent < 2` check, single build site; included in both
  the unknown early-return and the final return), pushing only PRESENT sub-signals (skip when
  the score is `null` — covers null shares and series-bechdel):
  - Cast → `{ label: 'Cast — women', detail: \`${Math.round(castS*100)}%\`, tone: subTone(castScore) }`
  - Leads → `detail: \`${Math.round(leadsS * n)}/${n} women\`` where `n = min(5, castMembers.length)`
  - Crew → `{ label: 'Crew — women', detail: \`${Math.round(crewS*100)}%\` }`
  - Bechdel → `{ label: 'Bechdel', detail: \`${bechdel.rating}/3\` }`
  - Order: cast, leads, crew, bechdel.

---

## 2. `verdictCard.svelte` — hover popover + tap inline (the UI change)

Reuses the **dual pattern** from `movies/metrics/dddTags.svelte` (study it: focusable trigger
driving hover/focus state + an `expanded` `$state` toggling an inline panel for touch; honors
`prefers-reduced-motion`; flicker-free).

**Chosen container: per-card anchored popover, kept inside `verdictCard.svelte`.** Only two
cards exist, so the shared `position:fixed` tooltip dddTags uses (to avoid N tooltips across a
long list) buys nothing here; a `position:absolute` popover anchored to the card is simpler,
self-contained, and needs no scroll/resize-dismiss `$effect`.

- **Script:** `let open = $state(false)` (tap inline), `let hovering = $state(false)`
  (hover/focus). `const hasDetail = $derived(verdict.signals.length > 0)`.
- **Trigger:** wrap card content in a `<button type="button">` (keyboard-reachable) with
  `onmouseenter/onmouseleave/onfocus/onblur` → `hovering`, `onclick` → toggle `open`,
  `aria-expanded={open}`, descriptive `aria-label`. When `!hasDetail`, render a plain `<div>`
  (a "Not enough data" card isn't falsely interactive).
- **Markup:** a `.card-wrap` (`position: relative`, **holds the inline `--vt-fg/--vt-soft/
  --vt-on` custom props** moved up from `.card` so both card and popover read them) containing
  the card button, a `.detail-pop` (desktop hover popover, `role="tooltip"`), and an inline
  `.detail-inline` (touch). Both render the same signal list:
  ```svelte
  {#each verdict.signals as sig}
    <li class="sig" style="--vt-fg: var({toneTokens(sig.tone ?? verdict.tone).fg});">
      <span class="sig-dot"></span><span class="sig-label">{sig.label}</span>
      <span class="sig-detail">{sig.detail}</span>
    </li>
  {/each}
  <li class="sig sig--meta">Based on {signalsPresent} of {signalsTotal} signals</li>
  ```
  Each row colors its dot/text by the **per-signal** tone (fallback to card tone).

**Styles (match existing vocabulary; `@reference "../../../../app.css"` unchanged):**
- **Remove `overflow-hidden` from `.card`** (so the popover isn't clipped); rounded corners +
  `border-left` accent don't need clipping. Add `position: relative` to `.card-wrap` as anchor.
- **Relax the 1-line clamp → 2-line safety clamp** (`-webkit-line-clamp: 2`); won't trigger for
  the new short summaries but keeps zero-CLS insurance on narrow mobile.
- `.card` as button: reset (`bg-transparent border-0 text-left w-full`, font inherit), keep
  existing visual classes, `cursor: help`, `:focus-visible` ring `box-shadow: 0 0 0 2px
  var(--brand)` (mirrors dddTags).
- `.detail-pop`: `position:absolute; left:0; right:0; top: calc(100% - 1px); z-index: 30;`
  rounded-md, `border border-border`, surface tinted `color-mix(in oklab, var(--vt-fg) 4%,
  var(--surface-raised))`, shadow, `p-sm text-xs`; hidden→visible via opacity+translateY with
  `transition .14s ease`, transform dropped under `prefers-reduced-motion`.
- `.sig`: `grid grid-cols-[auto_1fr_auto] items-center gap-sm`; `.sig-dot` `w-1.5 h-1.5
  rounded-full` `background: var(--vt-fg)`; `.sig-detail` `text-ink-muted tabular-nums`;
  `.sig--meta` muted, top-bordered.
- **Hover/touch split** (mirror dddTags): `@media (hover: hover)` gates `.detail-pop`;
  `@media (hover: none)` / narrow shows `.detail-inline` and hides the popover, so touch never
  shows a stuck hover popover.

**`verdictPanel.svelte`: no change** — it imposes no `overflow:hidden`, and the popover is
card-anchored. Verify only.

---

## 3. Wiring / ripple

- **Both `+page.svelte` files: NO change.** `signals` is additive on the same returned objects;
  `<VerdictPanel {safety} {representation} />` flow is unchanged. (Confirmed against
  `src/routes/movie/[movieId]/+page.svelte` and `src/routes/tv/[seriesId]/+page.svelte`.)
- Edit list: `verdict.ts` (types + signals build), `verdictCard.svelte` (popover/inline),
  `verdict.spec.ts` (new assertions), `.CLAUDE/architecture.md` (doc).

---

## 4. Tests — `verdict.spec.ts`

Add (no existing assertion breaks — none currently match the count suffix):
- **Safety flags:** `rapeOnScreen` → signal `{ label:'Rape on screen', detail:'Flagged',
  tone:'danger' }`; a caution flag → `tone:'warn'`; `noRape` never appears; with both
  `sexHarOnScrn` + `rapeOnScreen`, signals are in `UM_FLAGS` declaration order.
- **Safety DDD line:** affirmed SV tag → `{ label:'Community trigger warnings',
  detail:'1 warning', tone:'danger' }`; tied-vote tag → tone `'neutral'`; two tags →
  `'2 warnings'` (pluralization).
- **Safe sentinel:** all-false UM + empty DDD → `signals` is the single
  `{ label:'No sexual violence flagged', detail:'Clear', present:false, tone:'success' }`.
- **Clean summary guard:** harmful/caution/safe `summary` does NOT contain `'('`.
- **Representation:** strong baseInput → `signals` labels equal `['Cast — women','Leads —
  women','Crew — women','Bechdel']`, bechdel detail `'3/3'` tone `'success'`; series
  (`bechdel:null`) → no Bechdel signal; leads detail formatted `'1/5 women'`; sub-tone mapping
  0→danger / 1→warn / 2→success.
- Keep all existing tier/tone/signalsPresent tests unchanged.

---

## 5. Docs + verification

- **`.CLAUDE/architecture.md`:** update the verdict-panel entry (cards now reveal a named-signal
  breakdown on hover/focus → desktop popover, tap → inline panel, reusing the `dddTags.svelte`
  dual pattern; summary is a clean one-liner) and the `verdict.ts` entry (returned shape gains
  `signals: VerdictSignal[]`; `subTone` per-signal tone; summaries no longer embed the count).
- **Baseline:** `bun run check` → 0 errors (new field + button a11y), `bun run test:unit` →
  all pass incl. new signal assertions, `bun run build` → clean.
- **Manual UX check:** the harmful example ("Depicts sexual assault or abuse.") shows a clean,
  un-cut summary on first render; hover/focus reveals the flag list + "N community trigger
  warnings"; on a touch viewport, tapping the card expands the inline breakdown; the popover
  doesn't clip or flicker; tone change/reveal is suppressed under `prefers-reduced-motion`.
