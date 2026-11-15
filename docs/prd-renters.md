# PRD: Renters insurance estimates (HO-4)

Status: draft, November 12, 2026. Companion: [prd-homeowners.md](prd-homeowners.md).

Confidence tags on research findings: **[V]** checked against a primary source, **[L]** from a credible secondary source, **[U]** unverified. Findings come from two internal research passes (November 7 and November 12, 2026); where they disagreed, this PRD says so. Sources are listed at the end.

## 1. Summary

NotAQuote.FYI estimates car insurance from public sources, in the browser, with no contact details asked and every number linked to where it came from. This PRD extends the same approach to **renters insurance** (the HO-4 policy form): a sourced range for what a renters policy typically costs in your state and area, and what changes it.

Renters comes before homeowners because the public data fits it far better:

- The NAIC publishes the average HO-4 premium for every state each year, broken out by how much belongings coverage the policy carries (data for 2023, published July 2026; Table 5) [V]. Renters policies cluster at low coverage amounts: 67.1% of HO-4 and HO-6 exposures are under $35,000 [V].
- The BLS Consumer Price Index has a series that prices renters policies specifically (`CUUR0000SEHD`, tenants' and household insurance). There is no equivalent for homeowners structure coverage.
- Several state regulators publish sample renters premiums for fixed profiles, which lets us measure how coverage amount, deductible, and liability limit move the price.
- There's no house to value. Replacement cost, the hardest part of homeowners, doesn't apply.

### Why now

Internal market research (November 2026) found no nationwide, non-commercial, open-source renters or homeowners estimator that combines public premium figures, public location-risk data, published factor weights, browser-only inputs, and a source link for every adjustment. That's a search result, not proof that none exists.

The nearest alternatives:

- **RivoRent's renters estimator**, part of a rental-listing site. It asks only for a state and a coverage band, takes no commissions, and shows a range from NAIC's state figures brought forward with the BLS index [L]. It doesn't adjust for deductible, liability limit, or location, and it isn't open source.
- **State regulator tools** (California and Texas cover renters). Each covers one state and a few fixed profiles, and shows a number per insurer rather than a range.
- **Commercial editorial calculators.** Their published averages often disagree because they quietly assume different coverage, deductibles, and profiles.

NotAQuote's difference is the what-if: change your coverage, deductible, liability limit, or ZIP code and see what moves, with every step sourced, in a project anyone can inspect and correct.

Commercial comparison sites have a reason to ask for contact details: a completed quote has value even when nothing is sold. One insurer's affiliate program advertised $10 per home lead and $3 per renters lead, and a 2026 industry benchmark put insurance leads at $10 to $75 or more, often sold to several agents at once (per November 2026 research; secondary sources). NotAQuote sells nothing, so it can answer the question without the form.

## 2. Who it's for

- *"My lease says I need renters insurance. What should it cost?"*
- *"I'm moving from Austin to Los Angeles. What happens to my renters insurance?"*
- *"Is a $1,000 deductible worth it, or should I keep $500?"*
- *"How much more is $50,000 of coverage than $20,000?"*
- *"I already bundle with my car insurance. What's the renters part actually costing me?"*
- *"My property manager offers renters coverage for $25 a month with the lease. Is that reasonable?"*

The main audience is people renting for the first time, people moving, and parents helping a young adult set up their first apartment. That last group already uses the site for teen drivers.

The lease moment matters. A 2022 industry survey cited by the National Apartment Association found about 55% of renters insured, and 75% of those buying because the landlord required it [L]. Many people decide while signing a lease, often with an add-on offered by the property manager, and have nothing independent to compare it with.

## 3. Goals and non-goals

### Goals
1. Give a sourced yearly and monthly range for a typical renters policy in any state with NAIC data, in under a minute, with no personal data leaving the browser.
2. In every state, show how belongings coverage moves the price, from NAIC's averages by coverage amount. In California and Texas (and Maryland, if its current guide covers renters), also show how deductible and liability limit move it, measured from regulator sample premiums.
3. Explain every adjustment in plain words, with its source, date, and how sure we are, as the car estimate does.
4. Be honest about range width. The less we can source, the wider the range.

### Non-goals
- **Not a quote, and nothing that looks like one.** No applications, no payments, no binding, no referral links or compensation.
- **No insurer names, rankings, or recommendations.** Regulator surveys list premiums by company; we use only medians across companies, and never show or return a per-company figure. This keeps the site clearly informational, outside insurance-producer licensing (which covers selling, soliciting, and negotiating), and away from Texas-style rules against aiding an insurance transaction. It's not a legal opinion; see Risks.
- **No flood or earthquake estimate.** Standard renters policies exclude flood; we say so, and where FEMA's flood insurance claims data show flood claims in your ZIP code, the note says that too, with a link to FEMA's flood insurance pages. Earthquake is a California add-on; v1 notes it and doesn't price it.
- **No coverage advice.** Coverage amounts are what-if inputs, not "how much you need" recommendations.
- **No credit or claims-history inputs.** Insurers in many states use them, but the rules vary by state and we have no public measure of their effect. The range covers them, and the explanation says so.

## 4. Experience

### Where it lives
- `/renters`: the renters calculator, built from the same parts as the car calculator.
- `/renters/states/[state]`: a page per state with the typical renters price and what changes it, like `/states/[state]`.
- A "Renters" section on `/methodology`, rows on `/sources`, and an entry on `/data-licenses`.
- A link from the car calculator's "Bundled with home or renters" option to `/renters`, and back.

### Inputs (all optional except state, all as bands)

| Input | Bands (draft) | Default |
|---|---|---|
| State | 50 states + DC | none, required |
| ZIP code | 5 digits, kept in this browser only | blank (state typical) |
| Belongings coverage (personal property) | Bands matching NAIC's amount-of-insurance ranges, e.g. $15k, $20k, $25k, $35k, $50k, $80k+ | $20k–$25k (NAIC's most common HO-4 range; confirm in M0) |
| Deductible | $250, $500, $1,000, $2,500 | $500 |
| Liability coverage | $100k, $300k, $500k | $100k |
| Your current premium | optional dollar amount | blank |

