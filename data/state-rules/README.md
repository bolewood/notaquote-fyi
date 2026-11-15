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
- **Colorado.** The minimums were checked against the 2024 statute PDF, so a 2025–2026 change can't be fully ruled out (none was found). The official 2026 edition now exists (olls.info, linked from the legislature's 2026 titles page) and the rating rules cite it, but it hasn't been compared for the minimums yet.
- **Massachusetts.** mass.gov blocked every request, so the UM minimum comes from the statute's cross-reference rather than the insurance department's own page.

## Scheduled changes

Some laws pass years before they take effect. Those live in each row's `scheduledChanges` list, and the Sources page shows them as "Coming ...". Right now:

- **DC:** 50/100/20 (and uninsured motorist coverage to match) for policies from 1 October 2027 (D.C. Law 26-155).
- **California:** 50/100/25 for policies issued or renewed from 1 January 2035 (Vehicle Code 16056(d)).

`src/lib/state-rules.test.ts` has a date tripwire: on the `from` date, the test "no scheduled change has taken effect without the row being updated" starts failing. To fix it, move the new figures into the row, update `effective` and `checkedOn` (and the file's `checkedOn` and `version`), then delete the entry from `scheduledChanges`.

## Fixing a row

The step-by-step guide is in [CONTRIBUTING.md](../../CONTRIBUTING.md#a-state-rule-minimum-coverage-and-required-coverages). In short: edit the row in `state-rules.json`, add a quote to `evidence.json`, set the dates, and run `npx tsx --test src/lib/state-rules.test.ts`. The tests check the shape of every row, that dates line up, and a small labeled block of pinned values for well-verified rows. Blanking a figure you can't confirm is always a valid edit.

## What insurers may use to set a price (`rating-rules.json`)

A separate file, because it's checked separately from the minimums above. It answers one question per state and factor: may car insurers use this to set your price? It feeds `/what-we-dont-ask` and the "What insurers can use" box on each state page.

- **Factors:** `credit`, `gender`, `age`, `maritalStatus`, `educationOccupation`, `territory`, `priorInsurance`.
- **Status:** `banned` (can't be used to set a car insurance price), `limited` (allowed with meaningful limits, for example "can't be the only reason for a higher price"), or `no-ban-found` (the quoted law expressly allows it, a law that once banned it was repealed, or, with `basis: "not-on-list"`, the state's list of banned factors leaves it out).
- **Optional `basis`:** how a `no-ban-found` answer was reached. `named` (the default when it's left out): a law names the factor and allows it, or a ban on it was repealed. `not-on-list`: the state's rating or anti-discrimination law lists what insurers can't use, and this factor isn't on that list. Use it only with `status: "no-ban-found"`, and make the `quote` that list, so a reader can see the factor isn't on it. The page lists these states on their own line, "No ban in the state's rating law", and the table says "No ban in state law" instead of "Allowed", because a list that leaves something out isn't the same as a law that says yes.
  - **The method:** find the state's rating law (often "unfairly discriminatory rates" or "classification" in the insurance code) and its anti-discrimination law. If one lists the factors insurers can't use, quote the list. Check the state's insurance department bulletins and regulations for a ban elsewhere before you settle on `not-on-list`; if you find one, that law is the source instead. If the state has no such list, leave the factor out (not reviewed) rather than guess.
- **Every entry needs** a one-sentence `summary` in plain words, a `source` (`label` and an https `url` to the law itself: a statute, regulation, or court opinion on an official site or a faithful mirror, or, with `evidence: "summary"`, the summary it rests on), and a short `quote` from that source. Add `effective` (YYYY-MM-DD) for rules that start in the future or started recently.
- **Optional `evidence`:** what the entry rests on. `law` (the default when it's left out): the statute, regulation, or court opinion itself. `summary`: a reputable summary of the law, used only when the law itself couldn't be fetched or quoted, even in a browser.
  - **What counts as a summary:** the state insurance department's own consumer pages and guides come first. A law-school or law-firm summary that names the statute is a fallback. News stories, insurer blogs, and lead-generation sites never count.
  - **NAIC material:** we don't save copies of NAIC charts or guides (the MC-20 credit chart, for example), even public PDFs, because NAIC's reprint terms bar storing them without written permission. Use them as leads only. That includes NAIC-written buyer's guides that a state department reposts.
  - **The rules don't change:** a summary entry still needs an https `source`, a short quote copied exactly from the summary, and a saved copy in `law/`, and the checker treats it like any other quote.
  - **Say whose summary it is:** the `summary` sentence names it ("..., according to the Texas Department of Insurance"), and the `status` says no more than the summary does. "Insurers may consider your age" supports `no-ban-found`, nothing stronger.
  - **Where it shows:** the page marks these answers with a dagger (†) in the tables and the comparison, with the footnote "From a summary of the law, not the law itself." The state-by-state lines and the state pages add "(from a summary)", and the page opens with a short note that it's a plain-language guide, not legal advice.
  - **No list from a summary:** `basis: "not-on-list"` can't be combined with `evidence: "summary"`. A "no ban" answer needs the state's list itself.
  - **Moving up:** when the law itself becomes readable, replace the entry's source with the law and drop `evidence`.
- **Blocked sources:** if a source's site forbids copying (Justia) or blocks fetching, search for an exact, distinctive sentence from the passage in quotes and cite another copy. Prefer, in order: an official or government copy; an openly licensed one (CourtListener, the Caselaw Access Project, law.cornell.edu); then any other copy whose terms allow reuse. Record where the copy came from in the saved copy's `mirror` and `sourceTerms`.
- **Optional `moreSources`:** a list of `{ label, url, quote }` for other laws that qualify the main one, such as an exception (California's senior-course discount) or the approved list a ban depends on. Same rules: an https link to the law and a short quote copied exactly.
- **Missing means not reviewed.** A factor that isn't listed for a state shows as "Not reviewed yet." It's never read as allowed. Don't add an entry from a secondary source (a news story, an insurer's blog, or a chart that summarizes laws); use it as a lead and quote the law.
- **Dates:** the top-level `checkedOn` and `version` (`rating-rules-YYYY-MM-DD`) move together. An entry can carry its own `checkedOn` if it was checked earlier.
- `src/lib/rating-rules.ts` checks the file when it loads, so a broken entry stops the build with a message saying what to fix.

To add or fix a state, open the state-rule issue form or a pull request with the law's link and the quote.

### Saved copies of the law (`law/`)

Every page a rule cites (each `source` and each `moreSources` item) has a saved copy of **the cited section only**, never a whole code, at `data/state-rules/law/<STATE>/<slug>.md`, for example `law/CA/cal-ins-code-1861.02.md`. Each rule's quote must be found in its copy, so `npm test` checks every quote on every pull request without going online.

- **Front matter**, one `key: "value"` per line (values are JSON strings): `url` (exactly the URL in `rating-rules.json`; that's how a rule finds its copy, and two files can't share one), `title` (the section, like `"Cal. Ins. Code § 1861.02"`), `retrieved` (YYYY-MM-DD), `fetchedWith` (`"fetch"` or `"browser"`), `site`, and, when they apply, `mirror` (the page isn't the state's own site) and `sourceTerms` (a short note on the site's terms, when it states any).
- **Body:** the section's plain text, one paragraph per line, as the site shows it.
- **Make or refresh copies** with `npm run rules:snapshot` (or `-- --state XX`). It cuts the cited section out of the page with the rules for each site in `scripts/rating-quotes/law.ts` (`SITE_RULES`); a new site needs a rule there. A copy whose text hasn't changed is left alone, and a failed fetch never overwrites or deletes a copy.
- **One page, several sections.** A copy holds one section, picked by the first label that cites its URL. When rules cite two sections of one chapter page (Texas) or one statute PDF (Colorado), give each section its own URL with a `#` fragment (`IN.544.htm#544.002`, `crs2026-title-10.pdf#10-4-628`). The fragment never reaches the server, so the link still opens the same page.
- **Consumer guides** (PDFs or web pages from an insurance department) are cut to the part we cite with `GUIDE_CUTS` in `scripts/rating-quotes/law.ts`. PDFs laid out in columns set `pdfColumns` in their site rule, so their text comes out in reading order.
- **Sites that need a browser.** California's leginfo, Hawaii's legislature, and the New York Senate sometimes answer a plain fetch with a bot check, and Texas's statutes site and Indiana's code viewer build their pages with JavaScript. (Indiana's viewer reads the whole title from a file, `iga.in.gov/ic/<year>/Title_<n>.html`, that only answers a browser's user agent; save that file and pass it with `--page`.) For those, open the page in a browser, save its HTML (in the browser's developer tools, copy `document.documentElement.outerHTML` into a file), and run `npm run rules:snapshot -- --url "<the cited URL>" --page <file>`. That copy is marked `fetchedWith: "browser"`. The repo has no headless browser on purpose, to keep the dependencies light.
- **PDFs** (Idaho's and Alabama's rules, Iowa's and Kentucky's statutes, Arkansas's act) go through `pdftotext`, from poppler (`brew install poppler` or `apt-get install poppler-utils`). Arkansas's acts print a line number in the margin of every line and a header on every page; `pdfLineNumbers` in the site rule drops them, so a quote can run across lines.
- **Character sets.** A page is read in the character set its server or a `<meta>` tag names. Nevada's and Oregon's statute pages are Windows-1252 and don't say so, so a page that isn't valid UTF-8 is read as Windows-1252.
- **Prefer the state's own site, or an openly licensed one.** A few rules cite a copy that isn't the state's own: `law.cornell.edu` for California's and Massachusetts's regulations, and the Caselaw Access Project (`static.case.law`, released under CC0 1.0, see https://case.law/terms/) for Pennsylvania's 1984 court opinion, which isn't on the court's own site. Their copies say so in `mirror`, so we can move to official copies later. Don't save copies from sites whose terms forbid reproduction (Justia's, for example).
- **Copyright and site terms are two different questions.** Under *Georgia v. Public.Resource.Org* (2020), works made by officials acting in their legislative or judicial duties, such as statutes, court opinions, and annotations a legislature writes, aren't under copyright. That doesn't settle a website's own terms of use, which can limit copying from that site, and it doesn't cover what private publishers add, such as headnotes or summaries. So we copy from official or openly licensed sources, copy only the cited section, and record each site's terms in `sourceTerms`: the terms page's address and what it allows, or the notice the page shows.

### Checking the quotes (`npm run rules:check-quotes`)

- `npm run rules:check-quotes` (offline, the default) checks every quote against its saved copy. It's the same check `npm test` runs.
- `npm run rules:check-quotes -- --live` fetches each cited page, cuts out the section the same way the snapshot script does, and compares it with the saved copy. A GitHub Action runs this once a month and opens (or comments on) an issue titled "Rating rule quotes need a look" when something needs attention.
- Add `--state XX` to check one state.
- Whitespace, curly and straight quotes, dashes, and the spacing after `§` don't count as differences. A quote with `...` passes when its pieces appear in order.
- **Results:** `OK`; `MISSING` (the quote isn't in the law's text: re-read the law and fix the entry); `NO_SNAPSHOT` (no saved copy yet: run `npm run rules:snapshot`); `CHANGED` (live only: the quote is still there, but the section's text moved, and a short diff is printed: read it, then re-save the copy if the law really changed and check the entry still holds); `FETCH_FAILED` (live only: a dead link such as a 404 or 410, a server that keeps failing after retries, a network or DNS error, or a page the site rule can no longer cut: fix the link or the rule); and `NEEDS_BROWSER` (live only: a bot check, a JavaScript-only page, or a failure excused by a browser exception, below: check it by hand, or re-save it with a browser).
- It exits non-zero on `MISSING` or `NO_SNAPSHOT` offline, and on `MISSING`, `CHANGED`, or `FETCH_FAILED` live. `NEEDS_BROWSER` is reported, never fatal.
- **Browser exceptions** (`BROWSER_EXCEPTIONS` in `scripts/rating-quotes/law.ts`) cover a page that fails a plain fetch in one known way but opens fine in a browser. Each one names an exact page URL (never a whole site; a cited `#fragment` is ignored, since it never reaches the server), the one failure it excuses (an HTTP status or a network error code), a reason, the day someone last checked the page in a browser (`lastVerified`), and an `expires` date. Any other failure on that page, or the same failure after `expires`, is `FETCH_FAILED`. To renew one, open the page in a browser, re-save it with `--page` if it changed, and move both dates. Right now there are three:
  - The Illinois statute 215 ILCS 157/20: the General Assembly's server sends an incomplete certificate chain, which Node's fetch rejects (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`).
  - The Ohio Department of Insurance's Automobile Insurance Guide: it answers our checker's user agent with a 404 page, and so does its PDF copy.
  - Connecticut's General Statutes, chapter 701 (Conn. Gen. Stat. § 38a-686): the same incomplete certificate chain as Illinois (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). Its copy was saved from the page with `--page`.
- `RATING_CHECK_TODAY=YYYY-MM-DD` sets the date the live check judges expiry by, for testing.
