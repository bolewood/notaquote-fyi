/**
 * /llms.txt and /llms-full.txt: plain-text guides for AI assistants. They're
 * built from the same parameter lists, examples, and data versions the API
 * uses, so the guide can't drift from what the API accepts. The examples in
 * them are checked by src/lib/agent-api.test.ts.
 */
import {
  API_BASE,
  CACHE_CONTROL,
  COMPARE_PARAMS,
  CARS_PARAMS,
  EXAMPLES,
  HOW_TO_READ,
  PRIVACY_STATEMENT,
  SITE_ORIGIN,
  SITE_URL_NOTE,
  apiUrl,
  VERSIONS,
  WHATIF_PARAMS,
} from "./agent-api"
import { PRESET_NAMES, presetWords } from "./agent-cars"
import { DISCLAIMER } from "./copy"
import { COMPARE_LIMIT } from "./compare-list"
import { FACTOR_BUNDLE, FACTOR_FORMULA, formatDollars, publishedFactorGroups } from "./factor-engine"
import { allStateBaselines, STATE_BASELINE_ATTRIBUTION } from "./state-baselines"
import { DEFAULT_SCENARIO, STATES, stateName, type StateCode } from "./scenario"

type Spec = { name: string; values?: readonly string[]; default?: string; description: string }

const DRIVER_SPECS = COMPARE_PARAMS.filter((spec) => WHATIF_PARAMS.some((other) => other.name === spec.name)).map((spec) =>
  spec.name === "age" ? { ...spec, default: undefined } : spec,
)
const DRIVER_NAMES = new Set(DRIVER_SPECS.map((spec) => spec.name))

function url(path: string): string {
  return `${SITE_ORIGIN}${path}`
}

function paramLines(specs: readonly Spec[]): string {
  return specs
    .map((spec) => {
      const values = spec.values && spec.values.length <= 8 ? ` Values: ${spec.values.join(" | ")}.` : spec.values ? " Values: two-letter state codes (AL … WY, and DC)." : ""
      const fallback = spec.default !== undefined ? ` Default: ${spec.default}.` : ""
      return `- \`${spec.name}\`: ${spec.description}${values}${fallback}`
    })
    .join("\n")
}

/** A worked example for the most common question, kept in step with the API's own examples. */
export const TEEN_EXAMPLE = `${API_BASE}/compare?state=IL&age=16-18&policy=added&cars=popular:first-cars`
export const TEEN_EXAMPLE_MORE = `${API_BASE}/compare?state=TX&age=16-18&policy=added&cars=popular:suvs`
export const CHOICE_EXAMPLE = `${API_BASE}/compare?state=CA&age=40-64&cars=2019%20Honda%20Accord,2025%20Tesla%20Model%20Y,2025%20Toyota%20RAV4%20Hybrid`
export const STATE_EXAMPLES = [
  `${API_BASE}/whatif?state=IL&age=40-64&car=2020-toyota-camry&toState=CO`,
  `${API_BASE}/compare?state=CO&age=16-18&cars=2022-honda-civic-4dr,2022-toyota-rav4`,
  `${API_BASE}/compare?state=TX&age=16-18&cars=2022-honda-civic-4dr,2022-toyota-rav4`,
]

/** Every API path the guides use as an example, for the tests. */
export function guideExamples(): string[] {
  return [
    ...EXAMPLES.cars,
    ...EXAMPLES.compare,
    ...EXAMPLES.whatif,
    TEEN_EXAMPLE,
    TEEN_EXAMPLE_MORE,
    CHOICE_EXAMPLE,
    ...STATE_EXAMPLES,
  ]
}

