# Where our numbers come from

Every estimate on NotAQuote.FYI starts from one number, either what you pay now or a typical price for your state, and then adjusts it for what's different: the driver, the car, the coverage, where the car is kept. Each adjustment is a factor. This folder holds those factors, the public sources behind them, and the script that turns one into the other.

We'd rather show you a wide range than pretend to know something we don't. So every factor says where it came from. There are four kinds:

| Kind | What it means | What it does to the range |
| --- | --- | --- |
| **Starting point** | The thing everything else is compared with. Always 1.00. | Nothing. |
| **From public prices or rules** | Worked out from real prices that insurers reported to a state insurance department, comparing two profiles that differ in just that one thing. Or taken from an official state rule. | Adds how differently companies price the same thing (the middle half of companies). |
| **From public data, roughly** | Worked out from public data, but the profiles also differ in something else, or the states disagree, or the data is about claims rather than prices. We say what else differs. | The same, and we say it's rough. |
| **Our estimate (help wanted)** | We couldn't find a public source yet. It's our best guess, and it says so. | A deliberately wide spread, so the range grows. |

The range on the page adds up the spread of every factor that changed, so the more of an answer we had to guess, the wider it gets.

## How to rebuild

```
npm run factors:build
```

That reads everything in this folder (plus `data/state-baselines/state-baselines.json`) and writes `src/data/model-factors.json`. The tests run the same derivation again and fail if the committed file doesn't match, so a number can't quietly drift from its source. Other tests recompute a few factors by hand, straight from the CSVs.

The derivation is in `src/lib/factor-derivation.ts`. It's written to be read. `npx tsx scripts/example-table.ts` prints the worked example below.

## The method

For each factor we can source:

1. Find two published profiles that differ in (ideally) one thing, for example a 36-year-old and a 55-year-old who are otherwise identical.
2. For each insurance company, in the same place, divide one premium by the other.
3. Take the median across companies. The low and high edges are the 25th and 75th percentiles: the middle half of companies.
4. Where several states measure the same thing, take the median of the state medians (and of their percentiles), so one big survey doesn't drown out the others. Where the states disagree a lot (city versus rural), the edges are the lowest and highest state instead.
5. Where a factor has to be built in two steps (for example age 25 ÷ age 39, then age 39 ÷ age 55), multiply the two medians and add their spreads.
6. Round to two decimals.

## Sources

| Id | What | Publisher | Data year |
| --- | --- | --- | --- |
| `ok-2026` | Auto Insurance Rate Comparison. 20 companies, 5 cities, ages 16/21/36/55/70, male and female, 2018 Malibu, 25/50/25 limits with $500 deductibles. | Oklahoma Insurance Department | Sept 2026 |
| `nd-2026` | Auto Insurance Cost Comparison Survey. 23 companies, 5 regions, 11 household examples. | North Dakota Insurance & Securities Dept. | Jan 2026 rates |
| `dc-2024` | Premium Comparison, Sample Profiles. 29 companies, ages 25/39/66, married and single, 3-year-old Camry, minimum coverage. | DC Dept. of Insurance, Securities and Banking | 2024 (newest edition) |
| `tx-2025` | HelpInsure.com sample rates. 36 companies, 5 ZIP codes, liability only. One base driver (single, 30, clean) with one thing changed at a time. | Texas Dept. of Insurance and Office of Public Insurance Counsel | June 2025 rates (still current) |
| `ca-2026` | Automobile Premium Survey. About 45 companies, Los Angeles, Irvine, and Alturas. Single drivers by years licensed, record, and mileage; the same full-coverage driver on 12 different cars; married households, one with a teen. | California Dept. of Insurance | Jan 2026 rates |
| `co-2023` | Premium Comparison Report. 68 companies, 6 places from Denver to Craig. | Colorado Division of Insurance | 2022–2023 |
| `nc-sdip-2026` | Safe Driver Incentive Plan: the surcharge North Carolina insurers add per insurance point. | North Carolina Dept. of Insurance | current |
| `naic-auto-db-2022-2023` | Average liability and combined premiums, countrywide, 2023 (the same report as our state starting points). | NAIC | 2023 |
| `iso-via-iii-2024` | Claim frequency and average claim cost by coverage, 2024 (ISO data). | Insurance Information Institute | 2024 |
| `iso-symbols-2004` | How far ISO's vehicle liability symbols move a premium (+25% at most, 20% less at most). | Insurance Journal, reporting ISO | 2004 |
| `bls-cpi-sete` | Consumer price index for motor vehicle insurance (CUUR0000SETE): the 2023 average and August 2026. | U.S. Bureau of Labor Statistics | 2023–2026 |
| `sp-global-vio-2023` | Average age of US cars and light trucks: 12.5 years. | S&P Global Mobility | 2023 |
| `hldi-2022-24` | Insurance losses by make and model, 100 = average vehicle. | Highway Loss Data Institute (IIHS-HLDI) | 2022–24 models |

