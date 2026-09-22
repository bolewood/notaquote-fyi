# Where our numbers come from

Every estimate on NotAQuote.FYI starts from one number, either what you pay now or a typical price, and then adjusts it for what's different: the driver, the car, the coverage, where the car is kept. Each adjustment is a factor. This folder holds those factors, the public sources behind them, and the script that turns one into the other.

We'd rather show you a wide range than pretend to know something we don't. So every factor says where it came from. There are four kinds:

| Kind | What it means | What it does to the range |
| --- | --- | --- |
| **Starting point** | The thing everything else is compared with. Always 1.00. | Nothing. |
| **From public prices or rules** | Worked out from real prices that insurers reported to a state insurance department, comparing two profiles that differ in just that one thing. Or taken from an official state rule. | Adds how differently companies price the same thing (the middle half of companies). |
| **From public data, roughly** | Worked out from public data, but the profiles also differ in something else, or the data is about claims rather than prices. We say what else differs. | The same, and we say it's rough. |
| **Our estimate (help wanted)** | We couldn't find a public source yet. It's our best guess, and it says so. | A deliberately wide spread, so the range grows. |

The range on the page adds up the spread of every factor that changed, so the more of an answer we had to guess, the wider it gets.

## How to rebuild

```
npm run factors:build
```

That reads everything in this folder and writes `src/data/model-factors.json`. The tests run the same derivation again and fail if the committed file doesn't match, so a number can't quietly drift from its source. Other tests recompute a few factors by hand, straight from the CSVs.

The derivation is in `src/lib/factor-derivation.ts`. It's written to be read.

## The method

For each factor we can source:

1. Find two published profiles that differ in (ideally) one thing, for example a 36-year-old and a 55-year-old who are otherwise identical.
2. For each insurance company, in the same place, divide one premium by the other.
3. Take the median across companies. The low and high edges are the 25th and 75th percentiles: the middle half of companies.
4. Where several states measure the same thing, take the median of the state medians (and of their percentiles), so one big survey doesn't drown out the others.
5. Where a factor has to be built in two steps (for example age 25 ÷ age 39, then age 39 ÷ age 55), multiply the two medians and add their spreads.
6. Round to two decimals.

## Sources

| Id | What | Publisher | Data year |
| --- | --- | --- | --- |
| `ok-2026` | Auto Insurance Rate Comparison. 20 companies, 5 cities, ages 16/21/36/55/70, male and female, 2018 Malibu, 25/50/25 limits with $500 deductibles. | Oklahoma Insurance Department | Sept 2026 |
| `nd-2026` | Auto Insurance Cost Comparison Survey. 23 companies, 5 regions, 11 household examples. | North Dakota Insurance & Securities Dept. | Jan 2026 rates |
| `dc-2024` | Premium Comparison, Sample Profiles. 29 companies, ages 25/39/66, married and single, 3-year-old Camry, minimum coverage. | DC Dept. of Insurance, Securities and Banking | 2024 (newest edition) |
| `tx-2025` | HelpInsure.com sample rates. 36 companies, 5 ZIP codes, liability only. One base driver (single, 30, clean) with one thing changed at a time: age 18 or 65, an accident, higher limits, commuting miles, and more. | Texas Dept. of Insurance and Office of Public Insurance Counsel | June 2025 rates (still current) |
| `ca-2026` | Automobile Premium Survey. About 45 companies, Los Angeles, Irvine, and Alturas. Single drivers by years licensed, record, and mileage; liability-only and full coverage; married households with and without a bundling discount. | California Dept. of Insurance | Jan 2026 rates |
| `co-2023` | Premium Comparison Report. 68 companies, 6 places from Denver to Craig, four drivers, three coverage plans. | Colorado Division of Insurance | 2022–2023 |
| `nc-sdip-2026` | Safe Driver Incentive Plan: the surcharge North Carolina insurers add per insurance point. | North Carolina Dept. of Insurance | current |
| `iso-via-iii-2024` | Claim frequency and average claim cost by coverage, 2024 (ISO data). | Insurance Information Institute | 2024 |
| `hldi-2022-24` | Insurance losses by make and model, 100 = average vehicle. | Highway Loss Data Institute (IIHS-HLDI) | 2022–24 models |

Every premium row in `sources/` keeps a `locator`: where you'll find it in the original (page, table, row, and column, or the exact web request), plus the printed figure when we converted it. Oklahoma, North Dakota, DC, and Colorado print six-month premiums, which we doubled. `sources/sources.json` has the URLs, check dates, and the terms of use we found. `sources/README.md` lists the quirks in each file, and which companies we left out and why.

## Each factor, and how we got it

The exact numbers, counts, and percentiles are in `src/data/model-factors.json` next to each factor, in its `derivation` field. The table below rounds them.

