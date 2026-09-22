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
| `ca-2026` | Automobile Premium Survey. About 45 companies, Los Angeles, Irvine, and Alturas. Single drivers by years licensed, record, and mileage; married households, one with a teen. | California Dept. of Insurance | Jan 2026 rates |
| `co-2023` | Premium Comparison Report. 68 companies, 6 places from Denver to Craig. | Colorado Division of Insurance | 2022–2023 |
| `nc-sdip-2026` | Safe Driver Incentive Plan: the surcharge North Carolina insurers add per insurance point. | North Carolina Dept. of Insurance | current |
| `naic-auto-db-2022-2023` | Average liability and combined premiums, countrywide, 2023 (the same report as our state starting points). | NAIC | 2023 |
| `iso-via-iii-2024` | Claim frequency and average claim cost by coverage, 2024 (ISO data). | Insurance Information Institute | 2024 |
| `iso-symbols-2004` | How far ISO's vehicle liability symbols move a premium (+25% at most, 20% less at most). | Insurance Journal, reporting ISO | 2004 |
| `hldi-2022-24` | Insurance losses by make and model, 100 = average vehicle. | Highway Loss Data Institute (IIHS-HLDI) | 2022–24 models |

Every row in `sources/` keeps a `locator`: where you'll find it in the original (page, table, row, and column, or the exact web request), plus the printed figure when we converted it. Oklahoma, North Dakota, DC, and Colorado print six-month premiums, which we doubled. `sources/sources.json` has the URLs, check dates, and the terms of use we found. `sources/README.md` lists the quirks in each file, and which companies we left out and why.

## Each factor, and how we got it

The exact numbers, counts, and percentiles are in `src/data/model-factors.json` next to each factor, in its `derivation` field.

| Factor | Value | Range | Kind | Where it comes from |
| --- | --- | --- | --- | --- |
| Age 16–18, own policy | 2.87 | 2.57–3.81 | From public prices | Texas: age 18 ÷ 30, then × the 26–39 factor |
| Age 16–18, added to a parent's policy | 1.51 | 1.30–1.77 | Rough | California: family with a 17-year-old ÷ family without one |
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
| How much of a vehicle's liability losses we pass on | 52% | 26%–79% | Our estimate | Fitted to ISO's +25% / 20% less band |

### Driver age

- **40–64** is the starting point.
- **26–39**: Oklahoma, age 36 ÷ age 55. Both married, same commute, mileage, car, and coverage, so age is the only difference.
- **22–25**: DC, age 25 ÷ age 39 (same company, same household type), times the 26–39 factor, because 39 falls in that band. DC's profiles are minimum coverage only.
- **65+**: the middle of DC's age 66 ÷ 39 and Texas's age 65 ÷ 30, times the 26–39 factor.
- **19–21**: Oklahoma, age 21 (single) ÷ age 55 (married). *Rough*, because marital status differs too.
- **16–18**: Texas, age 18 ÷ age 30 for the same single driver, car, ZIP, and credit, for men and women, times the 26–39 factor. Texas's site shows ages as bands (16–24, 25–64, 65+); the department's data call asks companies to rate them at 18, 30, and 65, and we read the bands that way. Texas's figures are liability only. Oklahoma's 16-year-old costs about 4.5 times its 55-year-old, but those two also differ in marital status, how they use the car, and mileage.

### Teens: their own policy, or added to yours

Both surveys above price a teen who is **the only driver on their own policy**, and that's what the estimate does unless you ask otherwise. Whenever the driver is 16–21, the page says so: "This prices your teen as the only driver on their own policy. Adding a teen to a parent's policy usually costs less than this."

For the more common case, **adding a teen to a parent's policy**, California publishes one useful pair: a married couple with a 17-year-old (profile 2565) and a younger married couple without one (profile 2555), both full coverage on two family cars. Same company, same place, the household with the teen costs a median 51% more (middle half of companies +30% to +77%, 235 comparisons). The engine offers this as `teenOnParentPolicy`. It's *rough*: the two households also differ in the parents' years of experience, the second car (a Highlander versus a Sienna), and mileage, the teen "drives pleasure use only", and both are two-car households. A household with one car might see a bigger jump. We'd love a cleaner source. Help wanted.

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

