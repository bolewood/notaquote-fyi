/**
 * The words on a state page, as plain strings, so tests can check that every
 * page says something of its own (docs/VOICE.md applies to all of it). The
 * page adds links and layout around them.
 */
import { aboutTheSame, differenceWords, dollars, estimateDollars, monthlyDollars, rangeWords, shownYearly } from "./format"
import { stateName, type StateCode } from "./scenario"
import { DESCRIPTION_MAX } from "./site-meta"
import { inSentence, TEEN_TOP, type StateFigures } from "./state-pages"
import { liabilityShorthand, NO_FAULT_CHOICE, stateMinimumAssumption, type StateRule } from "./state-rules"
import type { TeenPriced } from "./teen-cars"
import { MODELS_ENABLED } from "./car-page-links"

export function ordinal(value: number): string {
  const tens = value % 100
  if (tens >= 11 && tens <= 13) return `${value}th`
  const last = value % 10
  return `${value}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`
}

/** "Indiana", "Indiana and Iowa", "Indiana, Iowa, and Ohio" */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`
}

const NUMBER_WORDS: Record<number, string> = { 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight" }

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "the 10th least expensive of the 50 states and DC", from whichever end is closer. */
export function rankWords(f: StateFigures): string {
  const { rank, of, tiedWith } = f.rank
  const fromBottom = of - rank - tiedWith.length + 1
  const place =
    rank === 1
      ? "the most expensive"
      : fromBottom === 1
        ? "the least expensive"
        : rank <= of / 2
          ? `the ${ordinal(rank)} most expensive`
          : `the ${ordinal(fromBottom)} least expensive`
  const tie = tiedWith.length > 0 ? ` (tied with ${joinNames(tiedWith.map(stateName))})` : ""
  return `${place} of the 50 states and DC${tie}`
}

/** Whole dollars, as NAIC printed them (rounded to the dollar). */
function naic(amount: number): string {
  return dollars(amount)
}

/** "Ohio", or "DC" where space is short. */
export function shortName(code: StateCode): string {
  return code === "DC" ? "DC" : stateName(code)
}

export function stateTitle(f: StateFigures): string {
  return `${shortName(f.code)} car insurance: cost and state minimums`
}

/** The least insurance the law asks for, in one short clause, for a lead or a table. */
export function minimumWords(rule: StateRule | null, style: "sentence" | "cell" = "sentence"): string {
  if (!rule || rule.sourceUrl === null) return style === "cell" ? "Not checked yet" : "we haven't checked the minimum yet"
  const short = liabilityShorthand(rule)
  if (rule.insuranceRequired === false) {
    return style === "cell"
      ? `Optional for most drivers; a policy needs ${short ?? "the minimums"}`
      : `insurance itself is optional for most drivers, but a policy must carry at least ${short ?? "the state's minimums"} liability`
  }
  if (short) return style === "cell" ? short : `the law asks for at least ${short} liability`
  // No injury-liability minimum (Florida): say what is required instead.
  const parts: string[] = []
  const pip = rule.pipRequired === true ? rule.pipAmount?.match(/^\$[\d,]+/)?.[0] : null
  if (pip) parts.push(`${pip} of personal injury protection`)
  if (rule.pd !== null) parts.push(`${dollars(rule.pd)} of property damage liability`)
  if (rule.combinedSingleLimit !== null) parts.push(`${dollars(rule.combinedSingleLimit)} of liability`)
  if (parts.length === 0) return style === "cell" ? "See the page" : "the law's minimum is on this page"
  const listed = joinNames(parts)
  return style === "cell" ? listed.replace(/ of personal injury protection/, " PIP").replace(/ of property damage liability/, " property damage") : `the law asks for ${listed}`
}

export function stateDescription(f: StateFigures): string {
  const name = shortName(f.code)
  const teen = ` Adding a teen: about ${differenceWords(f.teen.added.increase)}.`
  const long = `${name}: ${naic(f.baseline.annual)} a year for full coverage in 2023, about ${estimateDollars(f.start.annual)} today. Minimum: ${minimumWords(f.rule, "cell")}.`
  if (long.length + teen.length <= DESCRIPTION_MAX) return long + teen
  const short = `${name}: ${naic(f.baseline.annual)} a year in 2023, about ${estimateDollars(f.start.annual)} today. Minimum: ${minimumWords(f.rule, "cell")}.`
  return short.length + teen.length <= DESCRIPTION_MAX ? short + teen : short
}

/** The page's opening lines: the facts first. */
export function leadText(f: StateFigures): string {
  const name = inSentence(f.code)
  const vs = f.vsNational.words.replace(" more than", " above").replace(" less than", " below").replace("about the same as", "about the same as")
  return `Drivers in ${name} paid ${naic(f.baseline.annual)} a year for full coverage in 2023, ${vs} the national average. With prices up since, figure on about ${estimateDollars(f.start.annual)} today. In ${name}, ${minimumWords(f.rule)}.`
}

export function priceParagraph(f: StateFigures): string {
  const name = inSentence(f.code)
  return `That makes ${name} ${rankWords(f)}. Nationally, the average was ${naic(f.national.annual)}.`
}

/** How the state sits among its neighbors, in one sentence. */
export function neighborsSummary(f: StateFigures): string {
  const name = capitalize(inSentence(f.code))
  if (f.neighbors.length === 0) return ""
  if (!f.bordering) {
    const other = f.neighbors[0]
    return `${name} doesn't share a border with another state, so here it is next to ${other.name}. ${name}'s typical price is ${other.vs.words} ${other.name}'s.`
  }
  const cheaper = f.neighbors.filter((row) => row.baseline.annual < f.baseline.annual).map((row) => row.name)
  const pricier = f.neighbors.filter((row) => row.baseline.annual > f.baseline.annual).map((row) => row.name)
  const count = f.neighbors.length
  const all = count === 1 ? "its only neighbor" : count === 2 ? "both of its neighbors" : `all ${NUMBER_WORDS[count] ?? count} of its neighbors`
  if (pricier.length === count) return `A typical policy costs less in ${inSentence(f.code)} than in ${all}.`
  if (cheaper.length === count) return `A typical policy costs more in ${inSentence(f.code)} than in ${all}.`
  const parts: string[] = []
  if (cheaper.length > 0) parts.push(`more than in ${joinNames(cheaper)}`)
  if (pricier.length > 0) parts.push(`less than in ${joinNames(pricier)}`)
  const same = f.neighbors.filter((row) => row.baseline.annual === f.baseline.annual).map((row) => row.name)
  if (same.length > 0) parts.push(`the same as in ${joinNames(same)}`)
  return `A typical policy in ${inSentence(f.code)} costs ${joinNames(parts)}.`
}

