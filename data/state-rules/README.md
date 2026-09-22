# State minimum rules

Every state (and DC) sets the least car insurance you're allowed to drive with. This folder holds those minimums for all 50 states and DC, each with a link to the law or government page it came from and the date we checked it.

- `state-rules.json` is the table the site reads. Edit this one to fix a row.
- `evidence.json` has a short quote from each source, so you can check a figure without re-reading a whole statute.
- `src/lib/state-rules.ts` loads the table and refuses to start if a row is malformed (a dollar figure without a source, a URL that isn't `https`, a flag value it doesn't know).

Version `state-rules-2026-09-22`, checked 22 September 2026.

## What's in a row

| Field | What it means |
| --- | --- |
| `biPerPerson`, `biPerAccident` | Bodily-injury liability: what your policy pays for injuries you cause, per person and per accident. |
| `pd` | Property-damage liability: what your policy pays for other people's property. |
| `combinedSingleLimit` | Some states also accept one combined limit instead of the three split amounts. Recorded when the law names one. |
| `insuranceRequired` | `false` only for New Hampshire, where most drivers don't have to buy a policy. |
| `pipRequired`, `umRequired`, `uimRequired`, `medPayRequired` | Whether a **minimum** policy has to include personal injury protection, uninsured motorist, underinsured motorist, or medical payments coverage. See the flag values below. |
| `pipAmount`, `umLimits` | Plain-text details, such as "$10,000 per person". |
| `noFault` | `true` where your own PIP pays first and your right to sue for smaller injuries is limited. `"choice"` where you pick (Kentucky, New Jersey, Pennsylvania, DC). The site shows `"choice"` as "Your choice". |
| `noFaultDefault` | Only for `"choice"` states: `true` if no-fault applies when you don't pick, `false` if ordinary fault rules do, `null` if we haven't confirmed. `null` on every other row. |
| `effective` | Effective dates and recent changes. |
| `scheduledChanges` | Laws already passed that take effect later, each with a `from` date, the new figures, a summary, and a source. See "Scheduled changes" below. |
| `sources` | Label and link for each source. The first one is the best source for the dollar limits. |
| `checkedOn` | The day someone last read the sources. |
| `note` | One to three plain sentences shown to visitors. |
| `goodToKnow` | A helpful caveat that isn't a gap in our research, such as an exemption or how a "choice" state works. The Sources page shows it as "Good to know". |
| `uncertain` | Anything we couldn't confirm from a primary source. Read this before trusting a flag. The Sources page shows it under each state as "What we couldn't confirm". |

Flag values:

- `true`: you must carry it.
- `false`: a minimum policy doesn't have to include it. Your insurer may still have to offer it.
- `"required-unless-written-rejection"` or `"required-unless-written-deletion"`: it comes with your policy unless you turn it down in writing. The two differ only in the statute's wording.
- `"required-unless-rejected"`: it comes with your policy unless you turn it down, and the statute doesn't say the first rejection has to be in writing. Insurers usually ask for a signed form anyway. (Alabama UM and UIM, Montana UM, Wyoming UM, Wisconsin medical payments.)
- `null`: we couldn't confirm it from a primary source yet.

Credit fields (`creditBucket`, `creditFactor`) are fixed at "unreviewed" and 1.00 on every row. We don't ask about credit.

## How rows were checked

1. **Primary sources only.** A state legislature's statute page, a session law, or a state insurance department, DMV, or revenue department page. We didn't use insurer blogs, law-firm pages, Wikipedia, or national summary tables.
2. **Read the actual words.** Every dollar figure was matched against the literal text of its source, not a summary. Most pages were fetched and searched directly. Pages that block scripts (Hawaii, New Hampshire, New Mexico, Pennsylvania, Alabama, Indiana, and others) were read in a real browser.
3. **A second pass.** After the first research pass, the limits for every row were re-checked against the first-listed source (or the state agency page when the statute site wouldn't load). An independent review then spot-checked 22 rows against their primary sources and found no mismatches. The quotes in `evidence.json` come from this work.
4. **When in doubt, leave it blank.** If a figure or flag couldn't be confirmed from a primary source, it's `null` and the row's `uncertain` field says why.

## Where things stand

- **51 of 51 rows have a primary source and a check date.** Arkansas is only partly verified: its limits are confirmed on the Arkansas Insurance Department's FAQ, but its statute text was only seen in search excerpts (see "Known gaps").
- **50 of 51 rows have all three liability figures.** Florida is the exception on purpose: Florida doesn't make most drivers carry bodily-injury liability, so those two fields are blank and the note explains why.
- **Blank values:** Georgia uninsured and underinsured motorist (see below), Tennessee underinsured motorist, and New Jersey's no-fault default (which lawsuit option applies if you don't choose). The calculator says "We haven't confirmed whether ... is included" for a blank coverage instead of skipping it.

## Judgment calls

These are the places where a careful reader could reasonably disagree. If you know better, please open an issue.