export function llmsText(): string {
  return `# NotAQuote.FYI

> A free, open-source planning tool for US car insurance. It estimates what a car, a teen driver, a move, or a coverage change would do to a typical yearly bill, from public data, with every number sourced or labeled as our own estimate. It gives ranges, not quotes, and it sells nothing.

This file is for AI assistants. There's a read-only JSON API at ${url(API_BASE)} that runs the same math as the site. No key needed. Your user's browser isn't needed either: every answer below is one plain GET.

## What it is, and what it isn't

- It's a ballpark for planning. It is not a quote, and we're not an insurer, agent, or broker. Only an insurer can give a real price.
- Every estimate is a range. Real quotes can land above or below it. Show the range, not only the middle figure.
- It starts from a typical price for the state (NAIC's 2023 average for full coverage, brought up to today with the government's price index for car insurance), then adjusts for the driver, the car, the place, and the coverage.
- Each adjustment is either from a public source or labeled as our best guess, and guesses widen the range. The car adjustment comes from HLDI's insurance-claims results for that model, or the average for its kind of car when we don't have the model (\`claimsData\` says which).
- It covers insurance cost only. It knows nothing about crash-test ratings, reliability, or whether a car fits the family. Say so, and point to IIHS (https://www.iihs.org/ratings, and its list of safe used cars for teens: https://www.iihs.org/ratings/safe-vehicles-for-teens) and NHTSA (https://www.nhtsa.gov/ratings) for safety.
- Figures are for one car on the policy. With a teen added, the parent is assumed to be 40–64 with a clean record.
- There's no place to send a premium, a VIN, a ZIP code, or a name, and we turn away requests that plainly include one. Only a state, a few bands, and car names.
- Always include the model year in a car name ("2019 Honda Accord"). Without one we assume 2022, and say so.

## Recipes

### A. "Pick N cars for our teen" (cheap to insure, plus whatever else they want)

1. Price a broad list in one request. The site's list of popular first cars is built in:
   ${url(TEEN_EXAMPLE)}
   Change \`state\` to theirs. \`policy=added\` (the default for 16–18) means the teen joins a parent's policy, which is the usual case; \`policy=own\` prices the teen alone and costs much more. Add \`region=urban|suburban|rural\` if you know it. The model year defaults to 2022 (about the age of a typical first car); set \`year=\` to change it.
2. Want more choice? Price a second list and merge: \`cars=popular:suvs\`, \`cars=popular:trucks-and-fun\`, or up to ${COMPARE_LIMIT} of your own cars as ids (from ${url(`${API_BASE}/cars?q=...`)}) or names like "2021 Mazda CX-5". Every compare answer also has \`related\`: ready-to-fetch links for the other lists, the other policy choice, and other states. Here are SUVs for a teen in Texas:
   ${url(TEEN_EXAMPLE_MORE)}
   Can't build URLs? ${url("/llms-full.txt")} lists these links for every state.
3. Read \`results\`: they're sorted cheapest first by \`teenAdds.yearly\` (what adding the teen costs a year with that car). \`wholePolicy.range\` is the whole household policy's range. \`gapToCheapest\` is the gap to the cheapest car. \`why\` says what sets a car apart from the others in the list; \`whyVsAverageCar\` compares it with an average car. \`rangeNotes\` flags cars whose range reaches higher (sporty ones, pricey repairs).
4. Choose. Gaps between cars are often smaller than the ranges, so let the user's other wants decide among the cheaper ones ("not boring", room for gear, all-wheel drive). If they want something sporty, include it but say its range reaches higher.
5. Answer with, for each car: the name (\`label\`), about how much adding the teen costs a year (and a month), the whole-policy range, and one line of why. Then: where the numbers start (\`startingPoint.attribution\`), that it's not a quote (\`disclaimer\`), a suggestion to check IIHS and NHTSA safety ratings for each car, and the \`siteUrl\` so they can open the same list on the site, star favorites, and print it. ${SITE_URL_NOTE}

### B. "What if I buy X?"

${url(EXAMPLES.whatif[0])}

\`car\` is the car they have now, \`to\` is the one they're thinking about. For "X or Y?", one compare call with the current car and both choices is simpler, and it sorts them for you:

${url(CHOICE_EXAMPLE)}

In a what-if, read \`headline\`, \`difference.yearly\` (and its \`parts\`), and \`now\` and \`next\` with their ranges. Add \`state\`, \`age\`, and \`coverage\` if you know them. Other what-ifs: \`toAge=16-18&policy=added\` (adding a teen), \`toDeductible=2000\`, \`toCoverage=standard\`, \`toRegion=urban\`.

### C. "How do prices compare between states?"

- One household moving: ${url(STATE_EXAMPLES[0])}
- The same cars in two states: send the same compare request with a different \`state\`:
  ${url(STATE_EXAMPLES[1])}
  ${url(STATE_EXAMPLES[2])}

We have a typical price for all 50 states and DC. Moving between states carries its own uncertainty, which the range includes.

## Endpoints

All are GET, return JSON, and accept only the parameters listed. Names match without regard to case, dashes, or underscores. Anything left out gets the site's default, and the response echoes the full driver back (\`driver\`, with \`defaultsUsed\`).

### ${API_BASE}

The index: every endpoint, parameter, allowed value, and an example. ${url(API_BASE)}

### ${API_BASE}/cars

Find cars and their ids. Understands "2022 honda civic", "model y", "crv", "f150". With no \`q\`, returns the site's popular lists, each with a preset name you can pass to compare (${PRESET_NAMES.join(", ")}).

${paramLines(CARS_PARAMS)}

Examples:
${EXAMPLES.cars.map((path) => `- ${url(path)}`).join("\n")}

Each match has \`id\` (like "2022-honda-civic-4dr": model year, make, model, and version), \`year\`, \`make\`, \`model\`, \`trim\` (the version), \`vehicleClass\`, \`powertrain\`, \`claimsData\` ("model", "class-average", or "unknown"), \`yearsAvailable\`, and \`otherTrims\`.

### Driver parameters (compare and whatif)

${paramLines(DRIVER_SPECS)}

### ${API_BASE}/compare

Price up to ${COMPARE_LIMIT} cars for one driver, cheapest first. Takes the driver parameters (age defaults to 16-18), plus:

${paramLines(COMPARE_PARAMS.filter((spec) => !DRIVER_NAMES.has(spec.name)))}

Examples:
${EXAMPLES.compare.map((path) => `- ${url(path)}`).join("\n")}

Per car: \`rank\`, the car's details, \`resolution\` (what your input matched, with \`confidence\`: exact for an id, high for one clear match, medium when we had to choose; read \`note\` and \`alternatives\`), then either \`yearly\`, \`monthly\`, and \`range\` (own policy) or \`teenAdds\` and \`wholePolicy\` (a teen added to a parent's policy), plus \`label\` (the name to use in sentences, with the version when it matters, like "2025 Toyota RAV4 Hybrid AWD"), \`gapToCheapest\`, \`why\`, \`whyVsAverageCar\`, \`claimsData\`, \`rangeNotes\`, and \`explanation\`. For the whole answer: \`summary\` (one line, like the site's), \`startingPoint\`, \`notes\`, \`howToRead\`, \`disclaimer\`, \`sources\`, \`siteUrl\`, \`related\`, and \`versions\`.

### ${API_BASE}/whatif

What one or more changes do to a typical yearly bill, piece by piece. Takes the driver parameters for the situation now (age defaults to 40-64), plus:

${paramLines(WHATIF_PARAMS.filter((spec) => !DRIVER_NAMES.has(spec.name)))}

Examples:
${EXAMPLES.whatif.map((path) => `- ${url(path)}`).join("\n")}

Returns \`headline\`, \`mode\` ("change", "teen-added", or "teen-own"), \`now\` and \`next\` (each with \`yearly\`, \`monthly\`, and \`range\`), \`difference\` (with \`parts\`), \`startingPoint\`, \`notes\`, \`sources\`, \`siteUrl\`, and \`related\` (ready-to-fetch links: both cars side by side, adding a teen, a higher deductible, other states). For "teen-own" the teen gets a separate policy, so \`next\` is their own bill and \`difference\` is null.

## How to read and present the numbers

${HOW_TO_READ.map((line) => `- ${line}`).join("\n")}
- Every response carries the one-line disclaimer to show once: "${DISCLAIMER}"

## Errors

Errors are JSON: \`{ "error": { "status", "code", "message", "hint", ... } }\`. The \`hint\` says how to fix the request. Codes: unknown_parameter (the valid ones are listed), private_input_rejected, invalid_value (with \`allowedValues\`), missing_parameter, duplicate_parameter, too_many_cars, car_not_found (with \`unresolved\` and \`suggestions\`), request_too_long, not_found.

## Privacy

${PRIVACY_STATEMENT} Car names we can't match are never repeated back in errors. On the site itself, the math runs in the visitor's browser.

## Caching and rate

Answers depend only on the inputs and the data versions, so they're cached for a day (\`Cache-Control: ${CACHE_CONTROL}\`; errors for an hour), and CORS is open. Please keep it to about one request a second. Current versions: model ${VERSIONS.model}, factors ${VERSIONS.factors}, catalog ${VERSIONS.catalog}, state prices ${VERSIONS.stateBaselines}.

## Credit and licenses

- Code: MIT. Data we compile: CC BY 4.0; credit "NotAQuote.FYI".
- Typical state prices: National Association of Insurance Commissioners (NAIC), 2022/2023 Auto Insurance Database Report. Car claims results: Highway Loss Data Institute (HLDI). Car list: NHTSA vPIC and FuelEconomy.gov. Third-party sources keep their own terms: ${url("/data-licenses")}

## More

- How the numbers work: ${url("/methodology")} (as plain text: ${url("/llms-full.txt")})
- Every source: ${url("/sources")}
- The code and data: https://github.com/bolewood/notaquote-fyi
- The site: ${url("/")} (What-if) and ${url("/compare")} (Compare cars)
- Pages for people: one per state (${url("/states")}, like ${url("/states/ohio")}), one per popular car (${url("/cars")}, like ${url("/cars/toyota-rav4")}), and guides (${url("/guides")}). They're human-readable summaries for one typical driver; for anyone's own question, use the API above.
`
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim()
}

