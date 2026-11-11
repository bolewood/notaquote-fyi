/**
 * The words on a car page (docs/VOICE.md applies), as one plain object the
 * page renders. Keeping every visible sentence here lets the tests measure how
 * much of each page is its own, and flag pages that read like a template.
 */
import type { VehicleCatalog } from "./catalog"
import {
  aboutTheSame,
  carFigures,
  carPages,
  CLAIMS_YEARS,
  displayModel,
  trimName,
  type CarFigures,
} from "./car-pages"
import { uniqueness, type UniquenessReport } from "./uniqueness"
import { differenceWords, dollars, estimateDollars, monthlyDollars, rangeDollars, shownYearly, signedDollars } from "./format"
import { HLDI_COVERAGES, hldiReport, listWords, priceMeaning, SOFTENING_REASON, type HldiRating } from "./hldi"
import { lossPushesVsAverage } from "./pricing"
import { DESCRIPTION_MAX, SEARCH_PROMISE, TITLE_MAX } from "./site-meta"
import { ordinal } from "./state-content"

const POWERTRAIN_WORDS: Record<string, string> = {
  combustion: "gas-powered",
  hybrid: "a hybrid",
  "plug-in-hybrid": "a plug-in hybrid",
  electric: "electric",
  "fuel-cell": "a fuel-cell car",
}

function lowerFirst(text: string): string {
  return /^[A-Z]{2}/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1)
}

/** "RAV4 Prime", "Forester", "F-150 Lightning": the model name without make or parenthetical notes. */
function modelTag(f: CarFigures): string {
  return displayModel(f.page.model)
}

/**
 * "an" before vowel sounds ("an Audi Q5", "an Acura MDX", "an F-150", "an Outback");
 * "a" otherwise ("a 2024 Audi Q5", "a Honda Civic", "a Hyundai Ioniq 5", "a Utah policy").
 */
export function articleFor(phrase: string): "a" | "an" {
  const firstWord = phrase.trim().split(/[\s-]+/)[0] ?? ""
  if (/^(F|H|L|M|N|R|S|X)\d*$/i.test(firstWord) || /^(HR|MDX|NX|RDX|RX)$/i.test(firstWord)) return "an"
  if (/^(uni|use|eu|utah)/i.test(firstWord)) return "a"
  return /^[aeiou]/i.test(firstWord) ? "an" : "a"
}

