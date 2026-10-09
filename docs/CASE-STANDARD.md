# Abi School — Case Design Standard

What every new case needs, learned from building and testing Unit 1. Use it when drafting a case (here, in ChatGPT, or in a doc). Templates for each mode are in `docs/templates/`.

## The app already handles these (don't write them into a case)

- **Short, plain writing.** 2–4 sentences, one question at a time, occasional emoji, dry wit.
- **No leading commentary.** The guide never says "Notice…", "What's missing is…" or "Look closely". Noticing is Abi's job.
- **Characters protect themselves.** Witnesses and characters act in their own interest, never volunteer damaging facts, and only speak to what they could know.
- **Real peoples, real societies.** Native nations are organized societies with their own interests and technology, never props or rescuers.
- **Timeline.** Real events get pinned to her timeline automatically.
- **Pictures.** Evidence and measurement images show in the chat when revealed.
- **Wrap-up.** The guide says up front how many key questions there are, then shows each as its own "Question 2 of 4" card, one at a time, with no follow-ups. The case closes after the last answer. Keep exploring questions and the Case Summary follow.
- **Challenge.** Building blocks with no prices; specs only when she asks. The live Budget panel. Fair tests that follow physics. A required redesign after a failure.
- **Simulation.** A–D decision buttons with tradeoffs. A short "What changed" list after each choice. The Colony panel with ↑ ↓ → arrows. Real events on schedule. The built-in debrief: final outcome, yours vs. the real one, biggest difference, then the wrap-up questions.

## Every case

| Piece | Standard |
|---|---|
| **Opening paragraph** | Two short paragraphs. First: the scene (place, time, what it looks, sounds or smells like, who's there). Second: her job and the goal in one or two sentences. This is the hook, and the goal lives here, not on a separate "win" card. |
| **Brief cards** | 3–7 cards, each with an emoji, a short label, and 1–2 sentences (≤40 words). People's voices work well ("A mother of three"). |
| **Picture** | A real, credited image at the top (Wikimedia Commons or public domain). |
| **Real vs. constructed** | Say exactly what's real and what's invented. Abi learns it at the end. |
| **Notes** | Only what's special about *this* case: history facts to get right, sensitive topics, what not to give away. |
| **Scaffolds** | 2–3 hints, light to strong, for when she's truly stuck. |
| **Keep exploring** | 3–5 directions (e.g. Native farming technology, modern farming). |
| **Wrap-up questions** | The last questions, asked straight through. Required for Challenges and Simulations. |

## Investigation — "Figure it out"

- **Solvable.** The answer must be reachable from the evidence. Real unsolved mysteries go to bonus cases.
- **8–12 evidence items,** including one red herring, written as plain facts with no built-in conclusions.
- **At least one real picture** (a document, painting or object).
- **Witnesses with motives** that Abi can catch: who was there, who got paid, what they want people to believe.
- **Abi has a real role** (detective, judge) and makes the final call in her own words.

## Challenge — "Make it work"

- **Who it's for (`designFor`).** Exactly who the design serves: how many people, ages, families, special needs. Families and children change what gets built.
- **One budget unit** (dollars or worker-days) and any scarce resource with a hard limit (e.g. kegs of nails).
- **Building blocks.** 3–6 categories Abi sees, no prices.
- **Toolbox.** Priced items for the guide, plus a few hidden ones for good ideas she might invent.
- **3+ measurements** she has to ask for.
- **3–5 stress tests,** each with a clear pass rule.
- **Wrap-up:** "Would you approve this…? Why?"

## Simulation — "Live the history"

- **An important role with real pressure:** a leader who gets blamed, not a bystander or a kid watching.
- **5 stats,** with words instead of numbers where possible (Hostile → Cooperative). People is a count.
- **8–10 decisions** in an order of play, interleaved with real events. Each decision has 3–4 options with real tradeoffs.
- **Real events whose severity depends on her earlier choices,** plus knock-on triggers when a stat drops too low.
- **Required decisions** that must happen before the end (e.g. the Starving Time).
- **Debrief topics** for "yours vs. the real one", and **4 wrap-up questions**.

## Before a case goes live

1. **Run the checker:** `npm run check-cases -- <case id>`. Fix every ❌ and look at every ⚠️.
2. **Run the simulated students** from the Parent dashboard (rusher, curious, unusual, stuck) and read the transcripts.
3. **Monica plays it once** with Test play. Then mark it READY.
