# Keeping the data fresh

The numbers on NotAQuote.FYI come from public sources that publish on their own schedules. Once a year we check every source, pull in what's new, and write down what changed. This page is the recipe.

It's written so one person can do it in a weekend, and so you can hand it to an AI coding assistant: "Follow docs/DATA-REFRESH.md for the 2027 refresh. Stop and ask me before changing any judgment call."

## When

- **Every September, the annual refresh.** A GitHub Action opens an issue titled "Annual data refresh (YEAR)" on September 22 with the checklist below. September works well because new model years are out, NAIC's report from the winter before is available, and it lands before DC's scheduled law change on October 1, 2027.
- **Every month, tripwires.** CI also runs on the 1st of each month. It fails if a state's scheduled law change has taken effect without the row being updated, or if anything else has drifted. GitHub emails the failure to the maintainers.
- **Any time, community fixes.** Someone reports a number through "Suggest a fix", and we fix that one thing in a small PR, following CONTRIBUTING.md. That doesn't have to wait for September.

## What gets refreshed

| Data | Source | Publishes | Where it lives | How to update |
| --- | --- | --- | --- | --- |
| Vehicle catalog | NHTSA vPIC and FuelEconomy.gov | Continuously, with new model years each fall | `public/catalog/vehicle-catalog.json` (generated) | `npm run catalog:build` |
| Typical price per state | NAIC Auto Insurance Database Report | About once a year, with a data lag of about 2 years | `data/state-baselines/state-baselines.json` | By hand ([steps](../data/state-baselines/README.md#updating)) |
| Price trend | BLS CPI series CUUR0000SETE | Monthly | `data/state-baselines/state-baselines.json` (trend inputs) | By hand, then `npm run factors:build` |
| State minimum rules | State statutes and insurance departments | When legislatures act | `data/state-rules/state-rules.json` plus `evidence.json` | By hand ([steps](../data/state-rules/README.md#fixing-a-row)) |
| Driver and coverage factors | State rate-comparison surveys (CA, TX, CO, OK, ND, DC) and NC's surcharge rule | Mostly yearly | `data/factors/sources/*.csv` plus `sources.json` | Update the CSVs, then `npm run factors:build` |
| Vehicle claims results | IIHS-HLDI insurance losses by make and model | Yearly, with new model years | `data/factors/sources/hldi-2022-24.csv` | Replace the CSV, then `npm run factors:build` ([Vehicles](../data/factors/README.md#vehicles)) |
| Fleet age | S&P Global Mobility press release | Yearly | `data/factors/assumptions.json` (`fleet-age-band`) | By hand, only if the band should change |

## The annual refresh, step by step

Work on a branch named `data-refresh-YEAR`. Commit after each step, so the history reads like the checklist.

### 1. Start
- Run `npm ci && npm test` on a clean `main`, so you know the starting point is green.
- Read open issues labeled `data`, `factors`, `state-rules`, and `vehicles`. Fold in anything with a good source.

### 2. Vehicle catalog
- Bump `RETRIEVED_ON` in `scripts/build-vehicle-catalog.ts` to today, then run `npm run catalog:build`. It's polite on purpose and takes a while. If NHTSA starts refusing requests, stop and try again later. Don't hammer it.
- Read `data/catalog/source-diff.md`. New model years should appear. Removals deserve a second look.
- Check the popular-car presets still resolve. `npm test` does this.

### 3. Typical price per state (NAIC)
- Check whether NAIC has published a newer *Auto Insurance Database Report*. If it has, follow [the steps](../data/state-baselines/README.md#updating): the same three tables, every state and DC, update the source entry and PDF hash, bump `version` and `checkedOn`, and update the spot values in the test.
- If there's no new edition, leave it. The price trend (next step) keeps the dollars current.

### 4. Price trend (BLS)
- Update the latest-month CPI value, and the data-year average if NAIC moved to a new year, from https://data.bls.gov/timeseries/CUUR0000SETE. Pin the month you used.
- Run `npm run factors:build`. The typical starting prices move by the ratio. Check that the README's example table test still passes, and update the table if the numbers moved.

### 5. State minimum rules
- Apply anything in a row's `scheduledChanges` whose date has passed or will pass before next September. Move the figures into the row and delete the scheduled entry.
- For each state, re-open the cited source and check for new legislation. A fast way is to search "[state] minimum auto liability insurance [year] law change". This is a good job for an AI assistant with web access. Give it `data/state-rules/README.md` and ask it to report changes with quotes, not to edit.
- Update `checkedOn` on every row you re-checked, then bump the file's `version` and `checkedOn`.
- Run `npx tsx --test src/lib/state-rules.test.ts`.

### 6. Driver and coverage factors
- For each survey in `data/factors/sources/sources.json`, check for a newer edition. California's scripts live in `scripts/research/ca-2026/`. Copy them to a folder for the new year rather than editing the old ones, so past pulls stay reproducible.
- Replace or add CSV rows, and update each source's `checkedOn` and edition notes.
- Bump `DERIVATION_VERSION`, `EFFECTIVE_DATE`, and `CHECKED_ON` in `src/lib/factor-derivation.ts`. Run `npm run factors:build` and read the diff of `src/data/model-factors.json`. Any factor that moves more than about 10% deserves a sentence in the changelog explaining why.
- A new state survey is the best upgrade we can make. [How to improve a factor](../data/factors/README.md#how-to-improve-a-factor) explains how to wire one in.

### 7. Vehicle claims results (HLDI)
- First check the permission status noted in `data/factors/sources/sources.json`. If IIHS said no, set `useHldiModels` to `false` in `data/factors/vehicle-families.json` and skip the rest of this step.
- If HLDI has published newer model years, refresh the subset CSV (see the notes at the top of `scripts/derive-factors.ts`). Add families for new popular models to `vehicle-families.json`, then rebuild. The bias tests (911 > Mustang, Model Y > RAV4, and so on) will tell you if something went sideways.

### 8. Everything else
- **Fleet age:** if S&P's new figure crosses a band boundary, revisit `fleet-age-band` in `data/factors/assumptions.json`.
- **Source manifest:** update `checkedOn` for sources you re-checked in `src/data/source-manifest.json`, then bump its `version`.
- **Model version:** if the *math* changed, not just the data, bump `MODEL_VERSION` in `src/lib/copy.ts`. Old share links will then say they were made with an older version.
- **Help wanted:** if a contributed source retired one of our best guesses, update `src/lib/help-wanted.ts` and close the issue.

### 9. Check
- Run `npm run lint && npm run typecheck && npm test && npm run build`, then `npm run factors:build` again (it should leave no diff).
- Click through the site locally (`npm run dev`): the Model Y what-if, a 15-car compare for a 16-year-old, and /sources for two or three states.
- Curl `/api/v1/compare?cars=popular:first-cars` and check that it looks sane.
- If the UI looks different, retake the README screenshots in `docs/images/`.

### 10. Write it down and ship
- Add an entry to `CHANGELOG.md`: what data moved, from which edition to which, and anything a visitor would notice ("typical prices rose about 6%").
- Add a short, plain entry to the site's **What's changed** page (`src/app/model-version/page.tsx`), for visitors, in the voice of `docs/VOICE.md`.
- Open a PR titled "Annual data refresh (YEAR)", link the refresh issue, wait for CI, and merge. Vercel deploys `main`.
- Tag the merge commit, e.g. `git tag data-2027.09 && git push origin data-2027.09`, so anyone can find exactly which data a past estimate used.
- Close the refresh issue.

## Changelog rules

- **`CHANGELOG.md`** (repo) records every release that changes data or math. Newest first, dated, grouped as *Data*, *Math*, *Site*. It's for contributors and anyone auditing a number.
- **The What's changed page** (site) is a friendly summary for visitors. Only list what someone using the site would notice.
- **Data versions** are date-stamped strings (`factors-2026-09-22`, `state-rules-2026-09-22`, and so on). Bump the one for each file you change, and nothing else. The site footer's "Data updated" date follows the factor bundle.