| Factor | Value | Middle half of companies | Kind | Where it comes from |
| --- | --- | --- | --- | --- |
| Age 16–18 | 2.87 | 2.57–3.81 | From public prices | Texas: age 18 ÷ 30, then × the 26–39 factor |
| Age 19–21 | 1.92 | 1.69–2.06 | Rough | Oklahoma: 21 ÷ 55 (marital status differs too) |
| Age 22–25 | 1.30 | 1.20–1.49 | From public prices | DC: 25 ÷ 39, then × the 26–39 factor |
| Age 26–39 | 1.11 | 1.06–1.20 | From public prices | Oklahoma: 36 ÷ 55 |
| Age 40–64 | 1.00 | | Starting point | |
| Age 65+ | 1.05 | 0.95–1.16 | From public prices | DC 66 ÷ 39 and Texas 65 ÷ 30, then × the 26–39 factor |
| Licensed 1–3 years (26+) | 2.27 | 1.84–2.73 | Rough | California: 2 years ÷ 13 years |
| Licensed 4–9 years (26+) | 1.34 | 1.24–1.55 | Rough | California: 4 and 7 years ÷ 13 years |
| Licensed under 1 year (26+) | 2.27 | 1.84–3.28 | Our estimate | At least the 1–3 year factor |
| One at-fault accident | 1.52 | 1.38–1.66 | From public prices | California, Texas, and North Carolina's rule |
| Two or more accidents | 2.40 | 1.70–3.40 | Our estimate | Two North Carolina surcharges added |
| Under 7,500 miles | 0.92 | 0.88–0.94 | From public prices | California: 5,000–7,500 ÷ 7,600–10,000 miles |
| Over 15,000 miles | 1.08 | 1.04–1.15 | Rough | California 12,500–16,000 miles and Texas commuting 18,000 miles |
| Bundling | 0.90 | 0.85–1.00 | From public prices | California: same household with and without a multi-policy discount |
| Good student, driver training | 0.92, 0.95 | | Our estimate | |
| Urban | 1.29 | 1.12–1.44 | From public prices | City ÷ rural, same company and driver, 5 states |
| Suburban | 1.07 | 0.91–1.22 | From public prices | Suburb ÷ city in 3 states, × the urban factor |
| Rural | 1.00 | | Starting point | |
| State-minimum limits | 0.87 | 0.79–0.90 | From public prices | Texas: 30/60/25 ÷ 100/300/100 |
| 250/500/250 limits | 1.15 | 1.05–1.30 | Our estimate | |
| Deductible $500, $2,000 | 1.08, 0.88 | | Our estimate | |
| Loan or lease | 1.05 | | Our estimate | |
| Vehicle age 4–7, 8–12, 13+ | 0.88, 0.75, 0.62 | | Our estimate | |

### Driver age

- **40–64** is the starting point.
- **26–39**: Oklahoma, age 36 ÷ age 55. Both married, same commute, mileage, car, and coverage, so age is the only difference.
- **22–25**: DC, age 25 ÷ age 39 (same company, same household type), times the 26–39 factor, because 39 falls in that band. DC's profiles are minimum coverage only.
- **65+**: the middle of DC's age 66 ÷ 39 and Texas's age 65 ÷ 30, times the 26–39 factor.
- **19–21**: Oklahoma, age 21 (single) ÷ age 55 (married). *Rough*, because marital status differs too.
- **16–18**: Texas, age 18 ÷ age 30 for the same single driver, car, ZIP, and credit, for men and women, times the 26–39 factor. Texas's site shows ages as bands (16–24, 25–64, 65+); the department's data call asks companies to rate them at 18, 30, and 65, and we read the bands that way. Texas's figures are liability only. For comparison, Oklahoma's 16-year-old costs about 4.5 times its 55-year-old, but those two also differ in marital status, how they use the car, and mileage.

Both surveys price a teen who is **the only driver on their own policy**. Adding a teen to a parent's policy is priced differently, and we don't have a public source for that yet. Help wanted.

There's no separate "teen" switch. The 16–18 band is the teen factor, so nothing is counted twice. The good-student discount only applies under 26, and driver training under 22, so switching them on for a 65-year-old does nothing.

### Years licensed

California rates drivers by years licensed rather than age, so its survey gives us years licensed but not age. We use it only from age 26, so it doesn't pile on top of the young-driver age factors. It's *rough*, because a newly licensed California driver may also be younger. **10 or more years** is the starting point. Nobody publishes a price for under a year of experience, so we use the 1–3 year factor and widen the top.

### Driving record