Every row in `sources/` keeps a `locator`: where you'll find it in the original (page, table, row, and column, or the exact web request), plus the printed figure when we converted it. Oklahoma, North Dakota, DC, and Colorado print six-month premiums, which we doubled. `sources/sources.json` has the URLs, check dates, and the terms of use we found. `sources/README.md` lists the quirks in each file, and which companies we left out and why.

## Each factor, and how we got it

The exact numbers, counts, and percentiles are in `src/data/model-factors.json` next to each factor, in its `derivation` field.

| Factor | Value | Range | Kind | Where it comes from |
| --- | --- | --- | --- | --- |
| Age 16–18, own policy | 2.87 | 2.57–3.81 | From public prices | Texas: age 18 ÷ 30, then × the 26–39 factor |
| Adding a 16–18-year-old to a parent's policy (whole household) | 1.66 | 1.43–1.95 | Rough | California: family with a 17-year-old ÷ family without one, adjusted for the parents' experience |
| Age 19–21 | 1.92 | 1.69–2.06 | Rough | Oklahoma: 21 ÷ 55 (marital status differs too) |
| Age 22–25 | 1.30 | 1.20–1.49 | From public prices | DC: 25 ÷ 39, then × the 26–39 factor |
| Age 26–39 | 1.11 | 1.06–1.20 | From public prices | Oklahoma: 36 ÷ 55 |
| Age 40–64 | 1.00 | | Starting point | |
| Age 65+ | 1.05 | 0.95–1.16 | From public prices | DC 66 ÷ 39 and Texas 65 ÷ 30, then × the 26–39 factor |
| Licensed 1–3 years (26+) | 1.32 | 1.00–1.73 | Our estimate | California as an upper bound, capped |
| Licensed 4–9 years (26+) | 1.16 | 1.00–1.34 | Our estimate | California as an upper bound |
| Licensed under 1 year (26+) | 1.32 | 1.00–2.08 | Our estimate | |
| One at-fault accident | 1.52 | 1.38–1.66 | From public prices | California, Texas, and North Carolina's rule |
| Two or more accidents | 2.40 | 1.70–3.40 | Our estimate | Two North Carolina surcharges added |
| Under 7,500 miles | 0.92 | 0.88–0.94 | From public prices | California: 5,000–7,500 ÷ 7,600–10,000 miles |
| Over 15,000 miles | 1.08 | 1.04–1.15 | Rough | California and Texas |
| Bundling | 0.90 | 0.85–1.00 | From public prices | California: same household with and without a multi-policy discount |
| Good student, driver training | 0.92, 0.95 | | Our estimate | |
| Urban | 1.29 | 0.99–2.01 | From public prices | City ÷ rural, same company and driver, 5 states |
| Suburban | 1.14 | 1.07–1.65 | Rough | Where the suburb sits between rural and city, in 3 states |
| Rural | 1.00 | | Starting point | |
| State-minimum limits | 0.87 | 0.79–0.90 | From public prices | Texas: 30/60/25 ÷ 100/300/100 |
| 250/500/250 limits | 1.15 | 1.05–1.30 | Our estimate | |
| Deductible $500, $2,000 | 1.08, 0.88 | | Our estimate | |
| Loan or lease | 1.05 | | Our estimate | |
| Vehicle age 4–7, 8–12, 13+ | 0.88, 0.75, 0.62 | | Our estimate | |
| Liability share of a full-coverage premium | 51% | 45%–65% | Rough | NAIC 2023 countrywide |
| How much of a vehicle's liability losses we pass on | 52% | 26%–79% | Our estimate | Fitted to ISO's +25% / 20% less band, then frozen |
| How strongly repair losses move the damage part (exponent) | 0.38 | 0.24–0.52 | Rough | Fitted to California's prices for 12 cars |
| Extra on the damage part for luxury makes (car value) | ×1.74 | ×1.64–×1.96 | Rough | Fitted to California's prices for 12 cars (BMW and Tesla only) |
| The same, half strength, for Lexus, Acura, Volvo, Genesis, Infiniti, Cadillac, Lincoln, Alfa Romeo | ×1.32 | ×1.00–×1.96 | Our estimate | Our judgment |
| Price change since 2023, typical starts only | +18% | +13% to +23% | Rough | BLS consumer price index for car insurance |

### Driver age

