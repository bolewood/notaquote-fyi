# PRD: Homeowners insurance estimates (HO-3), pilot

Status: draft, November 12, 2026. Builds on [prd-renters.md](prd-renters.md); read that first. This PRD only spells out what's different for homeowners.

Confidence tags on research findings: **[V]** checked against a primary source, **[L]** from a credible secondary source, **[U]** unverified. Findings come from two internal research passes (November 7 and November 12, 2026); where they disagreed, this PRD says so. Sources are listed at the end.

## 1. Summary

A homeowners estimate answers the same kind of question as the car and renters estimates: roughly what this costs, and what changes it, with a source for every step and nothing leaving the browser. It's harder to do honestly:

- **What's strong:** state averages (NAIC, HO-3 policy form), ZIP-level premium averages from the U.S. Treasury's Federal Insurance Office (2018–2022, from a data call covering 330+ insurers and 246M+ policy-years) [V], regulator sample premiums in several states, and federal hazard data (FEMA, USDA Forest Service, NOAA).
- **What's weak:** the house itself. Rebuild cost, roof, construction details, fire-protection class, insurer territories, and catastrophe models are mostly proprietary. There's no public equivalent to a parcel-level replacement-cost engine [V/L], and ISO's fire-protection classes aren't openly published [L].

So homeowners ships as a **pilot**: California, Texas, and Florida to start, plus Oklahoma, Maryland, and South Carolina once each state's current survey is confirmed, labeled experimental, with a visibly wider range than renters, and an explanation of what we can't see.

### Gate to start
1. Renters is live and has met its validation targets (renters PRD §10), so the shared parts (derivation, ranges, ZIP-to-county lookup, validation harness) are proven.
2. NAIC has answered the permission request (renters PRD §6). NAIC figures appear only with written permission. If NAIC declines, homeowners can still start from federal data only: Treasury's ZIP averages, the BLS homeowners price index, and Census survey data (§5).

### Why now
Same market gap as renters: no national, open, browser-local estimator was found that publishes its sources and factor weights. NerdWallet's homeowners calculator is the closest commercial analog [V]. It's transparent about method, but built on proprietary rate data, commercial, and not open source. California's regulator tool is the closest public one, and states plainly that its results aren't quotes [V].

The need has grown. NAIC's own analysis of 2018–2024 found inflation-adjusted average premiums up 18% to 43% by region, and insurer-initiated non-renewals up 96% to 216% [V per the second research pass]. Published "average home insurance" figures from commercial sites range from about $2,150 to $3,550 a year nationally, mostly because each assumes a different house and coverage (per November 2026 research).

## 2. Who it's for

- *"We're looking at houses around $400,000. What will insurance add to the monthly payment?"*
- *"Our renewal went up 30%. Is that our ZIP code, or us?"*
- *"Would a $2,500 deductible save enough to be worth it?"*
- *"We're moving from Ohio to Florida. How different is home insurance there?"*

First-time buyers and families comparing places to live are the core audience. They tend to overlap with the families using the car and teen-driver pages.

## 3. Goals and non-goals

### Goals
1. In the pilot states, give a sourced range for a typical homeowners policy by area, dwelling coverage, home age, construction, and deductible.
2. Show plainly how much of the price is place (weather, wildfire, storms) versus the house, using public hazard data, without claiming parcel-level accuracy.
3. Everywhere else, show the state's typical price with a wide range and a clear "we can't adjust for your area here yet."

### Non-goals
Everything in the renters non-goals applies (not a quote, no insurer names or rankings, medians only, no applications or referrals). In addition:

- **No home-value input treated as rebuild cost.** The market price includes land, which isn't insured, and rebuild cost can be higher or lower than market value. We ask for dwelling coverage if you know it, or offer a rough rebuild-cost band that's clearly labeled.
- **No flood or earthquake pricing.** Standard homeowners policies exclude both. Show a note, made ZIP-specific with FEMA's flood insurance claims and policy counts (OpenFEMA), and link FEMA's flood maps and flood insurance pages. Flood is a separate product, out of scope.
- **No coverage advice.** Dwelling coverage is a what-if input, not a recommendation.
- **No wildfire or catastrophe score of our own.** The Forest Service warns that Wildfire Risk to Communities isn't intended to rate individual homes [V]. We use it, and FEMA's National Risk Index, to describe risk near a location, never to claim what an insurer knows about a specific house.
- **No national credit adjustment.** See §5.