- **Michigan.** A Michigan policy defaults to $250,000/$500,000 for injuries. You can sign a state form to drop to $50,000/$100,000, and that's the lowest you can buy, so the row records 50/100. The $10,000 property-damage figure is still in the statute, but damage your car does to property inside Michigan is paid by property protection insurance (up to $1 million). The older 20/40/10 figures still appear in a separate financial-responsibility statute. We don't use them because you can't buy a policy that low.
- **New Jersey.** The row records the Standard Policy minimums (35/70/25 for policies issued or renewed on or after 1 January 2026). New Jersey also allows a much thinner Basic Policy. The note says so.
- **New Hampshire.** Most drivers don't have to buy insurance, so `insuranceRequired` is `false`. The dollar figures are what a policy must include if you do buy one (and what the state can require after a crash or violation).
- **Florida uninsured motorist.** Florida's UM law applies only to policies that include bodily-injury liability. A minimum Florida policy (PIP plus property damage) doesn't, so the UM flags are `false`. If you add injury liability, UM comes with it unless you reject it in writing.
- **UM that also covers underinsured drivers.** In many states the law defines "uninsured" to include underinsured drivers, so one coverage handles both. Those rows mark UIM the same as UM and explain it in `umLimits`.
- **"Not required" for PIP or medical payments** in at-fault states usually means we found no law requiring it, not that a statute says it's optional. The `uncertain` field says so where it matters.
- **Washington PIP.** The statute calls PIP "an optional coverage" that insurers must offer, and turning it down takes a written rejection. We follow the statute's word and mark it `false`. The note tells visitors about the written rejection.
- **"Choice" no-fault states.** Kentucky, New Jersey, Pennsylvania, and DC let you choose. Defaults: Kentucky puts you under no-fault unless you file a rejection (`noFaultDefault: true`). Pennsylvania presumes full tort if you don't choose (75 Pa.C.S. 1705, `false`). In DC, PIP is optional and the lawsuit limit only applies if an injured person with PIP elects PIP benefits (`false`). New Jersey's default is `null`: unofficial copies of N.J.S.A. 39:6A-8.1 say the limited right to sue applies, but we haven't read an official copy.
- **Virginia.** Minimums rose to 50/100/25 for policies effective on or after 1 January 2025. The option to pay a fee instead of buying insurance ended on 1 July 2024 (confirmed on the Virginia DMV's page; we didn't open the act itself).

## Known gaps (help wanted)

- **Arkansas (partly verified).** The limits (25/50/25) are confirmed on the Arkansas Insurance Department's Private Passenger Automobile Insurance FAQ (open "What coverages are mandatory?"), which is now the first source. The page loads its answers with JavaScript, so open it in a browser. That FAQ says you "must be offered" uninsured motorist, underinsured motorist, and PIP coverage, which is weaker than the law excerpts we read (those say uninsured motorist coverage and PIP come with the policy unless you turn them down in writing). The official Arkansas Code is only published through LexisNexis's public-access site, which blocks direct links behind a captcha. Those links are labeled "(Lexis public access, search for the section)": they open the code's front page, and you search for the section number. The PIP and uninsured-motorist statute quotes come from search-result excerpts, so the full sections weren't seen.
- **Georgia UM.** The official Georgia code is also only on LexisNexis. Unofficial copies say uninsured motorist coverage is included unless you reject it in writing, but we don't cite unofficial copies, so the flags are blank. The 25/50/25 limits come from the state insurance department's page.
- **Tennessee.** The limits are confirmed on the Department of Revenue's page. The T.C.A. 56-7-1201 link is Lexis public access (search for the section). The 2022 public chapter that raised them (and names the $65,000 combined limit) blocks scripts, so its quote comes from a browser read during the first pass. Whether Tennessee's UM definition covers underinsured drivers wasn't confirmed, so UIM is blank.
- **Mississippi and New Mexico.** The official code sites wouldn't load for us. Figures come from the state insurance department or MVD pages, plus legislature bill documents that reproduce current law.
- **Colorado.** The newest statute PDF we found is the 2024 edition, so a 2025–2026 change can't be fully ruled out. None was found.
- **Massachusetts.** mass.gov blocked every request, so the UM minimum comes from the statute's cross-reference rather than the insurance department's own page.

## Scheduled changes

Some laws pass years before they take effect. Those live in each row's `scheduledChanges` list, and the Sources page shows them as "Coming ...". Right now:

- **DC:** 50/100/20 (and uninsured motorist coverage to match) for policies from 1 October 2027 (D.C. Law 26-155).
- **California:** 50/100/25 for policies issued or renewed from 1 January 2035 (Vehicle Code 16056(d)).

`src/lib/state-rules.test.ts` has a date tripwire: on the `from` date, the test "no scheduled change has taken effect without the row being updated" starts failing. To fix it, move the new figures into the row, update `effective` and `checkedOn` (and the file's `checkedOn` and `version`), then delete the entry from `scheduledChanges`.

## Fixing a row

The step-by-step guide is in [CONTRIBUTING.md](../../CONTRIBUTING.md#a-state-rule-minimum-coverage-and-required-coverages). In short: edit the row in `state-rules.json`, add a quote to `evidence.json`, set the dates, and run `npx tsx --test src/lib/state-rules.test.ts`. The tests check the shape of every row, that dates line up, and a small labeled block of pinned values for well-verified rows. Blanking a figure you can't confirm is always a valid edit.