- **40–64** is the starting point.
- **26–39**: Oklahoma, age 36 ÷ age 55. Both married, same commute, mileage, car, and coverage, so age is the only difference.
- **22–25**: DC, age 25 ÷ age 39 (same company, same household type), times the 26–39 factor, because 39 falls in that band. DC's profiles are minimum coverage only.
- **65+**: the middle of DC's age 66 ÷ 39 and Texas's age 65 ÷ 30, times the 26–39 factor.
- **19–21**: Oklahoma, age 21 (single) ÷ age 55 (married). *Rough*, because marital status differs too.
- **16–18**: Texas, age 18 ÷ age 30 for the same single driver, car, ZIP, and credit, for men and women, times the 26–39 factor. Texas's site shows ages as bands (16–24, 25–64, 65+); the department's data call asks companies to rate them at 18, 30, and 65, and we read the bands that way. Texas's figures are liability only. Oklahoma's 16-year-old costs about 4.5 times its 55-year-old, but those two also differ in marital status, how they use the car, and mileage.

### Teens: their own policy, or added to yours

There are two different questions here, and the engine keeps them apart.

**A teen on their own policy** (the default). Both surveys behind the 16–18 factor price a teen who is the only driver on their own policy. Whenever the driver is 16–21, the page says so: "This prices your teen as the only driver on their own policy. Adding a teen to a parent's policy usually costs less than this."

**Adding a teen to your policy** (`teenOnParentPolicy`, or the helper `teenAddedToPolicy`). Here the starting price and the estimate are both **your whole household's policy**, before and after the teen is added. It is not the teen's share, and it isn't a price for a teen's own car, so the engine won't use it to compare cars (`compareVehicles` refuses).

The figure comes from California's survey, which publishes one useful pair: a married couple with a 17-year-old (profile 2565) and a younger married couple without one (profile 2555), both full coverage on two family cars. For the same company and place, the household with the teen costs a median **+51%** (235 comparisons).

That understates the teen. The teen family's parents have been licensed 28 and 25 years, the other couple 13 and 10, and more experience is cheaper. California's single drivers licensed 25 years cost 9% less than those licensed 13 years (247 comparisons), so we divide by that: **+66%** (range +43% to +95%).

Which way could this be wrong?

- **Lower:** the experience credit may be smaller on a two-driver policy than for one driver, so the low edge goes all the way down to the unadjusted +51%.
- **Higher:** both families insure two cars. A one-car household would probably see a bigger jump, because the teen's cost is spread over less premium.
- **Either way:** the second car (a Highlander versus a Sienna) and the mileage also differ.

It's *rough*, and a cleaner source is welcome.

When there's no premium you entered, the typical start in this mode says what it is: NAIC's typical price for **one insured car** in your state, standing in for your household's premium.

There's no separate "teen" switch. The 16–18 band is the teen factor, so nothing is counted twice. The good-student discount only applies under 26, and driver training under 22, so switching them on for a 65-year-old does nothing.

### Years licensed

California's survey is the only public source that prices drivers by years licensed, but California doesn't allow age as a rating factor (10 CCR §2632.5). So a California driver licensed 2 years is usually young, and California's "2 years ÷ 13 years" figure (+127%) carries the youth effect our age factor already counts. Used as-is, a 30-year-old licensed 2 years would have cost about 88% as much as a 16-year-old.

So these are *our estimates*, used only from age 26:

- California's figure is an upper bound, capped at the 19–21 age factor ÷ the 26–39 age factor (1.73), so an experienced-age driver never costs more than a young one.
- We don't know how much of the gap is experience and how much is age, so we take the middle of 1.00 and that upper bound on a multiplying scale: **1–3 years 1.32** (range 1.00–1.73), **4–9 years 1.16** (1.00–1.34).
- **Under 1 year** uses the 1–3 year figure with a higher top (up to 2.08).

Now a 30-year-old licensed 2 years comes out at about 51% of a 16-year-old.

### Driving record

- **One at-fault accident**: the middle of three states. California's single drivers with one at-fault accident ÷ clean (+41%). Texas's accident ÷ clean (+52%). North Carolina's Safe Driver Incentive Plan, set by state law: +40% for a small accident, +55% for a medium one, and +70% for $3,850 or more of damage or an injury, which is most accidents today (ISO's 2024 average collision claim was $5,489).
- About California's discount: CDI says its survey premiums are "before any applicable discounts are applied", and company footnotes list California's Good Driver discount among those discounts (one says "California Good Driver Discount 30%", another "20% Good Driver Discount"). So California's clean figures leave that discount out, and a California driver who loses it after an accident probably sees a bigger jump than the survey shows.
- **Two or more**: *our estimate*. North Carolina's page doesn't list the surcharge for that many points, so we added two single-accident surcharges.

### Mileage and bundling

- **Under 7,500 miles**: California, 5,000–7,500 ÷ 7,600–10,000 miles for the same driver in Los Angeles.
- **Over 15,000 miles**: *rough*. California's top band (12,500–16,000) is only partly over 15,000, and Texas's high-mileage profile also changes from pleasure to commuting. Many Texas companies charge the same for both.
- **Bundling**: California, the same household with and without a multi-policy discount.

