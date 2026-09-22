# Typical premium by state

If you don't tell us what you pay now, we need somewhere to start. This is that starting point: one typical yearly premium for each state and DC, from a public source you can check yourself.

The data lives in `state-baselines.json` in this folder. `src/lib/state-baselines.ts` reads it, checks it when it loads (all 51 codes, no extras, positive numbers, `annual` equal to the rounded exact figure), and `stateBaseline("OH")` returns Ohio's figure with its source. The Sources page lists every state. The pricing engine doesn't use these yet. Wiring them in is a separate piece of work.

Wherever a figure is shown, label it: **Source: NAIC, 2022/2023 Auto Insurance Database Report, 2023 data** (exported as `STATE_BASELINE_ATTRIBUTION`).

Version `state-baselines-2026-09-22`, checked 22 September 2026.

## Where the numbers come from

**NAIC, *2022/2023 Auto Insurance Database Report*.** The National Association of Insurance Commissioners collects premium data from insurers in every state and publishes averages by state. This edition was adopted in December 2025 and announced on 13 February 2026. It's the newest edition as of September 2026.

- Report: https://content.naic.org/sites/default/files/publication-aut-pb-auto-insurance-database.pdf
- Announcement: https://content.naic.org/article/naic-releases-20222023-auto-insurance-database-report
- SHA-256 of the PDF we read: `34759655ce8e5387b48d523ebab89f9cd8f29d3f67c6d391838398b7d2659b78`

The NAIC site shows a bot check to scripts, so open the link in a normal browser.

## Which number we use

The report has several averages. We use one of them for every state, so states compare fairly with each other:

**Combined average premium, 2023** (Table 5, printed page 25, "2023" column). NAIC adds up the average liability premium, the average collision premium, and the average comprehensive premium. That's roughly what an average driver paid for a full-coverage policy on one car for a year. `annual` is that figure rounded to whole dollars. `combinedAveragePremium` keeps it to the cent, exactly as printed.

Two other figures from the same report and year are stored alongside, in case the engine wants them later:

- `liabilityAveragePremium`: Table 1C, printed page 17. The average cost of liability coverage alone.
- `averageExpenditure`: Table 4, printed page 24. Total premium divided by all insured cars, including cars with liability only. NAIC calls it an estimate of what consumers spent on average. It's lower than the combined premium because many cars don't carry collision or comprehensive.

The countrywide figures from the same tables are stored as `countrywide`. They're NAIC's own national numbers, not an average of the state rows.

**Why 1,438 in NAIC's text and 1,439 here?** NAIC's summary says the countrywide combined average premium was "$1,438". Table 5 prints it as 1,438.60. NAIC's text drops the cents; we round to the nearest dollar, so `annual` is 1,439. The exact figure, 1438.6, is stored next to it. If you compare a state against a whole-dollar figure quoted elsewhere, expect the same one-dollar difference whenever the cents are 50 or more.

## What these numbers are not

- **They're not your price.** NAIC says its averages make no distinction for the driver, the car, or the limits and deductibles people picked. A teen driver, a new sports car, or high limits will cost more. A long clean record and an older car may cost less.
- **They're from 2023.** Prices have risen since. See "Adjusting for time" below.
- **State-to-state comparisons are rough.** NAIC warns that "direct comparisons between state results should be treated with a high degree of caution," because states differ in coverages, laws, and how data is reported. NAIC's liability figures include no-fault coverage, for example, so states with big required no-fault benefits (like Michigan or New York) look pricier on liability.
- **They're per car, per year.** Not per household, and not per six-month policy.

## Adjusting for time (recorded, not applied)

The Bureau of Labor Statistics tracks how car insurance prices change in its Consumer Price Index, series **CUUR0000SETE** (motor vehicle insurance, U.S. city average, not seasonally adjusted). The file stores:

- 2023 annual average: 716.004
- 2024 annual average: 843.098
- 2025 annual average: 893.544
- August 2026 (the latest month on 22 September 2026): 848.231

Source: https://data.bls.gov/timeseries/CUUR0000SETE, fetched through the BLS public API. BLS published no October 2025 value because of the 2025 lapse in appropriations.

August 2026 ÷ the 2023 average is about 1.18. That's a rough national multiplier for how much insurance prices moved since the data year. It's national, not state by state, and it tracks price changes for the same coverage, not changes in what people buy. **Nothing applies it today.** If the engine starts using it, that should be a visible, versioned choice.

## How we checked the numbers

1. We downloaded the report through a browser and extracted the text with two different PDF tools (`pdftotext` and `pypdf`). All 153 state values (51 jurisdictions × 3 tables) and the countrywide values matched between the two.
2. Separately, we parsed the three tables again from scratch and compared every value with the JSON. All 153 matched.
3. The tests check that there are 51 rows in the calculator's state order, every `annual` is a positive whole number that rounds the printed figure, every row points at a known source, and a few spot values (CA, TX, NY, FL, OH, countrywide) match Table 5 as printed.

## Judgment calls

- **One measure for everyone.** We picked the combined average premium because it matches a clear kind of policy (liability plus collision plus comprehensive) and is available for all 51 jurisdictions in the same year. The expenditure figure mixes liability-only and full-coverage cars, so it's harder to explain as "a typical policy."
- **The final report, not the preview.** NAIC published a preliminary 2023 supplement in June 2025 (https://content.naic.org/sites/default/files/aut-db_1.pdf). The full report revised many 2023 values (California's expenditure went from 1,223.16 to 1,225.02, for example). We use the full report throughout. If you spot-check against the June 2025 supplement, some numbers won't match. That's expected.
- **Rounding.** `annual` rounds half up to whole dollars. The exact printed figure stays next to it.
- **Copyright and permission.** The report says "© 2025 National Association of Insurance Commissioners. All rights reserved" and asks for written permission to reproduce it. We store only per-state numbers, which are facts, with credit and a link to NAIC. We don't copy its text or tables, and the PDF isn't in this repository (a test makes sure of that). The project owner reviewed this and approved using the per-state figures for this non-commercial project. Earlier versions kept NAIC figures out entirely; the source manifest (`src/data/source-manifest.json`) now marks the December 2025 report "Used with credit" and the June 2025 supplement "Not used". If NAIC asks us to handle this differently, we will.

## Updating

When NAIC publishes a newer edition:

1. Read the same three tables for the new year, for every state and DC.
2. Update `dataYear`, the source entry (name, URL, tables, published date, PDF hash), and every row.
3. Update the CPI values for the new data year and the latest month.
4. Bump `version` and `checkedOn` to the date you checked.
5. Run `npm test`, and update the spot values in `src/lib/state-baselines.test.ts`.
