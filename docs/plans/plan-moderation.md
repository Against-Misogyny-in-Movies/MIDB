# Plan: moderation section

Approved by the user as a plan (2026-11-17). Its phases are rows in `docs/phases/STATUS.md`; none starts until the user says so. The proposed screens are published as the artifact "Moderation redesign".

Scope set by the user (2026-11-17):

- Add ways back: end a mute, lift a ban, re-open closed decisions.
- Add a staff view of one account, with notes; keyboard triage; a staff roles page.
- Queues are ordered by priority, with true counts and paging.
- Wide screens get the queue list with a context panel beside it.
- A reason is a rule from a fixed list, shown to the author; the most severe comments start collapsed. Otherwise the work stays inside the staff pages: no appeal flow for authors.
- One review round (reviewer, ux, copy-judge) after the last phase.

## Job and audience

`/user/moderation` is Operate (`PRODUCT.md`, Surfaces). A moderator arrives to clear what is waiting, often in short sittings, and decides about other people's words and accounts. The page has to show what matters first, give enough context to decide fairly, make every decision reversible by someone, and spare the moderator text they do not need to read.

## What the research says

| Source                                                   | Practice                                                                                                   | Applied as                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Reddit's 2024 mod queue; arXiv 2409.16840 and 2509.07314 | The item opens beside the queue; actions sit under the content; hard-to-find features go unused            | List and context panel; one visible action row                                        |
| Discourse review queue                                   | One queue ranked by a score; notes and a timeline; reporter accuracy; ambiguous Approve and Reject confuse | Priority order; account notes and timeline; reporter record; buttons named by outcome |
| Triage guidance                                          | Rank by harm, not arrival; keep action, status and reversal apart                                          | Priority from severity, open reports, age; reversals are logged actions of their own  |
| Das, Dang and Lease (2020)                               | Reduce exposure by default; the moderator chooses when to read                                             | The most severe comments start collapsed                                              |
| Santa Clara Principles                                   | Tell the affected account which rule was broken                                                            | A rule from a fixed list, shown to the author                                         |
| WCAG 2.1.4                                               | Single-key shortcuts can be switched off and do nothing in fields                                          | Shortcuts with a setting and a visible list                                           |

The searches found nothing authoritative on moderation shortcuts, undo or bulk safeguards; those parts follow the reference products.

## Findings in the current section

Read from code; not rendered for this plan.

### Missing

- **F1.** A mute or a ban cannot be undone (`docs/phases/STATUS.md`, Open items, Comments). A hidden or rejected comment opened from the table offers Hide and Reject again, not Restore.
- **F2.** No view of one account: only a comment count and the public profile. The log has no index on the account or the staff member, no filter and no paging.
- **F3.** Tab counts are the lengths of capped lists, and the community reports count leaves out flagged titles.
- **F4.** The Reported and Recent actions tabs are not in the URL.
- **F5.** No keyboard path through a queue beyond the tabs' arrow keys. No plate closes on Escape.
- **F6.** Only a script can change a role, and only to administrator.

### Rules that disagree

- **F7.** `hideComment` and `rejectComment` skip the administrator check that approve, restore and dismiss have (`heldByAdministrator`, `moderation-actions.ts`), so a moderator can hide a comment an administrator approved.
- **F8.** `targetAllowed` (`moderation-target.ts`) does not read `banned_at`, so a banned account can be banned or muted again.

### Structure