**What kind of vehicle is it?** We read the EPA size class and powertrain that the government's own FuelEconomy.gov file lists for each trim (see `data/catalog/`). A Range Rover is a "Standard Sport Utility Vehicle 4WD", not a pickup. The Ioniq is a hybrid car and the Ioniq 5 is an electric SUV. Some trim names are sold as both gas and hybrid (61 of them, like the 2024 Honda CR-V FWD). We price the gas one unless the name says hybrid, and widen the range. We only fall back to the words in the name when the catalog has nothing.

**How much does it cost to insure?** The Highway Loss Data Institute publishes, for each vehicle, how its insurance losses compare with the average vehicle (100). A collision result of 134 means collision claims cost 34% more than average. HLDI adjusts these for the driver's age, gender, marital status, and state (and collision and comprehensive for the deductible), so they're about the car, not who usually drives it. That's why we can combine them with the driver factors without counting anything twice.

We use them like this:

- **Damage to your own car**: collision and comprehensive results move the damage part of the premium **in full**, weighted 71/29.
- **Damage and injuries you cause**: property-damage and bodily-injury liability results move the liability part, weighted 43/57, but **only partly**. Insurers move liability prices by vehicle much less than their loss data would suggest. ISO's liability symbol plan, as reported by Insurance Journal in 2004, allows surcharges "of up to 25 percent and discounts of up to 20 percent". HLDI's liability results for the models we keep span much wider (the middle 90% run from 38% less to +40%). So we pass on 52% of each vehicle's liability result: the largest share that keeps that middle 90% inside ISO's band. We also keep every vehicle inside the band (0.80–1.25). The weight is *our judgment*, fitted to ISO's band, and the range allows 26%–79%.
- **Body style**: when HLDI lists several bodies, we use the plain one (four doors, no convertible, hatchback, or wagon) unless the trim names a body. A Mustang uses HLDI's coupe row, not the convertible. A Civic sedan uses the sedan row, not the hatchback. A Wrangler 2-door uses the 2-door row.
- **Drive and cab**: when HLDI lists several versions (2WD and 4WD, cab styles), we match the drive when we know it and take the middle value of the rest.
- **Powertrain**: electric and plug-in cars only match electric and plug-in HLDI rows. A hybrid with no hybrid row of its own (mild hybrids, for example) uses the regular model's row.
- **Not in the table?** We use HLDI's average for the class (small SUV, full-size pickup, and so on) and widen the range.
  - Luxury makes use HLDI's luxury and sports-car class averages: the 24 makes that HLDI mostly files as luxury or sports (`vehicle-families.json` lists them with the counts).
  - Electric small and midsize SUVs use the middle of the electric models we keep in that class.
  - EPA calls some hatchbacks "large cars" because it measures interior room, while HLDI measures size by footprint and weight, so we use HLDI's midsize-car average for EPA large cars.
  - Which HLDI class stands in for which EPA class is our judgment.
- **Don't know the car at all?** We treat it as average and widen the range more (even more for a luxury make).

How closely an insurer's own vehicle rating follows HLDI losses is *our estimate* (about ±8%). Losses are for 2022–24 models; for other model years we widen the range.

We keep HLDI rows for 155 popular and teen-friendly model families (328 of the 685 rows HLDI publishes), listed in `vehicle-families.json`. For the biggest brands, about 4 in 5 of the 2024 trims in our catalog match an exact HLDI model.

**Switching HLDI off.** The per-model rows are one file (`sources/hldi-2022-24.csv`) behind one switch (`useHldiModels` in `vehicle-families.json`). Turn it off or delete the file and every vehicle uses its class average. The class averages come from HLDI's 34 published class subtotals (`sources/hldi-class-subtotals-2022-24.csv`). Delete that too and every vehicle is "not recognized", with a wide range. Nothing about drivers or coverage changes either way. The tests cover both.

### The range

- **Starting from a typical price instead of your own**: how far companies' prices sit from the middle company for the same driver, car, and place, in all five state surveys with many profiles. The middle half of companies are within about 21% less to +27%. *From public prices.*
- **Using a class average**, **a luxury class average**, and **vehicle not recognized**: how far HLDI's models sit from their class average, or from the all-vehicle average. *Rough.*
- **The liability weight**: how much the liability part would move if the weight were at the edge of its range.
- A partly matched trim, a trim sold as gas and hybrid, moving between states, and how closely insurers follow HLDI: *our estimates*.

