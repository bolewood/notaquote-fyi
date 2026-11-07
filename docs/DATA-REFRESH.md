# Keeping the data fresh

The numbers on NotAQuote.FYI come from public sources that publish on their own schedules. Once a year we check every source, pull in what's new, and write down what changed. This page is the recipe.

It's written so one person can do it in a weekend, and so you can hand it to an AI coding assistant: "Follow docs/DATA-REFRESH.md for the 2027 refresh. Stop and ask me before changing any judgment call."

## When

- **Every September, the annual refresh.** A GitHub Action opens an issue titled "Annual data refresh (YEAR)" on September 22 with the checklist below. September works well because new model years are out, NAIC's report from the winter before is available, and it lands before DC's scheduled law change on October 1, 2027.
- **Every January, HLDI's new results.** The Highway Loss Data Institute publishes a new model-year window each January. Follow [the HLDI annual refresh](#hldi-annual-refresh) below; it doesn't wait for September.
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
| Vehicle loss results | IIHS-HLDI insurance losses by make and model | Every January, with a new model-year window | `data/factors/sources/hldi-2022-24.csv` | Replace the CSV, then `npm run factors:build` ([Vehicles](../data/factors/README.md#vehicles)) |
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

### 7. Vehicle loss results (HLDI)
- If the January [HLDI annual refresh](#hldi-annual-refresh) already pulled this year's window, just confirm nothing new has come out since.
- First check the permission status noted in `data/factors/sources/sources.json`. If IIHS said no, set `useHldiModels` to `false` in `data/factors/vehicle-families.json` and skip the rest of this step.
- If HLDI has published newer model years, refresh the subset CSV (see the notes at the top of `scripts/derive-factors.ts`). Add families for new popular models to `vehicle-families.json`, then rebuild. The bias tests (911 > Mustang, Model Y > RAV4, and so on) will tell you if something went sideways.
- **Car pages.** They move to the newest model year on their own; their addresses don't change. If `npm test` says a car in `data/car-pages.json` (or on the popular lists) lost its model-level loss data, first check whether the catalog renamed it (then fix the name, and keep the old address with `"slug"`). If it really has no loss results any more, its page would disappear and its address would return 404. Don't just drop it: add a permanent redirect for `/cars/<slug>` to `/cars` in `next.config.ts`, remove the car from the list, and move its slug out of `src/lib/seo-slugs.json` into that file's `"retired"` list, so the test knows it's on purpose.
- **If IIHS said no** (`useHldiModels` is `false`): every car page, `/cars`, and the links to them go away together, and the teen guides and state pages switch to wording that doesn't name a single cheapest car. Build and click through `/guides` and a state page to check. Add the redirect above for `/cars/*` too.

### 8. Everything else
- **Fleet age:** if S&P's new figure crosses a band boundary, revisit `fleet-age-band` in `data/factors/assumptions.json`.
- **Source manifest:** update `checkedOn` for sources you re-checked in `src/data/source-manifest.json`, then bump its `version`.
- **Model version:** if the *math* changed, not just the data, bump `MODEL_VERSION` in `src/lib/copy.ts`. Old share links will then say they were made with an older version.
- **Help wanted:** if a contributed source retired one of our best guesses, update `src/lib/help-wanted.ts` and close the issue.

### 9. Check
- Run `npm run lint && npm run typecheck && npm test && npm run build`, then `npm run factors:build` again (it should leave no diff).
- Click through the site locally (`npm run dev`): the Model Y what-if, a 15-car compare for a 16-year-old, and /sources for two or three states.
- Curl `/api/v1/compare?cars=popular:first-cars` and check that it looks sane.
- Spot-check a few state and car pages (`/states/ohio`, `/states/california`, `/cars/tesla-model-y`, `/cars/subaru-outback`) and the guides under `/guides`. Every figure on them is worked out from the data at build time, so they update on their own; look for anything that reads oddly after the numbers moved. If HLDI published newer model years, the car pages move to the newest year by themselves (their addresses don't change). `npm test` fails if a car in `data/car-pages.json` no longer has HLDI loss data, or if new numbers make the car pages read too much alike (the rendered-text floor in `src/lib/seo.test.ts`); fix the wording rather than lowering the floor. A car is only kept out of search by an explicit `"noindex": true` in `data/car-pages.json`.
- If the UI looks different, retake the README screenshots in `docs/images/`.

### 10. Write it down and ship
- Add an entry to `CHANGELOG.md`: what data moved, from which edition to which, and anything a visitor would notice ("typical prices rose about 6%").
- Add a short, plain entry to the site's **What's changed** page (`src/app/model-version/page.tsx`), for visitors, in the voice of `docs/VOICE.md`.
- Open a PR titled "Annual data refresh (YEAR)", link the refresh issue, wait for CI, and merge. Vercel deploys `main`.
- Tag the merge commit, e.g. `git tag data-2027.09 && git push origin data-2027.09`, so anyone can find exactly which data a past estimate used.
- Close the refresh issue.

## HLDI annual refresh

HLDI publishes a new three-year window of insurance loss results by make and model every January (for example, 2023–25 models in January 2027). Work on a branch named `hldi-refresh-YEAR`, and commit after each step.

1. **Check permission.** Read the permission note in `data/factors/sources/sources.json`. If HLDI or IIHS has asked us to stop, set `useHldiModels` to `false` in `data/factors/vehicle-families.json` and follow "If IIHS said no" in step 7 above instead.
2. **Fetch the new window.** Pull HLDI's newest "Insurance losses by make and model" results the same way as last time (the access method is noted on the `iihs-hldi` entry in `src/data/source-manifest.json`), including the class subtotals if HLDI published them. To re-pick which models we keep from a full download, run `npm run factors:build -- --hldi-full <losses.csv>` (see the `_readme` in `data/factors/vehicle-families.json`). Save the results as `data/factors/sources/hldi-YYYY-YY.csv` and `hldi-class-subtotals-YYYY-YY.csv`, in the same columns as last year's files (collision, comprehensive, property damage, and bodily injury; we don't use med pay or PIP). Don't edit HLDI's figures.
3. **Register it.** Point the newest-window file name in `src/lib/factor-derivation.ts` (today `sources/hldi-2022-24.csv`) at the new file, and add its source entry (title, URL, `dataYear`, `checkedOn` set to the day you pulled it, and the same terms note) to `data/factors/sources/sources.json`. Update the file list in the `iihs-hldi` license note in `src/data/source-manifest.json`. Add families for new popular models to `vehicle-families.json`.
4. **Rebuild factors.** Run `npm run factors:build`, then read the diff of `src/data/model-factors.json`. The bias tests (911 > Mustang, Model Y > RAV4, and so on) will tell you if something went sideways.
5. **Update dates.** Set the new report's `checkedOn` in `data/factors/sources/sources.json` to the day you retrieved it (leave the older reports' dates alone unless you re-pulled them). If HLDI has told us when it published a report, add it to `HLDI_PUBLISHED` in `src/lib/hldi.ts`. Bump the factor bundle's `version` and `checkedOn`, the source manifest's `checkedOn` for HLDI (`src/data/source-manifest.json`), and `CAR_PAGES_CONTENT_UPDATED` in `src/lib/site-meta.ts`. The sources page line ("HLDI data through [window] models. We retrieved …") comes from those dates, so check it reads right on `/sources`.
6. **Check the car pages.** Run `npm test`. The car pages move to the newest model year by themselves. Fix any car that lost its model-level results (see step 7 above). Then open `/cars/subaru-legacy`, `/cars/toyota-rav4`, `/cars/tesla-model-y`, and two or three others, and check:
   - "What HLDI reports" names the new window, and each row's percent matches HLDI's published table (100 minus the index).
   - The ratings match HLDI's own. If HLDI changed its rating cutoffs, update `HLDI_RATING_BANDS` in `src/lib/hldi.ts`.
   - "What we estimate that means for price" reads sensibly, and the dollars match the figures above it.
   - The worked example on `/methodology#why-percentages-differ` still reads right (it's generated from the Legacy page). If the Legacy no longer has model-level results, switch the example to another car and update `docs/hldi-review.md`.
7. **Ship.** Add a CHANGELOG entry and a line on the What's changed page ("Car results now use HLDI's 2023–25 models"), open a PR titled "HLDI refresh (YEAR)", and tag the merge commit `data-YEAR.01`.

## Photo library

Each car page will get a credited, openly licensed photo of the right generation of the car. Before any photo, the library maps every model year to a generation, from sources anyone can check:

- `data/photos/series.json` (hand-maintained): each car's English Wikipedia article and Wikidata item, plus any hand entries (below). Scripts add new cars but never overwrite an entry.
- `data/photos/generations.json` (generated): each car's generations with US model years, the Wikipedia article and revision they come from, and the Commons category for its photos. Don't edit it; fix the car in `series.json` and regenerate.
- `data/photos/coverage.json` and `docs/photo-coverage.md` (generated): every catalog model year mapped to one generation, with gaps, overlaps, split years, facelift evidence and "Needs attention".

Requests go to Wikipedia, Wikidata and Commons one at a time, with a User-Agent that names this repo, and are cached in `data/photos/.cache/` (not committed; delete it to refetch).

### Adding a car

1. Add it to `data/car-pages.json` as usual (step 7 above).
2. Run `npm run photos:add -- <slug>`. It finds the car's article, reads its generations and US model years, and rebuilds the coverage report.
3. Read the car's lines under "Needs attention" in `docs/photo-coverage.md`. Most cars need nothing. If something's flagged, fix it in the car's `series.json` entry:
   - **Wrong article** (a shared name, an overview article): set `wikipedia` and `wikidata` to the right ones, then run `photos:add` again.
   - **Generations the parser can't read** (one name covering different vehicles, an article without US model years): list them under `generations`, each with `label`, `from`, `to` (null if still on sale), `article`, `commons`, and a `source`, a quote or URL for the US model years. Hand-entered years without a source are flagged.
   - **A badge twin** (GMC Canyon and Chevrolet Colorado, Yukon and Tahoe, Escalade): the shared article gives the right years, but the photos must carry this car's badge. Give each generation its own brand's `commons` category, and list the other car's slug under `twins` (on both cars), so the photo review can tell them apart. A `commons` set by hand is always kept, even a whole-model one, so add a `note` saying why.
   - **Sections that aren't this car** (an electric spin-off, a Raptor): add a pattern to `exclude`.
   - **Catalog years the US model wasn't sold** (a skipped year, a listing ahead of launch): `notSold` with `years`, `note` and `source`.
   - Set `status` to `"checked"` once a person or a review has confirmed the entry.
4. Look at the car's row in the "Every car" table. Busy Commons categories keep their photos in subcategories (by year, body style or market), so the table counts usable files one level down too. Some go deeper: the US Camry XV50 photos are three levels down, under "Toyota Camry (XV50, North America, 2011)" and "(…, 2014)". A shown generation with almost no files may need a better category.
5. Run `npm test`. The photo-library test fails if any year a car page shows has no generation, or no Commons category.

### Choosing the photos

Three more steps pick and fetch a photo for every model year a car page shows. `photos:verify` asks a model on OpenRouter, and so does `photos:eval` (below), so they need an `OPENROUTER_API_KEY` in your environment: set it however you keep secrets (a password manager's command-line tool, say), not in a file in the repo. Never print the key.

1. `npm run photos:candidates [-- <slug>…]` lists the openly licensed photos (public domain, CC0, CC BY, CC BY-SA) in each shown generation's Commons category and the usable subcategories under it, up to four levels down. It skips racing, police, taxi, concept and other-market subcategories, and files under 1200×700. The list goes to `data/photos/.cache/` (not committed).
2. `npm run photos:verify [-- <slug>…]` asks Jev (TypeSafe's decision model, through OpenRouter) about candidates, best first. Jev sees only the image, never the filename or category, and answers:
   - which generation of the car this is, or a badge twin, a different model, or no single car;
   - whether it shows the outside of one whole car, a recognizable face or a readable plate;
   - whether it's a taxi, police car, race car or wreck, and how good the photo is.

   A photo is used only when Commons and Jev agree on the generation, Jev's confidence is at least `GATE` in `scripts/photos/verify.ts`, it shows a whole car, and nobody's face is recognizable. Photos from near a shown year are reviewed first, and each shown year gets the accepted photo nearest to its year, so a year after a facelift gets the facelifted car. Accepted photos get one more question (is the car registered outside the US and Canada?). Each year then takes the best-suited photo (`suitability()` in `verify.ts`): close in model year, a US or Canadian car, not a rear view, no readable plate, and a good photo. Verify keeps reviewing (up to 150 photos) while a shown year has no well-suited photo within two years of it. The result, with credit, license and the exact file version, is `data/photos/manifest.json`.

   Some generations look so much like their neighbors that Jev is rarely sure (the 2017–2022 Prius Prime, several Subarus). If a generation has no photo at `GATE` after 150 reviews, verify takes one at `FALLBACK_GATE` where Commons and Jev still agree, and lists it at the end of its output as "worth a look". Open those on Commons before a release.

3. `npm run photos:download` brings the repo in line with the manifest: one WebP per chosen photo in `public/car-photos/` (1200 pixels wide, named by the Commons file's sha1, with EXIF and GPS data removed), and `data/photos/images.json`, which says which photo each car page year shows and its credit (title, author, license, Commons page, "Resized and converted to WebP"). It first checks each pick is still on Commons with the same sha1 and a usable license; one that isn't is left out and listed, so rerun `photos:verify` for that car. It deletes photos the manifest no longer uses, and rerunning it with nothing changed downloads nothing. Run it monthly too: Commons sometimes deletes a file (often a dealer photo uploaded without permission), and a file with a pending deletion request is left out before that happens.

   Wherever a photo appears on the site, show its credit: the author, the license (linked to `licenseUrl`) and a link to the Commons page (`source`). CC BY and CC BY-SA require it, and `images.json` has all of it for each photo.

Answers are cached by file, so rerunning costs nothing; a fresh review of every car costs about a dollar.

**Changing the model or the questions.** The model is pinned in `scripts/photos/jev.ts` (with the endpoint, an OpenRouter alpha; if it moves, that file is the only one to change). Before changing either, run `npm run photos:eval` (it needs the key too). It asks the same questions about photos whose answer Commons already knows, on hard cases (neighboring generations, badge twins, plug-in versions), and reports how often an answer at each confidence is right. Set `GATE` from that table, and look at the disagreements yourself: Commons is sometimes the one that's wrong.

### Each fall (new model years)

After the vehicle catalog refresh (step 2 of the annual refresh), run `npm run photos:generations` and then `npm run photos:coverage`. New model years show up as gaps, or past the end of a generation still marked "present". Wikipedia usually has the new generation by then; if not, add a hand entry with a manufacturer source, or wait. Then work through "Recheck each fall" in `docs/photo-coverage.md`: `notSold` years that were predictions, generations that ended recently (did a new model year appear?), and entries a review marked `confidence: "medium"`. Update or clear each one.

## Changelog rules

- **`CHANGELOG.md`** (repo) records every release that changes data or math. Newest first, dated, grouped as *Data*, *Math*, *Site*. It's for contributors and anyone auditing a number.
- **The What's changed page** (site) is a friendly summary for visitors. Only list what someone using the site would notice.
- **Data versions** are date-stamped strings (`factors-2026-09-22`, `state-rules-2026-09-22`, and so on). Bump the one for each file you change, and nothing else. The site footer's "Data updated" date follows the factor bundle.
