# Contributing to NotAQuote.FYI

Thanks for helping. This project only works if the numbers are right and anyone can check them, so every fix, source, and sharp question makes it better.

There are three ways to help, from easiest to most involved:

1. **Tell us something's wrong.** Use one of the [issue forms](https://github.com/bolewood/notaquote-fyi/issues/new/choose). No code needed.
2. **Find a source.** Many numbers still need a public source. A good link, plus the date you checked it, is one of the most useful things you can give us.
3. **Send a pull request.** Fix a number, add a state rule, or improve the code. The rest of this page is for you.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first. The short version: be kind, and assume good intent.

## Get it running (about 5 minutes)

You'll need [Node.js](https://nodejs.org/) 20.19 or newer (CI checks both 20.19 and 24) and npm, which comes with Node.

```bash
git clone https://github.com/bolewood/notaquote-fyi.git
cd notaquote-fyi
npm install
npm run dev
```

Then open [http://127.0.0.1:41731](http://127.0.0.1:41731). The page reloads as you edit.

There are no environment variables, API keys, or databases to set up.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the site at http://127.0.0.1:41731 and reloads on changes. |
| `npm test` | Runs the unit tests. |
| `npm run lint` | Checks code style with ESLint. |
| `npm run typecheck` | Generates Next.js route types, then checks types with TypeScript. Works on a fresh clone. |
| `npm run build` | Makes a production build, the same way the live site is built. |
| `npm run start` | Serves that production build locally. |
| `npm run catalog:build` | Rebuilds the vehicle catalog from NHTSA and FuelEconomy.gov. Downloads large files; you rarely need it. |

Before you open a pull request, run these four. CI runs the same ones:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

### Tests

Tests sit next to the code they check, as `*.test.ts` files in `src/lib/`, and use Node's built-in test runner through `tsx`. To run one file:

```bash
npx tsx --test src/lib/suggest-fix.test.ts
```

If you add a new test file, add its path to the `test` script in `package.json`. Tests aren't discovered automatically.

## Five numbers that need a source

Four are our best guesses; the fifth rests on one state's prices. A state insurance department's rate comparison guide (sample prices from many companies for the same drivers) could turn each into a sourced number. They're also listed on the site's Help page, each with a prefilled issue.

1. **Deductible.** How a $500 or $2,000 deductible changes the price. Look for sample prices at two deductibles for the same driver and car.
2. **Car's age.** How much less an older car costs to insure. Look for the same car at two model years, with collision and comprehensive.
3. **Good-student discount.** Look for a young driver priced with and without it.
4. **Adding a teen outside California.** Look for a family priced before and after adding a 16- or 17-year-old to the parents' policy.
5. **Two or more at-fault accidents.** Look for a driver priced with no at-fault accidents and with two.

The list lives in `src/lib/help-wanted.ts`; update it when one of these gets a source.

## The golden rule: every number needs a source

If a number changes what someone sees, it needs a public source that anyone can open, plus the date someone checked it. If we can't source a number yet, we say so plainly, label it as an assumption, and let the range get wider. We don't hide a guess behind a precise-looking figure.

### What makes a good source

Best, in roughly this order:

- **State insurance department pages**, especially consumer guides and rate-comparison guides that show sample premiums for standard drivers.
- **Statutes and regulations** on the state's official legislature or code website.
- **Public government datasets**, like NHTSA's vPIC or FuelEconomy.gov.
- **Other official public reports** that anyone can read for free.

Not good enough on their own:

- Insurance company marketing pages and blog posts.
- "Average rates" from comparison or lead-generation sites that don't show their method.
- Anything behind a paywall or a license that stops us from citing it openly. We can link to restricted reports, but we don't copy from them.
- Answers from a chatbot or search summary. Find the page it came from and cite that.

### How to record a source

With every sourced value, record:

- **The link** to the exact page, not just the site's home page.
- **The date you checked it**, as `YYYY-MM-DD`.
- **What it says**, in a sentence of your own words. Short quotes are fine; long copied passages aren't.
- **How you got the number**, if you worked it out from the source rather than copying it (for example, "ratio of the 17-year-old sample premium to the 40-year-old one, averaged across the six carriers listed").

Longer research notes belong in the matching `data/*/assumptions.md` file.

## Changing the data

### A factor (a number that moves the estimate up or down)

1. If you're not sure the change is right, use the ["A number looks wrong"](https://github.com/bolewood/notaquote-fyi/issues/new?template=1-number.yml) form first so we can talk it through.
2. Edit the factor in `src/data/model-factors.json`, with its source as described above.
3. Bump the file's version string (see [Versions](#versions) below).
4. Run `npm test`. If a test expects the old number, update the test, and say why in your pull request.
5. Add a line to `data/factors/assumptions.md` about what changed and why.

### A state rule (minimum coverage and required coverages)

Every state's row lives in one file, `data/state-rules/state-rules.json`. [`data/state-rules/README.md`](data/state-rules/README.md) explains each field and the judgment calls behind the current rows.

1. **Find the source.** Use the statute on the state legislature's site, or the state insurance department or DMV page. Note the exact page and today's date.
2. **Edit the row.** Find the object with your state's `"state"` code and change what's wrong:
   - Dollar limits: `biPerPerson`, `biPerAccident`, `pd`, and `combinedSingleLimit` if the state names one. Whole dollars, no commas (`25000`).
   - Coverage marks: `pipRequired`, `medPayRequired`, `umRequired`, `uimRequired`. Use `true`, `false`, `"required-unless-written-rejection"`, `"required-unless-written-deletion"`, `"required-unless-rejected"`, or `null`.
   - `noFault`: `true`, `false`, or `"choice"`. For `"choice"`, set `noFaultDefault` to what applies if you don't pick (`true`, `false`, or `null`). Otherwise `noFaultDefault` stays `null`.
   - `sources`: add `{ "label": "...", "url": "https://..." }`. Put the best source for the dollar limits first.
   - `note`: one to three plain sentences for visitors ([docs/VOICE.md](docs/VOICE.md)).
   - `goodToKnow`: a helpful caveat that isn't a gap (an exemption, how a choice works), or `null`.
   - `uncertain`: anything you couldn't confirm. **If you can't confirm a figure, set it to `null` and say why here.** That's always a valid edit.
   - `effective`: when the rule took effect, and any recent change.
   - `scheduledChanges`: a law that's passed but not in effect yet, as `{ "from": "YYYY-MM-DD", "biPerPerson": ..., "biPerAccident": ..., "pd": ..., "summary": "...", "sourceUrl": "https://..." }`. Once that date arrives, a test fails until you apply the new figures to the row and remove the entry.
3. **Add a quote.** In `data/state-rules/evidence.json`, give your state the same sources in the same order, each with a short `quote` (a sentence or two) from the page.
4. **Update the dates.** Set the row's `checkedOn` to today (`YYYY-MM-DD`). At the top of `state-rules.json`, set `checkedOn` to the newest row date and `version` to `state-rules-` plus that date. Set the `version` at the top of `evidence.json` to match.
5. **Run the tests:**

   ```bash
   npx tsx --test src/lib/state-rules.test.ts
   ```

   A bad value fails with a message naming the row and field. If you changed a row listed under "PINNED SPOT CHECKS" in that test file on purpose, update the pinned value there too and say why in your pull request. Then run the full set: `npm run lint && npm run typecheck && npm test && npm run build`.
6. **Look at it.** Run `npm run dev` and open [http://127.0.0.1:41731/sources#state-note-OH](http://127.0.0.1:41731/sources#state-note-OH) (use your state's code). Check the table row, the note, "Details and sources", and the "State minimum" line in the calculator for that state.
7. **Say what changed.** In the pull request, link the source and add anything unusual to `data/state-rules/README.md`.

### A vehicle

The vehicle catalog is generated from NHTSA vPIC and FuelEconomy.gov by `scripts/build-vehicle-catalog.ts`. Please don't hand-edit `public/catalog/vehicle-catalog.json`, `src/lib/catalog-meta.ts`, or `src/lib/catalog-defaults.ts`. If a car is missing or classified wrong, the fix usually belongs in the build script, followed by `npm run catalog:build`. If that's more than you want to take on, a ["Vehicle"](https://github.com/bolewood/notaquote-fyi/issues/new?template=3-vehicle.yml) issue is just as welcome.

### A car page

Car pages live at `/cars/<slug>`. The cars are the site's popular lists (in `src/lib/car-search.ts`) plus the list in [`data/car-pages.json`](data/car-pages.json). To add one, add `{ "make": "...", "model": "...", "why": "..." }` with the catalog's exact make and model names, then run `npm test`. A page is only built when the Highway Loss Data Institute has claims results for that exact model, and the test tells you if yours doesn't.

The slug is the make and model in lowercase with dashes (Toyota RAV4 is `toyota-rav4`, Ford F-150 is `ford-f-150`, and words in parentheses drop out). There's no year in it, so the address survives the yearly refresh. **Never change a live slug.** Every live slug is pinned in `src/lib/seo-slugs.json`, and `npm test` fails if one changes or disappears; when you add a car, add its slug there too. To keep an old address after a rename, give the car a `"slug"` in `data/car-pages.json` (this works for cars on the popular lists as well). State pages work the same way: `/states/ohio`, `/states/district-of-columbia`.

Car pages are checked for how much of each page is its own. `npm test` renders every car page, masks the dollar amounts (so numbers alone can't carry a page), and measures the share of five-word runs found on no other car page (`src/lib/uniqueness.ts`). It fails if the median drops under 20%, any page drops under 15%, or two pages overlap more than 0.63 (`RENDERED_CAR_FLOOR` in `src/lib/seo.test.ts`, set just under the values when it was written). If your wording change trips it, make the pages more their own; don't lower the floor.

Nothing is kept out of search automatically. To keep one car's page up for visitors but out of search results and the sitemap, add `"noindex": true` to its entry in `data/car-pages.json` (for a car on the popular lists, add an entry with just its make, model, and the flag), and say why in the pull request.

### Versions

Every data file carries a version string. Share links record two of them, the model version and the factor-bundle version, so someone opening an old link can tell when the math or the factors behind it have changed. So when you change data, bump its version to include today's date:

| What you changed | Where the version lives |
| --- | --- |
| Factors | `DERIVATION_VERSION` (with `EFFECTIVE_DATE` and `CHECKED_ON`) in `src/lib/factor-derivation.ts`, then `npm run factors:build` writes `src/data/model-factors.json` |
| Source list | `"version"` in `src/data/source-manifest.json` |
| State rules | `"version"` and `"checkedOn"` in `data/state-rules/state-rules.json` (see the steps above) |
| Typical premium by state | `"version"` and `"checkedOn"` in `data/state-baselines/state-baselines.json` |
| Vehicle catalog | Written for you by `npm run catalog:build` |
| How the engine does its math | `MODEL_VERSION` in `src/lib/copy.ts` |

Follow the pattern already in the file (for example `factors-2026-09-21` becomes `factors-2026-10-02`). If you're unsure, say so in the pull request and a maintainer will help.

If your change moves a number people see, add a line to [CHANGELOG.md](CHANGELOG.md). The once-a-year refresh of every source is in [docs/DATA-REFRESH.md](docs/DATA-REFRESH.md).

## Privacy rules for code

These are promises the site makes, so they're rules for every change:

- A visitor's inputs stay in their browser. The only exception is the optional VIN decode, which goes straight from the browser to NHTSA.
- No analytics scripts, tracking pixels, cookies, or third-party scripts.
- Never put a premium, a VIN, or anything personal in a URL that leaves the site.

To add a "Suggest a fix" link beside a number, use the helper in `src/lib/suggest-fix.ts`. It opens a prefilled GitHub issue. It also drops values that look like a dollar amount, a VIN, an email address, or a phone number, but that's a safety net, not a guarantee: only ever pass the site's own labels and values, never anything the visitor typed. Write liability minimums as "30/60/15", since values with a dollar sign are dropped.

```tsx
import { suggestFixUrl } from "@/lib/suggest-fix"

<a
  href={suggestFixUrl({
    kind: "state-rule",
    title: "Ohio minimum liability",
    fields: { state: "Ohio", rule: "Minimum liability limits", shown: "25/50/25" },
  })}
  rel="noreferrer"
>
  Spot something wrong? Tell us
</a>
```

If you rename or remove a field in an issue form, update `FIX_TEMPLATES` to match. The tests catch a mismatch.

## Words on the site

Anything a visitor reads should follow [docs/VOICE.md](docs/VOICE.md): plain words, short sentences, honest about what we don't know, and never salesy or scary. Picture explaining it to a friend at the kitchen table.

## Pull requests

- **Keep them small.** One fix or one feature per pull request. Three small ones get reviewed faster than one big one.
- **Link the issue** it fixes, if there is one ("Fixes #12").
- **Show your sources** for any data change.
- **Fill in the checklist** in the pull request template.
- **Expect questions.** Review is about getting the numbers right, not about you. If a reviewer asks for a source, that's the project working as intended.

Not sure where to start? Look for issues labeled [`good first issue`](https://github.com/bolewood/notaquote-fyi/labels/good%20first%20issue) or [`help wanted`](https://github.com/bolewood/notaquote-fyi/labels/help%20wanted), or [ask a question](https://github.com/bolewood/notaquote-fyi/issues/new?template=5-question.yml).

## Licensing your contribution

By contributing, you agree that your code is released under the [MIT license](LICENSE) and your data contributions under [CC BY 4.0](DATA-LICENSE.md), the same terms as the rest of the project.