## 4. Experience

Same pattern as renters: `/homeowners`, `/homeowners/states/[state]` for the pilot states, a methodology section, sources rows, a data-licenses entry, and cross-links with the car calculator's bundling option and with `/renters`.

The page carries a plain "Experimental" note near the result: "We're still testing this in a few states. Expect a wider range than our car or renters estimates."

States with an unusual standard policy get a one-line warning. In Hawaii, for example, a standard homeowners policy excludes hurricane, which needs a separate policy (per November 2026 research; confirm before launch). North Carolina uses its own HE-7 form alongside HO-3.

### Inputs (draft bands)

| Input | Bands | Notes |
|---|---|---|
| State | 50 + DC | Pilot states get area adjustments; others get the state figure and a wide range |
| ZIP code | 5 digits, browser-only | The smallest area we use. Hazard data are pre-summarized to ZIP (ZCTA) per state, so no address is ever needed (see §7) |
| Dwelling coverage | $150k, $250k, $350k, $500k, $750k, $1M+ | "From your policy's declarations page, if you have one" |
| …or rough rebuild cost | Square feet band × a public construction-cost figure | Shown as "a rough rebuild cost, not an appraisal"; widens the range. Source to be chosen (see §6). |
| Year built | Before 1950, 1950–79, 1980–99, 2000–09, 2010+ | Matched to the survey profiles' home-age variations |
| Construction | Frame, masonry | Only if a pilot survey varies it |
| Deductible | $500, $1,000, $2,500, 1–2% (wind/hurricane, FL/TX) | Percentage deductibles explained in plain words |
| Current premium | Optional | Same as car and renters: start from it if entered |

### Output
Same structure as renters: a range and likely figure, "Here's how we got this", and "Why the range is this wide". Plus one homeowners-specific block:

> **What's around this home.** FEMA rates expected yearly losses from natural hazards in this ZIP code as relatively high, mostly from hurricanes and wind. The Forest Service rates wildfire risk to homes here as low. These describe the area, not your house.

And a second block, which explains but never changes the price (figures illustrative):

> **How often insurers drop policies here.** From 2018 to 2022, insurers chose not to renew about 2 in 100 policies a year in this ZIP code, above the state's average. If yours isn't renewed, your state's insurer of last resort is the backstop.

That block uses Treasury's ZIP non-renewal rates, with the Senate Budget Committee's county data (2018–2023) where Treasury has no figure. The Senate data covers carriers with about 65% of the market; say so.

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
| State typical premium | NAIC homeowners report, data for 2023 (July 2026), HO-3 average by state [V] | `reference` | Needs NAIC's permission (renters PRD §6). If NAIC declines, start from Treasury's state-level averages (2022) instead, with a wider range. |
| Trend to today | BLS Producer Price Index, *Direct Property and Casualty Insurers: Homeowner's Insurance* (`PCU5241265241262`), monthly, through Sept. 2026 [V] | `reference` | BLS's consumer index (`CUUR0000SEHD`) prices renters policies only, so it isn't used here. The producer index is constant-quality: it tracks price for the same coverage, so it won't show premiums rising because coverage limits rose with rebuild costs. Say so in "Why the range is this wide." |
| Area within the state | Pilot-state regulator sample premiums by ZIP, city, or county (CA, TX, FL CHOICES across all 67 counties, OK across four cities), the same profile priced in different places | `sourced` where a survey covers the area, else `indicative` | Elsewhere in a pilot state, fall back to a capped hazard adjustment (below), then the state figure. **Treasury ZIP data and Florida's observed county averages are kept out of the factor so they can check it** (§9). |
| Dwelling coverage, deductible, home age, construction | CA 2026 survey, TX HelpInsure, FL CHOICES (3 scenarios), OK 2026 chart (5 scenarios × frame and masonry, $100k–$500k dwelling, 1% deductible) [V], plus MD and SC if confirmed. NAIC Table 4 (HO-3 average premium by amount of insurance, by state) as a cross-check on the dwelling coverage slope, if NAIC permits. | `sourced` where a survey varies it | Same paired-profile derivation and medians as renters. Oklahoma varies dwelling amount and construction but not deductible. |
| Hazard (wind, wildfire, hail) | FEMA National Risk Index (expected annual loss for covered perils only: wind, hail, tornado, hurricane, wildfire, winter weather; flood and earthquake go to the exclusion note), USFS Wildfire Risk to Communities, NOAA Storm Events. Tract figures pre-summarized to ZIP, weighted by population. | `indicative` | **Mostly explains.** Where a survey covers the area, its prices already contain the hazard effect; hazard data say why. Only where no survey covers the area does it adjust the price, capped, with the range widened. |
| Wind share (FL) | FL OIR county averages with and without wind | explanation only | Shown as "about X% of a typical premium in this county is for wind"; doesn't change the estimate. |