- **F9.** The route file holds the bulk operation, the scan sequence and the purge calls (`.claude/rules/code-standards.md`, Route folders are thin).
- **F10.** Cache purges are split: the route purges after comment actions, the data layer after the rest, so `#lib/server/data` imports `#lib/server/http`.
- **F11.** Three copies of the log-row insert (`logCommentAction`, `logReportAction`, `count-flags.ts`). `banUser` (`user-queries.ts`) has no production caller.
- **F12.** Every load runs every queue's query, whichever tab is open.
- **F13.** Three submit patterns (`rowSubmit`, an inline handler in `recentActionRow`, the AI bar's own) and two row shells (`moderationItem`, `reportRowShell`). Focus on Cancel differs between plates. The table's detail row repeats what its row shows.
- **F14.** `docs/architecture.md` names `banUser` as the ban path, says an administrator-held comment answers `forbidden-target` (the code answers `admin-acted`), and still says the classifier does not exist.

## Target design

### Routes

- `/user/moderation?tab=pending|reported|reports|table|log`. The load reads the open tab's list and one counts query for every tab.
- `/user/moderation/accounts/[id]`: the account view, by the opaque account id.
- `/user/moderation/staff`: administrators only.
- All stay under the hook's gate and `requireRole`.

### Queue page

- **Layout.** From a wide breakpoint, the list on the left and the selected item's panel on the right, in a reserved column so selecting and acting move nothing. Below it, one column with the panel opening under the selected row. The table's Review opens the same panel.
- **Panel.** The thread (the parent comment, the reply count), the account's standing and figures, the reporters with their record, the classifier's categories, then the actions.
- **Order.** Classifier severity, then open reports, then oldest. One module owns it (`src/lib/server/data/moderation-priority.ts`). Each row shows why it ranks.
- **Counts and paging.** Totals from the database; further pages with the profile lists' pager (`profilePager.svelte.ts`).
- **One row, one submit pattern.** `moderationItem` on `reportRowShell`; every form on `rowSubmit`. Plates take focus on open, return it on close and close on Escape (`focusAfterUpdate`).
- **Actions fit the state.** Restore on a hidden or rejected comment; End mute on a muted account; Lift ban on a banned one. Labels say "account".
- **Reasons.** A plate lists the rules (a tuple in `db/lib/comments.ts`) with an optional note. The author sees the rule and the note where the reason shows today.
- **Severe comments.** A comment at or above `REJECT_MIN_SEVERITY` (`policy.ts`) starts collapsed, with its categories and a "Show comment" control. A browser setting turns this off.
- **Feedback.** Toasts as today, and a polite status line on the list that says the result and how many remain. A removed row eases out under the shared transition, gated on reduced motion.
- **Keyboard.** `j` and `k` move, Enter opens, single keys act; a destructive key opens its plate and never acts on one press. Off in fields, switchable off, and never the only way to act.

### Account view

Standing (role, mute, ban with its reason, deleted), figures, the timeline of every moderation action on the account, staff notes, its comments in every status, its community reports with their standing, the reports against it, and the account actions. Every name in moderation links to it. It reuses `profileRows`, `commentHistoryRow`, `reportStanding.ts` and `canActOn.ts`.

### Reversals

- End mute and Lift ban are logged actions with a reason. Lifting a ban restores sign-in only; the plate says what it does not undo.
- A closed count flag can be re-opened; a community report's decision is reachable from the log.
- Authority follows `canActOn`: a moderator cannot reverse an administrator's action.

### Other additions

- **Log tab:** filters by action, staff member and account, with paging. A reversal marks the action it reverses.
- **Reporter record:** how many of a reporter's reports were upheld, beside their name.
- **Staff page:** administrators give and remove the moderator role, logged; the last-administrator rule of account deletion applies.

## Schema

Additive first (`.claude/rules/code-standards.md`, Database).

- `moderation_actions`: indexes on the target account and the staff member; new action values for the reversals, role changes and notes; a nullable rule column. Changing the action CHECK rebuilds the table, so the Worker version before it must already render an unknown action without failing.
- `comments`: a nullable rule column with its CHECK.
- `account_notes`: the account, the staff author (set null), the text with a length CHECK, the time. Account deletion removes them.
- `PRIVACY.md` and `SECURITY.md` change with the notes, the rule shown to authors and the role changes.

## Scope and boundaries

- **Untouched:** the classifier, the blocklist and the policy; what the AI search and the scan send; the community report rules; the reader-side report form.
- **Not in this plan:** an appeal flow for authors, claiming or assigning items, live updates between moderators, notifications.
- **Anti-goals:** no modal dialogs, no overflow menus for the main actions, no colour as the only mark of a selected row, no new dependency.

## Phases

| Phase | Work                                                                                                                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MR1   | Server structure: the bulk operation, the scan sequence and the purges leave the route; one log-row builder; `banUser` goes; the stale passages of `docs/architecture.md` are fixed. No behaviour change. |
| MR2   | The load reads one tab; true counts; paging; every tab in the URL.                                                                                                                                        |
| MR3   | Rule fixes: the administrator check on hide and reject; a repeat ban or mute is refused.                                                                                                                  |
| MR4   | Priority order.                                                                                                                                                                                           |
| MR5   | Schema: the indexes, action values, rule columns and account notes.                                                                                                                                       |
| MR6   | Reversals: End mute, Lift ban, Restore in place, re-open.                                                                                                                                                 |
| MR7   | Reasons from the rule list, shown to the author.                                                                                                                                                          |
| MR8   | Queue page: list and context panel, one row shell and submit pattern, plates, collapsed severe comments, the status line.                                                                                 |
| MR9   | Keyboard triage.                                                                                                                                                                                          |
| MR10  | Account view, notes, reporter record.                                                                                                                                                                     |
| MR11  | Log tab: filters and paging.                                                                                                                                                                              |
| MR12  | Staff roles page.                                                                                                                                                                                         |
| MR13  | Docs and copy.                                                                                                                                                                                            |

## Open decisions

1. **The rule list.** It should match rules the site publishes. If there is no rules page, the plan needs one line per rule and a place to publish them.
2. **Lifting a ban and its hidden comments.** Recommended: the comments stay hidden; a moderator restores them one by one or in bulk.
3. **Account notes in the data download.** Recommended: left out, and `PRIVACY.md` says so.
4. **Who may lift a ban.** Recommended: administrators only; a moderator may end a mute a moderator set.
