# Roadmap: from prototype to community project

NotAQuote.FYI should make one kind of question easy: *"What would happen to my insurance if I bought a Tesla Model Y?"* or *"Show my 15-year-old what 15 different cars would cost to insure, and let them narrow it down."* The numbers should be sourced, the sources public, and the whole thing easy to fix and extend, in the spirit of [collegedata.fyi](https://collegedata.fyi): public information that used to sit in hard-to-read PDFs, made usable.

## Principles

- **Easy.** Get an answer in under a minute, with no account and no personal data leaving the browser.
- **Trustworthy.** Every factor has a source, a date, and a link. Where we don't know, we say so and widen the range. We don't hide it behind jargon.
- **Inviting.** Anyone can see where a number came from and propose a better one, with a clear path from "that looks wrong" to a merged fix.
- **Kind.** The site reads like [docs/VOICE.md](VOICE.md): a helpful parent, not a legal department.

## Workstreams

### 1. Open-source foundation
- LICENSE (MIT for code) and a data license (CC BY 4.0 for data we compile; third-party sources keep their own terms, as listed on the Data licenses page).
- A README for newcomers: what it is, why it exists, how to run it, how the numbers work, and how to help.
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, issue templates (fix a factor, add or fix a state rule, vehicle classified wrong, bug), a PR template, and CI for lint, typecheck, test, and build.
- A `typecheck` script that works on a fresh clone. `shadcn` moves to devDependencies.

### 2. Sourced data
- **State rules:** minimum liability limits and required coverages for all 50 states and DC, each with a primary source URL and a check date.
- **State starting point:** a typical annual premium per state from a public, citable source, used as the default starting point when the visitor doesn't enter their own premium.
- **Factors:** driver age, experience, incidents, mileage, coverage level, and deductible relativities, derived where possible from public state insurance-department rate-comparison guides (sample premiums across carriers for standard driver profiles) and each cited. Anything we can't source stays labeled as an assumption and widens the range.
- **Vehicles:** classify from the catalog's own government fields (EPA vehicle class, fuel/powertrain type) instead of substring guesses, and add vehicle-level signals where a citable public source exists.

### 3. One pricing model
- Delete the separate sample weights. Every dollar figure on the site comes from the same versioned engine.
- Starting point: your current premium if you enter it, otherwise the sourced typical premium for your state, stated plainly.

### 4. The questions people actually ask
- **What-if:** change one thing and see the difference, e.g. "Switching to a 2025 Tesla Model Y: about +$420 a year."
- **Compare cars:** pick up to 15 vehicles and get a sortable table for the same driver, with a CSV download and a print view, so a parent and a teen can narrow the list together.

### 5. Voice
- Rewrite every page and control in the voice of docs/VOICE.md. One clear disclaimer per page.

### 6. Community feedback loop
- Replace the disabled Supabase corrections queue with "Suggest a fix" links that open a prefilled GitHub issue for the exact number, state, or vehicle in question. There's no backend to run, and everything happens in the open.

## Status (September 22, 2026)

Workstreams 1–6 are built and reviewed. What's left is ongoing data work, which is exactly where contributors can help:

- Find public sources for the numbers that are still our best guesses (see "Five numbers that need a source" in CONTRIBUTING.md).
- Add more states' rate-comparison guides, so factors rest on more than a handful of states.
- Refresh the NAIC figures and the price-index trend when new editions come out.
- HLDI vehicle data: permission requested from IIHS on September 22, 2026. If they say no, switch it off with `useHldiModels`.

## Launch switches (owner decisions)
- [x] Make the GitHub repository public.
- [x] Create the issue labels the forms use: `data`, `factors`, `state-rules`, `vehicles`.
- [x] Turn on private vulnerability reporting.
- [x] Set up contact@bolewood.com (a Google Group that accepts outside mail).
- [x] Open starter issues for the five numbers that need a source ([good first issues](https://github.com/bolewood/notaquote-fyi/labels/good%20first%20issue)).
- [ ] Remove `noindex` (in `next.config.ts` and `src/app/robots.ts`) after sharing privately with friends.