**Treasury's hazard findings are for checking, not coefficients.** Treasury found the highest-climate-risk ZIP quintile paid on average $2,321, 82% above the lowest, with nonrenewals about 80% higher [V]. Those are associations across areas, not the effect of one rating variable, so they must not become "wildfire adds X%". Use them, and the ZIP dataset, only to check that our area factors rank areas the same way.

### Credit and other restricted factors
No national credit switch. Add a `data/homeowners/jurisdictions.json` table, one row per state, with:

- `credit`: `allowed` / `restricted` / `prohibited` / `unknown`
- a link to the statute or regulator page
- a checked-on date

Start from NAIC's state-by-state credit chart and verify each state against its statute before marking it anything other than `unknown`. Verified so far [V]: Maryland prohibits using credit history to set homeowners premiums (Md. Code, Ins. § 27-501(e-2); COMAR 31.15.11.04); Nevada allows it with limits; Washington restricts it. Leads to verify: California and Massachusetts reportedly ban it for homeowners; Hawaii bans it in auto but not homeowners; Michigan, Oregon, and Utah have partial limits [L]. The estimate doesn't take a credit input. The table only shapes the explanation ("In Maryland, insurers can't use your credit history to set a home insurance price") and, for `allowed` states, the range width.

Claims history, roof age, and insurer wildfire scores get the same treatment later, as rows in the same table.

### Ranges
Same quadrature rule as car and renters, with two extra sources of width:

- an "experimental" spread on the whole estimate, set from the pilot validation (§9)
- the rough rebuild-cost band, when used instead of dwelling coverage

## 6. Data and rights

Everything in the renters PRD §6 applies (NAIC's written permission, each state's terms checked, figures with locators, no re-hosted PDFs, medians only). Homeowners adds:

| Source | Data | Reuse | Notes |
|---|---|---|---|
| U.S. Treasury / FIO, *Analyses of U.S. Homeowners Insurance Markets, 2018–2022* (Jan. 16, 2025), supporting ZIP workbook (.xlsx) | ZIP premium, claims, loss ratio, non-renewal metrics; owner-occupied homeowners only (no renters) | Federal, public domain; keep Treasury's credit and its disclaimer | H0: document every field and the suppression rule (ZIPs with fewer than 10 insurers or 50 policies are left out), and check whether average premium is per policy or adjusted for coverage. |
| U.S. Senate Budget Committee, homeowners non-renewal data (Dec. 16, 2024) | County non-renewal rates, 2018–2023 | Public release | About 65% of the market; rates only, no premiums. |
| BLS PPI `PCU5241265241262` | Monthly homeowners price index | Federal, public domain | |
| Census ACS PUMS (`INSP`, self-reported property insurance) | Household-reported insurance paid, by PUMA (about 100,000 people) | Federal, public domain | Validation only (§9); self-reported and averaged over five years. |
| OpenFEMA NFIP claims and policies in force | ZIP-level flood claims and policy counts | Federal, public domain | For the flood note only. |
| NAIC homeowners report, data for 2023, HO-3 by state (Table 4 by amount of insurance) | State averages | Needs NAIC's written permission | |
| Florida OIR market reports | County average premium, with and without wind | State publication; FLOIR pages carry a copyright notice, so check terms | |
| Florida OIR CHOICES; Oklahoma Insurance Department rate comparison (Aug. 2026); California and Texas tools; Maryland and South Carolina if current editions are confirmed | Sample premiums for fixed profiles | Same as renters; check each state's terms (Oklahoma's page says "© 2026 The State of Oklahoma" with no stated reuse terms) | The two research passes disagree on Maryland's edition year and on whether South Carolina's tool is current. |
| FEMA National Risk Index v1.20 (Dec. 2025) | County and tract expected annual loss | Federal | |
| USDA Forest Service, Wildfire Risk to Communities (2024 data; 2026 viewer) | Wildfire likelihood and risk to homes | Federal; check metadata for third-party layers | Not home-specific; say so. |
| NOAA NCEI Storm Events (1950–mid 2026) | County hail, wind, tornado events | Public domain unless marked | Reporting thresholds change over time. |
| Rebuild cost per square foot | Candidates: ICC Building Valuation Data (check terms; it's an ICC publication, not federal), Census construction cost data | To decide in M0 | Must be labeled "rough"; never called a replacement-cost estimate unless validated. |

SERFF filings (insurer rate manuals) could give real territory and deductible factors, but filings are state records under each state's public-access rules, and viewable doesn't mean freely republishable [V]. SERFF Filing Access also requires a use agreement that bars redistribution. **Out of scope for the pilot.** A later research spike could check two or three insurers' filings offline, to test our curves, without copying anything into the repository.

**Watch:** NAIC's Homeowners Market Data Call covers eight years at ZIP, tract, and county level, and NAIC has been urged to publish aggregates (Oct. 2026). If it does, it could replace the Treasury data for validation and the non-renewal block; check its terms then.

## 7. Privacy

Same as renters PRD §7. ZIP (ZCTA) is the smallest area: tracts or exact locations would need an address sent to a geocoding service, so they're out. Hazard, non-renewal, and flood figures are pre-summarized to ZIP and shipped as one static JSON file per state (the second research pass estimates 30–100 KB each), loaded when that state is picked, so a ZIP never goes anywhere. The agent API takes `state` and `county`, not ZIP.

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
| Price level vs Census ACS PUMS self-reported premiums (`INSP`), by PUMA, for owners with a mortgage | Our median within 25% of the PUMS median in most PUMAs (self-reported data, so a loose check) |

**Go/no-go for leaving the pilot** (adding states or dropping "experimental"):
- All checks pass in most pilot states (for example, all but one).
- No open correction issue showing a systematic miss (for example, a whole coastal region consistently outside the range).
- A credit row verified for every state shown.

If the checks fail, widen the range and keep it experimental, or remove area adjustments and show the state figure only.

## 10. Milestones

| | Milestone | Done when |
|---|---|---|
| H0 | Gate and data | Renters gate met; Treasury ZIP workbook documented; OK, MD, and SC current editions checked (each joins the pilot only if confirmed); pilot-state surveys pulled, with each state's terms checked; rebuild-cost source chosen; PPI trend wired up. |
| H1 | Derivation | `homeowners-factors.json` with golden tests; jurisdictions table for the pilot states verified; per-state ZIP JSON files built. |
| H2 | Pages | `/homeowners`, pilot state pages, hazard explanation block, methodology section. |
| H3 | Validation | §9 checks run and published. |
| H4 | Pilot launch | "Experimental" label, CHANGELOG, DATA-REFRESH steps. |
| H5 | Decide | Go/no-go per §9. |

**Later (Phase C): condo (HO-6).** Probably easier than HO-3 because the unit owner doesn't insure the building shell, but the association's master policy adds its own complexity. NAIC and California both publish condo figures. A short PRD comes when HO-3 reaches go/no-go.

## 11. Risks and open questions

- **Rebuild cost** is the biggest source of error. If no public source is good enough, require dwelling coverage as an input and drop the rough band.
- **Homeowners trend index**: BLS's producer index is the best public option but understates growth from rising coverage limits. See §5.
- **Treasury data age** (2018–2022) predates recent sharp rate increases in several states. It's only a check on how areas rank, not on price level.
- **Catastrophe-exposed states move fast.** FL, CA, TX, and OK markets change quickly, and Florida county averages recently fell in many counties after tort reforms; date every figure and refresh on schedule.
- **Roof condition and mitigation** drive large price differences we can't see (South Florida quotes for similar homes reportedly span roughly $3,900 to $16,600 a year depending on roof and wind mitigation, per November 2026 research). The range has to stay wide.
- **Credit table effort.** Verifying 51 statutes is real work; ship pilot states first, others as `unknown`.
- **Licensing.** Same as renters. Counsel review before the pilot leaves experimental.
- **State survey coverage beyond the pilot states is unverified.** Neither research pass found comparison tools in the other states, but that doesn't mean none exist. A 50-state survey audit is on the roadmap backlog.

## 12. Acceptance criteria

All renters PRD §13 criteria, applied to homeowners, plus:

- [ ] No input or copy treats home value as rebuild cost.
- [ ] The hazard block says it describes the area, not the house, and credits FEMA and the Forest Service.
- [ ] Treasury ZIP figures and Florida observed county averages are used only for validation, never to build a factor or as per-hazard percentages.
- [ ] Every state shown has a `jurisdictions.json` row with a source link and date, or is marked `unknown`.
- [ ] "Experimental" note on every homeowners result until go/no-go passes.
- [ ] Flood note and FEMA link on every result.

## Sources

Accessed November 7 or 12, 2026 (internal research), in addition to the renters PRD's sources.

- U.S. Treasury / FIO, *Analyses of U.S. Homeowners Insurance Markets, 2018–2022* (Jan. 16, 2025): https://home.treasury.gov/news/press-releases/jy2791 and ZIP workbook: https://home.treasury.gov/system/files/311/Supporting_Underlying_Metrics_and_Disclaimer_for_Analyses_of_US_Homeowners_Insurance_Markets_2018-2022.xlsx
- BLS PPI, homeowner's insurance (`PCU5241265241262`), on FRED (checked November 12, 2026): https://fred.stlouisfed.org/series/PCU5241265241262
- U.S. Senate Budget Committee reports (non-renewal data, Dec. 2024): https://www.budget.senate.gov/ranking-member/committee-reports/
- NAIC, homeowners market trends 2018–2024: https://content.naic.org/article/naic-releases-first-its-kind-national-analysis-homeowners-insurance-market-trends
- NAIC homeowners insurance topic page (data call status): https://content.naic.org/insurance-topics/homeowners-insurance
- FEMA National Risk Index data: https://hazards.fema.gov/nri/data-resources
- Census ACS data: https://data.census.gov/
- Oklahoma Insurance Department, home insurance rate comparison (updated Aug. 2026; checked November 12, 2026): https://www.oid.ok.gov/consumers/insurance-basics/home-insurance-rate-comparison/
- Florida OIR CHOICES: https://choices.floir.gov/pandc/homeowners and https://floir.gov/consumers/choices-rate-comparison-search
- USDA Forest Service, Wildfire Risk to Communities: https://research.fs.usda.gov/firelab/products/dataandtools/wildfire-risk-communities (data viewer: https://research.fs.usda.gov/firelab/products/dataandtools/wildfire-risk-communities-data-viewer)
- NOAA NCEI Storm Events Database: https://www.ncei.noaa.gov/access/storm-events-database/
- South Carolina DOI price comparison tool: https://online.doi.sc.gov/Eng/Public/HelpInsure/HelpInsure.aspx/1000
- California DOI homeowners comparison tool: https://interactive.web.insurance.ca.gov/apex/f?p=111:20 and profiles: https://www.insurance.ca.gov/01-consumers/105-type/9-compare-prem/homeowners-profile.cfm
- NAIC, Credit-Based Insurance Scores (Mar. 19, 2026), with the state chart: https://content.naic.org/insurance-topics/credit-based-insurance-scores
- Maryland Insurance Administration, homeowners rates: https://insurance.maryland.gov/Consumer/Pages/homeowners-rates.aspx
- SERFF public access settings: https://login.serff.com/stateSettings.html
- NerdWallet home insurance calculator: https://www.nerdwallet.com/insurance/homeowners/home-insurance-calculator
- Maryland credit rule: https://www.law.cornell.edu/regulations/maryland/COMAR-31-15-11-04
- ISO fire-protection classes, other states' credit rules, ICC Building Valuation Data, Hawaii hurricane exclusion: per November 2026 research; primary links to record before use.
