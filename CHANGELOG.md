# Changelog

Every release that changes the data or the math goes here, newest first. The site's [What's changed](https://notaquote.fyi/model-version) page has the short version for visitors. How to do a refresh is in [docs/DATA-REFRESH.md](docs/DATA-REFRESH.md).

Data versions are date-stamped (`factors-YYYY-MM-DD`, `state-rules-YYYY-MM-DD`, `state-baselines-YYYY-MM-DD`, `catalog-YYYY-MM-DD`, `manifest-YYYY-MM-DD`). Annual refreshes are tagged `data-YYYY.MM`.

## 2026-09-23: Pages for search: states, cars, and guides

### Site
- **State pages** (`/states/<state>`, 51 pages, plus `/states`): the typical price (NAIC 2023, brought up to today), how it ranks and compares with the national figure and the neighbors, what a move from a neighbor might do, the state's minimum coverage with its sources, what adding a 16-year-old costs, and the five popular cars that cost least to insure for a teen there. The page says plainly that the order of cars is the same in every state.
- **Car pages** (`/cars/<make-model>`, 121 pages, plus `/cars`): for each popular model with its own HLDI claims results, led by the newest model year our claims data covers (2024): a typical 45-year-old's yearly estimate, a table of older model years (full coverage, liability only, adding a teen, the teen's own policy), the spread across versions, other ages, what adding a 16-year-old costs, why (claims in plain words and each part of the bill in dollars), and the nearest cars in the same HLDI size class. The list is the site's popular lists plus `data/car-pages.json`; every live slug is pinned in `src/lib/seo-slugs.json`. Each page's own-content share is measured at build time; one page below the floor (the Toyota RAV4 Prime) is `noindex` and out of the sitemap.
- **Guides**: `/guides/cheapest-cars-to-insure-for-teens` and `/guides/adding-a-teen-driver`, with a `/guides` index linked from the footer.
- Every page has its own title, description, and canonical address, plus Open Graph and Twitter tags. Social preview images are drawn at build time for the site, Compare, the guides, and each state and car page.
- Structured data: `WebSite` and `WebApplication` on the home page, two `Dataset`s on /sources (the state minimums, ours under CC BY 4.0; the typical prices, NAIC's figures with credit and no license claimed), `Article` on the guides, and breadcrumbs.
- `sitemap.xml` lists every indexable page, with `lastModified` from the data's own check dates (not the llms.txt guides).
- Links: state pages from the /sources state picker and the footer, car pages from the What-if result, Compare rows, and the footer. Buttons on the new pages open the What-if and Compare pages filled in, without changing anything the visitor saved until they choose (new share-link `via` values: `page`, `add`, `state`, `teen`).
- If the per-model claims data is switched off, every car page, `/cars`, and the links to them go away together, and the teen guide and state pages say cars of the same kind tie instead of naming one.

### Math
- No change to the math. A national starting point (`nationalTypicalStart`, NAIC's countrywide figure brought up to today the same way as a state's) is new, for pages that aren't about one state.

## 2026-09-23: Open to search engines

### Site
- Search engines may now index the site. The `noindex` header and meta tag are gone, and `robots.txt` and `sitemap.xml` allow everything.
- Added this changelog, the refresh runbook, and a yearly reminder issue.

## 2026-09-22: Help for AI assistants

### Site
- Added a read-only JSON API (`/api/v1`: `cars`, `compare`, `whatif`) that uses the same math as the site. It doesn't accept a premium, VIN, ZIP code, or name.
- Added `/llms.txt` and `/llms-full.txt`, a guide for AI assistants with recipes and ready-to-fetch links.

## 2026-09-22: Community release (model 0.2.0)

### Data
- **State rules** (`state-rules-2026-09-22`): minimum liability limits and required coverages for all 50 states and DC, each with a primary source, a check date, and quotes in `evidence.json`. Scheduled changes for DC (2027) and California (2035) are recorded, with a test that fails when one takes effect.
- **Typical price per state** (`state-baselines-2026-09-22`): NAIC 2022/2023 Auto Insurance Database Report, 2023 combined average premium, used as facts with credit. Brought up to August 2026 with BLS CPI series CUUR0000SETE (×1.1847).
- **Factors** (`factors-2026-09-22`):
  - Driver, record, mileage, area, and coverage factors come from rate surveys in California, Texas, Colorado, Oklahoma, North Dakota, and DC, plus North Carolina's surcharge rule. The raw CSVs and derivation script are in the repo.
  - Of the 26 adjustments, 9 come from published prices, 4 are worked out from public data, and 13 are our best guesses.
- **Vehicles:** HLDI insurance losses by make and model (2022–24), calibrated against California's multi-vehicle survey. Class and powertrain come from EPA data in the catalog. We've asked IIHS for permission; `useHldiModels` turns it off.

### Math
- One pricing engine for every dollar on the site. The old sample weights are gone.
- A teen can be priced on their own policy or added to a parent's policy (a household increase).

### Site
- A What-if home page and a Compare page for up to 15 cars (sorting, stars, CSV, print, share links).
- Plain-language rewrite of every page (docs/VOICE.md).
- "Suggest a fix" links that open prefilled GitHub issues.
- MIT license for the code; CC BY 4.0 for the data we compile.

## 2026-09-21: Prototype (model 0.1.0)

- The first version: a labeled sample calculator, the NHTSA/FuelEconomy vehicle catalog, and six sourced state rows.