- **One at-fault accident**: the middle of three states. California's single drivers with one at-fault accident ÷ clean (1.41; California's clean profiles include its required Good Driver discount, so this includes losing it). Texas's accident ÷ clean (1.52). North Carolina's Safe Driver Incentive Plan, set by state law: 40% for a small accident, 55% for a medium one, and 70% for $3,850 or more of damage or an injury, which is most accidents today (ISO's 2024 average collision claim was $5,489).
- **Two or more**: *our estimate*. North Carolina's page doesn't list the surcharge for that many points, so we added two single-accident surcharges.

### Mileage and bundling

- **Under 7,500 miles**: California, 5,000–7,500 ÷ 7,600–10,000 miles for the same driver in Los Angeles.
- **Over 15,000 miles**: *rough*. California's top band (12,500–16,000) is only partly over 15,000, and Texas's high-mileage profile also changes from pleasure to commuting. Many Texas companies charge the same for both.
- **Bundling**: California, the same household with and without a multi-policy discount.

### Area

- **Rural** is the starting point.
- **Urban**: the same company and driver in a city versus a rural area, in five states. Oklahoma City and Tulsa ÷ Woodward and McAlester (1.16), Fargo ÷ the rest of North Dakota (0.99), Houston and Dallas ÷ Plainview and Alpine (2.01), Los Angeles ÷ Alturas (1.70), and Denver and Colorado Springs ÷ Sterling, Alamosa, and Craig (1.29). We use the middle state. The states really do differ, and the range shows it.
- **Suburban**: in the three states that publish a suburb, city, and rural area (Plano, Irvine, Highlands Ranch), the suburb costs 14%–20% less than the city. We apply that to the urban factor.

### How a full-coverage premium splits (liability versus damage)

A full-coverage premium pays for two different things: **liability** (damage and injuries you cause to others) and **damage to your own car** (collision and comprehensive). Some factors only touch one part. We split it using ISO's 2024 claim costs (how often claims happen × the average claim), published by the Insurance Information Institute:

- Liability ≈ 55% of the total. *Rough*: these are claim costs, not prices, and they leave out uninsured-motorist, medical, and PIP coverage. The 45%–65% edges are our estimate.
- Within damage, collision ≈ 71% and comprehensive ≈ 29%.
- Within liability, bodily injury ≈ 57% and property damage ≈ 43%.

### Liability limits, deductible, loan or lease, vehicle age

Each moves only its own part of the premium: limits move the liability part; deductible, loan or lease, and vehicle age move the damage part. With liability-only coverage, the deductible and the car's age don't matter at all.

- **State-minimum limits**: Texas, 30/60/25 (its minimum) ÷ 100/300/100, liability only. Minimums differ by state, so the real difference in your state may be bigger or smaller.
- Higher limits, deductibles, loan or lease, and vehicle age are *our estimates*. Help wanted: a state survey that prices the same driver at two deductibles would source the deductible directly. Colorado's plans change the deductible and the limits at the same time, so we couldn't use them.

### Vehicles

This is the part that answers "what if I bought a Tesla Model Y?"

**What kind of vehicle is it?** We read the EPA size class and powertrain that the government's own FuelEconomy.gov file lists for each trim (see `data/catalog/`). A Range Rover is a "Standard Sport Utility Vehicle 4WD", not a pickup. The Ioniq is a hybrid car and the Ioniq 5 is an electric SUV. We only fall back to the words in the name when the catalog has nothing.

**How much does it cost to insure?** The Highway Loss Data Institute publishes, for each vehicle, how its insurance losses compare with the average vehicle (100). A collision result of 134 means collision claims cost 34% more than average. HLDI adjusts these for the driver's age, gender, marital status, and state (and collision and comprehensive for the deductible), so they're about the car, not who usually drives it. That's why we can combine them with the driver factors without counting anything twice.

We use them like this:

- Collision and comprehensive results move only the **damage** part of the premium, weighted 71/29.
- Property-damage and bodily-injury liability results move only the **liability** part, weighted 43/57. HLDI reports bodily injury as how often claims happen, not their cost; we use it as published.
- When HLDI lists several versions (2WD and 4WD, cab styles), we match the drive when we know it and take the middle value of the rest.
- Electric and plug-in cars only match electric and plug-in HLDI rows. A hybrid with no hybrid row of its own (mild hybrids, for example) uses the regular model's row.
- **Not in the table?** We use HLDI's average for the class (small SUV, full-size pickup, and so on) and widen the range. For electric small SUVs and midsize SUVs we use the middle of the electric models we keep in that class. EPA calls some hatchbacks "large cars" because it measures interior room, while HLDI measures size by footprint and weight, so we use HLDI's midsize-car average for EPA large cars. Which HLDI class stands in for which EPA class is our judgment (`vehicle-families.json`).
- **Don't know the car at all?** We treat it as average and widen the range more.

How closely an insurer's own vehicle rating follows HLDI losses is *our estimate* (about ±8%). Losses are for 2022–24 models; for other model years we widen the range.

We keep HLDI rows for 155 popular and teen-friendly model families (328 of the 685 rows HLDI publishes), listed in `vehicle-families.json`. For the biggest brands, about 4 in 5 of the 2024 trims in our catalog match an exact HLDI model.

### The range

- **Starting from a typical price instead of your own**: how far companies' prices sit from the middle company for the same driver, car, and place, in all five state surveys with many profiles. The middle half of companies are within about −21% to +27%. *From public prices.*
- **Using a class average** and **vehicle not recognized**: how far HLDI's models sit from their class average, and from the all-vehicle average. *Rough.*
- A partly matched trim, moving to another state, and how closely insurers follow HLDI: *our estimates*.

## What we left out, on purpose

- **Credit.** Many insurers use a credit-based insurance score where the law allows, and it can move a real quote a lot. In Texas's 2025 sample rates, for the same driver, companies priced "poor" credit a median 19% above average credit, and "good" credit 17% below (180 comparisons each). We don't ask about credit and it's not in the model, so your real price could be higher or lower because of it.
- **Gender and marital status** aren't inputs. Where the surveys give both, our factors pool men and women.
- **Discounts we can't see** (safe-driving apps, paying in full, loyalty) aren't modeled.

## Sources we found but didn't use

- **Maryland Insurance Administration, "Auto Insurance: A Comparison Guide to Rates" (August 2026).** 53 companies × 29 ZIP codes. It would be excellent for city-versus-rural factors, but its terms say "Partial reproductions are not permitted without the prior written consent of the MIA." We didn't copy it. If the owner gets consent, it can be added quickly.
- **HLDI's 2021–23 table** has a few models that 2022–24 dropped (Chevrolet Bolt, Kia Rio, Dodge Charger). Its 100 is a different average, so we didn't mix it in.
- **North Dakota 2025** repeats the same examples as 2026, with many identical figures. We use 2026.
- States we checked that don't publish multi-company sample premiums now: Virginia, Pennsylvania, New York, New Jersey, Delaware, Connecticut, Massachusetts, West Virginia (last survey 2024, minimum coverage only), Kansas, Arkansas, and Louisiana (its rate guide is no longer on its publications page). We haven't checked Washington, Oregon, Nevada, Arizona, Utah, New Mexico, Georgia, South Carolina, Michigan, Illinois, or Florida yet. Help wanted.

## Terms of use: decisions for the owner

- **HLDI (IIHS).** IIHS allows "limited noncommercial, educational and personal use" with the source cited as www.iihs.org, and says "repetitive" use or redistribution needs written permission (legal@iihs.org). A table kept in a public repository for years probably counts as repetitive. The numbers themselves are facts, and we keep only a subset for popular vehicles, but the safe step is to **email IIHS and ask**. Their page lists what to include: which content, the project, the audience, how it's distributed and for how long, and whether you charge (we don't). If they say no, the HLDI files come out, and the vehicle part of the derivation needs another source (or every vehicle falls back to "not recognized", with a wide range).
- **Insurance Information Institute.** We use eight ISO figures from one table, with attribution. The same page marks its NAIC tables "Further reprint or distribution strictly prohibited without written permission of NAIC". We use none of those.
- **State surveys** (Oklahoma, North Dakota, DC, Texas, California, Colorado) are public consumer publications. California's and Colorado's pages carry a general copyright line; none of them has terms that restrict using the figures that we could find.
- **North Carolina SDIP** is a public statement of a state rule.

## How to improve a factor

Spot something wrong, or know a better source? Here's how to help.

1. **Find a public source.** The best ones are state insurance-department rate comparisons that show many companies' prices for the same driver, with one thing changed: the same driver at two deductibles, or with and without an accident. Official state rules and insurer rate filings (public in many states) are great too. Please avoid ranking sites and blogs: we need the original.
2. **Save the numbers.** Add a CSV under `sources/` with one row per published figure and a `locator` column that says exactly where it is (page, table, row, column, or the exact web request). Convert six-month figures to yearly, and keep the printed figure in the locator. Please don't commit the PDF itself; link to it instead.
3. **Add it to `sources/sources.json`** with the URL, data year, the date you checked it, and any terms of use you found.
4. **Derive it** in `src/lib/factor-derivation.ts`. If it replaces an estimate, delete that entry from `assumptions.json` (the build stops if a factor is both).
5. **Run** `npm run factors:build` and `npm test`. The tests check that every sourced factor names a real source and says how it was worked out, and that every estimate says so and widens the range.

If you can't code, that's fine. Open an issue with the link and the page number, and someone will take it from there.
