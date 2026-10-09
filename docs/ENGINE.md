# Abi School — Engine Design

The app exists for one reason: **every session behaves the same way.** A new chat window improvises; this engine doesn't. It assembles the same instructions every turn, keeps case facts as data, and lets code (not the AI's mood) decide what can happen next.

## How a turn works

1. Abi sends a message (typed or spoken).
2. `lib/engine.ts` builds the instructions, always in this order:
   - **Facilitator Guide** (`lib/guide.ts`): who Abi is, short-text rules, wit, teaching rules, hidden-info rules, safety.
   - **Mode rules** (`lib/modes.ts`): how this kind of case runs.
   - **Case spec** (`cases/*.json`): everything about the case *except hidden results*.
   - **Current state**: stage, what she's found, her design, stats. Rebuilt every turn.
3. Claude replies. When it needs a fact or an action, it calls a **tool**. The tool reads the case data, checks the stage rules, updates state, and returns the real result.
4. Everything is saved: the full conversation, Abi's view, and the game state.

Hidden results (water tests, evidence, event details, stress-test scenarios) are **not in the instructions at all**. The AI only learns them by calling a tool, so it can't leak or invent them.

## The four engines

| Mode | AI plays | Tools | Code enforces |
|---|---|---|---|
| **Challenge** — make it work | Project team + physics | `look_up`, `take_measurement`, `submit_design`, `run_stress_test`, `judge_test` | Cost and capacity math; no stress tests before a valid design; tests run in order, straight through (a pass moves on to the next test automatically); a failure pauses testing for a redesign, then the failed test is retested; the case can close only when every test has passed with her final design; tests with required pieces (`checks`) fail automatically if the design lacks them; `capacityRule` keeps output that doesn't qualify (e.g. untreated water) out of the target |
| **Investigation** — figure it out | Lab, archive, witnesses | `examine`, `record_theory` | Evidence never changes; witness testimony is recorded as evidence; Theory Board; solved vs. unsolved rules; ≥3 pieces and a theory before closing |
| **Simulation** — live the history | The world and its people | `make_choice`, `advance_time` | Stat changes from data; real events move stats; stat thresholds trigger consequences (Adapt); each decision once; ≥half the decisions before closing |
| **Inquiry** — ask a question | Socratic mentor | `record_starting_idea` | Starting idea recorded before closing |

Every mode also has `pin_to_timeline`, `save_wonder` and `close_case`.

## Shared shell

- **Passcode** for the app, **PIN** for the parent dashboard. No accounts.
- **Storage**: private Vercel Blob (JSON files). Locally, `.data/`.
- **Case Summary**: written by `close_case` in Abi's voice, rendered as a one-page printable file.
- **Parent record**: what happened, hints given, concepts covered.
- **Wonder List**: questions saved for later; explored as Inquiry sessions.
- **Timeline**: real events pinned during cases, shown in order.
- **Voice**: read-aloud (browser speech) and talk-to-type (browser speech recognition, where supported).
- **Safety**: AI label on every screen, on-topic only, personal/worrying topics redirected to Mom, no personal info collected, every session visible on the dashboard.

## Case files

One JSON file per case in `/cases`, registered in `lib/cases.ts`. Shared fields: id, title, mode, classification, status (`READY` / `DRAFT` / `HOLD`), **version**, opening (intro + tap cards + prompt), facilitator notes, just-in-time concepts, scaffold ladder, completion criteria, end reveal, skills, timeline events. Mode data:

- **Challenge**: budget, targets, existing resources, environment (physical facts only), toolbox (cost, capacity, needs, limits), measurements, stress tests (scenario, pass rule, hidden detail).
- **Investigation**: question, what the evidence supports, causal chain, evidence items, theories (supported/weakened by), red herrings.
- **Simulation**: role, setting, can/can't know, people (real or invented, with voice), daily-life details, science hooks, stats, fixed events, decision points (options with effects and consequences), history comparison.

**Version locking**: a session saves a snapshot of the case when it starts and uses it to the end, so editing a case never changes one already in progress. Raise `version` when you change a case.

**Every case** has a `winCondition` shown on Abi's screen, and `followUpSeeds` that steer the three Keep exploring questions at the end.

## Workflow for a new case

Draft together → write the JSON → run simulated students from the dashboard → read transcripts, fix → set `READY` → Abi plays → review the record → adjust.

## Sequence

"Today's case" = Abi's open case if any, otherwise the lowest-numbered `READY` case she hasn't closed. Test runs from the dashboard never count as Abi's progress.