## Worked example: 15 cars, a parent and a teen

A 45-year-old and a 16-year-old in suburban Illinois, clean record, 7,500–15,000 miles a year, no discounts, full coverage (100/300/100) with a $1,000 deductible, 2024 models. The starting point is Illinois's typical price, **$1,257 a year** (NAIC combined average premium, 2023, which stands for a 40–64-year-old in a suburb on an average car). Dollar figures scale with the starting point: from $1,900, every figure would be about 1.51 times higher. Reproduce with `npx tsx scripts/example-table.ts`.

"Liability" and "Damage" are the vehicle's factors for each part of the premium (1.00 = average vehicle). Figures are the likely yearly price, with the range in brackets.

| 2024 vehicle | HLDI row used | Liability | Damage | 45-year-old | 16-year-old, own policy | 16-year-old, added to a parent's policy |
| --- | --- | --- | --- | --- | --- | --- |
| Tesla Model Y Long Range AWD | Tesla Model Y electric 4dr 4WD | 0.89 | 1.25 | $1,342 ($1,038–$1,722) | $3,851 ($2,891–$5,517) | $2,026 ($1,488–$2,697) |
| Toyota RAV4 | Toyota RAV4 4dr | 0.94 | 0.69 | $1,031 ($799–$1,322) | $2,959 ($2,224–$4,238) | $1,557 ($1,145–$2,072) |
| Honda CR-V FWD | Honda CR-V 4dr | 0.86 | 0.64 | $946 ($716–$1,232) | $2,715 ($1,997–$3,925) | $1,428 ($1,028–$1,925) |
| Honda Civic 4Dr | Honda Civic | 1.17 | 1.11 | $1,437 ($1,110–$1,845) | $4,125 ($3,091–$5,914) | $2,170 ($1,591–$2,891) |
| Toyota Camry | Toyota Camry; Camry 4WD | 1.09 | 1.18 | $1,422 ($1,101–$1,823) | $4,081 ($3,066–$5,846) | $2,147 ($1,578–$2,857) |
| Toyota Corolla | Toyota Corolla | 1.14 | 0.98 | $1,336 ($1,032–$1,715) | $3,836 ($2,876–$5,498) | $2,018 ($1,480–$2,688) |
| Ford F-150 Pickup 4WD | F-150 4WD; SuperCab 4WD; SuperCrew 4WD | 0.94 | 0.84 | $1,119 ($867–$1,435) | $3,211 ($2,413–$4,599) | $1,690 ($1,242–$2,248) |
| Chevrolet Silverado 4WD | Silverado 1500 4WD; crew cab 4WD; ext. cab 4WD | 1.05 | 0.81 | $1,170 ($907–$1,500) | $3,358 ($2,525–$4,809) | $1,767 ($1,299–$2,351) |
| Jeep Wrangler 2dr 4WD | Jeep Wrangler 2dr convertible 4WD | 1.10 | 0.46 | $983 ($760–$1,262) | $2,822 ($2,117–$4,044) | $1,485 ($1,090–$1,977) |
| Subaru Outback AWD | Subaru Outback 4WD with EyeSight | 0.80 | 0.69 | $941 ($720–$1,213) | $2,700 ($2,007–$3,880) | $1,421 ($1,034–$1,899) |
| Ford Mustang | Ford Mustang 2dr | 1.09 | 1.36 | $1,539 ($1,192–$1,973) | $4,418 ($3,320–$6,328) | $2,324 ($1,708–$3,092) |
| Tesla Model 3 Long Range AWD | Tesla Model 3 electric 4dr 4WD | 0.94 | 1.36 | $1,441 ($1,117–$1,847) | $4,137 ($3,111–$5,925) | $2,176 ($1,600–$2,895) |
| Honda Accord | Honda Accord | 1.13 | 1.01 | $1,345 ($1,040–$1,726) | $3,860 ($2,896–$5,531) | $2,031 ($1,491–$2,704) |
| Toyota Tacoma 2WD | Toyota Tacoma double cab pickup | 0.96 | 0.84 | $1,131 ($877–$1,450) | $3,245 ($2,440–$4,647) | $1,707 ($1,255–$2,271) |
| Kia Soul | Kia Soul | 1.16 | 0.83 | $1,254 ($968–$1,611) | $3,598 ($2,694–$5,159) | $1,893 ($1,387–$2,522) |