### Area

- **Rural** is the starting point.
- **Urban**: the same company and driver in a city versus a rural area, in five states: Oklahoma City and Tulsa ÷ Woodward and McAlester (+16%), Fargo ÷ the rest of North Dakota (1% less), Houston and Dallas ÷ Plainview and Alpine (+101%), Los Angeles ÷ Alturas (+70%), and Denver and Colorado Springs ÷ Sterling, Alamosa, and Craig (+29%). We use the middle state (+29%). The states really do disagree, so the range runs from the lowest state to the highest (1% less to +101%).
- **Suburban** (*rough*): only Texas, California, and Colorado publish a suburb as well. Measured directly against their rural areas, suburbs cost +65%, +32%, and +7% (middle +32%). That's more than our five-state urban factor, because those three states have unusually big city-versus-rural gaps, so we don't use it directly. Instead we measure where each state's suburb sits between its rural area and its city (0.72, 0.53, and 0.27 of the way, on a multiplying scale), take the middle (0.53), and apply it to the urban factor: **+14%**. The range runs from the lowest to the highest direct figure (+7% to +65%).

### How a full-coverage premium splits

A full-coverage premium pays for two different things: **liability** (damage and injuries you cause to others) and **damage to your own car** (collision and comprehensive). Some factors only touch one part.

- **Liability share: 51%**, from NAIC's 2023 countrywide average liability premium ($736.65) ÷ its combined average premium ($1,438.60). These are the same NAIC figures behind our state starting points. ISO's 2024 claim costs give 55%. *Rough*, because it's an average across all insured cars and states; the 45%–65% edges are our estimate.
- **Within damage**, collision ≈ 71% and comprehensive ≈ 29% (ISO 2024 claim costs).
- **Within liability**, bodily injury ≈ 57% and property damage ≈ 43% (ISO 2024 claim costs).

### Liability limits, deductible, loan or lease, vehicle age

Each moves only its own part of the premium: limits move the liability part; deductible, loan or lease, and vehicle age move the damage part. With liability-only coverage, the deductible and the car's age don't matter at all.

- **State-minimum limits**: Texas, 30/60/25 (its minimum) ÷ 100/300/100, liability only. Minimums differ by state, so the real difference in your state may be bigger or smaller.
- Higher limits, deductibles, loan or lease, and vehicle age are *our estimates*. Help wanted: a state survey that prices the same driver at two deductibles would source the deductible directly. Colorado's plans change the deductible and the limits at the same time, so we couldn't use them.

### Vehicles

This is the part that answers "what if I bought a Tesla Model Y?"

**What kind of vehicle is it?** We read the EPA size class and powertrain that the government's own FuelEconomy.gov file lists for each trim (see `data/catalog/`). A Range Rover is a "Standard Sport Utility Vehicle 4WD", not a pickup. The Ioniq is a hybrid car and the Ioniq 5 is an electric SUV.

Some trim names are sold in more than one version: 61 names as both gas and hybrid (like the 2024 Honda CR-V FWD), and a few as hybrid and plug-in (the 2024 Mazda CX-90 4WD). We price the least electrified version unless the name says otherwise, say which one we priced, and widen the range. The CX-90 4WD is priced as a mild hybrid, and because HLDI has no hybrid row for it, on HLDI's gas row; the note says so. We only fall back to the words in the name when the catalog has nothing.

**What HLDI tells us, and what it doesn't.** The Highway Loss Data Institute publishes, for each vehicle, how its insurance losses compare with the average vehicle (100). A collision result of 134 means collision claims cost 34% more than average.

- **Adjusted for:** HLDI adjusts these results for the driver's age, gender, and marital status, the state, how built-up the area is, standard or non-standard risk, and (for collision and comprehensive) the deductible.
- **Not adjusted for:** credit, mileage, prior claims, or income. So a car that careful, well-off drivers tend to buy can look cheaper to insure than it is, because some of the driver's good record shows up as the car's.
- **Value:** insurers' own vehicle ratings also follow the car's price, which HLDI's losses only partly reflect.

So we don't use HLDI's numbers as they are. We calibrate them against real prices.

**Calibrating to real prices.** California's 2026 survey prices the same full-coverage driver (clean record, 7,600–10,000 miles) on four cars in each of four profiles, in Los Angeles, Irvine, and Alturas. We fetched all of them: 12 cars, each compared with the Accord in the same profile, same company, and same place (about 122 comparisons per car). Then we fit how HLDI's results turn into those prices:

- price ∝ liability share × liability factor + damage share × (HLDI damage result)^**0.38** × (**1.74** if the make is one HLDI mostly files as luxury).
- The liability share is California's own, from NAIC (46.6%). The liability factor is the frozen weight below.
- The exponent (0.38) says real prices differ between cars much less than HLDI's repair losses do.
- The luxury term (×1.74 on the damage part) stands in for the car's value, because we found no public price list to use instead. **It was fitted on BMW and Tesla only**, the only luxury makes in California's calibration.
- The two numbers are chosen on a 0.01 grid to make each car ÷ the Accord as close to California's as possible. Before calibration the squared log error was 0.307; after, 0.093.

