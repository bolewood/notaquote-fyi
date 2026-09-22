# Source files

One CSV per source, with one row per published figure. Each row's `locator` says where to find the figure in the original. We downloaded everything on 22 September 2026. The originals aren't committed, so please follow the URLs.

## Premium surveys (`*-premiums.csv`, `*-profiles.csv`)

Columns: `source_id, state, data_year, url, locator, territory, carrier, profile_id, annual_premium`. Profiles are described in the matching `*-profiles.csv`, in the source's own words.

### ok-2026: Oklahoma Insurance Department

- The PDF prints **six-month** premiums. `annual_premium` = printed × 2; each locator keeps the printed figure.
- 20 companies × 5 cities × 10 profiles = 1,000 figures, all published (not just the cheapest).
- In the Tulsa table the Equity row is printed as "EQU+27:95ITY INSURANCE COMPANY". We keep it as printed and treat it as "EQUITY INSURANCE COMPANY" when matching (see `CARRIER_ALIASES` in `src/lib/factor-derivation.ts`).
- Both State Farm companies price the 16-year-old below the 21-year-old in every city. That's what they filed.
- The rates leave out driver discounts (good student, accident-free) but include vehicle discounts.

### nd-2026: North Dakota Insurance & Securities Department

- **Six-month** premiums, doubled. Two-page spreads, so locators give both the PDF page and the printed page.
- **Example #4 is left out.** Its figures don't belong to the companies printed next to them: one row matches another company's Example #5 row exactly, and seven match 2025 rows for different companies.
- Grinnell's Example #11 row is printed as 0 in every region, so it's skipped. "N/A" cells are skipped.
- Figures marked `*` in the source use the company's minimum deductible, not the one asked for. We only compare those figures with the same company's figures in other regions, so it doesn't affect the city-versus-rural comparison.

### dc-2024: DC Department of Insurance, Securities and Banking

- **Six-month** premiums, doubled. The newest edition as of September 2026. Each company's rates have their own effective date, from November 2022 to August 2024 (in the locator).
- The profiles are minimum required coverage. The source doesn't mention collision or comprehensive.
- The four Chubb companies have identical rows, and two Liberty companies do too. We keep them as published, so those groups count more than once.

### tx-2025: Texas HelpInsure.com (TDI and OPIC)

