# PRD: Lot mode and the listing extension

Status: draft, November 15, 2026. Two phases with separate gates: **lot mode** (a page on the site, buildable now) and a **listing extension** (later, only if data terms clearly allow it).

Confidence tags: **[V]** checked against a primary source, **[L]** credible secondary source or inference, **[U]** unverified. Research was done November 15, 2026; sources are at the end.

## 1. Summary

People check insurance after they've fallen for a car: on a listing site at night, or in a dealership office with a salesperson waiting. The site already answers "what would this car do to my bill?", but only if you come to it and type the car in.

**Phase 1, lot mode.** A page on the site, made for phones: scan the VIN barcode on a windshield or door jamb (or type it), and compare up to four cars against the car you drive now, the way `/compare` does. No app to install, and nothing to sign up for.

**Phase 2, the listing extension.** A free, open-source browser extension that, when you click it on a car listing, reads that listing's VIN and shows the same comparison in a small panel. It's gated on data terms and on whether phase 1 shows real demand.

### What research found
- **Insurance on listings already exists, but closed.** Three small extensions already show an insurance figure inside a cost-of-ownership number on car listings: FairLane, PriceTalon, and Actual Car Cost Calculator. None explains its method; one requires an account, one charges after five lookups [V]. None is open source; a search found no comparable open-source extension [U].
- **Nothing in this category is big.** No consumer car-listing extension found passes about 2,000 users, even with a company behind it [V]. Mozilla shut down Fakespot in 2025, saying it didn't fit a model it could sustain [L]. An extension is a trust signal and a demo, not a growth engine.
- **No free web app** was found that scans a VIN and compares insurance; the scanners that exist are native apps with paid upsells [U].

So the opportunity isn't "insurance on a listing." It's **the trustworthy version**: a published method, open code, no account, and nothing sent anywhere.

## 2. Who it's for
- *"I'm at the lot looking at four used SUVs. Which is cheapest to insure?"*
- *"This listing looks great. What will it do to our insurance compared with our Camry?"*
- *"Our teen is choosing between these three cars."* (Links to the teen plan.)

## 3. Goals and non-goals

### Goals
1. Scan or type up to four VINs on a phone and compare them in under a minute.
2. Start from the visitor's current car and premium, if saved on this device, so results read as "+$40 a month vs. your Camry."
3. Keep every promise the site already makes: no account, no tracking, no insurer names, no referrals.

### Non-goals
- **No automatic page reading.** The extension never runs on a page until you click it, and never reads more than the one listing you're on.
- **No affiliate codes, ads, or links to sellers or insurers**, ever. Chrome's 2025 policy requires prominent disclosure and a user action for any affiliate code [V]; we simply don't have any.
- **No Facebook Marketplace or Craigslist** in the first extension. Both ban automated data collection in their terms, and Meta won a case against a browser extension that collected data from logged-in Facebook pages (Meta v. BrandTotal, 2022) [L].
- **No native app.**

## 4. Phase 1: Lot mode

### Experience
- `/lot` (working name). One big "Scan a VIN" button, a "type it instead" field, and up to four slots.
- Each scanned car is decoded and matched to the site's catalog. Then the familiar comparison appears: your current car vs. each candidate, monthly and yearly change, range, and "why" (HLDI loss results in plain words).
- "Where's the VIN?" help: windshield, driver's door jamb, window sticker. Notes that some labels can't be scanned and typing works fine.

### How scanning works
- **Native first:** the browser's `BarcodeDetector` works in Chrome on Android and Samsung Internet. It's turned off by default in Safari, including on iPhone, and isn't in Firefox [V].
- **Fallback:** the MIT-licensed `barcode-detector` polyfill, built on zxing-cpp WebAssembly, which reads Code 39, Code 128, Data Matrix, and QR [V]. **Self-host its `.wasm` file**; by default it loads from a public CDN [V].
- **Symbologies:** VIN labels on door jambs and windshields are mostly Code 39, with some Code 128; some manufacturers use Data Matrix [L]. Window-sticker QR codes usually link to marketing pages, not the VIN [L].
- **Camera:** video frames are processed on the phone and never stored or sent. The page says so next to the camera view.
- **VIN check:** validate the check digit locally before decoding, so a misread is caught right away.

### Privacy
VIN decoding goes from the visitor's browser to NHTSA's vPIC service, as the site's VIN lookup does today, and the page says so ("Your browser asks NHTSA, a U.S. government agency, what car this VIN is. We don't see it."). Everything else follows the existing rules: candidates stored only on this device, share links with car names only.

### Follow-on: fuel cost
The vehicle catalog already comes from FuelEconomy.gov, but the site drops fuel figures today. Lot mode is the natural place to add "and about $X a month in fuel, at today's national average price," with its own source. This is a separate, small decision; it widens the site from insurance to cost of ownership.

## 5. Phase 2: The listing extension

### Gate
Build only when:
1. **Data terms clearly cover it.** The extension shows figures built from HLDI loss results and NAIC state averages on other companies' web pages. Confirm in writing with each data provider that their terms cover this, whether the extension bundles the data or fetches estimates from the site's API. Until confirmed, don't build it.
2. **Phase 1 shows demand.** For example, lot mode is used regularly and people ask for listings support (in issues or messages).