What it shows:

- Teslas cost more to repair (collision), so their damage factor is high.
- Civics, Camrys, Corollas, and Souls have more liability claims than average in HLDI's data, even after HLDI adjusts for the driver. Passing on only half of that keeps them in a believable place, but for a 45-year-old a Model Y still lands a little below a Civic or Camry, and a Model 3 about level with a Civic.
- The Mustang coupe, with high collision losses, is the most expensive car here.
- SUVs and trucks with low repair costs are the cheapest.

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
- **California and Colorado** pages carry a general copyright line; **Texas** and **DC** carry none for the data. None of them has terms that restrict using the figures that we could find.
- **NAIC.** The report is copyrighted; we use two countrywide figures with credit, the same way `data/state-baselines` does.
- **Insurance Information Institute.** We use eight ISO figures from one table, with attribution. The same page marks its NAIC tables "Further reprint or distribution strictly prohibited without written permission of NAIC". We use none of those.
- **Insurance Journal.** We keep two numbers and one quoted sentence, with a link.
- **North Carolina SDIP** is a public statement of a state rule.

## For the people building the page

The engine is in `src/lib/factor-engine.ts`. What the page needs to do:

1. **Pass the vehicle's facts.** Call `vehicleFacts(catalog, { year, make, model, trim })` from `src/lib/catalog-class.ts` and pass the result as `vehicle` (to `estimate`, `compareVehicles`, `whatIf`, or `runFactorEngine`). Without it the engine only has the name and can't use the catalog's EPA class and powertrain.
2. **Remove the teen checkbox.** The engine ignores `teen`; the 16–18 age band is the teen factor. Offer "Add to my policy" versus "Their own policy" for drivers 16–18 and pass `teenOnParentPolicy: true` for the first. Show `rangeNote`; it already explains which one you're seeing.
3. **Starting point.** If the visitor enters a premium, use `{ annual, scenario, vehicle, kind: "yours" }`. Otherwise use `typicalStart(scenario)`, which returns Illinois's (or any state's) NAIC figure with the scenario it stands for. Show `TYPICAL_START_ATTRIBUTION` next to it.
4. **Moving states** uses the NAIC state figures automatically. Pass `stateAnnual: {}` only to turn that off.
5. **Show `summary` and `rangeNote`** as written. `whatIf(...).headline` is the one-line answer ("Switching to a 2025 Tesla Model Y: about +$280 a year.").
6. **"Here's how we got this"**: `publishedFactorGroups()` returns every factor with `change` ("+29%", "8% less"), `range`, `confidence` (plain words for the kind), `sources`, and `derivation`.

## How to improve a factor

Spot something wrong, or know a better source? Here's how to help.

1. **Find a public source.** The best ones are state insurance-department rate comparisons that show many companies' prices for the same driver, with one thing changed: the same driver at two deductibles, or with and without an accident. Official state rules and insurer rate filings (public in many states) are great too. Please avoid ranking sites and blogs: we need the original.
2. **Save the numbers.** Add a CSV under `sources/` with one row per published figure and a `locator` column that says exactly where it is (page, table, row, column, or the exact web request). Convert six-month figures to yearly, and keep the printed figure in the locator. Please don't commit the PDF itself; link to it instead.
3. **Add it to `sources/sources.json`** with the URL, data year, the date you checked it, and any terms of use you found. A test fails if a source file isn't listed there or isn't used.
4. **Derive it** in `src/lib/factor-derivation.ts`. If it replaces an estimate, delete that entry from `assumptions.json` (the build stops if a factor is both).
5. **Run** `npm run factors:build` and `npm test`. The tests check that every sourced factor names a real source and says how it was worked out, and that every estimate says so and widens the range.

If you can't code, that's fine. Open an issue with the link and the page number, and someone will take it from there.
