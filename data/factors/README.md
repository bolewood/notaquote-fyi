# Where our numbers come from

Every estimate on NotAQuote.FYI starts from one number, either what you pay now or a typical price, and then adjusts it for what's different: the driver, the car, the coverage, where the car is kept. Each adjustment is a factor. This folder holds those factors, the public sources behind them, and the script that turns one into the other.

We'd rather show you a wide range than pretend to know something we don't. So every factor says where it came from. There are four kinds:

| Kind | What it means | What it does to the range |
| --- | --- | --- |
| **Starting point** | The thing everything else is compared with. Always 1.00. | Nothing. |
| **From public prices or rules** | Worked out from real prices that insurers filed with a state, comparing two profiles that differ in just that one thing. Or copied from an official state rule. | Adds how differently companies price the same thing (the middle half of companies). |
| **From public data, roughly** | Worked out from public data, but the profiles also differ in something else, or the data is about claims rather than prices. We say what else differs. | The same, and we say it's rough. |
| **Our estimate (help wanted)** | We couldn't find a public source yet. It's our best guess, and it says so. | A deliberately wide spread, so the range grows. |

The range on the page adds up the spread of every factor that changed, so the more of an answer we had to guess, the wider it gets.

## How to rebuild

```
npm run factors:build
```

That reads everything in this folder and writes `src/data/model-factors.json`. The tests run the same derivation again and fail if the committed file doesn't match, so a number can't quietly drift from its source.

The derivation is in `src/lib/factor-derivation.ts`. It's written to be read.

## The method

For each factor we can source:

1. Find two published profiles that differ in (ideally) one thing, for example a 36-year-old and a 55-year-old who are otherwise identical.
2. For each insurance company, in the same city, divide one premium by the other.
3. Take the median across companies. The low and high edges are the 25th and 75th percentiles: the middle half of companies.
4. Where two states measure the same thing, take the median of the state medians (with two states, that's their average).
5. Round to two decimals.

## Sources

| Id | What | Publisher | Data year | File(s) |
| --- | --- | --- | --- | --- |
| `ok-2026` | Auto Insurance Rate Comparison: 20 companies, 5 cities, ages 16/21/36/55/70, male and female, 2018 Malibu, 25/50/25 limits, $500 deductibles | Oklahoma Insurance Department | Sept 2026 | `sources/ok-2026-*.csv` |
| `nd-2026` | Auto Insurance Cost Comparison Survey: 23 companies, 5 regions, 11 household examples | North Dakota Insurance & Securities Dept. | Jan 2026 rates | `sources/nd-2026-*.csv` |
| `dc-2024` | Premium Comparison, Sample Profiles: 29 companies, ages 25/39/66, married and single, 3-year-old Camry, minimum coverage | DC Dept. of Insurance, Securities and Banking | 2024 (newest edition) | `sources/dc-2024-*.csv` |
| `nc-sdip-2026` | Safe Driver Incentive Plan: the surcharge North Carolina insurers must add per insurance point | North Carolina Dept. of Insurance | current | `sources/nc-sdip-2026.csv` |
| `iso-via-iii-2024` | Claim frequency and average claim cost by coverage, 2024 (ISO data) | Insurance Information Institute | 2024 | `sources/iso-loss-costs-2024.csv` |
| `hldi-2022-24` | Insurance losses by make and model, 100 = average vehicle | Highway Loss Data Institute (IIHS-HLDI) | 2022–24 models | `sources/hldi-2022-24.csv`, `sources/hldi-class-subtotals-2022-24.csv` |

Every premium row keeps a `locator`: the page, table, row, and column where you'll find it in the original, plus the printed figure when we converted it (the Oklahoma, North Dakota, and DC surveys print six-month premiums, which we doubled). `sources/sources.json` has the URLs, check dates, and the terms of use we found. `sources/README.md` lists the quirks we found in each file.

## Each factor, and how we got it

The exact numbers, counts, and percentiles are in `src/data/model-factors.json` next to each factor, in the `derivation` field.

### Driver age (applies to the whole premium)

- **40–64** is the starting point.
- **26–39**: Oklahoma, age 36 ÷ age 55. Both married, same commute, mileage, car, and coverage, so age is the only difference. 200 company comparisons. *From public prices.*
- **22–25**: DC, age 25 ÷ age 39 (same company, same household type), times the 26–39 factor, because 39 falls in that band. *From public prices.* DC's profiles are minimum coverage only.
- **65+**: DC, age 66 ÷ age 39, times the 26–39 factor. *From public prices.* Also minimum coverage only.
- **19–21**: Oklahoma, age 21 (single) ÷ age 55 (married). *Rough*: marital status differs too.
- **16–18**: Oklahoma, age 16 ÷ age 55. *Rough*: the 16-year-old is single, drives to school, and drives under 7,500 miles; the 55-year-old is married and commutes 12,000 miles. It's also a teen who is **the only driver on their own policy**. Adding a teen to a parent's policy is priced differently, and usually costs less than this. We don't have a public source for that yet. Help wanted.

There's no separate "teen" switch. The 16–18 band is the teen factor, so nothing is counted twice. Good-student and driver-training discounts only apply to young drivers (under 26 and under 22), so switching them on for a 65-year-old does nothing.

### Years licensed

Only used from age 22. For younger drivers, the age factor already covers being new. **10 or more years** is the starting point. Everything else is *our estimate*.

### Driving record

- **One at-fault accident**: North Carolina's Safe Driver Incentive Plan, set by state law, adds 40% for a small accident (under $2,300 of damage), 55% for a medium one, and 70% for $3,850 or more or an injury. Typical claims today are well above $3,850 (ISO's 2024 average collision claim was $5,489), so we use 70%, with 40% as the low edge. *Rough*, because it's one state's rule. Insurers elsewhere set their own surcharges.
- **Two or more**: *our estimate*. North Carolina's page doesn't list the surcharge for that many points, so we added two single-accident surcharges.

