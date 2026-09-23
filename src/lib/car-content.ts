/**
 * The words on a car page (docs/VOICE.md applies), as one plain object the
 * page renders. Keeping every visible sentence here lets the tests measure how
 * much of each page is its own, and flag pages that read like a template.
 */
import type { VehicleCatalog } from "./catalog"
import { aboutTheSame, carFigures, carPages, CLAIMS_YEARS, factorWords, trimName, type CarFigures, type ClaimsWord } from "./car-pages"
import { uniqueness, type UniquenessReport } from "./uniqueness"
import { differenceWords, dollars, estimateDollars, monthlyDollars, rangeWords, shownYearly, signedDollars } from "./format"
import { REASON } from "./pricing"
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

// ---------------------------------------------------------------------------
// Headline pieces

export function carTitle(f: CarFigures): string {
  return `How much is insurance on a ${f.page.shortName}?`
}

function vsAverageDelta(f: CarFigures): number {
  return f.adult.likely - f.averageCar.likely
}

/** "$200 less than an average 2024 car", or "about the same as an average 2024 car". */
export function vsAverageWords(f: CarFigures): string {
  const delta = vsAverageDelta(f)
  const year = f.page.pick.year
  if (aboutTheSame(delta, f.averageCar.likely)) return `about the same as an average ${year} car`
  return `${differenceWords(delta).replace(" a year", "")} than an average ${year} car`
}

/**
 * Why, in one clause, from the car's own factors (so it can't contradict the
 * dollar gap): "because of cheaper repairs", "pricier repairs outweigh fewer
 * at-fault claims", "because of slightly more at-fault claims".
 */
export function becauseWords(f: CarFigures): string {
  const damage = f.page.relativity.physicalHundredths - 100
  const liability = f.page.relativity.liabilityHundredths - 100
  const repairs = (size: number) => `${Math.abs(size) < 10 ? "slightly " : ""}${size > 0 ? REASON.pricierRepairs : REASON.cheaperRepairs}`
  const claims = (size: number) => `${Math.abs(size) < 8 ? "slightly " : ""}${size > 0 ? REASON.moreClaims : REASON.fewerClaims}`
  const delta = vsAverageDelta(f)
  if (aboutTheSame(delta, f.averageCar.likely)) {
    if (damage * liability < 0 && Math.abs(damage) >= 5 && Math.abs(liability) >= 5) {
      return `${damage > 0 ? REASON.pricierRepairs : REASON.cheaperRepairs} and ${liability > 0 ? REASON.moreClaims : REASON.fewerClaims} about even out`
    }
    return "its claims are close to an average car's"
  }
  const up = delta > 0
  const main: string[] = []
  const other: string[] = []
  // The bigger effect first. Differences under 3 points don't count.
  const parts = [
    { size: damage, words: repairs(damage) },
    { size: liability, words: claims(liability) },
  ]
    .filter((part) => Math.abs(part.size) >= 3)
    .sort((left, right) => Math.abs(right.size) - Math.abs(left.size))
  for (const part of parts) (part.size > 0 === up ? main : other).push(part.words)
  if (main.length === 0) return "its claims are close to an average car's"
  if (other.length === 0) return `because of ${joinWords(main)}`
  return `${joinWords(main)} outweigh ${joinWords(other)}`
}

export function carDescription(f: CarFigures): string {
  return `A ${f.page.name}: about ${estimateDollars(f.adult.likely)} a year for a typical 45-year-old, ${vsAverageWords(f)}. Adding a teen: about ${differenceWords(f.teen.increase)}.`
}

export function leadText(f: CarFigures): string {
  const because = becauseWords(f)
  const joiner = because.startsWith("because") ? ", " : ": "
  return `A ${f.page.name} runs about ${estimateDollars(f.adult.likely)} a year for a typical 45-year-old, ${vsAverageWords(f)}${joiner}${because}.`
}

// ---------------------------------------------------------------------------
// Sections

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
  return words === "about the same" ? "about the same" : words
}

/** What the claims do to the two parts of the bill, in the engine's own factors and in dollars. */
export function priceEffectText(f: CarFigures): string {
  const { car, average } = f.parts
  const year = f.page.pick.year
  const own = `The part that fixes or replaces the ${f.page.shortName}: about ${estimateDollars(car.ownCar)}, against ${estimateDollars(average.ownCar)} for an average ${year} car (${partWords(f.page.relativity.physicalHundredths)}).`
  const others = `The part that pays for harm to others: about ${estimateDollars(car.liability)}, against ${estimateDollars(average.liability)} for an average car (${partWords(f.page.relativity.liabilityHundredths)}).`
  return `${own} ${others}`
}