If you enter your current premium, we start from it, as the car calculator does. Otherwise we start from your state's typical price.

### Output
- A range and a likely figure, with friendly numbers: "about $190 a year (about $16 a month), roughly $130–$290."
- "Here's how we got this": one step per adjustment. Each step shows its basis label, using the same `BASIS_WORDS` wording ("From published prices", "Worked out from public data", "Our best guess"), and its source link.
- "Why the range is this wide": the same bullet style as the car estimate.
- "This is a ballpark, not a price," said once.
- What-if: change one input and see the difference, e.g. "Raising your deductible to $1,000: about $25 less a year."

Example step wording, following `docs/VOICE.md` (no "baseline", "anchor", "relativity", or "thin"):

> **Belongings: $25,000 → $40,000.** About $35 more a year. From published prices: what renters in your state paid on average at each coverage amount in 2023 (NAIC), checked against California and Texas regulators' sample premiums for the same renter at both amounts.

## 5. Model

### Formula

```
estimate = state typical HO-4 premium (NAIC, latest data year)
         × price trend to today (BLS CPI CUUR0000SEHD)
         × location factor (ZIP → county)
         × belongings coverage factor
         × deductible factor
         × liability factor
```

The first term is the internal "baseline" in the research. It's called "typical price in your state" in the UI.

### Factors, sources, and basis tiers

Each factor uses the existing `FactorCell` shape (`value`, `low`, `high`, `basis`, `sources`, `derivation`, `n`) from `src/lib/factor-types.ts`.

| Factor | Source | Basis | Notes |
|---|---|---|---|
| State typical premium | NAIC *Dwelling Fire, Homeowners Owner-Occupied, and Homeowners Tenant and Condominium/Cooperative Unit Owner's Insurance Report: Data for 2023* (July 2026), Table 5, HO-4 average premium by state | `reference` | The second research pass reports figures for all 50 states and DC; confirm in M0. California and Texas figures come from their insurance departments rather than statistical agents. A state without a figure falls back to the national average, with a wider range and an explanation. |
| Trend to today | BLS CPI-U `CUUR0000SEHD`, tenants' and household insurance, monthly | `reference` | Reuse the trend pattern in `src/lib/state-baselines.ts` (`trendRatio`). The auto trend uses the motor vehicle insurance index; this is the renters equivalent. |
| Belongings coverage | NAIC Table 5: HO-4 average premium by amount of insurance, by state [V for the countrywide page; confirm state pages in M0]. Checked against CA DOI 2026 renters profiles and TX HelpInsure renters scenarios (Coverage C). | `sourced` | NAIC's band averages are what people actually paid, so they also reflect other differences between policies (deductibles, location). The CA and TX surveys price the same renter at different amounts, so they show whether NAIC's slope is close; if they disagree, widen the range. |
| Deductible | CA and TX surveys (and MD if it covers renters), where they vary it | `sourced` where varied, else `assumed` | Check which surveys vary the deductible for renters profiles. |
| Liability limit | Same, where varied | `sourced` or `assumed` | Likely the thinnest; if no survey varies it, "Our best guess" with a wide range. |
| Location within the state | FBI Crime Data Explorer (burglary and larceny rates by agency, rolled up to county), FEMA National Risk Index (county expected annual loss) | `indicative` | Kept deliberately small, capped (e.g. ±15%; to be set from the CA and TX ZIP-level sample premiums), with the range widened. FBI data need an agency-participation check: NIBRS covered 64.8% of the population in 2021 and about 90% in 2025, through 15,000+ agencies [V]. Agencies report by city police or county sheriff, so roll up weighted by population; counties below a participation threshold get no crime adjustment. Use FEMA's losses for perils a renters policy covers; leave out flood and earthquake. |
| Location, validated | CA and TX sample premiums by ZIP | used for checking, not as a factor | Tests whether the indicative location factor points the right way. |