| Car ÷ Accord | California's prices | Our model | Before calibration |
| --- | --- | --- | --- |
| Subaru Crosstrek | 0.85 | 0.79 | 0.69 |
| Honda Civic | 0.99 | 1.04 | 1.07 |
| Toyota Tacoma | 0.95 | 0.89 | 0.84 |
| Toyota Prius | 1.05 | 0.94 | 0.98 |
| Tesla Model 3 | 1.21 | 1.38 | 1.06 |
| Ford F-150 | 0.88 | 0.97 | 0.98 |
| BMW 340i | 1.50 | 1.66 | 1.56 |
| Toyota RAV4 | 0.87 | 0.86 | 0.77 |
| Tesla Model S | 1.80 | 1.53 | 1.39 |
| Chevrolet Silverado | 0.95 | 0.99 | 0.90 |
| BMW 530i | 1.37 | 1.30 | 0.97 |

With only 12 cars, it's *rough*. Leaving each car out in turn moves the exponent between 0.24 and 0.52 and the luxury term between ×1.64 and ×1.96. When a luxury car is left out and predicted from the others, real ÷ model runs from 0.82 (the Model 3, which we over-predict by 18%) to 1.28 (the Model S, which we under-predict). So for luxury makes and electric cars the range reaches 18% lower and 28% higher, with a plain note. The whole fit is in `src/lib/factor-derivation.ts` and reruns with `npm run factors:build`. The scripts that fetched and parsed California's pages are in `scripts/research/ca-2026/`.

**Which makes get the value term** is our judgment, because it was fitted on BMW and Tesla only (`vehicle-families.json`):

- **Applied in full to** BMW, Mercedes-Benz, Audi, Porsche, Tesla, Land Rover, Jaguar, Maserati, Lucid, Rivian, Polestar, Bentley, Rolls Royce, Ferrari, Lamborghini, McLaren, and Aston Martin. Polestar is in because its cars are priced like a Tesla Model 3.
- **Half strength** (the square root, ×1.32, with a range from no term up to ×1.96) **for** Lexus, Acura, Volvo, Genesis, Infiniti, Cadillac, Lincoln, and Alfa Romeo. Their cars mostly cost less than a comparable BMW. Alfa Romeo's Giulia and Stelvio are priced like a 3 Series and X3, but it sells few cars and we have no price evidence for it, so it gets half, not full.
- **No term for** Buick and Mini. HLDI files some of their models as luxury, but their prices are mainstream. A Buick Envista comes out within 15% of a Chevrolet Trax, and an Acura Integra within 15% of a Honda Civic (tests check both).

**Sporty and costly-to-repair mainstream cars.** No sports car was in the calibration, and its mainstream cars' HLDI damage results run from 36% less to +14%. For a mainstream car in HLDI's sports-car class (a Mustang's damage result is +36%), or with a damage result above +14% (a Camry's is +18%), we're extrapolating. Those get a range that reaches 30% higher (*our estimate*). Sports cars get the note "Sporty cars often cost more to insure than their repair records suggest"; others get a note that their repair costs are above the cars we checked. We looked for a public price point: California's survey lists a Mustang in its vehicle sheet but doesn't price it for any single-driver profile, so the likely figure isn't raised, only the range.

With the calibration, our Model Y is about 30% above an Accord for a 45-year-old in suburban Illinois, and the range reaches about 88% above.

**Liability.** Property-damage and bodily-injury liability results move only the liability part of the premium, weighted 43/57, and only partly. Insurers move liability prices by vehicle much less than their loss data would suggest. ISO's liability symbol plan, as reported by Insurance Journal in 2004, allows surcharges "of up to 25 percent and discounts of up to 20 percent". We pass on 52% of each vehicle's liability result and keep every vehicle inside 0.80–1.25.

The 52% was the largest share that kept the middle 90% of HLDI's liability results inside ISO's band when we first chose it. It's now **frozen** in `assumptions.json`, so adding vehicles can't move it silently; each build reports what the check would give today. It's *our judgment*, and the range allows 26%–79%. We looked for a public insurer liability symbol table (SERFF filings, the Massachusetts residual market manual) and didn't find one. Massachusetts' vehicle rating groups apply to physical damage only.

**Matching a car to HLDI's rows.**