/** HLDI's "Luxury SUVs / Midsize" as "midsize luxury SUVs". */
function segmentWords(segment: string): string {
  const [kind, size] = segment.split(" / ")
  return `${(size ?? "").toLowerCase()} ${lowerFirst(kind)}`.trim()
}

/** "By the EPA's size classes it's a small SUV, and it's gas-powered." */
export function kindText(f: CarFigures): string {
  const kind = classWords(f)
  const power = f.page.facts.powertrain ? POWERTRAIN_WORDS[f.page.facts.powertrain] : null
  const segment = f.page.segment ? ` The Highway Loss Data Institute groups it with ${segmentWords(f.page.segment)}.` : ""
  if (kind && power) return `By the EPA's size classes it's ${kind}, and it's ${power}.${segment}`
  if (kind) return `By the EPA's size classes it's ${kind}.${segment}`
  if (power) return `It's ${power}.${segment}`
  return segment.trim()
}

export function teenText(f: CarFigures): string {
  const car = f.teen.increase
  const average = f.teenAverageCar.increase
  const vs = aboutTheSame(car - average, average)
    ? "about the same as with an average car"
    : `${differenceWords(car - average).replace(" a year", "")} than with an average ${f.page.pick.year} car`
  return `A new 16-year-old driving the ${f.page.shortName} adds about ${estimateDollars(car)} a year (${monthlyDollars(car)} a month), ${vs}.`
}

export function teenRankText(f: CarFigures): string {
  const { rank, of } = f.teenRank
  const fromTop = of - rank + 1
  const place =
    rank === 1 ? "the cheapest" : fromTop === 1 ? "the most expensive" : rank <= of / 2 ? `${ordinal(rank)} cheapest` : `${ordinal(fromTop)} most expensive`
  return `For adding a teen, the ${f.page.shortName} ranks ${place} of our ${of} car pages.`
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
  return `Among these ${of} ${group}, the ${f.page.shortName} is ${place} to insure.`
}

