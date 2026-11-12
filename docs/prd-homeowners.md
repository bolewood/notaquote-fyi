# PRD: Homeowners insurance estimates (HO-3), pilot

Status: draft, November 12, 2026. Builds on [prd-renters.md](prd-renters.md); read that first. This PRD only spells out what's different for homeowners.

Confidence tags on research findings: **[V]** checked against a primary source, **[L]** from a credible secondary source, **[U]** unverified. Sources are listed at the end, accessed November 7, 2026 unless noted.

## 1. Summary

A homeowners estimate answers the same kind of question as the car and renters estimates: roughly what this costs, and what changes it, with a source for every step and nothing leaving the browser. It's harder to do honestly:

- **What's strong:** state averages (NAIC, HO-3 policy form), ZIP-level premium averages from the U.S. Treasury's Federal Insurance Office (2018–2022, from a data call covering 330+ insurers and 246M+ policy-years) [V], regulator sample premiums in several states, and federal hazard data (FEMA, USDA Forest Service, NOAA).
- **What's weak:** the house itself. Rebuild cost, roof, construction details, fire-protection class, insurer territories, and catastrophe models are mostly proprietary. There's no public equivalent to a parcel-level replacement-cost engine [V/L], and ISO's fire-protection classes aren't openly published [L].

So homeowners ships as a **pilot**: five states, labeled experimental, with a visibly wider range than renters, and an explanation of what we can't see.

### Gate to start
1. Renters is live and has met its validation targets (renters PRD §10), so the shared parts (derivation, ranges, ZIP-to-county lookup, validation harness) are proven.
2. NAIC has answered the renters permission question, or the renters approach (use per-state averages as facts with credit; remove them if NAIC objects) is in place and unchallenged.

### Why now
Same market gap as renters: no national, open, browser-local estimator was found that publishes its sources and factor weights. NerdWallet's homeowners calculator is the closest commercial analog [V]. It's transparent about method, but built on proprietary rate data, commercial, and not open source. California's regulator tool is the closest public one, and states plainly that its results aren't quotes [V].

## 2. Who it's for

- *"We're looking at houses around $400,000. What will insurance add to the monthly payment?"*
- *"Our renewal went up 30%. Is that our ZIP code, or us?"*
- *"Would a $2,500 deductible save enough to be worth it?"*
- *"We're moving from Ohio to Florida. How different is home insurance there?"*

First-time buyers and families comparing places to live are the core audience. They tend to overlap with the families using the car and teen-driver pages.

## 3. Goals and non-goals

### Goals
1. In the five pilot states, give a sourced range for a typical homeowners policy by area, dwelling coverage, home age, construction, and deductible.
2. Show plainly how much of the price is place (weather, wildfire, storms) versus the house, using public hazard data, without claiming parcel-level accuracy.
3. Everywhere else, show the state's typical price with a wide range and a clear "we can't adjust for your area here yet."

### Non-goals
Everything in the renters non-goals applies (not a quote, no insurer names or rankings, medians only, no applications or referrals). In addition:

- **No home-value input treated as rebuild cost.** The market price includes land, which isn't insured, and rebuild cost can be higher or lower than market value. We ask for dwelling coverage if you know it, or offer a rough rebuild-cost band that's clearly labeled.
- **No flood pricing.** Standard homeowners policies exclude flood. Show a note and link FEMA's flood maps and flood insurance pages. Flood is a separate product, out of scope.
- **No wildfire or catastrophe score of our own.** The Forest Service warns that Wildfire Risk to Communities isn't intended to rate individual homes [V]. We use it, and FEMA's National Risk Index, to describe risk near a location, never to claim what an insurer knows about a specific house.
- **No national credit adjustment.** See §5.

## 4. Experience

Same pattern as renters: `/homeowners`, `/homeowners/states/[state]` for the pilot states, a methodology section, sources rows, a data-licenses entry, and cross-links with the car calculator's bundling option and with `/renters`.

The page carries a plain "Experimental" note near the result: "We're still testing this in five states. Expect a wider range than our car or renters estimates."

### Inputs (draft bands)