/** "a small SUV", "an SUV", "a midsize car". */
export function classWords(f: CarFigures): string | null {
  const label = f.page.classLabel
  if (!label) return null
  const words = lowerFirst(label)
  return `${/^(SUV|[aeiou])/i.test(words) ? "an" : "a"} ${words}`
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? ""
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`
}

/** HLDI's "Luxury SUVs / Midsize" as "midsize luxury SUVs". */
function segmentWords(segment: string): string {
  const [kind, size] = segment.split(" / ")
  return `${(size ?? "").toLowerCase()} ${lowerFirst(kind)}`.trim()
}

function peerGroupWords(f: CarFigures): string {
  if (f.similar.basis === "segment" && f.page.segment) return segmentWords(f.page.segment)
  return f.page.classLabel ? `${lowerFirst(f.page.classLabel)}s` : "cars"
}

// ---------------------------------------------------------------------------
// Headline pieces

/** The page's heading: the question it answers. */
export function carTitle(f: CarFigures): string {
  return `How much is insurance on ${articleFor(f.page.shortName)} ${f.page.shortName}?`
}

/**
 * The title search results show: the words people search ("Ford Escape insurance cost"), then the
 * answer. The page's own heading keeps the question (carTitle).
 */
export function carSearchTitle(f: CarFigures): string {
  // The figure is for one model year: name it, so a "2008 Escape" searcher doesn't take it for theirs.
  const answer = `insurance cost: about ${estimateDollars(f.adult.likely)} a year`
  const dated = `${f.page.name} ${answer}`
  return dated.length <= TITLE_MAX ? dated : `${f.page.shortName} ${answer}`
}

function vsAverageDelta(f: CarFigures): number {
  return f.adult.likely - f.averageCar.likely
}

/** "$200 less than an average car of the same age", or "about the same as an average car of the same age". */
export function vsAverageWords(f: CarFigures): string {
  const delta = vsAverageDelta(f)
  if (aboutTheSame(delta, f.averageCar.likely)) return "about the same as an average car of the same age"
  return `${differenceWords(delta).replace(" a year", "")} than an average car of the same age`
}

/** The car's losses are close to an average car's: nothing stands out. */
export const CLOSE_TO_AVERAGE = "its losses are close to an average car's"

/**
 * Why, in one clause, in HLDI's coverages and from the car's own factors (so
 * it can't contradict the dollar gap): "because of lower crash-repair losses
 * and fewer injury claims", "higher crash-repair losses outweigh fewer injury
 * claims".
 */
export function becauseWords(f: CarFigures): string {
  const { ups, downs } = lossPushesVsAverage(f.page.relativity, true, { damage: 3, liability: 3 })
  const words = (list: { words: string }[]) => listWords(list.map((item) => item.words))
  const delta = vsAverageDelta(f)
  if (aboutTheSame(delta, f.averageCar.likely)) {
    const big = (list: { size: number }[]) => list.some((item) => item.size >= 5)
    if (big(ups) && big(downs)) return `${words(ups)} and ${words(downs)} about even out`
    return CLOSE_TO_AVERAGE
  }
  const [main, other] = delta > 0 ? [ups, downs] : [downs, ups]
  if (main.length === 0) return CLOSE_TO_AVERAGE
  if (other.length === 0) return `because of ${words(main)}`
  return `${words(main)} outweigh ${words(other)}`
}

export function carDescription(f: CarFigures): string {
  // Search snippets are short: "an average car its age" says the same thing in fewer words.
  const vs = vsAverageWords(f).replace("an average car of the same age", "an average car its age")
  const figures = `A ${f.page.name}: about ${estimateDollars(f.adult.likely)} a year for a 45-year-old`
  const teen = `Adding a teen: about ${differenceWords(f.teen.increase)}.`
  // The promise when it fits; the comparison with an average car when that fits too.
  for (const text of [`${figures}, ${vs}. ${teen} ${SEARCH_PROMISE}`, `${figures}. ${teen} ${SEARCH_PROMISE}`, `${figures}, ${vs}. ${teen}`])
    if (text.length <= DESCRIPTION_MAX) return text
  return `${figures}. ${teen}`
}

export function leadText(f: CarFigures): string {
  const because = becauseWords(f)
  const joiner = because.startsWith("because") ? ", " : ": "
  const model = modelTag(f)
  const group = peerGroupWords(f)
  const groupClause =
    f.groupRank.of >= 2 ? ` (#${f.groupRank.rank} of ${f.groupRank.of} ${group} we compare)` : ""
  return `A ${f.page.name} runs about ${estimateDollars(f.adult.likely)} a year for a typical 45-year-old, ${vsAverageWords(f)}${joiner}${because}. Putting a new 16-year-old on a family policy with the ${model} adds about ${estimateDollars(f.teen.increase)} a year${groupClause}.`
}

// ---------------------------------------------------------------------------
// Sections

/** An HLDI rating in the middle of a sentence: "better than average", "average". */
export function ratingPhrase(rating: HldiRating | null): string {
  return rating ? rating.charAt(0).toLowerCase() + rating.slice(1) : "not published by HLDI"
}

/** "By the EPA's size classes it's a small SUV, and it's gas-powered." */
export function kindText(f: CarFigures): string {
  const kind = classWords(f)
  const powerKey = f.page.facts.powertrain
  const power = powerKey ? POWERTRAIN_WORDS[powerKey] : null
  const model = modelTag(f)
  const seg = f.page.segment ? segmentWords(f.page.segment) : null
  if (powerKey === "electric") {
    return `The ${f.page.shortName} is an electric ${f.page.classLabel ? lowerFirst(f.page.classLabel) : "vehicle"}${seg ? ` that HLDI benchmarks among ${seg}` : ""}; on electric models like the ${model}, battery pack and sensor repair costs shape collision losses alongside low injury-claim frequency.`
  }
  if (powerKey === "plug-in-hybrid") {
    return `The ${f.page.shortName} is a plug-in hybrid${kind ? ` (${kind} by EPA size class)` : ""}${seg ? ` grouped by HLDI with ${seg}` : ""}, combining dual-powertrain repair costs on the ${model} with its own loss history.`
  }
  if (powerKey === "hybrid") {
    return `By EPA size class the ${f.page.shortName} is ${kind ?? "a hybrid vehicle"} with a hybrid powertrain${seg ? `, and HLDI tracks the ${model} alongside ${seg}` : ""}.`
  }
  const segment = seg ? ` In Highway Loss Data Institute loss tables, the ${f.page.shortName} is benchmarked against ${seg}.` : ""
  if (kind && power) return `In EPA size classes, the ${model} is ${kind} (${power}).${segment}`
  if (kind) return `In EPA size classes, the ${model} is ${kind}.${segment}`
  if (power) return `The ${model} is ${power}.${segment}`
  return segment.trim()
}

export function teenText(f: CarFigures): string {
  const car = f.teen.increase
  const average = f.teenAverageCar.increase
  const vs = aboutTheSame(car - average, average)
    ? "about the same as adding a teen with an average car of the same age"
    : `${differenceWords(car - average).replace(" a year", "")} than adding a teen with an average car of the same age`
  const ownTeen = f.years[0]?.teenOwn.likely
  const own = ownTeen && ownTeen > car ? ownTeen : null
  if (f.teenRank.rank <= 40) {
    const ownClause = own
      ? ` Putting that 16-year-old on a policy of their own instead costs about ${estimateDollars(own)} a year, about ${estimateDollars(own - car)} more than sharing the family policy.`
      : ""
    return `Because the ${f.page.shortName} starts from lower losses than most cars, adding a new 16-year-old driver raises the family bill by about ${estimateDollars(car)} a year (${monthlyDollars(car)} a month), ${vs}.${ownClause}`
  }
  if (f.teenRank.rank > 80) {
    const ownClause = own
      ? ` A separate policy in the 16-year-old's own name runs about ${estimateDollars(own)} a year (${estimateDollars(own - car)} more than adding them to the family policy).`
      : ""
    return `A new driver costs more with any car, and more than usual with the ${f.page.shortName}: adding a 16-year-old raises the family bill by about ${estimateDollars(car)} a year (${monthlyDollars(car)} a month), ${vs}.${ownClause}`
  }
  const ownClause = own
    ? ` A separate policy for the 16-year-old runs about ${estimateDollars(own)} a year, so keeping them on the family policy saves about ${estimateDollars(own - car)} a year.`
    : ""
  return `Adding a new 16-year-old who drives the ${f.page.shortName} raises the family bill by about ${estimateDollars(car)} a year (${monthlyDollars(car)} a month), ${vs}.${ownClause}`
}

export function teenRankText(f: CarFigures): string {
  const { rank, of } = f.teenRank
  const model = modelTag(f)
  const fromTop = of - rank + 1
  const place =
    rank === 1 ? "the cheapest" : fromTop === 1 ? "the most expensive" : rank <= of / 2 ? `${ordinal(rank)} cheapest` : `${ordinal(fromTop)} most expensive`
  const oldest = f.years.length > 1 ? f.years.at(-1)! : null
  const olderTeenClause =
    oldest && oldest.year < f.page.pick.year
      ? ` Stepping down to a used ${oldest.year} ${model} (${oldest.ageWords}) brings the teen add-on to about ${estimateDollars(oldest.teen.increase)} a year.`
      : ""
  return `For adding a teen driver, the ${f.page.shortName} ranks ${place} out of all ${of} models we track.${olderTeenClause}`
}

/** "Among these 14 small SUVs, the Toyota RAV4 is the 6th least expensive to insure." */
export function groupRankText(f: CarFigures, group: string): string {
  const { rank, of } = f.groupRank
  if (of < 2) return ""
  const fromTop = of - rank + 1
  const place =
    rank === 1
      ? "the least expensive"
      : fromTop === 1
        ? "the most expensive"
        : rank <= of / 2
          ? `the ${ordinal(rank)} least expensive`
          : `the ${ordinal(fromTop)} most expensive`
  const cheaperPeer = f.similar.cheaper[0]
  const pricierPeer = f.similar.pricier[0]
  let peerNote = ""
  if (cheaperPeer && pricierPeer) {
    peerNote = ` Right next to it are the ${cheaperPeer.shortName} (about ${estimateDollars(cheaperPeer.likely)} a year) and the ${pricierPeer.shortName} (about ${estimateDollars(pricierPeer.likely)}).`
  } else if (cheaperPeer) {
    peerNote = ` Just below it is the ${cheaperPeer.shortName}, at about ${estimateDollars(cheaperPeer.likely)} a year.`
  } else if (pricierPeer) {
    peerNote = ` Next up is the ${pricierPeer.shortName}, at about ${estimateDollars(pricierPeer.likely)} a year.`
  }
  return `Among these ${of} ${group}, the ${f.page.shortName} is ${place} to insure.${peerNote}`
}

/** The versions of the model, when their prices differ: a sentence and one row per distinct price. */
export function trimsSummary(f: CarFigures): { text: string; rows: { trim: string; price: string }[] } | null {
  const trims = f.trims
  const name = `${f.page.pick.year} ${f.page.shortName}`
  if (trims.length < 2) {
    if (trims.length === 1) {
      return {
        text: `For the ${name}, our catalog lists the ${trims[0].trim} configuration at about ${estimateDollars(trims[0].likely)} a year.`,
        rows: [],
      }
    }
    return null
  }
  const first = trims[0]
  const last = trims.at(-1)!
  if (aboutTheSame(last.likely - first.likely, first.likely)) {
    return {
      text: `All ${trims.length} versions of the ${name} in our catalog (${joinWords(trims.map((trim) => trim.trim))}) price within about $50 a year of each other.`,
      rows: [],
    }
  }
  const rows: { trim: string; price: string }[] = []
  for (const trim of trims) {
    const price = `about ${estimateDollars(trim.likely)}`
    const same = rows.find((row) => row.price === price)
    if (same) same.trim = `${same.trim}; ${trim.trim}`
    else rows.push({ trim: trim.trim, price })
  }
  return {
    text: `Across ${name} trims, full coverage goes from about ${estimateDollars(first.likely)} a year on the ${first.trim} to about ${estimateDollars(last.likely)} on the ${last.trim}, because HLDI's loss results differ by body, drive, or powertrain.`,
    rows,
  }
}

export function yearsNote(f: CarFigures): string {
  const model = modelTag(f)
  const older = f.years.some((row) => row.claimsFromLater)
  const newest = f.years[0]
  const oldest = f.years.at(-1)
  const dropNote =
    newest && oldest && newest.year !== oldest.year
      ? `Full coverage on a used ${oldest.year} ${model} (${oldest.ageWords}) runs about ${estimateDollars(oldest.adult.likely)} a year, ${differenceWords(oldest.adult.likely - newest.adult.likely).replace(" a year", "")} than on a ${newest.year}. Dropping collision and comprehensive on that ${oldest.year} brings liability-only coverage to about ${estimateDollars(oldest.liabilityOnly.likely)} a year.`
      : ""
  return [
    `Our catalog covers the ${f.page.shortName} across model years ${f.yearsListed}.`,
    dropNote,
    older ? `For years before ${CLAIMS_YEARS.first}, we use HLDI's ${CLAIMS_YEARS.first}–${String(CLAIMS_YEARS.first + 2).slice(2)} report, with our adjustment for the car's age.` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

/** The range notes that are about this car, not the ones every page shares (those are on How it works). */
export function carNotes(f: CarFigures): string[] {
  const shared = [
    /^Companies' prices differ/,
    /^Our figure for the car's age/,
    /^We brought the 2023/,
    /^HLDI's bodily-injury figure/,
  ]
  return f.adult.rangePoints.filter((point) => !shared.some((pattern) => pattern.test(point)))
}

export type CarContent = {
  /** The page's heading. */
  title: string
  /** The title search results show. */
  searchTitle: string
  description: string
  lead: string
  estimateLabel: string
  estimate: string
  monthly: string
  range: string
  averageLine: string
  about: string
  /** HLDI's results combine drivers of all ages; the example driver is only for comparing pages. */
  driverNote: string
  stateLine: string
  yearsHeading: string
  yearsCaption: string
  years: { year: string; trim: string; age: string; adult: string; liability: string; teen: string; teenOwn: string }[]
  yearsNote: string
  trims: { text: string; rows: { trim: string; price: string }[] } | null
  otherDrivers: string
  teenHeading: string
  teen: string
  teenRank: string
  teenNote: string
  whyHeading: string
  /** Step A: what HLDI reports, in HLDI's own terms. */
  hldi: {
    heading: string
    intro: string
    rows: { name: string; helper: string; rating: HldiRating | "Insufficient data"; percent: string; peers: string }[]
    /** Coverages HLDI doesn't publish for this car. */
    missing: string
    source: string
    url: string | null
  } | null
  /** Step B: what we estimate those results mean for price. */
  price: { heading: string; shared: string; text: string } | null
  groupRank: string
  kind: string
  source: string
  similarHeading: string
  /** The nearest similar cars by price, cheapest first, with this car in its place (slug null). */
  similar: { slug: string | null; name: string; price: string }[]
  statesHeading: string
  statesSummary: string
  states: { name: string; path: string; adult: string; teen: string }[]
  notes: string[]
  /** The sentences every car page shares. Counted in the uniqueness measure, like everything else on the page. */
  fixed: {
    yearsCaption: string
    teenNote: string
    claimsIntro: string
    ctaNote: string
  }
}

/** Next to the 45-year-old, on every car page and the methodology page. */
export const EXAMPLE_DRIVER_NOTE =
  "HLDI's results combine drivers of all ages. We apply them to one example driver (a 45-year-old with a clean record) so pages are comparable; they aren't specific to 45-year-olds."

export const CAR_FIXED: CarContent["fixed"] = {
  yearsCaption:
    "One model year per age group. Liability only: no coverage for the car itself. Teen columns: a new 16-year-old. Each row uses the HLDI report that covers that model year.",
  teenNote: "That increase is how much the family bill goes up with a new 16-year-old driving this car.",
  claimsIntro: "What HLDI reports, then what we estimate it means for price:",
  ctaNote: "Both start from your own situation if you've set one. For crash safety, see IIHS and NHTSA ratings.",
}

function gapWords(delta: number, base: number): string {
  return aboutTheSame(delta, base) ? "about the same" : differenceWords(delta).replace(" a year", "")
}

function similarHeading(f: CarFigures): string {
  if (f.similar.basis === "segment" && f.page.segment) return `Similar ${segmentWords(f.page.segment)}`
  return f.page.classLabel ? `Similar ${lowerFirst(f.page.classLabel)}s` : "Similar cars"
}

function otherDriversText(f: CarFigures): string {
  const [young, mid, senior] = f.otherDrivers
  if (!young || !mid || !senior) {
    return `For other drivers on their own ${f.page.shortName} policy: ${f.otherDrivers
      .map((row) => `ages ${row.ages}, about ${estimateDollars(row.estimate.likely)} a year`)
      .join("; ")}.`
  }
  const youngGap = differenceWords(young.estimate.likely - f.adult.likely).replace(" a year", "")
  return `On a policy of their own with a ${f.page.name}, a ${young.ages}-year-old pays about ${estimateDollars(young.estimate.likely)} a year (${youngGap} than a 45-year-old), a ${mid.ages}-year-old about ${estimateDollars(mid.estimate.likely)}, and a driver ${senior.ages} about ${estimateDollars(senior.estimate.likely)}.`
}

/** "the Legacy", or "the Subaru Legacy" when the model name alone could be anything ("the 3"). */
function callName(f: CarFigures): string {
  const model = modelTag(f)
  return /^[A-Za-z]{3,}/.test(model) ? `the ${model}` : `the ${f.page.shortName}`
}

/** Step A: HLDI's own results for this car, one row per coverage. */
function hldiContent(f: CarFigures): CarContent["hldi"] {
  const report = hldiReport(f.page.relativity)
  if (!report) return null
  const series = report.series
  const intro =
    series.length === 1
      ? `The Highway Loss Data Institute (HLDI) compares each model's insurance losses with an average car's. For the ${series[0]}, on HLDI's scale where 100 is an average car and lower is better, it reports`
      : `The Highway Loss Data Institute (HLDI) compares each model's insurance losses with an average car's. HLDI lists this model as ${series.length} versions (${joinWords(series)}). Taking the middle of them, on HLDI's scale where 100 is an average car and lower is better, it reports`
  const shown = new Set(report.rows.map((row) => row.key))
  const missing = ["collision", "comprehensive", "propertyDamage", "bodilyInjury"].filter((key) => !shown.has(key as never))
  const missingNames: Record<string, string> = {
    collision: "crash repairs",
    comprehensive: "non-crash damage",
    propertyDamage: "damage to others' property",
    bodilyInjury: "injuries to others",
  }
  const indexWords: Record<string, string> = {
    collision: "crash repairs",
    comprehensive: "non-crash damage",
    propertyDamage: "damage to others' property",
    bodilyInjury: "injury claims",
  }
  const scores = `${listWords(report.rows.map((row) => `${row.index} for ${indexWords[row.key]}`))}.`
  return {
    heading: `What HLDI reports (${report.modelYears} models, all drivers combined)`,
    intro: `${intro} ${scores}`,
    // Every coverage, in the same order on every page; one HLDI doesn't publish for this model says so.
    rows: HLDI_COVERAGES.map((coverage) => {
      const row = report.rows.find((item) => item.key === coverage.key)
      if (!row) {
        return {
          name: coverage.name,
          helper: coverage.helper,
          rating: "Insufficient data" as const,
          percent: "No result from HLDI for this model",
          peers: "",
        }
      }
      const rank = f.coverageRanks[row.key]
      const place = rank ? (rank.rank === 1 ? "best" : rank.rank === rank.of ? "worst" : `${ordinal(rank.rank)} best`) : null
      return {
        name: row.name,
        helper: row.helper,
        rating: row.rating as HldiRating | "Insufficient data",
        percent: row.percent,
        peers: rank && place ? `${place} of the ${rank.of} ${peerGroupWords(f)} we compare` : "",
      }
    }),
    missing:
      missing.length > 0
        ? `HLDI doesn't publish a result for ${listWords(missing.map((key) => missingNames[key]))} on this model, so ${missing.length === 1 ? "it's" : "they're"} marked “Insufficient data”.`
        : "",
    source: `Source: HLDI, insurance losses by make and model, ${report.modelYears} models`,
    url: report.url,
  }
}

export function carContent(f: CarFigures): CarContent {
  const { page } = f
  const year = page.pick.year
  const model = modelTag(f)
  const pickedTrim = trimName(page.pick.trim, page.model)
  const price = (likely: number) => `about ${dollars(shownYearly(likely))}`
  const oldest = f.years.length > 1 ? f.years.at(-1)! : null
  const firstState = f.stateEstimates[0]!
  const lastState = f.stateEstimates.at(-1)!
  const middleStateNames = f.stateEstimates.slice(1, -1).map((row) => row.name)
  const window = f.claims.modelYears ?? `${CLAIMS_YEARS.last - 2}–${String(CLAIMS_YEARS.last).slice(2)}`
  const meaning = priceMeaning(page.relativity, callName(f), f.parts)

  return {
    title: carTitle(f),
    searchTitle: carSearchTitle(f),
    description: carDescription(f),
    lead: leadText(f),
    estimateLabel: `${page.name} (${pickedTrim}), national average`,
    estimate: `about ${estimateDollars(f.adult.likely)}`,
    monthly: `a year (about ${monthlyDollars(f.adult.likely)} a month)`,
    range: `Estimated range: ${rangeDollars(f.adult.low, f.adult.high)}. Actual quotes can fall outside it.`,
    averageLine:
      oldest && oldest.year < year
        ? `An average car of the same age (what HLDI's ${window} results measure against) runs about ${estimateDollars(f.averageCar.likely)} a year. A used ${oldest.year} ${model} drops to about ${estimateDollars(oldest.adult.likely)} (see the table below).`
        : `An average car of the same age (what HLDI's ${window} results measure against) runs about ${estimateDollars(f.averageCar.likely)} a year.`,
    about: `Priced for the ${year} ${pickedTrim}, the newest year covered by HLDI's loss data (${window} models), for a 45-year-old driver with a clean record and full coverage.`,
    driverNote: EXAMPLE_DRIVER_NOTE,
    stateLine: `Each state raises or lowers every car's price by the same percentage, so ${callName(f)}'s rank is the same in every state.`,
    yearsHeading: `A used ${page.shortName}, by model year`,
    yearsCaption: CAR_FIXED.yearsCaption,
    years: f.years.map((row) => ({
      year: String(row.year),
      trim: row.trim,
      age: row.ageWords,
      adult: price(row.adult.likely),
      liability: price(row.liabilityOnly.likely),
      teen: signedDollars(row.teen.increase),
      teenOwn: price(row.teenOwn.likely),
    })),
    yearsNote: yearsNote(f),
    trims: trimsSummary(f),
    otherDrivers: otherDriversText(f),
    teenHeading: `Adding a 16-year-old with ${articleFor(page.shortName)} ${page.shortName}`,
    teen: teenText(f),
    teenRank: teenRankText(f),
    teenNote: CAR_FIXED.teenNote,
    groupRank: groupRankText(f, peerGroupWords(f)),
    whyHeading: `Why the ${page.shortName} costs what it does`,
    hldi: hldiContent(f),
    price: meaning ? { heading: "What we estimate that means for price", shared: SOFTENING_REASON, text: meaning.own } : null,
    kind: kindText(f),
    source:
      f.claims.series.length > 0
        ? `Matched to HLDI series “${f.claims.series.join("; ")}” (${f.claims.report ?? `HLDI, ${window} models`}).`
        : `Used the ${f.adult.vehicle.label} class average (${f.claims.report ?? `HLDI, ${window} models`}).`,
    similarHeading: similarHeading(f),
    similar: [
      ...[...f.similar.cheaper].reverse(),
      { slug: null, name: page.name, likely: f.adult.likely },
      ...f.similar.pricier,
    ].map((car) => ({
      slug: car.slug,
      name: car.name,
      price: car.slug === null ? `${price(car.likely)} (this car)` : `${price(car.likely)} (${gapWords(car.likely - f.adult.likely, f.adult.likely)})`,
    })),
    statesHeading: `What ${articleFor(page.shortName)} ${page.shortName} costs in your state`,
    statesSummary: `In six sample states, a ${page.name} runs from ${price(firstState.adultLikely)} a year in ${firstState.name} through ${joinWords(middleStateNames)} to ${price(lastState.adultLikely)} in ${lastState.name}:`,
    states: f.stateEstimates.map((row) => ({
      name: row.name,
      path: row.path,
      adult: price(row.adultLikely),
      teen: signedDollars(row.teenIncrease),
    })),
    notes: carNotes(f),
    fixed: CAR_FIXED,
  }
}

/** Every visible word of a car page's own content, in order, for the uniqueness measure. */
export function carPageText(content: CarContent): string {
  return [
    content.title,
    content.lead,
    content.estimateLabel,
    content.estimate,
    content.monthly,
    content.range,
    content.averageLine,
    content.about,
    content.driverNote,
    content.stateLine,
    content.whyHeading,
    content.hldi?.heading ?? "",
    content.hldi?.intro ?? "",
    ...(content.hldi?.rows ?? []).map((row) => `${row.name} ${row.helper} ${row.rating} ${row.percent} ${row.peers}`),
    content.hldi?.missing ?? "",
    content.hldi?.source ?? "",
    content.price?.heading ?? "",
    content.price?.shared ?? "",
    content.price?.text ?? "",
    content.kind,
    ...content.notes,
    content.source,
    ...(content.years.length > 1
      ? [
          content.yearsHeading,
          content.yearsCaption,
          ...content.years.map((row) => `${row.year} ${row.trim} ${row.age} ${row.adult} ${row.liability} ${row.teen} ${row.teenOwn}`),
          content.yearsNote,
        ]
      : []),
    content.trims?.text ?? "",
    ...(content.trims?.rows ?? []).map((row) => `${row.trim} ${row.price}`),
    content.otherDrivers,
    content.teenHeading,
    content.teen,
    content.teenRank,
    content.teenNote,
    content.similarHeading,
    content.groupRank,
    ...content.similar.map((row) => `${row.name} ${row.price}`),
    content.statesHeading,
    content.statesSummary,
    ...content.states.map((row) => `${row.name} ${row.adult} ${row.teen}`),
    content.fixed.ctaNote,
  ]
    .filter(Boolean)
    .join("\n")
}

export function carMainText(f: CarFigures): string {
  return carPageText(carContent(f))
}

/** Car pages kept out of search results by choice: `"noindex": true` in data/car-pages.json. */
export function noindexCarSlugs(catalog: VehicleCatalog): Set<string> {
  return new Set(carPages(catalog).filter((page) => page.noindex).map((page) => page.slug))
}

/** How much of each car page's own wording is its own (numbers included), for a quick look while writing. */
export function carUniqueness(catalog: VehicleCatalog): UniquenessReport {
  return uniqueness(carPages(catalog).map((page) => ({ id: page.slug, text: carMainText(carFigures(catalog, page.slug)!) })))
}