Where a factor rests on only one state's survey, the explanation says so, as the car estimate does today ("From published prices in Texas (Illinois may differ)", via `basisLabel()` in `src/lib/pricing.ts`).

### Ranges
Same rules as the car engine: each factor that changes adds its spread, combined in quadrature, plus extra width for assumed or unknown items. The more we guessed, the wider the range. An existing test enforces this for cars ("the range is wider when more of the change is assumed"); add the same test here.

## 6. Data and rights

| Source | Data year | Reuse | Refresh |
|---|---|---|---|
| NAIC homeowners/tenant report, Table 5 (HO-4 by state and by coverage amount) | 2023 (published July 2026) | **Needs NAIC's written permission** (see below). | Annual; NAIC data lag about 2.5 years |
| BLS CPI `CUUR0000SEHD` | Monthly | Federal, public domain | Annual, with the existing price-index refresh |
| California DOI premium survey (renters) | 2026 | Use individual figures with a locator, as in `data/factors/sources/ca-2026-*.csv` | Annual |
| Texas HelpInsure (renters) | Current | Same, as in `tx-2025-*.csv` | Annual |
| Maryland Insurance Administration comparison guide | Edition year and renters coverage unconfirmed (the two research passes disagree) | Same, if it covers renters | Annual |
| OpenFEMA NFIP claims and policies in force, by ZIP | Through Sept. 2025 | Federal, public domain | Annual |
| FBI Crime Data Explorer | Through 2025 | Federal | Annual |
| FEMA National Risk Index | v1.20, Dec. 2025 | Federal; credit FEMA | When FEMA updates |
| Census ZCTA-to-county relationship file | 2020 | Federal, public domain | Each decennial update |

### NAIC
The report's copyright page says: "No part of this book may be reproduced, stored in a retrieval system, or transmitted in any form or by any means, electronic or mechanical, including photocopying, recording, or any storage or retrieval system, without written permission from the NAIC." (checked November 12, 2026). Per-state figures kept in a public repository and sent to browsers arguably count as storing part of it, so **NAIC's written permission is the main dependency for renters.**

In M0, write to NAIC's Legal Division (Request to Reprint Content) asking whether a free, open-source, non-commercial site may (1) show the per-state HO-4 averages and coverage-band averages from Table 5 with credit, (2) publish adjustments derived from them, and (3) keep those figures in a public repository and send them to browsers. Offer NAIC's standard non-endorsement wording. Record the answer in `src/data/source-manifest.json` (`licenseNote`, `lastChecked`).

**If NAIC says no, there's no federal substitute for renters.** No federal source publishes renters premiums by state; the BLS index is national and shows change, not price level. Renters would shrink to the states whose regulators publish renters sample premiums (California and Texas, and Maryland if confirmed), with other states told plainly that we can't estimate them yet.

### State surveys and SERFF
Check each state's terms before committing figures. Where terms allow, store individual figures with locators, never the source PDFs, in the existing format: `data/factors/sources/<state>-<year>-premiums.csv` and `-profiles.csv` (`source_id, state, data_year, url, locator, territory, carrier, profile_id, annual_premium`), with a note per source in `data/factors/sources/README.md`. Carrier names stay in the CSVs, so anyone can reproduce the derivation, but no per-carrier figure reaches the UI or API. Where a state's terms restrict copying, commit only the derived medians with locators to the source.

SERFF filings are out of scope for v1. SERFF Filing Access requires accepting a use agreement that bars redistributing filings; if they're used later, it's offline only, to check our numbers, with nothing copied into the repository.

## 7. Privacy

