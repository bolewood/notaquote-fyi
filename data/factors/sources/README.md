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

## nc-sdip-2026.csv

The North Carolina Department of Insurance's "Safe Driver Incentive Plan (Insurance Points)" table: points, the "% of Rate Increase", and what earns them, in the page's words.

## iso-loss-costs-2024.csv

The 2024 row of the Insurance Information Institute's table "Private Passenger Auto Insurance Losses, 2015-2024" (source line: ISO, a Verisk Analytics business). Frequency is claims per 100 car-years; severity is the average claim in dollars. The footnotes about which states are left out are in the locator.

## hldi-2022-24.csv and hldi-class-subtotals-2022-24.csv

HLDI's insurance losses by make and model for 2022–24 models, from the table at https://www.iihs.org/research-areas/auto-insurance/insurance-losses-by-make-and-model. The page loads its data from `POST https://www.iihs.org/api/hldilosses/getviewmodel` (one request per class and size). The locator names the class, size, and row.

- Values are HLDI's index: 100 = the average for all passenger vehicles. The web page shows the same numbers as a percentage above or below average, so 124 appears on the page as "24%".
- Blank means HLDI shows "Insufficient data".
- Collision, property damage, and comprehensive are overall losses (how often × how much). Personal injury protection, medical payments, and bodily injury are how often claims happen only.
- We keep only the families listed in `../vehicle-families.json`: 328 of the 685 rows HLDI publishes. To re-pick from a full download: `npm run factors:build -- --hldi-full path/to/losses.csv`.
- `all_coverages` in the subtotal file is a field the API returns but the page never shows. We don't use it.

Source: www.iihs.org. See the terms note in `../README.md`.
