/**
 * The words on a car page, as plain strings (docs/VOICE.md applies). The page
 * adds links and layout around them; tests check each page says something of
 * its own.
 */
import { factorWords, type CarFigures, type ClaimsWord } from "./car-pages"
import { differenceWords, estimateDollars, monthlyDollars, rangeWords } from "./format"
import { REASON, vehicleReasonParts } from "./pricing"
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

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a"
}

/** "a small SUV", "an SUV". */
export function classWords(f: CarFigures): string | null {
  const label = f.page.classLabel
  if (!label) return null
  const words = lowerFirst(label)
  return `${/^SUV/.test(words) ? "an" : article(words)} ${words}`
}

export function carTitle(f: CarFigures): string {
  return `What a ${f.page.name} costs to insure`
}

/** Why the car differs from an average car of the same year, from the engine's own reasons (its age aside). */
export function reasons(f: CarFigures): string[] {
  return vehicleReasonParts(f.page.relativity, true, f.page.pick.year).filter(
    (part) => part !== REASON.newer && part !== REASON.older,
  )
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? ""
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`
}

/** "$200 less than an average 2024 car" */
export function vsAverageWords(f: CarFigures): string {
  const words = differenceWords(f.adult.likely - f.averageCar.likely)
  return words === "about the same" ? `about the same as an average ${f.page.pick.year} car` : `${words.replace(" a year", "")} than an average ${f.page.pick.year} car`
}

export function carDescription(f: CarFigures): string {
  return `A ${f.page.name} costs about ${estimateDollars(f.adult.likely)} a year for a typical 45-year-old with full coverage (${rangeWords(f.adult.low, f.adult.high)}), ${vsAverageWords(f)}. Adding a 16-year-old: about ${differenceWords(f.teen.increase)}. Why, from insurance claims data.`
}

/** Why, in one clause: "because of cheaper repairs", "pricier repairs outweigh fewer at-fault claims". */
export function becauseWords(f: CarFigures): string {
  const why = reasons(f)
  const ups = why.filter((part) => part === REASON.pricierRepairs || part === REASON.moreClaims)
  const downs = why.filter((part) => part === REASON.cheaperRepairs || part === REASON.fewerClaims)
  const delta = Math.round((f.adult.likely - f.averageCar.likely) / 10)
  const [main, other] = delta >= 0 ? [ups, downs] : [downs, ups]
  if (delta === 0) return why.length > 0 ? `${joinWords(why)} about even out` : "its claims are about average"
  if (main.length === 0) return "its claims are about average"
  if (other.length === 0) return `because of ${joinWords(main)}`
  return `${joinWords(main)} outweigh ${joinWords(other)}`
}

export function leadText(f: CarFigures): string {
  const because = becauseWords(f)
  return `For a typical 45-year-old with full coverage, about ${estimateDollars(f.adult.likely)} a year nationally, ${vsAverageWords(f)}${because.startsWith("because") ? ", " : ": "}${because}.`
}

export function driverWords(): string {
  return "A 45-year-old (our 40–64 group) with a clean record, full coverage with a $1,000 deductible, 7,500–15,000 miles a year, in the suburbs."
}

export function teenText(f: CarFigures): string {
  return `Adding a new 16-year-old to that policy, driving this car, costs about ${differenceWords(f.teen.increase)} (about ${monthlyDollars(f.teen.increase)} a month). With an average ${f.page.pick.year} car, it would be about ${differenceWords(f.teenAverageCar.increase)}.`
}

export function teenRankText(f: CarFigures): string {
  const { rank, of } = f.teenRank
  const fromTop = of - rank + 1
  const place =
    rank === 1
      ? "the least expensive"
      : fromTop === 1
        ? "the most expensive"
        : rank <= of / 2
          ? `the ${ordinal(rank)} least expensive`
          : `the ${ordinal(fromTop)} most expensive`
  return `Of the ${of} cars we have pages for, it's ${place} to add a teen with.`
}

const CLAIMS_PHRASE: Record<ClaimsWord, string> = {
  "much lower": "much lower than average",
  lower: "lower than average",
  "about average": "about average",
  higher: "higher than average",
  "much higher": "much higher than average",
}

export function claimsPhrase(word: ClaimsWord | null): string {
  return word ? CLAIMS_PHRASE[word] : "no figure"
}

function partWords(hundredths: number): string {
  const words = factorWords(hundredths)
  return words === "about the same" ? "about the same as for an average car" : `${words} than for an average car`
}

/** What the claims do to the two parts of the bill, in the engine's own factors. */
export function priceEffectText(f: CarFigures): string {
  return `What that does to the price: the part of the bill that fixes your own car comes out ${partWords(f.page.relativity.physicalHundredths)}, and the part that pays for damage you cause to others ${partWords(f.page.relativity.liabilityHundredths)}. Insurers price a car's crash record only partly, so the second part moves less than the claims do.`
}

/** "It's a small SUV, and it's gas-powered." */
export function kindText(f: CarFigures): string {
  const kind = classWords(f)
  const power = f.page.facts.powertrain ? POWERTRAIN_WORDS[f.page.facts.powertrain] : null
  if (kind && power) return `By the EPA's size classes it's ${kind}, and it's ${power}.`
  if (kind) return `By the EPA's size classes it's ${kind}.`
  if (power) return `It's ${power}.`
  return ""
}

/** Everything the page is built around, for the uniqueness test. */
export function carMainText(f: CarFigures): string {
  return [
    carTitle(f),
    carDescription(f),
    leadText(f),
    teenText(f),
    teenRankText(f),
    kindText(f),
    priceEffectText(f),
    `repairs ${claimsPhrase(f.claims.repairs)}; theft ${claimsPhrase(f.claims.theftAndWeather)}; property ${claimsPhrase(f.claims.damageToOthers)}; injuries ${claimsPhrase(f.claims.injuriesToOthers)}`,
    ...f.states.map((row) => `${row.name} ${estimateDollars(row.estimate.likely)}`),
    ...f.similar.cheaper.map((row) => row.name),
    ...f.similar.pricier.map((row) => row.name),
  ].join("\n")
}