- **ZIP stays in the browser.** Converting a ZIP to a county uses a lookup table the browser downloads: the Census ZCTA-to-county relationship file, reduced to `zcta → county FIPS (largest share)`, a few hundred KB, cached. Nothing is sent anywhere. HUD-USPS crosswalks are an alternative; check their terms and token requirement first.
- If ZIP is stored in localStorage (so the page remembers it), say so on `/privacy`, as it does for car inputs today.
- New storage key, e.g. `notaquote.renters.v1`, via `useStoredValue` in `src/lib/local-store.ts`.
- **Share links** carry bands and the state only, never a ZIP or a dollar amount, following `src/lib/share-link.ts` (`FROZEN_RESULT_KEYS`).
- **Agent API**: add `GET /api/v1/renters` taking `state`, optional `county` (FIPS), and the bands. ZIP is rejected, like other personal-looking input (`personalInText` in `src/lib/agent-api.ts`). Same `VERSIONS` block, `PRIVACY_STATEMENT`, and daily caching. Update `/llms.txt` via `src/lib/agent-docs.ts`.
- Analytics stay path-only (`src/lib/analytics-url.ts`).

## 8. Architecture

Reuse what exists:

- **Types**: `FactorBundle`, `FactorGroup`, `FactorCell`, `FactorSource`, `FactorBasis` from `src/lib/factor-types.ts`.
- **Derivation**: a pure function in the style of `deriveFactors()` in `src/lib/factor-derivation.ts`, with paired profiles, median plus the 25th–75th percentile, a version stamp like `DERIVATION_VERSION`, and its own `scripts/derive-renters.ts` writing `src/data/renters-factors.json`. Add an npm script, e.g. `npm run renters:build`.
- **State figures**: a `data/state-baselines/renters-state-baselines.json` checked on load like `state-baselines.json` (all 51 codes, credit string), with a `RENTERS_BASELINE_ATTRIBUTION` shown wherever a figure appears.
- **Guardrails**: call `assertFactorBundleSafe` (every cell has a basis and sources) and `assertManifestSafe` on the new bundle and manifest rows.
- **Math**: the exact rational arithmetic the car engine uses.

**Open design choice:** generalize `src/lib/factor-engine.ts` with a line-of-insurance parameter, or write a small `src/lib/renters-engine.ts` that shares the types and helpers. **Recommendation: a separate engine.** The car engine carries vehicles, HLDI, teens, and liability/physical splits that renters doesn't need. Sharing types, range math, and display helpers (`pricing.ts`) gets most of the reuse without making the car engine harder to change. Revisit when homeowners starts, since that's when a third line would argue for a shared core.

## 9. Pages and SEO

- New pages follow `src/lib/seo.test.ts`: titles ≤ 60 characters, descriptions ≤ 155, at least 3 inbound links, valid JSON-LD crediting NAIC, and state pages that read as their own (the copy-overlap check in `src/lib/uniqueness.ts`).
- Pin every new slug in `src/lib/seo-slugs.json`.
- One social image per state page, like the car state pages.
- Possible guide later: *"Renters insurance for your first apartment"*, linked from the teen-driver guides.

## 10. Measuring success

Analytics record paths only, so we measure the model, not people.

**Primary: out-of-sample validation.** Hold out a share of regulator sample profiles (for example, one territory per state, or every fifth profile) from the derivation, then estimate them. Proposed starting targets, to revisit after the first measurement:

- Median absolute error against held-out medians: within 15%.
- At least 80% of held-out median premiums fall inside our range.
- Location factor points the right way (higher-premium ZIPs get higher estimates) in at least 70% of held-out CA/TX ZIP pairs.

Publish the result on `/methodology` and in `data/renters/README.md`, as `data/factors/README.md` does for cars.

**Secondary:**
- Share of estimate steps that are "From published prices" vs "Our best guess" (goal: none of the three coverage factors is a guess in CA and TX).
- Page views on `/renters` and state pages, and searches reaching them (Search Console).

## 11. Milestones