- **Body style:** we use the plain row (four doors, no convertible, hatchback, wagon, or coupe) unless the trim names a body. A Mustang uses the coupe row, a Civic sedan the sedan row, a Cayenne Coupe the coupe row.
- **Trim names:** a more specific HLDI name wins when the trim contains it. The "BMW M" model's "M4 Coupe" trim uses HLDI's M4 rows, a "911 Turbo S Cabriolet" the 911 Turbo convertible.
- **Drive and cab:** when HLDI lists several versions, we match the drive when we know it and take the middle value of the rest.
- **Powertrain:** electric and plug-in cars only match electric and plug-in HLDI rows. A hybrid with no hybrid row of its own uses the regular model's row.

**Not in the table?** We use an HLDI class average, with the same calibration, and widen the range. The class is chosen in this order:

1. An electric car uses the middle of the electric models we keep in its class, when there are enough of them (a Porsche Macan Electric is priced like other electric small SUVs, not like a gas Macan).
2. A two-door or convertible from a luxury make uses HLDI's sports-car average.
3. Other luxury makes use HLDI's luxury class averages. These are the 24 makes HLDI mostly files as luxury or sports cars; `vehicle-families.json` lists them with the counts.
4. Everyone else uses the regular class.

EPA calls some hatchbacks "large cars" because it measures interior room, while HLDI measures size by footprint and weight, so we use HLDI's midsize-car average for EPA large cars. Which HLDI class stands in for which EPA class is our judgment. Luxury class averages get a wider range (the middle 80% of luxury cars around their class, not the middle half).

**Don't know the car at all?** We treat it as average and widen the range more (even more for a luxury make).

We keep HLDI rows for 187 popular, teen-friendly, and luxury or sports model families (387 of the 685 rows HLDI publishes), listed in `vehicle-families.json`.

**Switching HLDI off.** The per-model rows are one file (`sources/hldi-2022-24.csv`) behind one switch (`useHldiModels` in `vehicle-families.json`). Turn it off or delete the file and every vehicle uses its class average. The calibration can't be fitted without the model rows, so HLDI's class results are then used as they are and the luxury term is off. The class averages come from HLDI's 34 published class subtotals (`sources/hldi-class-subtotals-2022-24.csv`). Delete that too and every vehicle is "not recognized", with a wide range. Nothing about drivers or coverage changes either way. The tests cover both.

### The range

- **Starting from a typical price instead of your own**: how far companies' prices sit from the middle company for the same driver, car, and place, in all five state surveys with many profiles. The middle half of companies are within about 21% less to +27%. *From public prices.*
- **Moving a typical price forward to today**: 5 points either way around the price index. *Our estimate.*
- **How closely real prices follow our vehicle factors**: the lowest and highest of California's price ÷ our model across the 12 calibration cars (12% less to +17%). *Rough.*
- **Luxury and electric cars**: up to 28% higher, from the biggest miss when each luxury car is left out of the calibration. *Rough.*
- **Using a class average**, **a luxury class average**, and **vehicle not recognized**: how far HLDI's models sit from their class average, or from the all-vehicle average. *Rough.*
- **The liability weight**: how much the liability part would move if the weight were at the edge of its range.
- A partly matched trim, a trim sold in more than one version, and moving between states: *our estimates*.

## Worked example: 15 cars, a parent and a teen

A 45-year-old and a 16-year-old in suburban Illinois, clean record, 7,500–15,000 miles a year, no discounts, full coverage (100/300/100) with a $1,000 deductible, 2024 models. The starting point is Illinois's typical price, moved forward to today.

The typical price stands for a 40–64-year-old in a suburb, on an average car as old as the insured fleet. S&P Global Mobility put the average US car at 12.5 years old in 2023, which sits on the line between our 8–12 and 13-plus bands. NAIC's collision and comprehensive averages only count cars that carry those coverages, which are newer, so we use 8–12. The 4–7 band is also plausible for cars with collision coverage. Using it would lower a new car's typical-start estimate by about 7%, which is inside the typical start's range (21% less to +27% before anything else is added). A 2024 model is newer than either, so its damage part costs more than the typical price's.

"Liability" and "Damage" are the vehicle's calibrated factors for each part of the premium (1.00 = average vehicle). Figures are the likely yearly price, with the range in brackets. The last column is the whole household's policy after adding a 16-year-old to the 45-year-old's policy on that car: the increase, and the new total. Reproduce with `npx tsx scripts/example-table.ts`; a test checks this table matches.

Starting point: Illinois's average full-coverage cost in 2023 was $1,257, according to the National Association of Insurance Commissioners (NAIC). Car insurance prices nationally have risen about 18% since then (government price index, August 2026), so we start from about $1,490.

