# PRD: The teen driver plan

Status: draft, November 15, 2026.

Confidence tags: **[V]** checked against a primary source, **[L]** credible secondary source, **[U]** unverified.

## 1. Summary

Adding a 16-year-old is the biggest insurance shock most families ever see, and it's a core question for the site: the calculator has an "Add a new 16-year-old driver" preset, a guide on what adding a teen costs, and a list of the cheapest cars to insure for a teen. Today, all of that answers one question: *how much will it go up this year?*

Families actually face a multi-year plan with real choices: which car the teen drives, whether that car carries full coverage, which discounts to ask about, and how quickly the cost comes down as the teen gains experience. And once they have a number, they hit a dead end. We don't refer anyone to an agent or insurer, so the site leaves them to work out on their own what to do next.

This PRD turns the teen estimate into a **plan**:

1. **Compare household setups side by side**: e.g. the teen on the family's newer car with full coverage vs. an older car with liability only.
2. **See the cost over four years**, as the teen goes from 16 to 20, not just year one.
3. **Leave with a checklist of questions to ask your agent or insurer**, built from the setups and discounts the family just looked at. This checklist is a reusable component; later, other results (a new car, a move) can use it too.

Nothing changes about the site's rules: no quotes, no referrals, no insurer names, nothing leaving the browser.

## 2. Who it's for

- *"Our son turns 16 in March. What will the next four years cost us?"*
- *"Is it cheaper to buy a $6,000 used car for her, or have her drive our CR-V?"*
- *"Should we drop collision on the old car once she's driving it?"*
- *"What discounts should we be asking about?"*
- *"Does it really get cheaper at 18? At 20?"*

Parents of 15- to 17-year-olds, usually planning months ahead (permit, then license). Teens themselves, using the existing compare-cars flow ("show my 15-year-old what 15 different cars would cost to insure").

## 3. Goals and non-goals

### Goals
1. Let a family compare two or three household setups for adding a teen, with a sourced range for each and the difference between them.
2. Show a year-by-year view from the first year of driving through about age 20, with each year's source and confidence.
3. Give every family a printable, shareable checklist of questions to ask their insurer, tied to what they compared.
4. Be honest where insurers differ, especially on which car a teen is rated on.

### Non-goals
- **No insurer names, rankings, or referrals.** The checklist tells families what to ask, not whom to call.
- **No promise that a setup works with every insurer.** Many insurers rate the youngest driver on the most expensive car to insure, or on a car of their choosing, regardless of who drives it; rules vary by insurer and state [L]. We show the range of outcomes, not a guaranteed saving.
- **No advice on how much coverage to buy.** Setups are what-ifs. Dropping collision is shown as a cost difference along with what it means ("if she wrecks it, you pay for the repairs"), never recommended.
- **No telematics app integration.** We can mention that usage-based programs exist and what to ask about them, but we don't connect to any.

## 4. Experience

### Where it lives
- A **teen plan** view, reached from the existing "Add a new 16-year-old driver" preset and from `/guides/adding-a-teen-driver`. Working name: `/teen-plan`.
- Links from `/guides/cheapest-cars-to-insure-for-teens` and each car page's "Adding a 16-year-old" section ("Plan the next four years with this car").

### Step 1: Your household today
Start from what the family already has, as the calculator does today: your current premium (or the state's typical price), and the car or cars on the policy. Up to three household cars; each one is a car the site already knows (vehicle catalog plus HLDI data), with its coverage level.

### Step 2: Setups to compare (up to 3)
Each setup answers "which car will the teen mainly drive, and how is that car covered?"

| Setup | Example |
|---|---|
| A | Teen drives the family's 2021 Honda CR-V, full coverage |
| B | Buy a 2014 Toyota Corolla for the teen, liability only |
| C | Buy a 2018 Mazda3, full coverage |

For each setup, the result shows **two numbers when it matters**: the cost if the insurer rates the teen on the car they drive, and the cost if it rates them on the household's most expensive car to insure. When those are the same (one car, or the teen's car is the priciest), we show one.

Illustrative figures:

> **Setup B: about $1,900 more a year (roughly $1,500–$2,500).** If your insurer rates your teen on the CR-V instead of the Corolla, it's closer to $2,300 more. Insurers decide this differently, so ask yours (it's on your checklist).

### Step 3: The next four years
A small chart and table per setup: years 1 through 4 of driving, with the yearly cost and the total. Each year shows its basis label ("From published prices", "Our best guess") and a note on what drives the drop: age, years licensed, and a clean record. The note also says plainly that an accident or ticket resets much of it.

Optional toggles with their own labels and ranges: good student, driver's ed, away at college without a car (distant student), and a usage-based program.

### Step 4: Questions to ask your insurer
A checklist generated from what the family looked at. For example:

- "Which car will you rate our teen on? Can we assign them to the Corolla?"
- "Do you offer a good-student discount? What grades or test scores count, and how often do you need proof?"
- "Is there a discount for a driver's ed course? Which courses qualify?"
- "If she goes to college more than 100 miles away without a car, is there a discount?" (shown if relevant)
- "What would it cost to drop collision and comprehensive on the Corolla?"
- "Do you have a usage-based (app or plug-in) program, and can it raise our price as well as lower it?"
- "When will the surcharge for a new driver start to come down?"

Printable, copyable, and shareable via a link that carries only bands and car names (no dollar amounts, as share links work today). The checklist component takes a list of "question items" from any result, so the car-change and move results can reuse it later.

## 5. Model