| Input | Bands | Notes |
|---|---|---|
| State | 50 + DC | Pilot states get area adjustments; others get the state figure and a wide range |
| ZIP code | 5 digits, browser-only | Converted to county and Census tract locally (see renters PRD §7) |
| Dwelling coverage | $150k, $250k, $350k, $500k, $750k, $1M+ | "From your policy's declarations page, if you have one" |
| …or rough rebuild cost | Square feet band × a public construction-cost figure | Shown as "a rough rebuild cost, not an appraisal"; widens the range. Source to be chosen (see §6). |
| Year built | Before 1950, 1950–79, 1980–99, 2000–09, 2010+ | Matched to the survey profiles' home-age variations |
| Construction | Frame, masonry | Only if a pilot survey varies it |
| Deductible | $500, $1,000, $2,500, 1–2% (wind/hurricane, FL/TX) | Percentage deductibles explained in plain words |
| Current premium | Optional | Same as car and renters: start from it if entered |

### Output
Same structure as renters: a range and likely figure, "Here's how we got this", and "Why the range is this wide". Plus one homeowners-specific block:

> **What's around this home.** FEMA rates this county's expected yearly losses from natural hazards as relatively high, mostly from hurricanes and wind. The Forest Service rates wildfire risk to homes here as low. These describe the area, not your house.

## 5. Model

### Formula

```
estimate = state typical HO-3 premium (NAIC)
         × price trend to today
         × area factor
         × dwelling coverage factor
         × deductible factor
         × home age / construction factor
         × hazard factor (pilot states, indicative)
```

### Factors, sources, and basis tiers

| Factor | Source | Basis | Notes |
|---|---|---|---|
| State typical premium | NAIC homeowners report, HO-3 average by state, latest data year 2022 [V] | `reference` | HO-3 rose 11.26% from 2021 to 2022 nationally [V], so the trend step matters. |
| Trend to today | **Open question.** BLS's household insurance series (`CUUR0000SEHD`) prices renters policies only; physical damage to owner-occupied homes is outside the CPI [V]. | `assumed` until sourced | Candidates: NAIC year-over-year change by state (lags 3 years), or the Treasury series. Until one is chosen, label the trend "Our best guess" and widen the range. Don't use the renters CPI as if it were a homeowners index. |
| Area within the state | Pilot-state regulator sample premiums by ZIP, city, or county (CA, TX, FL CHOICES, SC), the same profile priced in different places | `sourced` where a survey covers the area, else `indicative` | Elsewhere in a pilot state, fall back to a capped hazard adjustment (below), then the state figure. **Treasury ZIP data and Florida's observed county averages are kept out of the factor so they can check it** (§9). |
| Dwelling coverage, deductible, home age, construction | CA 2026 survey, TX HelpInsure, FL CHOICES, MD 2026 guide, SC DOI sample rates | `sourced` where a survey varies it | Same paired-profile derivation and medians as renters. |
| Hazard (wind, wildfire, hail) | FEMA National Risk Index (county and tract expected annual loss), USFS Wildfire Risk to Communities, NOAA Storm Events | `indicative` | **Mostly explains.** Where a survey covers the area, its prices already contain the hazard effect; hazard data say why. Only where no survey covers the area does it adjust the price, capped, with the range widened. |
| Wind share (FL) | FL OIR county averages with and without wind | explanation only | Shown as "about X% of a typical premium in this county is for wind"; doesn't change the estimate. |

**Treasury's hazard findings are for checking, not coefficients.** Treasury found the highest-climate-risk ZIP quintile paid on average $2,321, 82% above the lowest, with nonrenewals about 80% higher [V]. Those are associations across areas, not the effect of one rating variable, so they must not become "wildfire adds X%". Use them, and the ZIP dataset, only to check that our area factors rank areas the same way.

### Credit and other restricted factors
No national credit switch. Add a `data/homeowners/jurisdictions.json` table, one row per state, with:

- `credit`: `allowed` / `restricted` / `prohibited` / `unknown`
- a link to the statute or regulator page
- a checked-on date

Start from NAIC's state-by-state credit chart and verify each state against its statute before marking it anything other than `unknown`. Verified so far [V]: Maryland prohibits using credit history to set homeowners premiums; Nevada allows it with limits; Washington restricts it. The estimate doesn't take a credit input. The table only shapes the explanation ("In Maryland, insurers can't use your credit history to set a home insurance price") and, for `allowed` states, the range width.