### Yearly mileage, good student, driver training, bundling

All *our estimates* for now. We know the direction (lower mileage and these discounts cost less), but we haven't found a public source that isolates the size. Help wanted.

### Area

- **Rural** is the starting point.
- **Urban**: the same company and driver in a city versus a rural area. Oklahoma City and Tulsa versus Woodward and McAlester (800 comparisons), and Fargo versus "Remainder of State" in North Dakota (228 comparisons). *From public prices.* The two states disagree: Oklahoma's cities cost about 16% more, North Dakota's Fargo about the same as the rest of the state. We take the middle and the range shows the disagreement. Big metro areas, which these surveys don't cover, probably differ more.
- **Suburban**: *our estimate*, halfway between rural and urban.

### How a full-coverage premium splits (liability versus damage)

A full-coverage premium pays for two different things: **liability** (damage and injuries you cause to others) and **damage to your own car** (collision and comprehensive). Some factors only touch one part. We split it using ISO's 2024 claim costs (how often claims happen × the average claim), published by the Insurance Information Institute:

- Liability ≈ 55% of the total. *Rough*: these are claim costs, not prices, and they leave out uninsured-motorist, medical, and PIP coverage. The 45%–65% edges are our estimate.
- Within damage, collision ≈ 71% and comprehensive ≈ 29%.
- Within liability, bodily injury ≈ 57% and property damage ≈ 43%.

### Liability limits, deductible, loan or lease, vehicle age

All *our estimates*, and each moves only its own part: limits move the liability part; deductible, loan or lease, and vehicle age move the damage part. With liability-only coverage, the deductible and the car's age don't matter at all. Help wanted, especially for deductibles and limits. A state survey that prices the same driver at two deductibles or two limits would source these directly.

### Vehicles

This is the part that answers "what if I bought a Tesla Model Y?"

**What kind of vehicle is it?** We read the EPA size class and powertrain that the government's own FuelEconomy.gov file lists for each trim (see `data/catalog/`). A Range Rover is a "Standard Sport Utility Vehicle 4WD", not a pickup. The Ioniq is a hybrid car and the Ioniq 5 is an electric SUV. We only fall back to the words in the name when the catalog has nothing.

**How much does it cost to insure?** The Highway Loss Data Institute publishes, for each vehicle, how its insurance losses compare with the average vehicle (100). A collision result of 134 means collision claims cost 34% more than average. HLDI adjusts these for the driver's age, gender, marital status, state, and deductible, so they're about the car, not who usually drives it. That's why we can combine them with the driver factors without counting anything twice.

We use them like this:

- Collision and comprehensive results move only the **damage** part of the premium, weighted 71/29.
- Property-damage and bodily-injury liability results move only the **liability** part, weighted 43/57. HLDI reports bodily injury as how often claims happen, not their cost; we use it as published.
- When HLDI lists several versions (2WD and 4WD, cab styles), we match the drive when we know it and take the middle value of the rest.
- Electric and plug-in cars only match electric and plug-in HLDI rows. A hybrid with no hybrid row of its own (mild hybrids, for example) uses the regular model's row.
- **Not in the table?** We use HLDI's average for the class (small SUV, full-size pickup, and so on) and widen the range. EPA calls some hatchbacks "large cars" because it measures interior room, while HLDI measures size by footprint and weight, so we use HLDI's midsize-car average for EPA large cars. Which HLDI class stands in for which EPA class is our judgment (`vehicle-families.json`).
- **Don't know the car at all?** We treat it as average and widen the range more.

