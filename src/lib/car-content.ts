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
  factorWords,
  trimName,
  type CarFigures,
  type ClaimsWord,
} from "./car-pages"
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

export function carTitle(f: CarFigures): string {
  return `How much is insurance on ${articleFor(f.page.shortName)} ${f.page.shortName}?`
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
  const model = modelTag(f)
  const group = peerGroupWords(f)
  const groupClause =
    f.groupRank.of >= 2 ? ` (#${f.groupRank.rank} of ${f.groupRank.of} ${group} we compare)` : ""
  return `A ${f.page.name} runs about ${estimateDollars(f.adult.likely)} a year for a typical 45-year-old, ${vsAverageWords(f)}${joiner}${because}. Putting a new 16-year-old on a family policy with the ${model} adds about ${estimateDollars(f.teen.increase)} a year${groupClause}.`
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
  const model = modelTag(f)
  const ownShare = Math.round((car.ownCar / (car.ownCar + car.liability)) * 100)
  const liabShare = 100 - ownShare
  const phys = f.page.relativity.physicalHundredths
  const liab = f.page.relativity.liabilityHundredths

  if (phys >= 106 && liab <= 102) {
    return `Physical-damage coverage is what pushes the ${f.page.shortName} up: fixing or replacing the ${model} after a crash, theft, or storm takes ${ownShare}% of the full-coverage bill at about ${estimateDollars(car.ownCar)} a year, versus ${estimateDollars(average.ownCar)} on an average ${year} car (${partWords(phys)}). Third-party liability on the ${model} makes up the other ${liabShare}% at about ${estimateDollars(car.liability)} a year, against ${estimateDollars(average.liability)} for an average car (${partWords(liab)}).`
  }
  if (phys <= 94 && liab <= 94) {
    return `Both halves of ${articleFor(f.page.shortName)} ${f.page.shortName} policy come in below an average ${year} car: collision and comprehensive coverage for the ${model} itself accounts for ${ownShare}% of the bill at about ${estimateDollars(car.ownCar)} a year versus ${estimateDollars(average.ownCar)} (${partWords(phys)}), while liability coverage for harm to others takes ${liabShare}% at about ${estimateDollars(car.liability)} versus ${estimateDollars(average.liability)} (${partWords(liab)}).`
  }
  if (liab >= 105) {
    return `Liability claims weigh heavily on the ${f.page.shortName}: paying for damage and injuries to others represents ${liabShare}% of the ${model} bill at about ${estimateDollars(car.liability)} a year, compared with ${estimateDollars(average.liability)} for an average car (${partWords(liab)}). Coverage that repairs or replaces the ${model} itself makes up the remaining ${ownShare}% at about ${estimateDollars(car.ownCar)} a year, against ${estimateDollars(average.ownCar)} on an average ${year} car (${partWords(phys)}).`
  }
  const own = `Fixing or replacing the ${f.page.shortName} after a crash, theft, or storm makes up ${ownShare}% of the ${model} full-coverage bill: about ${estimateDollars(car.ownCar)} a year, versus ${estimateDollars(average.ownCar)} on an average ${year} car (${partWords(phys)} for the ${model}).`
  const others = `Paying for damage and injuries to other people makes up the remaining ${liabShare}% on the ${model}: about ${estimateDollars(car.liability)} a year, versus ${estimateDollars(average.liability)} on an average car (${partWords(liab)} for ${model} liability).`
  return `${own} ${others}`
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
  const model = modelTag(f)
  const vs = aboutTheSame(car - average, average)
    ? `about the same as adding a teen with an average ${f.page.pick.year} car`
    : `${differenceWords(car - average).replace(" a year", "")} than adding a teen with an average ${f.page.pick.year} car`
  const ownTeen = f.years[0]?.teenOwn.likely
  if (f.teenRank.rank <= 40) {
    const ownClause =
      ownTeen && ownTeen > car
        ? ` Putting that 16-year-old on a standalone ${f.page.name} policy instead costs about ${estimateDollars(ownTeen)} a year—about ${estimateDollars(ownTeen - car)} more than sharing the family policy on the ${model}.`
        : ""
    return `Because the ${f.page.shortName} starts from lower baseline claims, adding a new 16-year-old driver raises a parent's bill by about ${estimateDollars(car)} a year (${monthlyDollars(car)} a month), ${vs}.${ownClause}`
  }
  if (f.teenRank.rank > 80) {
    const ownClause =
      ownTeen && ownTeen > car
        ? ` A separate policy in the 16-year-old's own name with a ${f.page.name} runs about ${estimateDollars(ownTeen)} a year (${estimateDollars(ownTeen - car)} above the family-policy add-on for the ${model}).`
        : ""
    return `High young-driver multipliers amplify the ${f.page.shortName}'s rate: adding a 16-year-old to a parent's policy adds about ${estimateDollars(car)} a year (${monthlyDollars(car)} a month), ${vs}.${ownClause}`
  }
  const ownClause =
    ownTeen && ownTeen > car
      ? ` Writing a separate policy for a 16-year-old driving a ${f.page.name} runs about ${estimateDollars(ownTeen)} a year, so keeping the ${model} on the family policy saves about ${estimateDollars(ownTeen - car)} a year.`
      : ""
  return `Adding a new 16-year-old who drives the ${f.page.shortName} raises a parent's policy by about ${estimateDollars(car)} a year (${monthlyDollars(car)} a month), ${vs}.${ownClause}`
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
  const model = modelTag(f)
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
    peerNote = ` Right next to the ${model} in this class are the ${cheaperPeer.shortName} (about ${estimateDollars(cheaperPeer.likely)} a year) and the ${pricierPeer.shortName} (about ${estimateDollars(pricierPeer.likely)}).`
  } else if (cheaperPeer) {
    peerNote = ` Just below the ${model} in this class is the ${cheaperPeer.shortName} at about ${estimateDollars(cheaperPeer.likely)} a year.`
  } else if (pricierPeer) {
    peerNote = ` Next up from the ${model} in this class is the ${pricierPeer.shortName} at about ${estimateDollars(pricierPeer.likely)} a year.`
  }
  return `Among these ${of} ${group}, the ${f.page.shortName} is ${place} to insure.${peerNote}`
}