/** One move, in words: "Moving from Pennsylvania: about $270 less a year." */
export function moveWords(delta: number, base: number): string {
  if (aboutTheSame(delta, base)) return "About the same"
  return `About ${differenceWords(delta)}`
}

/** The least insurance the law asks for, in a few plain sentences (the What-if page says the same). */
export function minimumText(code: StateCode): string {
  return stateMinimumAssumption(code).replace(/^State minimum: /, "")
}

/** A short line about how claims work there, when it's unusual. */
export function faultText(f: StateFigures): string | null {
  const rule = f.rule
  if (!rule) return null
  const name = inSentence(f.code)
  if (rule.noFault === true) {
    return `${capitalize(name)} is a no-fault state: after a crash, your own policy pays for your own injuries first (through personal injury protection), whoever caused it.`
  }
  if (rule.noFault === NO_FAULT_CHOICE) {
    return `In ${name}, you choose whether no-fault rules apply to you. Under no-fault, your own policy pays for your own injuries first, whoever caused the crash.`
  }
  return null
}

/** The teen callout's small print: the monthly figure and the whole policy. */
export function teenCallout(f: StateFigures): string {
  const added = f.teen.added
  return `About ${monthlyDollars(added.increase)} a month, on one average car with full coverage. The whole policy with the teen: ${rangeWords(added.after.low, added.after.high)} a year.`
}

export function ownPolicyParagraph(f: StateFigures): string {
  const own = f.teen.own
  return `On a policy of their own, with the same kind of car, the same teen would pay about ${estimateDollars(own.likely)} a year in ${inSentence(f.code)} (${rangeWords(own.low, own.high)}).`
}