| 2024 vehicle | HLDI row used | Liability | Damage | 45-year-old | 16-year-old, own policy | Adding a 16-year-old to the 45-year-old's policy |
| --- | --- | --- | --- | --- | --- | --- |
| Tesla Model Y Long Range AWD | Tesla Model Y electric 4dr 4WD | 0.89 | 1.90 | $2,351 ($1,568–$3,403) | $6,748 ($4,392–$10,490) | +$1,552 (policy $3,903, $2,494–$5,778) |
| Toyota RAV4 | Toyota RAV4 4dr | 0.94 | 0.87 | $1,540 ($1,135–$2,057) | $4,421 ($3,169–$6,494) | +$1,017 (policy $2,557, $1,796–$3,524) |
| Honda CR-V FWD | Honda CR-V 4dr | 0.86 | 0.84 | $1,447 ($1,044–$1,958) | $4,152 ($2,917–$6,151) | +$955 (policy $2,402, $1,655–$3,348) |
| Honda Civic 4Dr | Honda Civic | 1.17 | 1.04 | $1,879 ($1,381–$2,512) | $5,391 ($3,855–$7,924) | +$1,239 (policy $3,118, $2,185–$4,302) |
| Toyota Camry | Toyota Camry; Toyota Camry 4WD | 1.09 | 1.06 | $1,823 ($1,340–$2,645) | $5,232 ($3,743–$8,148) | +$1,203 (policy $3,026, $2,122–$4,489) |
| Toyota Corolla | Toyota Corolla | 1.14 | 0.99 | $1,811 ($1,333–$2,420) | $5,196 ($3,720–$7,634) | +$1,195 (policy $3,006, $2,110–$4,145) |
| Ford F150 Pickup 4WD | Ford F-150 4WD; Ford F-150 SuperCab 4WD; Ford F-150 SuperCrew 4WD | 0.94 | 0.94 | $1,596 ($1,173–$2,134) | $4,581 ($3,277–$6,733) | +$1,054 (policy $2,650, $1,858–$3,655) |
| Chevrolet Silverado 4WD | Chevrolet Silverado 1500 4WD; Chevrolet Silverado 1500 crew cab 4WD; Chevrolet Silverado 1500 ext. cab 4WD | 1.05 | 0.92 | $1,674 ($1,235–$2,234) | $4,805 ($3,449–$7,055) | +$1,105 (policy $2,779, $1,955–$3,828) |
| Jeep Wrangler 2dr 4WD | Jeep Wrangler 2dr convertible 4WD | 1.10 | 0.74 | $1,564 ($1,159–$2,084) | $4,488 ($3,234–$6,582) | +$1,032 (policy $2,596, $1,833–$3,571) |
| Subaru Outback AWD | Subaru Outback 4WD with EyeSight | 0.80 | 0.87 | $1,419 ($1,032–$1,905) | $4,073 ($2,884–$6,004) | +$937 (policy $2,356, $1,636–$3,262) |
| Ford Mustang | Ford Mustang 2dr | 1.09 | 1.12 | $1,878 ($1,379–$2,726) | $5,389 ($3,850–$8,395) | +$1,239 (policy $3,117, $2,183–$4,626) |
| Tesla Model 3 Long Range AWD | Tesla Model 3 electric 4dr 4WD | 0.94 | 1.95 | $2,436 ($1,626–$3,525) | $6,990 ($4,555–$10,863) | +$1,607 (policy $4,043, $2,587–$5,983) |
| Honda Accord | Honda Accord | 1.13 | 1.00 | $1,806 ($1,329–$2,413) | $5,183 ($3,712–$7,615) | +$1,192 (policy $2,998, $2,104–$4,134) |
| Toyota Tacoma 2WD | Toyota Tacoma double cab pickup | 0.96 | 0.94 | $1,611 ($1,185–$2,153) | $4,624 ($3,310–$6,795) | +$1,063 (policy $2,674, $1,876–$3,687) |
| Kia Soul | Kia Soul | 1.16 | 0.93 | $1,773 ($1,306–$2,368) | $5,088 ($3,646–$7,474) | +$1,170 (policy $2,943, $2,067–$4,057) |

What it shows:

- Teslas and other expensive cars cost more to repair and are worth more, so their damage factor is high. A Model Y comes out about 30% above an Accord for the 45-year-old, and its range reaches about 88% above.
- Civics, Camrys, Corollas, and Souls have more liability claims than average in HLDI's data. We pass on only half of that.
- The Mustang and Camry ranges reach higher than their neighbours', because their repair losses are above the mainstream cars we checked against real prices.
- SUVs and trucks with low repair costs are the cheapest.
- A teen on their own policy costs about 2.9 times the parent. Adding the teen to the parent's policy raises the household's premium by about two-thirds.

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