const SOURCES_BY_ID = new Map(FACTOR_BUNDLE.sources.map((source) => [source.id, source]))

const PRESETS = ["popular:first-cars", "popular:suvs", "popular:trucks-and-fun"] as const

/** Ready-to-fetch compare links for every state: the three lists, with a 16–18-year-old added and on their own. */
export function readyLinks(): string {
  return STATES.map((state) => {
    const lines = PRESETS.flatMap((preset) =>
      (["added", "own"] as const).map((policy) => {
        const link = apiUrl("/compare", [["state", state.code], ["age", "16-18"], ["policy", policy], ["coverage", DEFAULT_SCENARIO.coverage], ["cars", preset]])
        return `- ${presetWords(preset)}, teen ${policy === "added" ? "added to a parent's policy" : "on their own policy"}: ${link}`
      }),
    )
    return `### ${state.name} (${state.code})

${lines.join("\n")}`
  }).join("\n\n")
}

/** The methodology as markdown, generated from the factor bundle and the state prices. */
export function llmsFullText(): string {
  const groups = publishedFactorGroups()
    .map((group) => {
      const header = `### ${group.family}\n\n${group.note}`
      if (group.rows.length === 0) return header
      const rows = group.rows
        .map((row) => {
          const sources = row.sources.map((id) => SOURCES_BY_ID.get(id)?.publisher ?? id).join("; ")
          return `| ${cell(row.key)} | ${cell(row.change)} | ${cell(row.range)} | ${cell(row.confidence)}${sources ? ` (${cell(sources)})` : ""} |`
        })
        .join("\n")
      return `${header}\n\n| When | Change | Could be | Where it comes from |\n| --- | --- | --- | --- |\n${rows}`
    })
    .join("\n\n")
  const states = allStateBaselines()
    .map((row) => `| ${stateName(row.state as StateCode)} | ${row.state} | ${formatDollars(row.annual)} |`)
    .join("\n")
  const sources = FACTOR_BUNDLE.sources
    .map((source) => `- ${source.publisher}: ${source.title}. ${source.url} (checked ${source.checkedOn})`)
    .join("\n")
  return `${llmsText()}
---

# How the numbers work

Generated from the data the site runs on (factors ${FACTOR_BUNDLE.version}). The friendly version is at ${url("/methodology")}.

## The formula

${FACTOR_FORMULA}.

A typical start stands for a 40–64-year-old, licensed 10+ years, with no at-fault accidents, driving 7,500–15,000 miles a year in the suburbs, with full coverage, a $1,000 deductible, and an average car 8–12 years old. Only ratios are used, so anything the start and the estimate share cancels out. The range adds up, in quadrature, the spread of every adjustment that changed, so the more we had to guess, the wider it gets.

## Every adjustment

"Change" is measured from the row marked "Measured from here". "Could be" is how far each one could reasonably move.

${groups}

## Typical yearly price by state (before bringing it up to today)

${STATE_BASELINE_ATTRIBUTION}.

| State | Code | Average full coverage, 2023 |
| --- | --- | --- |
${states}

## Sources

${sources}

---

# Ready-to-fetch links

For assistants that can fetch a link but can't build one. Each is a compare request for a 16–18-year-old with full coverage in the suburbs, 2022 models.

${readyLinks()}
`
}