### Design (if the gate passes)
- **Chrome and Firefox first.** Safari later; Apple's App Store Connect can now package a web extension from a ZIP without a Mac, but it still needs a paid developer account and App Store review [V].
- **Permissions: `activeTab` and `scripting` only.** No content scripts that run automatically, no broad host access. Chrome warns users about broad host permissions, and review takes longer for them [V]. Actual Car Cost Calculator uses this click-to-run pattern [V].
- **Reading the VIN:** structured data that sites already publish. Autotrader, Carvana, CarMax, and CarGurus put the VIN in schema.org JSON-LD (`vehicleIdentificationNumber`) on the pages checked; Cars.com uses a `data-vin` attribute and shows it in visible text [V, one sample page each, Nov. 15, 2026]. Fall back to "paste the VIN."
- **Computing:** in the extension, from the same engine and data bundle as the site (or the site's banded API, depending on what the data terms allow). Nothing about the visitor is sent.
- **Showing:** a small panel the extension opens, not text injected into the listing itself. This keeps us from modifying the site's content, which some terms prohibit (CarGurus bars anyone who would "modify the Site Content") [V].
- **Store listing:** "Does not collect data," open-source link, and a single purpose, matching Chrome's July 2026 policy that data collection must be strictly necessary to an extension's single, disclosed purpose [V].

### Listing-site terms (read, not legal advice)
Cars.com, Autotrader, CarGurus, Facebook, and Craigslist all prohibit systematic or automated data extraction [V]. None mentions extensions a person uses on one page. A click-to-run tool that reads the page you're looking at, computes on your device, and sends nothing is the most defensible design [L]. No case against a pure display overlay of that kind was found [U]. Have counsel read the design before publishing.

## 6. Measuring success
- Lot mode page views and repeat use (path-only analytics; no counting of scans if that would need event tracking we don't do).
- Share of scans that fall back to typing (from user reports and testing, not tracking): tells us whether scanning works well enough.
- For the extension, if built: store installs and ratings, which are public.

## 7. Milestones

| | Milestone | Done when |
|---|---|---|
| L0 | Scanning spike | Native and polyfill scanning tested on recent iPhones and Android phones against real door-jamb and windshield labels; misread rate noted. |
| L1 | Lot mode | `/lot` with scan, type, check digit, catalog match, compare against your car. |
| L2 | Fuel cost (optional) | Decision made; if yes, fuel figures added with source. |
| X0 | **Extension gate** | Data terms confirmed in writing; demand signal met. |
| X1 | Extension v1 | Chrome and Firefox, click-to-run, JSON-LD and `data-vin` reading, panel UI, open source. |
| X2 | Safari | If X1 is used. |

## 8. Risks
- **Data terms** are the main risk for the extension, and the reason it's gated.
- **Breakage:** listing sites change their markup often. JSON-LD is more stable than page layout, and "paste the VIN" always works.
- **Low adoption** is likely for the extension. That's acceptable if it's cheap to maintain and earns trust; it's not acceptable if it drains time from the core site.
- **Scanning reliability** on iPhones depends on the polyfill; typing must always be one tap away.

## 9. Acceptance criteria
- [ ] Lot mode works on current iPhone Safari and Android Chrome, with typing as a fallback.
- [ ] No camera frames, VINs, or results leave the device except the VIN decode request to NHTSA, which the page discloses.
- [ ] The barcode WebAssembly file is self-hosted; content security policy allows no new third-party origins except NHTSA.
- [ ] Extension (if built): `activeTab` + `scripting` only, no automatic content scripts, no network requests except those disclosed, source published, store listing says "does not collect data."

## Sources (accessed November 15, 2026)
- Chrome Web Store listings: FairLane https://chromewebstore.google.com/detail/mcleceonkfpabimikomncodahbklojcm, PriceTalon https://chromewebstore.google.com/detail/fomgkappdkjkabibmpfhleicgonldnap, Actual Car Cost Calculator https://chromewebstore.google.com/detail/fgemojheaafagapgnlhnimmicnniijek, iSeeCars https://chromewebstore.google.com/detail/iopiohfikdmghocogoenjpblfhahgick
- Chrome Web Store policies: affiliate ads https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads; 2026 policy update https://developer.chrome.com/blog/cws-policy-updates-2026; permissions https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions; review process https://developer.chrome.com/docs/webstore/review-process
- Fakespot shutdown (secondary): https://www.macrumors.com/2025/05/22/mozilla-pocket-discontinued/
- Terms: Cars.com https://www.cars.com/about/terms/; Autotrader https://www.autotrader.com/legal/visitor-agreement; CarGurus https://www.cargurus.com/about/terms-of-use; Facebook https://www.facebook.com/terms.php; Craigslist https://www.craigslist.org/about/terms.of.use
- Meta v. BrandTotal (secondary): https://www.courthousenews.com/judge-rules-brandtotals-data-harvesting-violates-metas-terms-of-use-and-anti-hacking-laws/
- Safari web extension packaging: https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect; Firefox signing: https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/
- BarcodeDetector support: https://caniuse.com/mdn-api_barcodedetector; MDN: https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector; barcode-detector polyfill: https://cdn.jsdelivr.net/npm/barcode-detector@3.1.3/README.md
- VIN barcode formats (vendor sources): https://www.dynamsoft.com/blog/imaging/barcode/scanning-vin-codes-barcode-reader/