- Read from the site's own data call, `POST https://www.helpinsure.com/api/autoResults`, one request per ZIP and profile (75 in all, two seconds apart). The locator names the saved response and the record's `RPTG_INSR_ID` and `PLANKEY_ID`. `AUTO_SAMPLE_RATE_AMT` is already yearly. Rates in effect 1 June 2025 (Commissioner's Bulletin B-0005-25), still the live data on 22 September 2026.
- **Liability only.** TDI asks companies for bodily-injury and property-damage liability rates only.
- The base profile (`tx-base`) is a single man, age band 25–64, average credit, a 2024 Camry, commuting 18,000 miles, clean, 30/60/25. Each other profile changes one thing (its name says what); `tx-age18_female` and `tx-age65_married` change two. The request body for each is: `{"gender":"1","maritalStatus":"1","personAge":"2","creditScore":"2","vehicleType":"1","autoUsageType":"2","accident":"0","speeding":"0","coverageLimit":"1"}` plus `county` and `zip`, with the one field changed (`personAge` 1 or 3, `accident` 1 with `speeding` left out as the site does, `coverageLimit` 2 or 3, `gender` 2, `maritalStatus` 2, `creditScore` 1 or 3, `vehicleType` 2, `autoUsageType` 1, `speeding` 1).
- The site labels ages as bands (16–24, 25–64, 65+) and credit as Poor/Average/Good. TDI's data call rates the ages at 18, 30, and 65, and credit as above-average, average, and below-average risk. Matching them up is our reading; the site doesn't say so.
- One company (Colonial County Mutual through Titan) came back twice in every response with identical premiums. We kept one copy.
- The carrier name includes the managing agency when TDI names one, because several agencies write through the same company.

### ca-2026: California Department of Insurance

- Read from the survey tool at https://interactive.web.insurance.ca.gov/apex_extprd/f?p=111:11 by choosing the type, location, years licensed, mileage, record, and vehicle, as a visitor would (198 submissions, two seconds apart). Profile definitions are in CDI's exhibit, `APS2026ProfilesExhibit-2.xlsx`. Figures are yearly, effective 1 January 2026.
- Profile ids follow CDI's: the first three digits are years licensed and coverage (110–114 Basic liability-only Camry at 2, 4, 7, 13, 25 years; 251–254 Standard full-coverage Accord at 4, 7, 13, 25 years), the fourth is mileage (1: 5,000–7,500; 2: 7,600–10,000; 3: 12,500–16,000), and the letter is the record (A clean, B ticket, C at-fault accident, D both). Married households: 1152, 1192, 2555, 2565, 2592, with M meaning "No Violations (With Multi-Policy Discount)".
- **Companies left out of every comparison**, because CDI's footnotes say they priced different coverage from the profile: Nations Ins Co, KnightBrook Ins Co, Qualitas Ins Co, Anchor General Ins Co, Federal Ins Co (CHUBB), First Acceptance Ins Co, Inc., and Incline Natl Ins Co. They're still in the file, as published.
- CDI says the survey premiums are "before any applicable discounts are applied". Company footnotes list California's Good Driver discount among those discounts ("California Good Driver Discount 30%", "20% Good Driver Discount"), so the clean profiles leave it out. A California driver who loses it after an accident probably sees a bigger jump than the survey shows.
- Profiles 2565 (a couple with a 17-year-old) and 2555 (a younger couple without one) give the rough "teen added to a parent's policy" factor.
- Mileage variants were only fetched for Los Angeles.

### co-2023: Colorado Division of Insurance

- **Six-month** premiums, doubled. The page says both "current as of July 2023" and "effective July 1, 2022".
- Four drivers (A: 25, male, single; B: 25, female, single; C: 45, male, married; D: 72, female, married, pleasure use) on three plans (1: 25/50/15, $1,000 deductibles; 2: 50/100/25, $500; 3: 100/300/50, $500).
- "$0" means the company gave no rate for that plan, driver, and place. Those are skipped.
- Three Chubb companies are printed with an unexplained " *"; we kept the names as printed. Their figures match three other Chubb companies.
- We use Colorado only for city, suburb, and rural comparisons and for how far companies' prices spread.

## nc-sdip-2026.csv

The North Carolina Department of Insurance's "Safe Driver Incentive Plan (Insurance Points)" table: points, the "% of Rate Increase", and what earns them, in the page's words.

## iso-liability-symbols-2004.csv

Two numbers from Insurance Journal's 1 April 2004 report on ISO's liability symbols: surcharges "of up to 25 percent and discounts of up to 20 percent". We use them to decide how much of HLDI's liability result to pass on.

## iso-loss-costs-2024.csv

The 2024 row of the Insurance Information Institute's table "Private Passenger Auto Insurance Losses, 2015-2024" (source line: ISO, a Verisk Analytics business). Frequency is claims per 100 car-years; severity is the average claim in dollars. The footnotes about which states are left out are in the locator.

## hldi-2022-24.csv and hldi-class-subtotals-2022-24.csv

HLDI's insurance losses by make and model for 2022–24 models, from the table at https://www.iihs.org/research-areas/auto-insurance/insurance-losses-by-make-and-model. The page loads its data from `POST https://www.iihs.org/api/hldilosses/getviewmodel` (one request per class and size). The locator names the class, size, and row.

- Values are HLDI's index: 100 = the average for all passenger vehicles. The web page shows the same numbers as a percentage above or below average, so 124 appears on the page as "24%".
- Blank means HLDI shows "Insufficient data".
- Collision, property damage, and comprehensive are overall losses (how often × how much). Personal injury protection, medical payments, and bodily injury are how often claims happen only.
- We keep only the families listed in `../vehicle-families.json`: 328 of the 685 rows HLDI publishes. To re-pick from a full download: `npm run factors:build -- --hldi-full path/to/losses.csv`.
- `all_coverages` in the subtotal file is a field the API returns but the page never shows. We don't use it.

- The per-model file is behind one switch, `useHldiModels` in `../vehicle-families.json`. Turning it off or deleting the file makes every vehicle use its class average.

Source: www.iihs.org. See the terms note in `../README.md`.