- **HLDI (IIHS).** The IIHS copyright page says: "The content on this website is made available for limited noncommercial, educational and personal use only; a user may download content to share with others for limited noncommercial and educational purposes without requesting specific permission." It also says: "Repetitive noncommercial, educational, or personal use and copying or redistribution in any manner for commercial use is not permitted without written permission from the Institute." Requests go to legal@iihs.org, and the page lists what to include: which content, the project, the audience, how it's distributed and for how long, and whether you charge (we don't). A table kept in a public repository for years probably counts as repetitive use, so the safe step is to **ask**. If the answer is no, switch HLDI off as described above.
- **North Dakota.** The Department's disclaimer grants "permission to copy and distribute the information for non-commercial use, as long as the content remains unaltered." We copy the figures unaltered (six-month figures are kept as printed in each locator). The site footer reads "Copyright © 2025 North Dakota Insurance & Securities Department".
- **Oklahoma.** The page footer reads "© 2026 The State of Oklahoma". We found no terms specific to the rate comparison.
- **California** pages carry "Copyright © California Department of Insurance". We fetched 36 more survey pages (the 12 calibration cars in 3 places) the same way a visitor would, two seconds apart. **Colorado** pages carry a general copyright line; **Texas** and **DC** carry none for the data. None of them has terms that restrict using the figures that we could find.
- **NAIC.** The report is copyrighted; we use two countrywide figures with credit, the same way `data/state-baselines` does.
- **Insurance Information Institute.** We use eight ISO figures from one table, with attribution. The same page marks its NAIC tables "Further reprint or distribution strictly prohibited without written permission of NAIC". We use none of those.
- **Insurance Journal** and **S&P Global Mobility.** We keep a number or two and one quoted sentence from each, with a link.
- **BLS.** U.S. government work, public domain.
- **North Carolina SDIP** is a public statement of a state rule.

## For the people building the page

The engine is in `src/lib/factor-engine.ts`. What the page needs to do:

1. **Pass the vehicle's facts.** Call `vehicleFacts(catalog, { year, make, model, trim })` from `src/lib/catalog-class.ts` and pass the result as `vehicle` (to `estimate`, `compareVehicles`, `whatIf`, `teenAddedToPolicy`, or `runFactorEngine`). Without it the engine only has the name and can't use the catalog's EPA class and powertrain.
2. **Remove the teen checkbox.** The engine ignores `teen`; the 16–18 age band is the teen factor. For drivers 16–18, offer two choices:
   - **"Their own policy"**: the default.
   - **"Add to my policy"**: call `teenAddedToPolicy(start, parentScenario, { vehicle })`, where `start` is the household's policy now (their premium, or `typicalStart(parentScenario, { teenOnParentPolicy: true })`). Show its `headline`, which reads like "Adding your teen to your policy: about +$1,190 a year on a policy that costs $1,810 now." Say it's the whole household's policy. Don't use it in the car comparison table; `compareVehicles` throws if you try.
   - Show `rangeNote`; it already explains which one you're seeing.
3. **Starting point.**
   - If the visitor enters a premium, use `{ annual, scenario, vehicle, kind: "yours" }`. It's never adjusted for price changes.
   - Otherwise use `typicalStart(scenario)`. It returns the state's NAIC figure moved forward by the price index, with the scenario it stands for. Show its `attribution` sentence ("Illinois's average full-coverage cost in 2023 was $1,257 (NAIC). Car insurance prices nationally have risen about 18% since then (government price index, August 2026), so we start from about $1,490.") and `TYPICAL_START_ATTRIBUTION`.
4. **Moving states** uses the NAIC state figures automatically. Pass `stateAnnual: {}` only to turn that off.
5. **Show `summary` and `rangeNote`** as written. `whatIf(...).headline` is the one-line answer ("Switching to a 2025 Tesla Model Y: about +$X a year.").
6. **"Here's how we got this"**: `publishedFactorGroups()` returns every factor with `change` ("+29%", "8% less"), `range`, `confidence` (plain words for the kind), `sources`, and `derivation`.

## How to improve a factor

Spot something wrong, or know a better source? Here's how to help.

1. **Find a public source.** The best ones are state insurance-department rate comparisons that show many companies' prices for the same driver, with one thing changed: the same driver at two deductibles, or with and without an accident. Official state rules and insurer rate filings (public in many states) are great too. Please avoid ranking sites and blogs: we need the original.
2. **Save the numbers.** Add a CSV under `sources/` with one row per published figure and a `locator` column that says exactly where it is (page, table, row, column, or the exact web request). Convert six-month figures to yearly, and keep the printed figure in the locator. Please don't commit the PDF itself; link to it instead.
3. **Add it to `sources/sources.json`** with the URL, data year, the date you checked it, and any terms of use you found. A test fails if a source file isn't listed there or isn't used.
4. **Derive it** in `src/lib/factor-derivation.ts`. If it replaces an estimate, delete that entry from `assumptions.json` (the build stops if a factor is both).
5. **Run** `npm run factors:build` and `npm test`. The tests check that every sourced factor names a real source and says how it was worked out, and that every estimate says so and widens the range.

If you can't code, that's fine. Open an issue with the link and the page number, and someone will take it from there.
