# PRD: What we don't ask, and how much it can matter

Status: draft, November 15, 2026.

Confidence tags: **[V]** checked against a primary source or the repo's own data, **[L]** credible secondary source, **[U]** unverified.

## 1. Summary

Every estimate on the site says "your real quote could be higher or lower." This page explains why, and by how much. It covers the things insurers use that we deliberately don't ask about (credit, which insurer you pick, tickets, gaps in coverage, gender, and more), how much each one can move a price, where the law allows it, and what you can do about it.

It's a long, readable page in two parts:

1. **What moves the price.** A chart for one example driver: a horizontal bar per factor, showing how far it can push the price down and up. It responds to the state you pick: credit's bar disappears where it's banned, and the insurer spread uses that state's survey where we have one.
2. **The rules, state by state.** A Wikipedia-style reference: what each state allows insurers to use, why it matters, and the law behind it. It's there whatever state you've picked, because you might be in California today and considering a move to Texas.

The page answers the question visitors most likely have after any estimate: *"Why is my real quote so different from yours?"*

## 2. Who it's for
- *"Your estimate says $1,900. My quote was $2,800. Why?"*
- *"Does my credit score really affect my car insurance?"*
- *"We're moving from California to Texas. What changes besides the price?"*
- *"Is it legal for them to charge my son more because he's a boy?"*
- Reporters, teachers, and students who want one clear, sourced explanation.

## 3. Goals and non-goals

### Goals
1. Show, for one example driver, how much each major factor can move a price, using sourced numbers wherever they exist.
2. Say plainly where no public number exists, instead of inventing one.
3. Explain every state's rules on which factors insurers can use, with the law cited, in plain words.
4. End each factor with something practical: what you can do or ask.

### Non-goals
- **Not a calculator.** No sliders that produce "your price." The chart shows how much each thing *can* matter for an example driver, so it can't be mistaken for a quote. The calculator keeps doing estimates.
- **No new inputs to the calculator.** Credit stays out of the model, as `data/factors/assumptions.md` requires today. This page explains it instead.
- **No legal advice.** State summaries describe the rules and link the law; they don't tell anyone what applies to their policy.
- **No insurer names.**

## 4. Part 1: What moves the price

### The example driver
The site's existing example: 45 years old, clean record, full coverage, at the national typical price (about $1,950 a year today for an average car), matching the car pages' example so numbers line up across the site.

### The chart
One horizontal bar per factor, drawn from the example driver's price: the low end to the high end of what the factor can do, with a dot or tick at "typical." Each bar is labeled with its basis, using the site's existing basis wording ("From published prices", "Our best guess"), plus two new labels:

- **"We ask this one"** for factors the calculator already uses (shown for contrast, in a lighter style).
- **"No public number"** for factors insurers use but no public source measures. Drawn as an empty, outlined bar with a short note, not a guessed length.

Sorted widest first. Draft list:

| Factor | Can move the example price | Basis | Source |
|---|---|---|---|
| **Which insurer you choose** | Middle half of insurers: about 1.6× from low to high; cheapest to priciest about 4.6–4.9× | From published prices [V] | Same driver, same place, across companies: California 2026 (1.6× middle half, 4.6× extremes, 216 comparisons) and Oklahoma 2026 (1.6×, 4.9×, 50 comparisons), computed from `data/factors/sources/` on Nov. 15, 2026. Texas 2025 shows 2.2–2.6× for the middle half, but its profiles are liability-only and include more non-standard insurers; show it separately with that note. |
| **Credit-based insurance score** | Poor credit about +19%; good credit about −17% vs average | From published prices [V] | Texas 2025 sample rates, same driver, median across 180 comparisons each (`data/factors/README.md`). Zero where banned. |
| **An at-fault accident** | about +52% (range +38% to +66%) | We ask this one [V] | `data/factors/README.md` (California, Texas, North Carolina's rule) |
| **A speeding ticket** | to find | to source | North Dakota's survey has a ticket profile, combined with an accident; North Carolina's state rule assigns fixed points. Look for a clean single-ticket pair. |
| **A DUI** | to find | to source | North Carolina's rule assigns fixed points; other surveys don't price it. |
| **A gap in coverage** | to find | likely "No public number" | |
| **Gender** | to find | to source | Texas's survey prices 18-year-old men and women separately (`tx-age18`, `tx-age18_female`). Zero where banned. |
| **Marital status** | to find | to source | Oklahoma and Texas profiles differ by marital status; find a clean pair. |
| **Where in the state you live** | City vs. small town, already asked | We ask this one | existing area factor |
| **Discounts** (bundling, good student, paying in full, paperless, usage-based programs) | bundling is sourced; the rest are our estimate or "No public number" | mixed | existing factors |

The first two rows already have sourced numbers in the repo. Each "to find" row is a small research task (milestone W0). If a source isn't found, the row ships as "No public number."

### Responding to the state you pick
- A state picker at the top, defaulting to the state saved on this device, if any.
- Bars for factors **banned** in that state collapse to a line labeled "Not allowed in California." Bars for **restricted** factors get a note ("Michigan limits how credit can be used").
- Where we have that state's own survey, the insurer-spread bar uses it; otherwise it says which states it comes from.

### Tap a bar
Each bar opens a short explainer:
- what it is and why insurers use it
- where it's banned or limited (linking down to the state section)
- the source and how the number was worked out
- **what you can do:** for example, "Ask whether a defensive-driving course removes a ticket surcharge," "Ask whether your insurer re-checks credit at renewal if your score improved," "Shopping around matters more than anything else on this chart." These reuse the checklist component from the teen plan PRD.

### The insurer bar's explainer (draft)
This is the most counterintuitive finding on the page, so its explainer carries the most weight:

> **Why do insurers disagree so much?** Each company builds its own price from its own claims history, its own list of factors, and its own weights, and files it separately in each state. Companies also want different customers: one may see you as an ideal customer while another prices you high because you're not who they're looking for. They can bring in about the same money overall and still disagree a lot about any one person. In California's and Oklahoma's surveys, for the same driver in the same place, a company near the pricier end of the middle half charged about 60% more than one near the cheaper end.
>
> **What you can do:** of everything on this chart, getting quotes from three or four companies is usually the biggest thing you control.

Keep the claim to the middle half (1.6×) in the headline; mention the extremes only with the note that they include companies the example driver doesn't suit. Whether to mention state limits on pricing by how likely you are to shop around depends on W0 research.

### Static first
The chart is generated from the same data bundle as the estimates at build time, so it can't drift. It works without JavaScript as a plain table, and the state picker enhances it. A shareable image per state (the site already makes social images for state pages) gives reporters something to use.

## 5. Part 2: The rules, state by state

### Shape
A reference section further down the page, readable top to bottom like an encyclopedia entry:

1. **An introduction:** states regulate what insurers may use, the main kinds of rules (outright bans, limits, state-set systems), and why states disagree (fairness vs. predicting risk).
2. **A section per factor**: credit, gender, age and experience, marital status, education and occupation, where you live, prior insurance. Each says which states ban or limit it, with the law cited, and one or two notable stories. For example:
   - **California** doesn't let insurers price on credit or gender, and age isn't a rating factor at all. Its regulations rank three mandatory factors first: your driving record, the miles you drive, and your years of driving experience (10 CCR 2632.5) [V].
   - **Texas** allows credit, with limits, and the difference it makes is measurable in the state's own sample rates [V for the measurement].
   - **North Carolina** sets the points for accidents and tickets in state law, so every insurer applies the same surcharge [V, `src/lib/state-surveys.ts`].
3. **A full table**: one row per state and DC, with columns for credit, gender, age, other limits, and notes. Each cell links to its source, with the state picker highlighting the current state's row. Also a "compare two states" control: pick California and Texas and see the rows side by side, with a plain summary of what changes for you if you move.
4. **Sources and dates**, as on `/sources`.

### Data
Extend `data/state-rules/` rather than starting a new dataset:
- `state-rules.json` gains a `ratingFactors` object per state, e.g. `credit: "banned" | "limited" | "allowed" | null`, `gender`, `age`, `maritalStatus`, `educationOccupation`, `territory`, `priorInsurance`, each with a short note.
- `evidence.json` gains quotes from the law for each, using the existing evidence format: label, URL, `supports`, quote.
- The existing `CREDIT_BUCKET = "unreviewed"` placeholder in `src/lib/state-rules.ts` becomes the real value from this data.
- `null` means not reviewed, and the page says "not reviewed yet," never a guess.
- Same contributor path as other state rules: the existing issue form for adding or fixing a state rule.

State findings from November 2026 research are in §11. Every row is checked against the law before it ships.

## 6. Where it lives and links
- `/what-we-dont-ask` (working title; maybe "Why your quote is different"). Linked from:
  - every "Why the range is this wide" block
  - `/methodology`
  - each `/states/[state]` page ("What insurers in Texas can and can't use")
  - the disclaimer
- Each state page gets a short "Rules in this state" box drawn from the same data, linking to its row.

## 7. Voice
Follows `docs/VOICE.md`. Explains, doesn't take sides on whether credit-based pricing is fair; reports what each state decided and why people disagree. Never scary: "Credit can matter a lot where it's allowed. Here's what you can ask."

## 8. Privacy
Nothing new is collected. The state picker uses the state already stored on this device, if any. No credit, record, or gender input anywhere.

## 9. Measuring success
- The page is linked from every estimate and indexed for questions like "does credit affect car insurance in [state]."
- Corrections come in through the state-rule issue form (a sign people trust it enough to fix it).
- Every factor bar is either sourced or labeled "No public number." None is our guess dressed up as data.

## 10. Milestones

| | Milestone | Done when |
|---|---|---|
| W0 | Research | Each "to find" row sourced or marked "No public number"; state rules for credit, gender, and age checked against the law for all 51; California's factor rules confirmed. |
| W1 | Data | `ratingFactors` in `state-rules.json` with evidence; insurer-spread and factor ranges generated from the bundle; tests. |
| W2 | Page | Chart with state picker and tap-to-explain; the state-by-state section with the full table and two-state comparison; links from estimates, state pages, methodology. |
| W3 | Share | Social image per state; a CHANGELOG entry. |

## 11. State findings (research, November 2026)

Research pass of November 15, 2026. Rows marked [V] were read in the statute or regulation; [L] rows come mainly from NAIC's credit-scoring chart (MC-20, Summer 2025) and other secondary sources. **Every row is checked against the law in W0 before it goes into `state-rules.json`.** Where a factor isn't mentioned, it wasn't researched; that is not the same as "no restriction."

### Bans that change the chart
| Factor | Banned in | Notes |
|---|---|---|
| Credit | California, Hawaii, Massachusetts [V]; Michigan bans the credit score in auto rates by statute (MCL 500.2162) [V], though credit-based insurance scores reportedly still play a role [U] | Washington's regulator banned it in 2021–22; courts struck that down [L]. |
| Gender | California, Hawaii, Massachusetts, Michigan, North Carolina [V]; Pennsylvania by court decision (*Hartford v. Insurance Commissioner*, 1984) [L] | **Montana repealed its ban** effective 2022, and a court upheld that in March 2026 [L]. It's the only state found to have reversed one. |
| Age | Hawaii (age and driving experience both) [V]; North Carolina (a 55+ discount is allowed) [V]; Massachusetts (except a 65+ reduction) [V]; California: not a rating factor (years of experience instead) [V] | |

### Limits on credit (most states)
Most states follow a common package: credit can't be the only reason for a price, denial, or non-renewal; no credit history can't count against you; medical debt is excluded; scores are refreshed periodically; and you get notice of an adverse decision [L]. Notable variations [L]:
- **Idaho** caps it: the worst-credit premium can be at most 2× the best.
- **Utah** lets auto insurers use credit only to lower rates, or alongside other factors.
- **Maryland** allows it only to price a new policy, not to raise a renewal.
- **Oregon** and **Rhode Island** give you a re-rate on request; **Texas** (from Sept. 2025) re-scores every 36 months and re-rates yearly on request; **DC** gives an annual re-rate right.
- **Virginia:** current law bars counting things like medical debt in collections against you (Va. Code § 38.2-2234(D)) [V]. *Correction:* an earlier research pass said 2026's SB 693 made credit unable to be the sole basis for a rate from July 1, 2026; the bill was narrowed into a study instead [V, statute pass of Nov. 15, 2026].

### Other notable rules
- **California:** besides credit and gender, education, occupation, and homeownership aren't allowed; having no prior insurance can't by itself be held against you; 15 optional factors include marital status, which the commissioner proposed removing in October 2026 [V for the regulation, L for the proposal]. Rates need prior approval.
- **Hawaii:** marital status, race, creed, ethnicity, and disability are also banned [V].
- **Massachusetts:** marital status, occupation, income, education, homeownership, and sexual orientation banned; the state sets the driving-record point system (Safe Driver Insurance Plan) [V].
- **Michigan:** marital status, homeownership, education, occupation, and "postal zone" banned, though territories are allowed [V].
- **North Carolina:** the state rate bureau sets points for accidents and tickets (Safe Driver Incentive Plan); new drivers licensed on or after July 1, 2025 can carry an inexperience surcharge for up to 8 years [V].
- **New York:** from November 23, 2026, occupation and education can't be the sole basis for a rate [V]; press reports say homeownership and ZIP are covered too [L].
- **New Jersey:** occupation, education, or credit can't alone set your rating tier [L].
- **Pennsylvania and Texas:** no rate increase solely because a spouse died (PA 2015; TX from Sept. 2025) [L].
- **Colorado:** rules on insurers' use of outside data and algorithms extended to auto in October 2025 [L].
- **Illinois:** gains authority to review auto rates from July 1, 2027 [L].

### Teachable contrasts for the page
- **California vs. Texas:** California ranks driving record, miles, and experience first and bars credit, gender, and age; Texas allows credit with consumer protections and lets insurers file rates and use them.
- **Hawaii vs. North Carolina:** both ban age; Hawaii bans driving experience too, while North Carolina can surcharge new drivers for years.
- **Small dials:** Idaho's 2× cap, Utah's lower-only rule, Maryland's new-policy-only rule.
- **Reversals:** Montana repealed a gender ban; Washington's credit ban was struck down in court.

### Sources (compiled, to verify in W0)
- NAIC, *Use of Credit Reports/Scoring in Underwriting* (MC-20), Summer 2025: https://content.naic.org/sites/default/files/model-law-chart-mc-20-use-of-credit-reports-scoring-in-underwriting.pdf
- NAIC, *Rate Filing Methods for P/C Insurance*, Fall 2022 (hosted by the Maryland Insurance Administration): https://insurance.maryland.gov/Consumer/Documents/agencyhearings/2022%20NAIC%20Chart%20-%20rate%20filing%20methods%20for%20P%26C%20insurance%20by%20state.pdf
- 10 CCR 2632.5 (California): https://www.law.cornell.edu/regulations/california/10-CCR-2632.5
- HRS §431:10C-207 (Hawaii): https://data.capitol.hawaii.gov/hrscurrent/Vol09_Ch0431-0435H/HRS0431/HRS_0431-0010C-0207.htm
- MCL 500.2111 and 500.2162 (Michigan): https://www.legislature.mi.gov/documents/mcl/pdf/mcl-500-2111.pdf, https://www.legislature.mi.gov/documents/mcl/pdf/mcl-500-2162.pdf
- 211 CMR 79.04 (Massachusetts): https://www.law.cornell.edu/regulations/massachusetts/211-CMR-79-04
- NCGS 58-36-65 and 58-36-30 (North Carolina): https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_58/GS_58-36-65.html
- NY DFS, 11 NYCRR 154 regulatory impact statement (Oct. 2026): https://www.dfs.ny.gov/industry-guidance/regulations/proposed-insurance/rp-ins-3am-11nycrr154-sapa
- Experian, states that restrict credit-based insurance scores (Mar. 18, 2025): https://www.experian.com/blogs/ask-experian/which-states-prohibit-or-restrict-the-use-of-credit-based-insurance-scores/
- Daily Montanan (Mar. 10, 2026): https://dailymontanan.com/2026/03/10/court-oks-allowing-insurance-companies-to-set-rates-based-on-marital-status/
- Insurance Journal on New York (June 22, 2026), Illinois (Aug. 7, 2026), Washington (Oct. 11, 2021), and California's marital-status proposal (Oct. 5, 2026)

## 12. Acceptance criteria
- [ ] Every bar is sourced (with method and date) or labeled "No public number."
- [ ] Banned factors collapse for states that ban them; restricted factors carry a note.
- [ ] Every state row cell links to a source with a checked-on date, or says "not reviewed yet."
- [ ] Works as a plain table without JavaScript.
- [ ] Tests:
  - the chart's numbers match the factor bundle and survey files
  - no state's row claims a rule without evidence
  - the plain-language guard on new copy
  - the existing SEO rules for the new page