/** The versions of the model, when their prices differ: a sentence and one row per distinct price. */
export function trimsSummary(f: CarFigures): { text: string; rows: { trim: string; price: string }[] } | null {
  const trims = f.trims
  const model = modelTag(f)
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
      text: `All ${trims.length} catalog versions of the ${name} (${joinWords(trims.map((trim) => trim.trim))}) price within about $50 a year of each other on the ${model}.`,
      rows: [],
    }
  }
  const rows: { trim: string; price: string }[] = []
  for (const trim of trims) {
    const price = `about ${estimateDollars(trim.likely)}`
    const same = rows.find((row) => row.price === price)
    if (same) same.trim = `${same.trim}; ${trim.trim}`
    else rows.push({ trim: `${trim.trim} (${model})`, price })
  }
  return {
    text: `Across ${name} trims, full coverage goes from about ${estimateDollars(first.likely)} a year on the ${first.trim} to about ${estimateDollars(last.likely)} on the ${last.trim} because HLDI loss results differ by ${model} body, drive, or powertrain.`,
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
      ? `Full coverage on a used ${oldest.year} ${model} (${oldest.ageWords}) runs about ${estimateDollars(oldest.adult.likely)} a year—${differenceWords(oldest.adult.likely - newest.adult.likely).replace(" a year", "")} than on a ${newest.year} ${model}—while dropping collision and comprehensive on that ${oldest.year} ${model} brings liability-only coverage to about ${estimateDollars(oldest.liabilityOnly.likely)} a year.`
      : ""
  return [
    `Our catalog covers the ${f.page.shortName} across model years ${f.yearsListed}.`,
    dropNote,
    older ? `For ${model} years before ${CLAIMS_YEARS.first}, we apply the ${CLAIMS_YEARS.first}–${String(CLAIMS_YEARS.first + 2).slice(2)} HLDI report with our vehicle-age adjustment.` : "",
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
  claimsIntro: string
  groupRank: string
  claims: { label: string; value: string }[]
  effect: string
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

export const CAR_FIXED: CarContent["fixed"] = {
  yearsCaption: "One model year per age group. Liability only: no coverage for the car itself. Teen columns: a new 16-year-old.",
  teenNote: "That's the whole household's bill going up.",
  claimsIntro: "Its insurance results against an average car's (HLDI):",
  ctaNote: "Both start from your own situation if you've set one. For crash safety, see IIHS and NHTSA ratings.",
}

function gapWords(delta: number, base: number, model: string): string {
  return aboutTheSame(delta, base) ? `about the same as the ${model}` : `${differenceWords(delta).replace(" a year", "")} than the ${model}`
}

function similarHeading(f: CarFigures): string {
  const model = modelTag(f)
  if (f.similar.basis === "segment" && f.page.segment) return `Similar ${segmentWords(f.page.segment)} vs. the ${model}`
  return f.page.classLabel ? `Similar ${lowerFirst(f.page.classLabel)}s vs. the ${model}` : `Similar cars vs. the ${model}`
}

function otherDriversText(f: CarFigures): string {
  const model = modelTag(f)
  const [young, mid, senior] = f.otherDrivers
  if (!young || !mid || !senior) {
    return `For other drivers on their own ${f.page.shortName} policy: ${f.otherDrivers
      .map((row) => `ages ${row.ages}, about ${estimateDollars(row.estimate.likely)} a year`)
      .join("; ")}.`
  }
  const youngGap = differenceWords(young.estimate.likely - f.adult.likely).replace(" a year", "")
  return `On a standalone ${f.page.name} policy, a ${young.ages}-year-old pays about ${estimateDollars(young.estimate.likely)} a year (${youngGap} than a 45-year-old on the ${model}), a ${mid.ages}-year-old pays about ${estimateDollars(mid.estimate.likely)} for the ${model}, and a driver ${senior.ages} pays about ${estimateDollars(senior.estimate.likely)} a year.`
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

  return {
    title: carTitle(f),
    description: carDescription(f),
    lead: leadText(f),
    estimateLabel: `${page.name} (${pickedTrim}), national average`,
    estimate: `about ${estimateDollars(f.adult.likely)}`,
    monthly: `a year (about ${monthlyDollars(f.adult.likely)} a month for the ${model})`,
    range: `${rangeWords(f.adult.low, f.adult.high)} across insurers for ${articleFor(page.shortName)} ${page.shortName}`,
    averageLine:
      oldest && oldest.year < year
        ? `An average ${year} car runs about ${estimateDollars(f.averageCar.likely)} a year; a used ${oldest.year} ${model} drops to about ${estimateDollars(oldest.adult.likely)} (see ${model} table below).`
        : `An average ${year} car runs about ${estimateDollars(f.averageCar.likely)} a year compared with ${estimateDollars(f.adult.likely)} on the ${model}.`,
    about: `Priced for the ${year} ${pickedTrim} (the newest ${model} year our HLDI claims data covers): a 45-year-old driver, clean record, full coverage.`,
    stateLine: `State rules and rates shift the ${model} by the same share.`,
    yearsHeading: `A used ${page.shortName}, by model year`,
    yearsCaption: `One ${model} model year per age band. Liability only leaves off coverage for the ${model} itself; teen columns price a new 16-year-old on the ${model}.`,
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
    teenNote: `That increase is the household's total bill going up when a 16-year-old drives the ${model}.`,
    groupRank: groupRankText(f, peerGroupWords(f)),
    whyHeading: `Why the ${page.shortName} costs what it does`,
    claimsIntro: `How the ${page.name} compares with an average car in Highway Loss Data Institute (HLDI) claims:`,
    claims: [
      { label: `${model} crash repairs (collision)`, value: `${claimsPhrase(f.claims.repairs)} for the ${model}` },
      { label: `${model} theft and weather (comprehensive)`, value: `${claimsPhrase(f.claims.theftAndWeather)} for the ${model}` },
      { label: `Property damage ${articleFor(model)} ${model} causes to others`, value: `${claimsPhrase(f.claims.damageToOthers)} for the ${model}` },
      { label: `Injury claims involving ${model} drivers`, value: `${claimsPhrase(f.claims.injuriesToOthers)} for the ${model}` },
    ],
    effect: priceEffectText(f),
    kind: kindText(f),
    source:
      f.claims.series.length > 0
        ? `Matched the ${page.shortName} to HLDI series “${f.claims.series.join("; ")}” (${f.claims.report ?? `HLDI, ${f.claims.modelYears ?? "2022–24"} models`}).`
        : `Used the ${f.adult.vehicle.label} class average for the ${page.shortName} (${f.claims.report ?? `HLDI, ${f.claims.modelYears ?? "2022–24"} models`}).`,
    similarHeading: similarHeading(f),
    similar: [
      ...[...f.similar.cheaper].reverse(),
      { slug: null, name: page.name, likely: f.adult.likely },
      ...f.similar.pricier,
    ].map((car) => ({
      slug: car.slug,
      name: car.name,
      price: car.slug === null ? `${price(car.likely)} (this ${model})` : `${price(car.likely)} (${gapWords(car.likely - f.adult.likely, f.adult.likely, model)})`,
    })),
    statesHeading: `What ${articleFor(page.shortName)} ${page.shortName} costs in your state`,
    statesSummary: `In our six sample states for the ${model}, a ${page.name} runs from ${price(firstState.adultLikely)} a year in ${firstState.name} through ${joinWords(middleStateNames)} to ${price(lastState.adultLikely)} in ${lastState.name}:`,
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
    content.stateLine,
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
    content.whyHeading,
    content.claimsIntro,
    ...content.claims.map((row) => `${row.label} ${row.value}`),
    content.effect,
    content.kind,
    content.source,
    content.similarHeading,
    content.groupRank,
    ...content.similar.map((row) => `${row.name} ${row.price}`),
    content.statesHeading,
    content.statesSummary,
    ...content.states.map((row) => `${row.name} ${content.estimateLabel.split(",")[0]} ${row.adult} ${row.teen}`),
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