| | Milestone | Done when |
|---|---|---|
| M0 | Rights and data pulls | NAIC permission request sent; NAIC Table 5 state pages confirmed; BLS series, CA/TX renters surveys (and MD's current guide checked for renters), Census crosswalk, FBI, FEMA, and OpenFEMA tables pulled; each state's terms checked; source rows added to the manifest and `data/factors/sources/README.md`. |
| M1 | Derivation | `renters-factors.json` built by a pure function; golden reproduction test passes; README example table matches. |
| M2 | Calculator and pages | `/renters`, state pages, methodology section, sources rows, data-licenses entry, agent API endpoint, share links. |
| M3 | Validation | Held-out validation run and published; thresholds met or ranges widened until they are. |
| M4 | Launch | NAIC's written permission received and recorded (hard gate); slugs pinned, sitemap updated, CHANGELOG entry, DATA-REFRESH steps added, car calculator cross-link live. |

## 12. Risks and open questions

- **NAIC permission.** The biggest risk, given the copyright notice in §6. **Hard gate:** build behind a feature switch, but don't launch publicly until NAIC grants written permission. If NAIC declines, renters shrinks to two or three states (§6).
- **NAIC coverage.** The second research pass reports HO-4 figures for every state and DC; confirm in M0, including any suppressed cells.
- **Data age.** NAIC's latest data year is 2023, about 2.5 years behind; the CPI trend bridges to today, but state-specific changes since then aren't captured. Say so in "Why the range is this wide."
- **Thin calibration.** Two or three states' surveys may not vary deductible or liability. Unvaried factors stay "Our best guess" and widen the range; recruit contributors via the existing "help wanted" issue pattern.
- **Crime data.** FBI participation gaps (about 10% of the population still uncovered in 2025, worse before) can make county comparisons misleading. Use participation thresholds and cap the effect.
- **Licensing.** The non-goals keep us informational, but this isn't a 50-state legal opinion. Before launch, have counsel confirm no state treats an automated renters-price comparison as solicitation.
- **Lead-price and traffic figures** in §1 come from secondary or vendor sources; don't repeat them on the site.

## 13. Acceptance criteria

- [ ] Every number on renters pages links to a source with a checked-on date; NAIC credit appears wherever an NAIC figure does.
- [ ] No per-insurer premium or insurer name appears in the UI, share links, or API.
- [ ] `npm test` includes, for renters:
  - golden reproduction of `renters-factors.json` from the source CSVs
  - hand-worked spot checks of two factors from the CSVs
  - range widens as more of the change is assumed
  - README example table matches `scripts/` output
  - plain-language guard (no "baseline", "anchor", "relativity", "thin" in rendered copy)
  - privacy: ZIP never appears in share links, storage outside the renters key, or API input
  - SEO rules for new pages
- [ ] New test files are added to the explicit list in `package.json`.
- [ ] Validation results (§10) are published, with the thresholds met or the gap explained.
- [ ] `docs/DATA-REFRESH.md` has renters steps; `CHANGELOG.md` records the launch.

## Sources

Accessed November 7 or 12, 2026 (internal research).

- NAIC, *Dwelling Fire, Homeowners Owner-Occupied, and Homeowners Tenant and Condominium/Cooperative Unit Owner's Insurance Report: Data for 2023* (July 2026): https://content.naic.org/sites/default/files/publication-hmr-zu-homeowners-report.pdf (copyright notice and Table 5 checked November 12, 2026); publications page: https://content.naic.org/publications
- NAIC Legal Division (reprint requests): https://content.naic.org/legal_home.htm
- BLS CPI `CUUR0000SEHD` on FRED: https://fred.stlouisfed.org/series/CUUR0000SEHD
- BLS, *Measuring Price Change in the CPI: Tenant's and Household Insurance*: https://www.bls.gov/cpi/factsheets/tenants-household-insurance.htm (series `CUUR0000SEHD`)
- California DOI homeowners/renters comparison tool: https://interactive.web.insurance.ca.gov/apex/f?p=111:20 and profiles: https://www.insurance.ca.gov/01-consumers/105-type/9-compare-prem/homeowners-profile.cfm
- Texas HelpInsure home FAQ: https://www.helpinsure.com/home-faq.html
- Maryland Insurance Administration, homeowners rates and comparison guide: https://insurance.maryland.gov/Consumer/Pages/homeowners-rates.aspx
- FBI Crime Data Explorer: https://cde.ucr.cjis.gov/ and NIBRS: https://nibrs.fbi.gov/ (participation figures per FBI releases cited in the research)
- OpenFEMA NFIP redacted claims: https://catalog.data.gov/dataset/fima-nfip-redacted-claims-openfema
- National Apartment Association, renters insurance survey coverage (Jan. 23, 2023): https://naahq.org/news/renters-insurance-premiums-constant
- RivoRent renters estimator: https://www.rivo.rent/renters-insurance
- SERFF Filing Access: https://filingaccess.serff.com/
- FEMA National Risk Index technical documentation v1.20: https://www.fema.gov/sites/default/files/documents/fema_national-risk-index_technical-documentation.pdf
- USFA NFIRS public data: https://www.usfa.fema.gov/nfirs/access-data/
- NAIC producer licensing: https://content.naic.org/insurance-topics/producer-licensing
- SERFF public access settings: https://login.serff.com/stateSettings.html
- Census ZCTA-to-county relationship files: Census Bureau geography relationship files (URL to record in M0).