/** The versions of the model, when their prices differ: a sentence and one row per distinct price. */
export function trimsSummary(f: CarFigures): { text: string; rows: { trim: string; price: string }[] } | null {
  const trims = f.trims
  if (trims.length < 2) return null
  const first = trims[0]
  const last = trims.at(-1)!
  const name = `${f.page.pick.year} ${f.page.shortName}`
  if (aboutTheSame(last.likely - first.likely, first.likely)) {
    return {
      text: `The ${trims.length} versions of the ${name} we list (${joinWords(trims.map((trim) => trim.trim))}) all come out within about $50 of each other.`,
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
    text: `The ${name} runs from about ${estimateDollars(first.likely)} a year (${first.trim}) to about ${estimateDollars(last.likely)} (${last.trim}): the claims data differs by drive, body, or powertrain.`,
    rows,
  }
}

export function yearsNote(f: CarFigures): string {
  const older = f.years.some((row) => row.claimsFromLater)
  return [
    `We list the ${f.page.shortName} for ${f.yearsListed}.`,
    "How much a car's age takes off is our own estimate.",
    older ? `Years before ${CLAIMS_YEARS.first} use the ${CLAIMS_YEARS.first}–${String(CLAIMS_YEARS.last).slice(2)} claims results.` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

/** The range notes that are about this car, not the ones every page shares (those are on How it works). */
export function carNotes(f: CarFigures): string[] {
  const shared = [/^Companies' prices differ/, /^Our figure for the car's age/, /^We brought the 2023/]
  return f.adult.rangePoints.filter((point) => !shared.some((pattern) => pattern.test(point)))
}

export type CarContent = {
  title: string
  description: string
  lead: string
  estimateLabel: string
  estimate: string
  monthly: string
  range: string
  averageLine: string
  about: string
  stateLine: string
  yearsHeading: string
  years: { year: string; age: string; adult: string; liability: string; teen: string; teenOwn: string }[]
  yearsNote: string
  trims: { text: string; rows: { trim: string; price: string }[] } | null
  otherDrivers: string
  teenHeading: string
  teen: string
  teenRank: string
  whyHeading: string
  groupRank: string
  claims: { label: string; value: string }[]
  effect: string
  kind: string
  source: string
  similarHeading: string
  /** The nearest similar cars by price, cheapest first, with this car in its place (slug null). */
  similar: { slug: string | null; name: string; price: string }[]
  notes: string[]
  /** The sentences every car page shares. Counted in the uniqueness measure, like everything else on the page. */
  fixed: {
    yearsCaption: string
    teenNote: string
    claimsIntro: string
    ctaNote: string
  }
}

export const CAR_FIXED: CarContent["fixed"] = {
  yearsCaption: "One model year per age group. Liability only: no coverage for the car itself. Teen columns: a new 16-year-old.",
  teenNote: "That's the whole household's bill going up.",
  claimsIntro: "Its insurance claims against an average car's (HLDI):",
  ctaNote: "Both start from your own situation if you've set one. For crash safety, see IIHS and NHTSA ratings.",
}

function gapWords(delta: number, base: number): string {
  return aboutTheSame(delta, base) ? "about the same" : differenceWords(delta).replace(" a year", "")
}

function similarHeading(f: CarFigures): string {
  if (f.similar.basis === "segment" && f.page.segment) return `Similar ${segmentWords(f.page.segment)}`
  return f.page.classLabel ? `Similar ${lowerFirst(f.page.classLabel)}s` : "Similar cars"
}

export function carContent(f: CarFigures): CarContent {
  const { page } = f
  const year = page.pick.year
  const price = (likely: number) => `about ${dollars(shownYearly(likely))}`
  return {
    title: carTitle(f),
    description: carDescription(f),
    lead: leadText(f),
    estimateLabel: `${page.name}, national average`,
    estimate: `about ${estimateDollars(f.adult.likely)}`,
    monthly: `a year (about ${monthlyDollars(f.adult.likely)} a month)`,
    range: rangeWords(f.adult.low, f.adult.high),
    averageLine:
      f.years.length > 1
        ? `An average ${year} car: about ${estimateDollars(f.averageCar.likely)}. An older ${page.shortName} costs less (below).`
        : `An average ${year} car: about ${estimateDollars(f.averageCar.likely)}.`,
    about: `Priced: the ${year} ${trimName(page.pick.trim, page.model)} (the newest year our claims data covers), a 45-year-old, clean record, full coverage.`,
    stateLine: "Each state moves every car's price by the same share.",
    yearsHeading: `A used ${page.shortName}, by model year`,
    years: f.years.map((row) => ({
      year: String(row.year),
      age: row.ageWords,
      adult: price(row.adult.likely),
      liability: price(row.liabilityOnly.likely),
      teen: signedDollars(row.teen.increase),
      teenOwn: price(row.teenOwn.likely),
    })),
    yearsNote: yearsNote(f),
    trims: trimsSummary(f),
    otherDrivers: `The ${page.shortName} for other drivers on their own policy, a year: ${f.otherDrivers
      .map((row) => `${row.ages}, ${estimateDollars(row.estimate.likely)}`)
      .join("; ")}.`,
    teenHeading: `Adding a 16-year-old with a ${page.shortName}`,
    teen: teenText(f),
    teenRank: teenRankText(f),
    groupRank: groupRankText(f, similarHeading(f).replace(/^Similar /, "")),
    whyHeading: `Why the ${page.shortName} costs what it does`,
    claims: [
      { label: "Repairs", value: claimsPhrase(f.claims.repairs) },
      { label: "Theft and weather", value: claimsPhrase(f.claims.theftAndWeather) },
      { label: "Damage to others", value: claimsPhrase(f.claims.damageToOthers) },
      { label: "Injuries to others", value: claimsPhrase(f.claims.injuriesToOthers) },
    ],
    effect: priceEffectText(f),
    kind: kindText(f),
    source: `Matched to “${f.claims.series.join("; ")}” in HLDI's results.`,
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
    content.stateLine,
    ...(content.years.length > 1
      ? [
          content.yearsHeading,
          content.fixed.yearsCaption,
          ...content.years.map((row) => `${row.year} ${row.age} ${row.adult} ${row.liability} ${row.teen} ${row.teenOwn}`),
          content.yearsNote,
        ]
      : []),
    content.trims?.text ?? "",
    ...(content.trims?.rows ?? []).map((row) => `${row.trim} ${row.price}`),
    content.otherDrivers,
    content.teenHeading,
    content.teen,
    content.teenRank,
    content.fixed.teenNote,
    content.whyHeading,
    content.fixed.claimsIntro,
    ...content.claims.map((row) => `${row.label} ${row.value}`),
    content.effect,
    content.kind,
    content.source,
    content.similarHeading,
    content.groupRank,
    ...content.similar.map((row) => `${row.name} ${row.price}`),
    ...content.notes,
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
