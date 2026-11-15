# PRD: Policy reader and the rate commons

Status: draft, November 15, 2026. Two parts with separate gates: the **policy reader** (browser only) and the **rate commons** (opt-in contributions, published only as aggregate tables).

Confidence tags: **[V]** checked against a primary source, **[L]** credible secondary source or inference, **[U]** unverified. Research for this PRD was done November 15, 2026; sources are at the end.

## 1. Summary

The site's best answers start from what you already pay. Today that means typing your premium and describing your car and drivers by hand. Most people have the answer sitting in their email: their policy's declarations page, the summary of who and what is covered and what it costs.

**Part 1, the policy reader.** Drop in your declarations page (PDF). The browser reads it right there, shows you what it found, lets you fix anything, and fills in the calculator. Nothing is uploaded. The page shows you, step by step, what it's doing, and works with your Wi-Fi off.

**Part 2, the rate commons.** After the reader shows what it found, you choose:

- **(a) Use it for today only.** It stays in this tab and is gone when you close it.
- **(b) Use it today, and add an anonymous summary to the rate commons.** You see the exact, coarsened summary before anything is sent (for example: Texas, a 2019–2021 midsize SUV, a driver aged 40–64, full coverage, a $500–$1,000 deductible, $1,500–$1,750 a year). We publish only tables that combine many people's summaries, never anyone's single record.

Over time, the commons gives everyone something no public source has today: what real households actually pay, by state and kind of car, published openly. No open, crowdsourced auto-premium dataset was found in research; the published "real premium" figures come from companies' own quote data [L].

### The design bar
Both parts should pass a privacy audit of the kind The Markup runs. Its Blacklight tool loads pages in a fresh browser and records network requests and browser API calls. It tests for third-party cookies, ad trackers, session recorders, keystroke capture (it types into fields without submitting and watches whether the values leave the page), canvas fingerprinting, and the Meta, Google remarketing, X, and TikTok pixels [V]. A reporter reviewing this feature would also watch the network while a PDF is read, and look at whether any claim we make can actually be checked [L].

## 2. Who it's for
- *"I don't know what half these numbers on my policy mean."*
- *"Is what I pay normal for my car and my state?"*
- *"I just want to try the what-ifs without typing everything in."*
- People who'd like to help make the site's numbers better, without giving up their privacy.

## 3. Goals and non-goals

### Goals
1. Read a typical digital declarations page in the browser and fill the calculator in under a minute, with every field shown for review.
2. Prove, not just promise, that nothing leaves the browser in session-only mode: an on-page activity log, a strict content security policy, and a documented Wi-Fi-off demo.
3. Explain where you stand: "Your premium is inside our range" or "above our range; here's what usually explains a gap like this." Never "you're overpaying."
4. Offer a contribution path whose exact payload you see first, that publishes only aggregate tables with minimum group sizes, and whose server code is public.

### Non-goals
- **No uploads in session-only mode.** Not the file, not the text, not the extracted values.
- **No row-level public dataset.** Research found that ZIP3 + vehicle + age band + premium is very likely unique in sparse areas [V for the underlying re-identification studies; L for this combination], and that a public dataset can't meet the legal bar for "deidentified" data under California's law, which requires binding the people who receive it [V definition, L application]. Aggregate tables avoid both problems.
- **No insurer names in the commons.** The reader may show the insurer's name back to you, but it's never stored or sent. This keeps the site's rule of no insurer comparisons.
- **No VIN, names, addresses, policy numbers, or birth dates kept.** The reader drops them the moment it sees them, and the activity log says so.
- **No GitHub-issue submission by default.** It would publicly tie a contribution to a GitHub account. At most, it's a separate, clearly labeled "public and signed" option.

## 4. Experience

### Step 1: Choose a file
"Read my declarations page" opens a file picker (or drag and drop). Next to it: "Your file stays on this device. Want to check? Turn off your Wi-Fi first. It still works."

### Step 2: Watch what happens
A plain activity log, live, as the browser works. For example:

```
Opened your file on this device (3 pages)              ✓ nothing sent
Read the text on each page                             ✓ nothing sent
Found: Texas, 2020 Honda CR-V, full coverage …         ✓ nothing sent
Skipped: your name, address, policy number, VIN        ✓ not kept
```

A small "network: 0 requests since you chose a file" counter, fed by the browser's own Performance API, sits under the log. A link explains how to confirm it yourself in the browser's developer tools.

For scanned PDFs with no text layer, the log says "This looks like a scan. Reading it needs a text-recognition model (about 5–20 MB) from our own site, the first time only." It only loads after you agree. The model size estimate comes from Tesseract's published files and is unverified for our setup [U].

### Step 3: Check what we found
A form showing each field, its value, and where on the page it came from. Every field is editable, and anything we couldn't read is blank:

| Field | Example |
|---|---|
| State | Texas |
| Policy term and total premium | 6 months, $842 → about $1,684 a year |
| Each car | 2020 Honda CR-V; coverage: liability limits, collision and comprehensive deductibles |
| Each driver | Age band only (we ask you to pick it; we don't keep birth dates) |
| Discounts listed | Multi-policy, good student … |

### Step 4: Choose
- **Use for today only** (default): fills the calculator for this tab. Nothing is saved, not even in the browser's storage, unless you separately choose "remember on this device." Today the calculator saves what you type on this device automatically (`notaquote.situation.v1`, which includes your premium), so values filled by the reader must bypass that saving unless you opt in.
- **Use today and add to the rate commons**: shows the exact coarsened summary that will be sent, as plain words and as the raw data. Choosing "send" makes a single request; the log shows it happen.

### Step 5: Where you stand
"Your $1,684 a year is inside our range for this household ($1,300–$2,200)." If outside: "It's above our range. Common reasons: a recent accident or ticket on someone's record, a credit-based price in your state, a high-risk ZIP code, or extra coverage. Here's what to ask your insurer." This reuses the checklist component from the teen plan PRD.

## 5. How the reader works
- **PDF text:** PDF.js, self-hosted, version 4.2.67 or later, with `isEvalSupported: false`. Earlier versions let a malicious PDF run code (CVE-2024-4367) [V].
- **Scans:** Tesseract.js, self-hosted. Its default setup fetches its engine and language data from a public CDN; we must point `workerPath`, `corePath`, and `langPath` at our own files [V]. Load it only after you agree, as above.
- **Field extraction:** a small set of patterns per common layout (start with the five or so largest auto insurers' declarations pages, from samples contributors redact and share), plus a generic fallback that looks for labeled amounts. Unknown layouts fall back to the form, prefilled with whatever was found.
- **Car matching:** match year, make, and model text against the site's vehicle catalog. Don't decode the VIN: decoding goes to NHTSA from your browser today, which would send it off the device.
- **Memory only:** values live in component state until you choose otherwise. Nothing goes in the URL (path-only analytics would still see the path, so the reader must never put values in it), in `localStorage`, in IndexedDB, or in the console.

## 6. The rate commons

### What gets sent
Coarsened in the browser before you see it:

| Field | Coarsening |
|---|---|
| State | as is |
| Area | ZIP3 only where the ZIP3 area has more than 20,000 people, following HIPAA's Safe Harbor rule [V]; otherwise "rest of state" |
| Car | make, body type, and a three-year model-year band |
| Drivers | count, and age bands; all drivers under 21 merged into one "teen or young adult" band |
| Coverage | the site's coverage levels, deductible band |
| Premium | annualized, in $250 bands |
| Data date | month and year of the policy term |

No insurer name, timestamp finer than a week, IP address, or browser details are stored.

### Where it goes
**v1: a small open-source endpoint.** One function, code public in the repo. It validates the summary against the site's own model (rejecting impossible values), adds it to a store with no IP, cookie, or user-agent field, and returns nothing identifying. Be honest that an auditor can read this code and our hosting settings but can't verify what the hosting platform logs: Vercel, like any host, sees the request's IP address regardless of our code [L]. Document the hosting log settings and retention on `/privacy`.

**Spam and poisoning:** plausibility checks against the model, in-memory rate limits (not stored), medians and trimmed statistics, delayed batch publishing. If a challenge is needed, load Turnstile only when someone clicks "send," the way The Markup loads its donation processor only after a click [V for The Markup's pattern]. Turnstile does analyze the browser, so disclose it [L].

**v2, when volume and funding justify it: Distributed Aggregation Protocol (Prio3) through Divvi Up.** The browser splits each summary between two independent servers, so neither ever sees an individual record, and only totals over a minimum batch size come out [V]. This is the strongest privacy story available, but Divvi Up has no public pricing (paid pilots by contact), and its TypeScript client implements an older draft than the current DAP spec [V]. Oblivious HTTP relays, which would hide the IP from us entirely, are sales-gated or enterprise-only today [V]; revisit later.

**Not used:** local differential privacy (noise on each record) destroys accuracy at the volumes we'd see [L].

### What gets published
- Tables only: for example, the median and middle-half premium band for "Texas, midsize SUV, 2019–2021, one driver 40–64, full coverage."
- Each published cell needs at least **k = 20** contributions (k = 50 for any cell including a teen band), with a methodology page.
- Optional extra protection: differential-privacy noise on published counts using OpenDP, which is still labeled a work in progress by its authors [V]. Decide in C1.
- Published quarterly, as CSV under CC BY 4.0, alongside the other compiled data. Raw contributions are never released, and deleted after aggregation if the method allows recomputation without them (decide in C1).

### How the site uses it
At first, only as a check: "real households in this table paid $X–$Y," shown next to the estimate, labeled "From the rate commons (N households)." Once a cell is large and stable, it can become a factor source with the basis label "Measured from here," which the site already defines.

## 7. Legal and privacy notes (for counsel to confirm)
- The site is run by a for-profit LLC, so whether California's Consumer Privacy Act applies depends on its thresholds (revenue, number of consumers, revenue from personal information), not on the site being free [L]. Other state privacy laws have their own thresholds; check them against expected contribution volume. Aggregate consumer information is excluded from "personal information" under California's definition [V], which fits publishing only tables.
- The federal Gramm-Leach-Bliley Act's "finder" coverage is about bringing buyers and sellers together; a free estimator that refers no one is likely outside it [L]. Get counsel's sign-off before ever adding anything resembling a referral.
- A declarations page lists other household members, often teens. The consent text says so, teen ages are merged, and teen cells need a higher k.
- Update `/privacy` before part 2 launches: what's sent, what's stored, hosting log settings, retention, and how publishing works.

## 8. Audit checklist (acceptance criteria)

Session-only mode (part 1):
- [ ] No third-party requests at page load or while reading a file (fonts, CDNs included). Verified with a recorded network log (HAR) and a Blacklight scan.
- [ ] No request carries anything derived from the file, before you choose to send. On the reader page, link prefetching is off and no client-side route change happens during the flow, so no other request fires either; the developer-tools network log is the evidence, and the on-page counter is a convenience.
- [ ] Extracted values never appear in URLs, analytics, `localStorage`, IndexedDB, or the console.
- [ ] A content security policy on the reader route restricts `connect-src`, `img-src`, `form-action`, and `worker-src` to our own origin, with `'wasm-unsafe-eval'` only where the OCR needs it. These can be static headers. A strict `script-src` with nonces would force dynamic rendering (per the Next.js guide bundled with this project), so decide separately whether that's worth it for the reader page alone. PDF.js and Tesseract files are self-hosted.
- [ ] Wi-Fi-off demo documented and tested.
- [ ] PDF.js 4.2.67 or later with `isEvalSupported: false`; no VIN decoding in the reader.

Contribution mode (part 2):
- [ ] The exact payload is shown before sending; one request on "send," none otherwise.
- [ ] Endpoint code is public; hosting log settings are documented; no IP, user agent, or cookie stored; Turnstile (if used) loads only on "send."
- [ ] Published tables enforce minimum group sizes (and noise, if chosen); methodology published; raw contributions never released.
- [ ] Teen bands merged, higher minimum; household-member disclosure in the consent text.
- [ ] Privacy page commits to aggregate-only publishing and no attempts to re-identify anyone.

Before part 2 launches, invite an outside review: a privacy researcher or newsroom technologist, using this checklist.

## 9. Milestones and gates

| | Milestone | Done when |
|---|---|---|
| R0 | Samples and CSP | 10–20 redacted declarations pages from volunteers across five or more insurers; content security policy for the reader route designed and tested. |
| R1 | Reader v1 | Text-PDF reading, the activity log, the review form, calculator fill, "inside or outside our range." Audit checklist (part 1) passed. |
| R2 | Scans | Self-hosted OCR behind consent. |
| C0 | **Gate for part 2** | Privacy page draft, legal read on the consent text, decision on noise and raw-data retention. |
| C1 | Commons v1 | Endpoint, coarsening, consent screen, publishing job with minimum group sizes. Outside review done. |
| C2 | First tables | First quarterly publication once any cell reaches k; shown on the site as a check only. |
| C3 | Revisit | DAP/Prio3 and OHTTP options; using the commons as a factor source. |

## 10. Risks and open questions
- **Layouts vary.** Each insurer's declarations page looks different and changes over time. The review form is the safety net; coverage grows with contributed samples.
- **The server side can't be fully verified.** Say so plainly, publish the code and settings, and move to DAP when feasible.
- **Small samples.** Most cells may never reach k. That's fine: publish what qualifies, and say how many contributions are waiting.
- **Who contributes.** People who contribute aren't typical, so tables are labeled as contributed, not representative.
- **Trust spillover.** A mistake here would damage the whole site's privacy reputation. That's why part 2 has its own gate and an outside review.

## Sources (accessed November 15, 2026)
- The Markup, How we built a real-time privacy inspector (Blacklight; updated Feb. 6, 2026): https://themarkup.org/blacklight/2020/09/22/how-we-built-a-real-time-privacy-inspector
- The Markup privacy policy: https://themarkup.org/privacy; donations page: https://themarkup.org/donations
- The Markup, Pixel Hunt (tax-filing sites): https://themarkup.org/pixel-hunt/2022/11/22/tax-filing-websites-have-been-sending-users-financial-information-to-facebook
- PDF.js advisory CVE-2024-4367: https://github.com/advisories/GHSA-wgrm-67xf-hhpq
- Tesseract.js local installation: https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md; language data: https://github.com/naptha/tessdata
- Divvi Up: https://divviup.org/; TypeScript client: https://github.com/divviup/divviup-ts; DAP draft 19: https://datatracker.ietf.org/doc/html/draft-ietf-ppm-dap-19; Firefox deployment: https://hacks.mozilla.org/2023/10/built-for-privacy-partnering-to-deploy-oblivious-http-and-prio-in-firefox/
- OHTTP relays: https://docs.fastly.com/products/oblivious-http-relay and https://developers.cloudflare.com/ohttp-relay/
- OpenDP: https://github.com/opendp/opendp
- Sweeney, Simple Demographics Often Identify People Uniquely: https://dataprivacylab.org/projects/identifiability/paper1.pdf
- Vercel request headers and log drains: https://vercel.com/docs/headers/request-headers
- Privacy Pass: https://datatracker.ietf.org/doc/rfc9576/; Turnstile: https://blog.cloudflare.com/turnstile-private-captcha-alternative/
- Levels.fyi verification: https://levels.fyi/verified; ClearHealthCosts methodology: https://clearhealthcosts.com/methodology/
- California Civil Code §1798.140: https://california.public.law/codes/civil_code_section_1798.140
- 16 CFR 314.2 (GLBA safeguards definitions): https://www.law.cornell.edu/cfr/text/16/314.2
