# Plan: avatar portraits and username pool

One phase (`docs/phases/STATUS.md`, phase 7).

## Decisions

- Avatars are tonal portraits on a four-step violet ramp (direction B, user instruction, 2026-11-12). No hue leaves the violet; every face takes the same tone, and identity comes from hair, headwear, glasses and dress.
- The roster is the six current figures, redrawn, plus fourteen: Marie Curie, Ada Lovelace, Rosalind Franklin, Katherine Johnson, Grace Hopper, Yayoi Kusama, Georgia O'Keeffe, Agnès Varda, Nina Simone, Virginia Woolf, Maya Angelou, Audre Lorde, Malala Yousafzai, Ruth Bader Ginsburg.
- The six current keys stay, so saved avatars keep working. No migration: `avatar_key` is checked against `AVATAR_KEYS` in code only.
- The username pool gains scientists, artists and musicians, film-makers, writers, activists and athletes. A new account's avatar stays unset (not matched to its username).

## Work

- `--avatar-*` tokens in `src/app.css`; `DESIGN.md`, Colour and Components, describe them.
- `Portrait.svelte`: the shared plate, clip, neck, shoulders and face. Eyes, mouth and fine marks draw only from `PORTRAIT_DETAIL_MIN` px up; outlines and glasses draw at every size.
- One `*Icon.svelte` per figure renders `Portrait` with her hair, headwear and dress as snippets.
- `AVATAR_DEFS`, `AVATAR_COMPONENTS` and `FEMINIST_ICONS` gain the new entries; tests cover the registry, the detail threshold and the pool's format.
- `docs/architecture.md`, Components, describes the avatar files.
