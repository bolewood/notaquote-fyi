/**
 * The words on a state page, as plain strings, so tests can check that every
 * page says something of its own (docs/VOICE.md applies to all of it). The
 * page adds links and layout around them.
 */
import { differenceWords, dollars, estimateDollars, monthlyDollars, rangeWords } from "./format"
import { stateName, type StateCode } from "./scenario"
import { inSentence, TEEN_TOP, type StateFigures } from "./state-pages"
import { liabilityShorthand, NO_FAULT_CHOICE, stateMinimumAssumption } from "./state-rules"

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

export function stateTitle(f: StateFigures): string {
  return `Car insurance in ${inSentence(f.code)}: typical cost, minimums, and teen drivers`
}

function minimumShort(f: StateFigures): string {
  const rule = f.rule
  if (!rule) return "its minimum coverage"
  if (rule.insuranceRequired === false) return "most drivers aren't required to buy insurance"
  const short = liabilityShorthand(rule)
  return short ? `the minimum liability coverage is ${short}` : "its minimum coverage is on the page"
}

export function stateDescription(f: StateFigures): string {
  const name = inSentence(f.code)
  return `Full coverage in ${name} averaged ${naic(f.baseline.annual)} a year in 2023 (NAIC), ${f.vsNational.words} the national average, or about ${estimateDollars(f.start.annual)} today. Here, ${minimumShort(f)}, and adding a 16-year-old costs about ${differenceWords(f.teen.added.increase)}.`
}

/** The page's opening line. */
export function leadText(f: StateFigures): string {
  const name = inSentence(f.code)
  return `Drivers in ${name} paid ${naic(f.baseline.annual)} a year on average for full coverage in 2023, ${f.vsNational.words} the national average. Here's what that means today, the least insurance the law asks for, and what a new teen driver adds.`
}

export function priceParagraph(f: StateFigures): string {
  const name = inSentence(f.code)
  return `That makes ${name} ${rankWords(f)}. Nationally, the average was ${naic(f.national.annual)}.`
}

export function liabilityParagraph(f: StateFigures): string {
  const share = Math.round(f.liabilityShare * 100)
  return `Liability alone, the part that pays for damage and injuries you cause to others, averaged ${naic(f.baseline.liabilityOnly)}, about ${share}% of the full-coverage price. The rest of a full-coverage bill pays to fix or replace your own car (collision and comprehensive).`
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
export function moveWords(delta: number): string {
  const words = differenceWords(delta)
  return words === "about the same" ? "About the same" : `About ${words}`
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

export function teenParagraph(f: StateFigures): string {
  const name = inSentence(f.code)
  const added = f.teen.added
  return `Adding a 16-year-old to a typical policy in ${name} (one average car, full coverage) costs about ${differenceWords(added.increase)}, about ${monthlyDollars(added.increase)} a month. The whole policy would then run ${rangeWords(added.after.low, added.after.high)} a year.`
}

export function ownPolicyParagraph(f: StateFigures): string {
  const own = f.teen.own
  return `On a policy of their own, with the same kind of car, the same teen would pay about ${estimateDollars(own.likely)} a year (${rangeWords(own.low, own.high)}). Most families add a new driver to the policy they already have.`
}

/** The line the owner asked for, word for word. */
export const SAME_ORDER_NOTE =
  "The order is the same in every state, because our car data is national. What changes from state to state is the price level."

export function teenCarsSummary(f: StateFigures): string {
  const name = inSentence(f.code)
  const first = f.teenCars[0]
  const last = f.teenCars.at(-1)!
  return `In ${name}, the ${first.car.label} is the cheapest of the ${f.teenCars.length} cars on the site's popular lists to add a teen with: about ${differenceWords(first.added.increase)}. At the other end of the same lists, the ${last.car.label} costs about ${differenceWords(last.added.increase)}.`
}

/** Every sentence the page is built around, for the uniqueness test. */
export function stateMainText(f: StateFigures): string {
  return [
    stateTitle(f),
    stateDescription(f),
    leadText(f),
    priceParagraph(f),
    liabilityParagraph(f),
    neighborsSummary(f),
    ...f.neighbors.map((row) => `${row.name} ${naic(row.baseline.annual)} ${moveWords(row.move.delta)}`),
    faultText(f) ?? "",
    f.rule?.note ?? "",
    f.rule?.goodToKnow ?? "",
    teenParagraph(f),
    ownPolicyParagraph(f),
    teenCarsSummary(f),
    ...f.teenCars.slice(0, TEEN_TOP).map((item) => `${item.car.label} ${differenceWords(item.added.increase)} ${estimateDollars(item.own.likely)}`),
  ]
    .filter(Boolean)
    .join("\n")
}