Claims history, roof age, and insurer wildfire scores get the same treatment later, as rows in the same table.

### Ranges
Same quadrature rule as car and renters, with two extra sources of width:

- an "experimental" spread on the whole estimate, set from the pilot validation (§9)
- the rough rebuild-cost band, when used instead of dwelling coverage

## 6. Data and rights

Everything in the renters PRD §6 applies (NAIC as facts with credit, individual figures with locators, no re-hosted PDFs, medians only). Homeowners adds:

| Source | Data | Reuse | Notes |
|---|---|---|---|
| U.S. Treasury / FIO, *Analyses of U.S. Homeowners Insurance Markets, 2018–2022* (Jan. 16, 2025), supporting ZIP dataset | ZIP premium, claims, nonrenewal metrics | Federal release; credit Treasury | M0: download, document every field, suppression rule, and the dataset's own disclaimer. |
| Florida OIR market reports | County average premium, with and without wind | State public data; check terms | |
| Florida OIR CHOICES; South Carolina DOI price comparison; Maryland guide; California and Texas tools | Sample premiums for fixed profiles | Same as renters | |
| FEMA National Risk Index v1.20 (Dec. 2025) | County and tract expected annual loss | Federal | |
| USDA Forest Service, Wildfire Risk to Communities (2024 data; 2026 viewer) | Wildfire likelihood and risk to homes | Federal; check metadata for third-party layers | Not home-specific; say so. |
| NOAA NCEI Storm Events (1950–mid 2026) | County hail, wind, tornado events | Public domain unless marked | Reporting thresholds change over time. |
| Rebuild cost per square foot | Candidates: ICC Building Valuation Data (check terms; it's an ICC publication, not federal), Census construction cost data | To decide in M0 | Must be labeled "rough"; never called a replacement-cost estimate unless validated. |

SERFF filings (insurer rate manuals) could give real territory and deductible factors, but filings are state records under each state's public-access rules, and viewable doesn't mean freely republishable [V]. **Out of scope for the pilot.** A later research spike could try parsing two or three insurers' filings in CA, TX, and MD.

## 7. Privacy

Same as renters PRD §7. The tract lookup is a bigger table than county; ship it per state (pilot states only), lazy-loaded when that state is picked, so a ZIP never goes anywhere. The agent API takes `state` and `county`, not ZIP or tract.

## 8. Architecture

Reuse the renters engine and its shared helpers. Homeowners is the third line of insurance, so this is the point to decide whether car, renters, and homeowners share one engine core (renters PRD §8). Recommendation: extract the shared core (factor application, range math, step building) only if renters and homeowners turn out to duplicate it. Don't restructure the car engine for this pilot.

New files (draft):
- `src/data/homeowners-factors.json`, built by `scripts/derive-homeowners.ts`
- `data/homeowners/README.md` (method, assumptions, validation results)
- `data/homeowners/jurisdictions.json`
- `data/homeowners/sources/*.csv`, following the `data/factors/sources/` format

## 9. Measuring success and go/no-go

Same validation approach as renters, with looser starting targets (a proposal, to revisit after the first measurement):

| Check | Target |
|---|---|
| Median absolute error vs held-out regulator sample medians, pilot states | within 25% |
| Held-out sample medians inside our range | at least 80% |
| Area factor ranks ZIPs the same way as Treasury's published ZIP averages (not used to build the factor) | Spearman correlation at least 0.6 per pilot state |
| Florida: estimates for typical homes rank counties the same way as OIR's observed county averages (not used to build the factor) | Spearman correlation at least 0.6 |

**Go/no-go for leaving the pilot** (adding states or dropping "experimental"):
- All four checks pass in at least four of the five pilot states.
- No open correction issue showing a systematic miss (for example, a whole coastal region consistently outside the range).
- A credit row verified for every state shown.

If the checks fail, widen the range and keep it experimental, or remove area adjustments and show the state figure only.

## 10. Milestones

| | Milestone | Done when |
|---|---|---|
| H0 | Gate and data | Renters gate met; Treasury ZIP dataset documented; pilot-state surveys pulled into CSVs; rebuild-cost source chosen; homeowners trend source decided (or labeled a guess). |
| H1 | Derivation | `homeowners-factors.json` with golden tests; jurisdictions table for the five pilot states verified. |
| H2 | Pages | `/homeowners`, pilot state pages, hazard explanation block, methodology section. |
| H3 | Validation | §9 checks run and published. |
| H4 | Pilot launch | "Experimental" label, CHANGELOG, DATA-REFRESH steps. |
| H5 | Decide | Go/no-go per §9. |

**Later (Phase C): condo (HO-6).** Probably easier than HO-3 because the unit owner doesn't insure the building shell, but the association's master policy adds its own complexity. NAIC and California both publish condo figures. A short PRD comes when HO-3 reaches go/no-go.

## 11. Risks and open questions

- **Rebuild cost** is the biggest source of error. If no public source is good enough, require dwelling coverage as an input and drop the rough band.
- **Homeowners trend index**: none is public. See §5.
- **Treasury data age** (2018–2022) predates recent sharp rate increases in several states. It's only a check on how areas rank, not on price level.
- **Catastrophe-exposed states move fast.** FL, CA, and TX markets change quickly; date every figure and refresh on schedule.
- **Credit table effort.** Verifying 51 statutes is real work; ship pilot states first, others as `unknown`.
- **Licensing.** Same as renters. Counsel review before the pilot leaves experimental.
- **State survey coverage beyond the five pilot states is unverified.** The November 2026 research didn't find comparison tools in the other states, but that doesn't mean none exist. A 50-state survey audit is on the roadmap backlog.

## 12. Acceptance criteria

All renters PRD §13 criteria, applied to homeowners, plus:

- [ ] No input or copy treats home value as rebuild cost.
- [ ] The hazard block says it describes the area, not the house, and credits FEMA and the Forest Service.
- [ ] Treasury ZIP figures and Florida observed county averages are used only for validation, never to build a factor or as per-hazard percentages.
- [ ] Every state shown has a `jurisdictions.json` row with a source link and date, or is marked `unknown`.
- [ ] "Experimental" note on every homeowners result until go/no-go passes.
- [ ] Flood note and FEMA link on every result.

## Sources

All accessed November 7, 2026 (internal research), in addition to the renters PRD's sources.

- U.S. Treasury / FIO, *Analyses of U.S. Homeowners Insurance Markets, 2018–2022* (Jan. 16, 2025): https://home.treasury.gov/news/press-releases/jy2791 and supporting data: https://home.treasury.gov/policy-issues/financial-markets-financial-institutions-and-fiscal-service/federal-insurance-office/reports-notices
- USDA Forest Service, Wildfire Risk to Communities: https://research.fs.usda.gov/firelab/products/dataandtools/wildfire-risk-communities (data viewer: https://research.fs.usda.gov/firelab/products/dataandtools/wildfire-risk-communities-data-viewer)
- NOAA NCEI Storm Events Database: https://www.ncei.noaa.gov/access/storm-events-database/
- Florida OIR CHOICES and market reports: Florida Office of Insurance Regulation (URLs to record in M0)
- South Carolina DOI price comparison tool: https://online.doi.sc.gov/Eng/Public/HelpInsure/HelpInsure.aspx/1000
- California DOI homeowners comparison tool: https://interactive.web.insurance.ca.gov/apex/f?p=111:20 and profiles: https://www.insurance.ca.gov/01-consumers/105-type/9-compare-prem/homeowners-profile.cfm
- NAIC, Credit-Based Insurance Scores (Mar. 19, 2026), with the state chart: https://content.naic.org/insurance-topics/credit-based-insurance-scores
- Maryland Insurance Administration, homeowners rates: https://insurance.maryland.gov/Consumer/Pages/homeowners-rates.aspx
- SERFF public access settings: https://login.serff.com/stateSettings.html
- NerdWallet home insurance calculator: https://www.nerdwallet.com/insurance/homeowners/home-insurance-calculator
- ISO fire-protection classes, Nevada and Washington credit rules, ICC Building Valuation Data: per November 2026 research; primary links to record before use.