### What exists today
- Age bands 16–18, 19–21, 22–25 with sourced or rough factors; years licensed counted from age 26 (`src/lib/scenario.ts`, `data/factors/README.md`).
- "Adding a 16–18-year-old to a parent's policy (whole household)": 1.66 (1.43–1.95), rough, from California's family profiles [V, repo].
- Good student 0.92 and driver training 0.95, both "Our estimate" [V, repo].
- `compareVehicles` refuses to compare cars for a household-with-teen estimate, because the engine prices one car per policy (`src/lib/factor-engine.ts`).

### What's new

**1. A household with more than one car.** Model a household premium as the sum of per-car premiums, where each car's premium depends on its own car factors and coverage, and on the highest-risk driver assigned to it. Two assignment rules, both computed:
- *Assigned:* the teen is rated on the car they mainly drive.
- *Highest-rated car:* the teen is rated on the household car with the highest factor.

The difference between them becomes part of the explanation, not hidden in the range. **This is the biggest engine change in the PRD.** Build it as a household layer on top of the existing single-car engine, not a rewrite.

Sources to look for in M0: state rate surveys that price multi-car households with a youthful driver (California's married-with-teen profiles are the closest today), and filed rating rules on driver-to-vehicle assignment (SERFF, offline reading only, nothing copied). Until then, the per-car split is "Our best guess" and labeled that way.

**2. A year-by-year age curve, 16 to 20.** Today's bands are three years wide. Candidate sources: Oklahoma's survey (ages 16 and 21 [V, repo]), Texas (18), and any state survey that prices single ages. California's family profile with a 17-year-old isn't an age point: California doesn't allow age as a rating factor, so it measures years licensed (`data/factors/assumptions.md`). Interpolate between sourced points and label the in-between years "Worked out from public data." Years licensed for under-26 drivers needs its own look: some surveys separate age from experience, most don't.

**3. Discounts.**

| Discount | Today | Plan |
|---|---|---|
| Good student | 0.92, our estimate | Look for state surveys or filed rules; some states require it to be offered [U] |
| Driver training | 0.95, our estimate | Same; several states mandate a driver's ed discount [U] |
| Distant student | none | New; "Our best guess" with a wide range |
| Usage-based program | none | Explanation and checklist only, no price. Programs can raise prices as well as lower them [L]. |

**4. Dropping collision and comprehensive on an older car.** Already supported through coverage levels ("Liability only, solid limits"). The plan shows it per car, with the car's age.

### Ranges
Same rules as today: each changed factor adds its spread, and assumed items widen the range. A four-year total adds up four yearly ranges, which assumes the years move together (a conservative, wider total). Say so.

## 6. Data and rights
No new outside data is required to ship a first version. Everything new starts as "Our best guess" and gets better as M0 research finds sources. New state surveys follow the existing format in `data/factors/sources/`. SERFF filings are offline reading only.

## 7. Privacy
Unchanged. Household cars and setups live in this browser (`useStoredValue`, new key `notaquote.teen-plan.v1`). Share links carry bands, car names, and setup choices, never dollar amounts. The agent API can add a `teen-plan` endpoint later with the same banded inputs.

## 8. Architecture
- **Household layer:** a new module (e.g. `src/lib/household.ts`) that calls the existing engine once per car and applies the assignment rule. Keep `compareVehicles`' refusal for the single-car path; the household layer is the right way to compare teen setups.
- **Age curve:** extend the age factor group with single-year cells for 16–20, derived in `src/lib/factor-derivation.ts` with the same median and spread rules.
- **Checklist component:** `src/components/ask-your-insurer.tsx`, taking `{ id, question, why, shownWhen }` items. Teen items live in the teen module; other features add their own.
- **Copy:** follows `docs/VOICE.md`. Reassuring, never scary: "This is the most expensive stretch, and it gets better."

## 9. Measuring success
- **Model:** sourced share of the age curve (goal: years 16, 17, 18, and 21 sourced); validation of household totals against family-with-teen profiles that weren't used to build the factors (held-out California profiles, or another state's family profiles): within the range at least 80% of the time (a proposal, to revisit).
- **Use:** page views of the teen plan and the guide; checklist prints and copies, counted only if the existing path-only analytics can count them without recording inputs. If not, don't count them.
- **Qualitative:** "Suggest a fix" issues and messages from parents.

## 10. Milestones

| | Milestone | Done when |
|---|---|---|
| T0 | Research | Single-age survey points collected; assignment-rule evidence summarized; discount sources searched. |
| T1 | Checklist | Reusable component shipped on the existing teen result, with the questions that don't need new math. **Ship this first: it fixes the dead end on its own.** |
| T2 | Age curve | Year-by-year factors and the four-year view for a single car. |
| T3 | Household | Multi-car household layer, setups A/B/C, both assignment outcomes. |
| T4 | Launch | `/teen-plan`, guide and car-page links, tests, CHANGELOG. |

## 11. Risks and open questions
- **Assignment rules** are the biggest uncertainty and the biggest lever. Showing both outcomes is honest, but the gap may be large. Explain it plainly.
- **Year-by-year data** may be sparse; the in-between years will lean on interpolation.
- **Families may read the checklist as advice.** Each question has a one-line "why we're asking," and nothing says "do this."
- **Teens' data:** nothing about the teen is stored beyond an age band in this browser, and nothing is sent.

## 12. Acceptance criteria
- [ ] The checklist component renders on the existing teen result, prints cleanly, and copies as plain text.
- [ ] Every year in the four-year view has a basis label and source link.
- [ ] Where the two assignment rules give different results, both appear, with the explanation.
- [ ] No insurer names, no dollar amounts in share links, no inputs in analytics.
- [ ] Tests:
  - household totals equal the sum of per-car estimates
  - the assignment rule changes only the car the teen is rated on
  - the range widens with assumed items
  - the four-year total equals the sum of the years
  - plain-language guard on new copy
