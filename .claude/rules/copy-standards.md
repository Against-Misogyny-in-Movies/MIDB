# Copy standards

Applies to all **user-facing** text (page copy, taglines, labels, notes) — not code comments, `<title>` tags, or commits. The `/resources` page is the reference voice; full rationale in `docs/architecture.md`, Copy & voice.

- **Matter-of-fact, not salesy.** State what a thing is and what happens. No marketing tone, rhetorical questions, reader flattery, or hedging filler ("just", "the gist", "roughly").
- **Third person everywhere, the landing page included.** Don't address the reader as "you" (use "the page", "a reader"). "MIDB" as the subject is fine. No slogans or mottos: the landing headline states what the site covers.
- **Essentials only.** Say each thing once, in the fewest words that keep its meaning. No intros that restate the heading, no taglines under titles, no template subheadings ("What it is / How it works / Where it comes from"), no "at a glance", "distilling", "so you decide", "the overall picture", no lists of three for rhythm. A sentence that carries no fact or action goes. No "How we…", "How it works", "How this is scored" or any "How …" heading or link: the explainer page and every link to it are "Methodology".
- **One term per concept.** "film" and "series" (not movie/TV/show), "verdict", "warning" (Does the Dog Die), "flag" and "concern" (Unconsenting Media), "source", "Bechdel Test". Labels are sentence case.
- **No em dashes (—) in copy.** Split sentences or use a colon. En dashes (–) stay in ranges (`0–3`, `adult–teen`).
- **Claims must be code-backed.** Computation details, thresholds, and privacy claims must match the code (e.g. the verdict explainer mirrors `verdict.ts`). Update copy when the code changes.
- **The copy judge.** `copy-judge` reads changed user-facing copy against these rules and the code it describes, and is run by the orchestrator whenever copy changes.