/** Liability-only coverage: the closest NAIC figure to what a minimum policy costs, and its rank. */
export function liabilityOnlyText(f: StateFigures): string {
  const rank = f.liabilityRank
  const fromBottom = rank.of - rank.rank + 1
  const place =
    rank.rank === 1
      ? "the highest"
      : fromBottom === 1
        ? "the lowest"
        : rank.rank <= rank.of / 2
          ? `the ${ordinal(rank.rank)} highest`
          : `the ${ordinal(fromBottom)} lowest`
  const share = Math.round(f.liabilityShare * 100)
  return `Liability-only coverage, the closest NAIC figure to what a minimum policy costs, averaged ${naic(f.baseline.liabilityOnly)} in ${inSentence(f.code)} in 2023 (about ${estimateDollars(f.liabilityToday)} today, brought up the same rough way), ${place} of the 50 states and DC. That's about ${share}% of the full-coverage price; the rest pays to fix or replace your own car.`
}

/** The line the owner asked for, word for word. */
export const SAME_ORDER_NOTE =
  "The order is the same in every state, because our car data is national. What changes from state to state is the price level."

/** "the 2022 Subaru Forester, Outback, and Crosstrek": several cars, the year and make said once when they share them. */
export function modelsWords(cars: readonly TeenPriced[]): string {
  const makes = new Set(cars.map((item) => item.car.pick.make))
  const years = new Set(cars.map((item) => item.car.pick.year))
  const year = years.size === 1 && cars.length > 0 ? `${cars[0].car.pick.year} ` : ""
  if (makes.size === 1 && cars.length > 1) return `the ${year}${cars[0].car.pick.make} ${joinNames(cars.map((item) => item.car.pick.model))}`
  return `the ${year}${joinNames(cars.map((item) => item.car.model))}`
}

/** How many cars tie with the cheapest one (to the $10 shown). */
export function tiedAtTop(cars: readonly TeenPriced[]): number {
  const first = shownYearly(cars[0]?.added.increase ?? 0)
  return cars.filter((item) => shownYearly(item.added.increase) === first).length
}

export function teenCarsSummary(f: StateFigures): string {
  const name = inSentence(f.code)
  const first = f.teenCars[0]
  const last = f.teenCars.at(-1)!
  const ties = tiedAtTop(f.teenCars)
  if (ties >= 3 && !MODELS_ENABLED) {
    return `Without claims results for each model, cars of the same kind come out the same here: ${ties} of the ${f.teenCars.length} cars on the site's popular lists tie for the least to add a teen with in ${name}, at about ${differenceWords(first.added.increase)}.`
  }
  if (ties >= 2) {
    const tied = f.teenCars.slice(0, ties)
    return `In ${name}, ${modelsWords(tied)} come out the same, the least of the ${f.teenCars.length} cars on the site's popular lists to add a teen with: about ${differenceWords(first.added.increase)}. At the other end of the same lists, the ${last.car.label} costs about ${differenceWords(last.added.increase)}.`
  }
  return `In ${name}, the ${first.car.label} is the cheapest of the ${f.teenCars.length} cars on the site's popular lists to add a teen with: about ${differenceWords(first.added.increase)}. At the other end of the same lists, the ${last.car.label} costs about ${differenceWords(last.added.increase)}.`
}

/** Every sentence the page is built around, for the uniqueness test. */
export function stateMainText(f: StateFigures): string {
  return [
    stateTitle(f),
    stateDescription(f),
    leadText(f),
    priceParagraph(f),
    neighborsSummary(f),
    ...f.neighbors.map((row) => `${row.name} ${naic(row.baseline.annual)} ${moveWords(row.move.delta, row.move.current.likely)}`),
    liabilityOnlyText(f),
    faultText(f) ?? "",
    f.rule?.note ?? "",
    f.rule?.goodToKnow ?? "",
    teenCallout(f),
    ownPolicyParagraph(f),
    teenCarsSummary(f),
    ...f.teenCars.slice(0, TEEN_TOP).map((item) => `${item.car.label} ${differenceWords(item.added.increase)} ${estimateDollars(item.own.likely)}`),
  ]
    .filter(Boolean)
    .join("\n")
}