How closely an insurer's own vehicle rating follows HLDI losses is *our estimate* (about ±8%). Losses are for 2022–24 models; for other years we widen the range.

We keep HLDI rows for about 130 popular and teen-friendly models (300 rows), listed in `vehicle-families.json`.

### The range

- **Starting from a typical price instead of your own**: how far companies' prices sit from the middle company for the same driver, car, and place, in Oklahoma and North Dakota. The middle half of companies are within about −23% to +27%. *From public prices.*
- **Using a class average** and **vehicle not recognized**: how far HLDI's models sit from their class average, and from the all-vehicle average. *Rough.*
- A partly matched trim, moving to another state, and how closely insurers follow HLDI: *our estimates*.

## What we left out, on purpose

- **Credit.** Many insurers use a credit-based insurance score where the law allows, and it can move a real quote a lot. We don't ask about it and it's not in the model. Your real price could be higher or lower because of it.
- **Gender and marital status** aren't inputs. Where the surveys give both, our factors average across men and women.
- **Discounts we can't see** (safe-driving apps, paying in full, loyalty) aren't modeled.

## Sources we found but didn't use

- **Maryland Insurance Administration, "Auto Insurance: A Comparison Guide to Rates" (August 2026).** 53 companies × 29 ZIP codes. It would be excellent for city-versus-rural factors, but its terms say "Partial reproductions are not permitted without the prior written consent of the MIA." We didn't copy it. If the owner gets consent, it can be added in an afternoon.
- **HLDI's 2021–23 table** has a few models that 2022–24 dropped (Chevrolet Bolt, Kia Rio, Dodge Charger). Its 100 is a different average, so we didn't mix it in.
- States we checked that don't publish multi-company sample premiums now: Virginia, Pennsylvania, New York, New Jersey, Delaware, Connecticut, Massachusetts, West Virginia (last survey 2024, minimum coverage only), Kansas, Arkansas, and Louisiana (its rate guide is no longer on its publications page).

## Terms of use: decisions for the owner

- **HLDI (IIHS).** IIHS allows "limited noncommercial, educational and personal use" with the source cited as www.iihs.org, and says "repetitive" use or redistribution needs written permission (legal@iihs.org). A table kept in a public repository for years probably counts as repetitive. The numbers themselves are facts, and we keep only a subset for popular vehicles, but the safe step is to **email IIHS and ask**. Their page lists what to include: which content, the project, the audience, how it's distributed and for how long, and whether you charge (we don't). If they say no, delete `sources/hldi-*.csv`, and the engine falls back to "vehicle not recognized" (a wide range) until another source exists.
- **Insurance Information Institute.** We use eight ISO figures from one table, with attribution. The same page marks its NAIC tables "Further reprint or distribution strictly prohibited without written permission of NAIC". We use none of those.
- **State surveys** (Oklahoma, North Dakota, DC) carry no restrictions we could find. They're public consumer publications.
- **North Carolina SDIP** is a public statement of a state rule.

## How to improve a factor

Spot something wrong, or know a better source? Here's how to help.

1. **Find a public source.** The best ones are state insurance-department rate comparisons that show many companies' prices for the same driver, with one thing changed: the same driver at two deductibles, or with and without an accident. Official state rules and insurer rate filings (public in many states) are great too. Please avoid ranking sites and blogs: we need the original.
2. **Save the numbers.** Add a CSV under `sources/` with one row per published figure and a `locator` column that says exactly where it is (page, table, row, column). Convert six-month figures to yearly, and keep the printed figure in the locator. Please don't commit the PDF itself; link to it instead.
3. **Add it to `sources/sources.json`** with the URL, data year, the date you checked it, and any terms of use you found.
4. **Derive it** in `src/lib/factor-derivation.ts`. If it replaces an estimate, delete that entry from `assumptions.json`.
5. **Run** `npm run factors:build` and `npm test`. The tests check that every sourced factor names a real source and says how it was worked out, and that every estimate says so and widens the range.

If you can't code, that's fine. Open an issue with the link and the page number, and someone will take it from there.
