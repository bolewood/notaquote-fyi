/**
 * The words on a state page, as plain strings, so tests can check that every
 * page says something of its own (docs/VOICE.md applies to all of it). The
 * page adds links and layout around them.
 */
import { plainEffective } from "../components/state-rules-table"
import { FACTOR_BUNDLE } from "./factor-engine"
import {
  aboutTheSame,
  differenceWords,
  dollars,
  estimateDollars,
  monthlyDollars,
  rangeEnds,
  rangeWords,
  shownYearly,
} from "./format"
import { stateName, type StateCode } from "./scenario"
import { DESCRIPTION_MAX, SITE_NAME, TITLE_MAX, type FaqItem } from "./site-meta"
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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "August 2026" from the factor bundle's CPI trend period ("2026-08"). */
export function trendMonthWords(): string {
  const period = FACTOR_BUNDLE.typicalStart?.trend.latestPeriod ?? ""
  const match = /^(\d{4})-(\d{2})$/.exec(period)
  if (!match) return period
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`
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

function rankPlaceShort(rank: number, of: number): string {
  const fromBottom = of - rank + 1
  if (rank === 1) return "highest in the US"
  if (fromBottom === 1) return "lowest in the US"
  return rank <= of / 2 ? `${ordinal(rank)} highest in the US` : `${ordinal(fromBottom)} lowest in the US`
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
  const name = shortName(f.code)
  const question = `How much is car insurance in ${name}?`
  if (question.length + SITE_NAME.length + 3 <= TITLE_MAX) return question
  return `${name} car insurance cost & minimums`
}

export function stateHeading(f: StateFigures): string {
  return `How much is car insurance in ${inSentence(f.code)}?`
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
  return style === "cell"
    ? listed.replace(/ of personal injury protection/, " PIP").replace(/ of property damage liability/, " property damage")
    : `the law asks for ${listed}`
}

export function stateDescription(f: StateFigures): string {
  const name = shortName(f.code)
  const min = minimumWords(f.rule, "cell")
  const teen = ` Teen add-on: about ${differenceWords(f.teen.added.increase)}.`
  const long = `Average car insurance in ${name}: ${naic(f.baseline.annual)} a year for full coverage in ${f.baseline.dataYear}, about ${estimateDollars(f.start.annual)} today. Minimums: ${min}.`
  if (long.length + teen.length <= DESCRIPTION_MAX) return long + teen
  if (long.length <= DESCRIPTION_MAX) return long
  const short = `Average car insurance in ${name}: ${naic(f.baseline.annual)} a year in ${f.baseline.dataYear}, about ${estimateDollars(f.start.annual)} today. Minimums: ${min}.`
  return short.length + teen.length <= DESCRIPTION_MAX ? short + teen : short
}

/** The page's opening direct-answer block: answers the cost and minimum questions in two sentences, varied by state bucket. */
export function leadText(f: StateFigures): string {
  const name = inSentence(f.code)
  const short = shortName(f.code)
  const { rank, of, tiedWith } = f.rank
  const fromBottom = of - rank - tiedWith.length + 1
  const vs = f.vsNational.words
    .replace(" more than", " above")
    .replace(" less than", " below")

  if (rank <= 10) {
    return `Full-coverage car insurance in ${name} averaged ${naic(f.baseline.annual)} a year in ${f.baseline.dataYear} (NAIC)—${vs} the ${naic(f.national.annual)} US average and ${rankPlaceShort(rank, of)}—which works out to about ${estimateDollars(f.start.annual)} a year in ${short} today (about ${monthlyDollars(f.start.annual)} a month, brought to ${trendMonthWords()} with the federal price index). In ${name}, ${minimumWords(f.rule)}, and ${short}'s ${f.baseline.dataYear} liability-only average—the closest NAIC figure to a minimum policy—was ${naic(f.baseline.liabilityOnly)} (about ${estimateDollars(f.liabilityToday)} today).`
  }
  if (fromBottom <= 10) {
    return `In ${name}, a full-coverage auto policy averaged ${naic(f.baseline.annual)} a year in ${f.baseline.dataYear} (NAIC), ${vs} the ${naic(f.national.annual)} national average (${rankPlaceShort(rank, of)}), or about ${estimateDollars(f.start.annual)} a year in ${short} today (about ${monthlyDollars(f.start.annual)} a month as of ${trendMonthWords()}). For ${short} drivers, ${minimumWords(f.rule)}, and liability-only coverage—the closest NAIC measure to a minimum policy—averaged ${naic(f.baseline.liabilityOnly)} in ${f.baseline.dataYear} (about ${estimateDollars(f.liabilityToday)} today).`
  }
  if (f.vsNational.percent <= -2) {
    return `Car insurance in ${name} cost an average of ${naic(f.baseline.annual)} a year for full coverage in ${f.baseline.dataYear} (NAIC), sitting ${vs} the ${naic(f.national.annual)} national average and coming to about ${estimateDollars(f.start.annual)} a year in ${short} today (about ${monthlyDollars(f.start.annual)} a month in ${trendMonthWords()} dollars). In ${name}, ${minimumWords(f.rule)}, while ${short} liability-only policies—the closest NAIC figure to minimum coverage—averaged ${naic(f.baseline.liabilityOnly)} in ${f.baseline.dataYear} (about ${estimateDollars(f.liabilityToday)} today).`
  }
  if (f.vsNational.percent >= 2) {
    return `Drivers in ${name} paid an average of ${naic(f.baseline.annual)} a year for full-coverage car insurance in ${f.baseline.dataYear} (NAIC), ${vs} the ${naic(f.national.annual)} US average, or about ${estimateDollars(f.start.annual)} a year in ${short} today (about ${monthlyDollars(f.start.annual)} a month through ${trendMonthWords()}). In ${name}, ${minimumWords(f.rule)}, and ${short}'s ${f.baseline.dataYear} liability-only average—the closest NAIC benchmark to a minimum policy—was ${naic(f.baseline.liabilityOnly)} (about ${estimateDollars(f.liabilityToday)} today).`
  }
  return `Average car insurance in ${name} cost ${naic(f.baseline.annual)} a year for full coverage in ${f.baseline.dataYear} (NAIC), ${vs} the ${naic(f.national.annual)} national average, or about ${estimateDollars(f.start.annual)} a year in ${short} today (about ${monthlyDollars(f.start.annual)} a month, brought up to ${trendMonthWords()} with the government's price index). In ${name}, ${minimumWords(f.rule)}, and ${short} liability-only coverage—the closest NAIC figure to a minimum policy—averaged ${naic(f.baseline.liabilityOnly)} in ${f.baseline.dataYear} (about ${estimateDollars(f.liabilityToday)} today).`
}

// ---------------------------------------------------------------------------
// Varied section headings (H2s) built from each state's own figures and rules

export function typicalPriceHeading(f: StateFigures): string {
  const name = inSentence(f.code)
  const { rank, of, tiedWith } = f.rank
  const fromBottom = of - rank - tiedWith.length + 1
  if (rank === 1) return `${shortName(f.code)} has the highest full-coverage average in the US: ${naic(f.baseline.annual)} in ${f.baseline.dataYear}`
  if (fromBottom === 1) return `${shortName(f.code)} has the lowest full-coverage average in the US: ${naic(f.baseline.annual)} in ${f.baseline.dataYear}`
  if (rank <= 10) return `What people pay in ${name}: ${ordinal(rank)} highest average in the US`
  if (fromBottom <= 10) return `What people pay in ${name}: ${ordinal(fromBottom)} lowest average in the US`
  if (f.vsNational.percent <= -5) return `Average car insurance cost in ${name}: ${-f.vsNational.percent}% below the US average`
  if (f.vsNational.percent >= 5) return `Average car insurance cost in ${name}: ${f.vsNational.percent}% above the US average`
  return `Average car insurance cost in ${name}: ${naic(f.baseline.annual)} in ${f.baseline.dataYear}, about ${estimateDollars(f.start.annual)} today`
}

export function neighborsHeading(f: StateFigures): string {
  const name = capitalize(inSentence(f.code))
  if (f.neighbors.length === 0) return `${name} compared with nearby states`
  if (!f.bordering) return `${name} compared with ${f.neighbors[0].name}`
  const cheaper = f.neighbors.filter((row) => row.baseline.annual < f.baseline.annual)
  const pricier = f.neighbors.filter((row) => row.baseline.annual > f.baseline.annual)
  const count = f.neighbors.length
  const listed =
    count <= 4
      ? joinNames(f.neighbors.map((row) => row.name))
      : `${f.neighbors.slice(0, 3).map((row) => row.name).join(", ")}, and ${count - 3} more bordering states`
  if (pricier.length === count) return `${name} costs less to insure than ${listed}`
  if (cheaper.length === count) return `${name} costs more to insure than ${listed}`
  return `How ${inSentence(f.code)} compares with ${listed}`
}

/** Extract the year a state's current liability limits took effect, when `effective` names one clearly. */
function effectiveSinceYear(rule: StateRule): string | null {
  const text = rule.effective ?? ""
  const unchanged = /unchanged since (\d{4})/i.exec(text)
  if (unchanged) return unchanged[1]
  const since = /\bsince (\d{4})\b/i.exec(text)
  if (since) return since[1]
  const effective = /(?:effective|beginning|on or after|after) (?:[A-Za-z]+\.? \d+, |\d+ [A-Za-z]+ )?(\d{4})/i.exec(text)
  if (effective) return effective[1]
  return null
}

function requirementClause(rule: StateRule): string | null {
  const { pipRequired: pip, umRequired: um, pipAmount } = rule
  const pipOfferedWritten = pip === false && pipAmount !== null && /reject it in writing/i.test(pipAmount)
  const pipWritten = pip === "required-unless-written-rejection" || pip === "required-unless-written-deletion"
  const umWritten = um === "required-unless-written-rejection" || um === "required-unless-written-deletion"
  if (pipOfferedWritten) return "PIP offered unless you reject it in writing"
  if (pipWritten && umWritten) return "PIP and uninsured-motorist coverage unless rejected in writing"
  if (pipWritten) return "PIP offered unless you reject it in writing"
  if (pip === "required-unless-rejected") return "PIP included unless you turn it down"
  if (pip === true && um === true) return "mandatory PIP and uninsured-motorist coverage"
  if (pip === true) return "mandatory personal injury protection (PIP)"
  if (um === true) return "mandatory uninsured-motorist coverage"
  if (umWritten) return "uninsured-motorist coverage unless rejected in writing"
  if (um === "required-unless-rejected") return "uninsured-motorist coverage unless you decline it"
  return null
}

export function minimumsHeading(f: StateFigures): string {
  const name = shortName(f.code)
  const rule = f.rule
  if (!rule || rule.sourceUrl === null) return `The least insurance ${inSentence(f.code)}'s law asks for`
  const short = liabilityShorthand(rule)
  if (rule.insuranceRequired === false) {
    return `${name}: insurance is optional for most drivers (${short ?? "state minimums"} when you buy a policy)`
  }
  if (!short) {
    return `${name}: ${minimumWords(rule, "cell")} minimum (${rule.noFault === true ? "no-fault" : "state law"})`
  }
  if (rule.scheduledChanges.length > 0) {
    const next = rule.scheduledChanges[0]
    const nextYear = next.from.slice(0, 4)
    return `${name}: ${short} minimums today, scheduled to rise in ${nextYear}`
  }
  const year = effectiveSinceYear(rule)
  const sinceWords = year ? ` since ${year}` : ""
  const extra = requirementClause(rule)
  if (rule.noFault === true) {
    return `${name}: ${short} minimums${sinceWords} and no-fault PIP rules`
  }
  if (rule.noFault === NO_FAULT_CHOICE) {
    return `${name}: ${short} minimums${sinceWords} and a choice on no-fault rules`
  }
  if (extra) {
    return `${name}: ${short} minimums${sinceWords}, with ${extra}`
  }
  return `${name}: ${short} liability minimums${sinceWords}`
}

export function teenHeading(f: StateFigures): string {
  return `Adding a 16-year-old driver in ${inSentence(f.code)}: about ${differenceWords(f.teen.added.increase)}`
}

export function faqHeading(f: StateFigures): string {
  return `Common questions about car insurance in ${inSentence(f.code)}`
}

// ---------------------------------------------------------------------------
// State-specific price, expenditure, rank, and neighbor prose

export function priceParagraph(f: StateFigures): string {
  const name = inSentence(f.code)
  const short = shortName(f.code)
  const liabPct = Math.round(f.liabilityShare * 100)
  const ownCarPct = 100 - liabPct
  const fullRank = f.rank.rank
  const liabRank = f.liabilityRank.rank
  const expGapDollars = f.baseline.annual - Math.round(f.baseline.averageExpenditure)
  const expGapPct = Math.round((1 - f.expenditureShare) * 100)
  const expPlace = rankPlaceShort(f.expenditureRank.rank, f.expenditureRank.of)

  let rankSentence: string
  if (liabRank <= fullRank - 5) {
    rankSentence = `In ${f.baseline.dataYear} NAIC data, ${name} was ${rankWords(f)} for full coverage (${naic(f.baseline.annual)} vs ${naic(f.national.annual)} nationally), but ranked higher on liability alone (${rankPlaceShort(liabRank, f.liabilityRank.of)} at ${naic(f.baseline.liabilityOnly)}) because liability makes up ${liabPct}% of a full-coverage ${short} bill.`
  } else if (fullRank <= liabRank - 5) {
    rankSentence = `In ${f.baseline.dataYear} NAIC data, ${name} was ${rankWords(f)} for full coverage (${naic(f.baseline.annual)} vs ${naic(f.national.annual)} nationally), while ranking lower on liability alone (${rankPlaceShort(liabRank, f.liabilityRank.of)} at ${naic(f.baseline.liabilityOnly)}) because ${ownCarPct}% of a full-coverage ${short} premium goes to collision and comprehensive coverage on your own car.`
  } else {
    rankSentence = `That ${naic(f.baseline.annual)} ${f.baseline.dataYear} full-coverage figure makes ${name} ${rankWords(f)} (against ${naic(f.national.annual)} nationally), with ${liabPct}% going to liability (${naic(f.baseline.liabilityOnly)}, ${rankPlaceShort(liabRank, f.liabilityRank.of)}) and ${ownCarPct}% covering physical damage to your own vehicle.`
  }

  let expSentence: string
  if (expGapPct >= 14) {
    expSentence = `NAIC also tracks ${name}'s average expenditure per insured vehicle—${naic(f.baseline.averageExpenditure)} in ${f.baseline.dataYear} (${expPlace}, or about ${estimateDollars(f.expenditureToday)} today)—which sits ${expGapPct}% (${dollars(expGapDollars)}) below ${short}'s full-coverage average because many ${short} drivers drop collision or comprehensive on older cars.`
  } else if (expGapPct <= 8) {
    expSentence = `Across all insured vehicles in ${name} (including policies without collision or comprehensive), NAIC's ${f.baseline.dataYear} average expenditure was ${naic(f.baseline.averageExpenditure)} (${expPlace}, about ${estimateDollars(f.expenditureToday)} today)—only ${expGapPct}% (${dollars(expGapDollars)}) below ${short}'s ${naic(f.baseline.annual)} full-coverage benchmark.`
  } else {
    expSentence = `Counting every insured car in ${name}—both full-coverage and liability-only policies—${short} drivers spent ${naic(f.baseline.averageExpenditure)} per vehicle on average in ${f.baseline.dataYear} (${expPlace}, about ${estimateDollars(f.expenditureToday)} today), or ${expGapPct}% (${dollars(expGapDollars)}) less than ${short}'s full-coverage combined average.`
  }

  return `${rankSentence} ${expSentence}`
}

/** replaces the generic "f.start.attribution" + "It's an average..." lines with state-specific attribution. */
export function typicalAttributionText(f: StateFigures): string {
  const short = shortName(f.code)
  const trendPct = Math.round(((f.start.annual / f.baseline.exact) - 1) * 100)
  return `${short}'s ${f.baseline.dataYear} NAIC full-coverage average (${naic(f.baseline.annual)}) adjusted +${trendPct}% to ${trendMonthWords()} using the US motor-vehicle insurance price index; your ${short} rate depends on your car, driving history, and coverage limits.`
}

/** How the state sits among its neighbors, naming the cheapest and priciest bordering states. */
export function neighborsSummary(f: StateFigures): string {
  const name = capitalize(inSentence(f.code))
  const short = shortName(f.code)
  if (f.neighbors.length === 0) return ""
  if (!f.bordering) {
    const other = f.neighbors[0]
    return `${name} doesn't share a land border with another state, so the table compares ${short} (${naic(f.baseline.annual)} in ${f.baseline.dataYear}) with ${other.name} (${naic(other.baseline.annual)}): ${short}'s typical price is ${other.vs.words} ${other.name}'s.`
  }
  const cheaper = f.neighbors.filter((row) => row.baseline.annual < f.baseline.annual).map((row) => row.name)
  const pricier = f.neighbors.filter((row) => row.baseline.annual > f.baseline.annual).map((row) => row.name)
  const count = f.neighbors.length
  const sortedByPrice = [...f.neighbors].sort((a, b) => a.baseline.annual - b.baseline.annual)
  const lowest = sortedByPrice[0]
  const highest = sortedByPrice.at(-1)!

  if (count === 1) {
    return `${name} borders only ${lowest.name} (${naic(lowest.baseline.annual)} in ${f.baseline.dataYear}): a typical ${short} policy (${naic(f.baseline.annual)}) is ${lowest.vs.words} ${lowest.name}'s, and moving the sample Camry from ${lowest.name} to ${short} today is ${moveWords(lowest.move.delta, lowest.move.current.likely).toLowerCase()}.`
  }

  const all = count === 2 ? `both bordering states (${joinNames(f.neighbors.map((r) => r.name))})` : `all ${NUMBER_WORDS[count] ?? count} bordering states`
  const spreadSentence =
    lowest.code !== highest.code
      ? ` Among ${short}'s neighbors, ${lowest.name} had the lowest ${f.baseline.dataYear} average (${naic(lowest.baseline.annual)}, moving to ${short} is ${moveWords(lowest.move.delta, lowest.move.current.likely).toLowerCase()}) and ${highest.name} had the highest (${naic(highest.baseline.annual)}, moving to ${short} is ${moveWords(highest.move.delta, highest.move.current.likely).toLowerCase()}).`
      : ""

  if (pricier.length === count) {
    return `A typical full-coverage policy in ${inSentence(f.code)} (${naic(f.baseline.annual)} in ${f.baseline.dataYear}) costs less than in ${all}.${spreadSentence}`
  }
  if (cheaper.length === count) {
    return `A typical full-coverage policy in ${inSentence(f.code)} (${naic(f.baseline.annual)} in ${f.baseline.dataYear}) costs more than in ${all}.${spreadSentence}`
  }
  const parts: string[] = []
  if (cheaper.length > 0) parts.push(`more than in ${joinNames(cheaper)}`)
  if (pricier.length > 0) parts.push(`less than in ${joinNames(pricier)}`)
  const same = f.neighbors.filter((row) => row.baseline.annual === f.baseline.annual).map((row) => row.name)
  if (same.length > 0) parts.push(`the same as in ${joinNames(same)}`)
  return `A typical policy in ${inSentence(f.code)} (${naic(f.baseline.annual)} in ${f.baseline.dataYear}) costs ${joinNames(parts)}.${spreadSentence}`
}

export function similarPricesSummary(f: StateFigures): string {
  if (f.similarPriceStates.length === 0) return ""
  const name = inSentence(f.code)
  const listed = joinNames(f.similarPriceStates.map((row) => `${row.name} (${naic(row.baseline.annual)} in ${f.baseline.dataYear}, about ${estimateDollars(row.startAnnual)} today)`))
  return `Outside ${shortName(f.code)}'s neighbors, the states closest to ${name}'s ${naic(f.baseline.annual)} full-coverage average are ${listed}.`
}

export function featuredCarsHeading(f: StateFigures): string {
  return `What popular cars cost to insure in ${inSentence(f.code)}`
}

export function featuredCarsSummary(f: StateFigures): string {
  if (f.featuredCars.length === 0) return ""
  const name = inSentence(f.code)
  const short = shortName(f.code)
  const sorted = [...f.featuredCars].sort((a, b) => a.adultLikely - b.adultLikely)
  const low = sorted[0]
  const high = sorted.at(-1)!
  return `In ${name}, a 45-year-old with full coverage pays from about ${estimateDollars(low.adultLikely)} a year for a ${low.name} to about ${estimateDollars(high.adultLikely)} for a ${high.name} on these ${short} sample models.`
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
    return `${capitalize(name)} is a no-fault state: after a crash, your own ${shortName(f.code)} policy pays for your medical bills first through personal injury protection (PIP), regardless of who caused the crash.`
  }
  if (rule.noFault === NO_FAULT_CHOICE) {
    return `In ${name}, drivers choose whether no-fault rules or traditional fault rules apply on their policy. Under no-fault in ${shortName(f.code)}, your own policy pays for your injuries first regardless of who caused the crash.`
  }
  return null
}

/** State-specific explanation of what the state's minimum liability and coverage rules mean in practice. */
export function minimumsOverviewText(f: StateFigures): string {
  const rule = f.rule
  const name = inSentence(f.code)
  const short = shortName(f.code)
  if (!rule) return ""
  const lawLabel = rule.sources[0]?.label ?? `${short} statute`
  const shortLim = liabilityShorthand(rule)
  if (rule.insuranceRequired === false && shortLim) {
    return `Under ${lawLabel}, ${name} does not require most drivers to buy an auto policy, but drivers still have to prove financial responsibility after an at-fault crash, and any ${short} policy sold must carry at least ${shortLim} liability plus ${rule.pipAmount ?? "medical payments coverage"}—without covering repairs to your own car.`
  }
  if (!shortLim) {
    return `Under ${lawLabel}, ${name} requires ${minimumWords(rule).replace(/^the law asks for /, "")} and does not set a general bodily-injury liability minimum for most drivers, nor does a ${short} minimum policy pay to repair your own vehicle.`
  }
  return `Set by ${lawLabel}, ${name}'s ${shortLim} minimum pays up to ${dollars(rule.biPerPerson!)} per person and ${dollars(rule.biPerAccident!)} per crash for injuries you cause to others, plus ${dollars(rule.pd!)} for others' property—the legal floor in ${short}, not a coverage recommendation, and it excludes collision or comprehensive repairs on your own car.`
}

/** The teen callout's small print: the monthly figure and the whole policy. */
export function teenCallout(f: StateFigures): string {
  const added = f.teen.added
  const short = shortName(f.code)
  const pct = Math.round((added.increase / f.start.annual) * 100)
  return `About ${monthlyDollars(added.increase)} a month (+${pct}% over a typical ${short} adult policy of ${estimateDollars(f.start.annual)}), bringing the combined ${short} family policy to ${rangeWords(added.after.low, added.after.high)} a year.`
}

export function ownPolicyParagraph(f: StateFigures): string {
  const own = f.teen.own
  const name = inSentence(f.code)
  const short = shortName(f.code)
  const savings = own.likely - f.teen.added.increase
  let surveyNote = ""
  if (f.survey?.kind === "rate-survey" && f.survey.profiles.length > 1) {
    const youngProfile = f.survey.profiles[1]
    const firstPlace = youngProfile.places[0]
    if (firstPlace) {
      surveyNote = ` In ${f.survey.publisher}'s ${f.survey.dataYear} sample survey (${youngProfile.shortLabel}), the median company quote in ${firstPlace.place} is ${dollars(firstPlace.median)} a year (${dollars(firstPlace.low)}–${dollars(firstPlace.high)}).`
    }
  }
  return `On a separate ${short} policy of their own with the same car, a 16-year-old in ${name} would pay about ${estimateDollars(own.likely)} a year (${rangeWords(own.low, own.high)}), so sharing a parent's ${short} policy saves about ${estimateDollars(savings)} a year.${surveyNote}`
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
  const ownShare = 100 - share
  const short = shortName(f.code)
  return `Liability-only coverage in ${inSentence(f.code)}—the closest NAIC figure to what a ${short} minimum policy costs—averaged ${naic(f.baseline.liabilityOnly)} in ${f.baseline.dataYear} (about ${estimateDollars(f.liabilityToday)} in ${short} today), ${place} of the 50 states and DC. That makes liability ${share}% of ${short}'s full-coverage average (${naic(f.baseline.annual)}), while the remaining ${ownShare}% goes toward collision and comprehensive coverage for your own car.`
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
  const short = shortName(f.code)
  const first = f.teenCars[0]
  const last = f.teenCars.at(-1)!
  const ties = tiedAtTop(f.teenCars)
  if (ties >= 3 && !MODELS_ENABLED) {
    return `Without claims results for each model, cars of the same kind come out the same here: ${ties} of the ${f.teenCars.length} cars on the site's popular lists tie for the least to add a teen with in ${name}, at about ${differenceWords(first.added.increase)}.`
  }
  if (ties >= 2) {
    const tied = f.teenCars.slice(0, ties)
    return `In ${name}, ${modelsWords(tied)} come out the same, the least of the ${f.teenCars.length} cars on the site's popular lists to add a teen with: about ${differenceWords(first.added.increase)} on a ${short} policy, versus about ${differenceWords(last.added.increase)} for the ${last.car.label} at the top of ${short}'s list.`
  }
  return `In ${name}, the ${first.car.label} is the cheapest of the ${f.teenCars.length} cars on the site's popular lists to add a teen with: about ${differenceWords(first.added.increase)} on a ${short} policy, compared with about ${differenceWords(last.added.increase)} for the ${last.car.label} in ${short}.`
}

// ---------------------------------------------------------------------------
// FAQ items built strictly from StateFigures, StateRule, and StateSurveySection

function faqMinimumAnswer(f: StateFigures): string | null {
  const rule = f.rule
  if (!rule || rule.sourceUrl === null) return null
  const name = inSentence(f.code)
  const short = shortName(f.code)
  const lawLabel = rule.sources[0]?.label ?? `${short} law`
  const parts: string[] = []
  if (rule.insuranceRequired === false && rule.biPerPerson !== null && rule.biPerAccident !== null && rule.pd !== null) {
    parts.push(
      `Under ${lawLabel}, buying a policy is optional for most ${name} drivers, but any ${short} auto policy must carry at least ${dollars(rule.biPerPerson)} per person / ${dollars(rule.biPerAccident)} per crash for bodily injury and ${dollars(rule.pd)} for property damage (${liabilityShorthand(rule)}).`,
    )
  } else if (rule.biPerPerson !== null && rule.biPerAccident !== null && rule.pd !== null) {
    const single = rule.combinedSingleLimit !== null ? ` (or a ${dollars(rule.combinedSingleLimit)} single limit)` : ""
    parts.push(
      `Under ${lawLabel}, ${name} requires ${liabilityShorthand(rule)} liability: ${dollars(rule.biPerPerson)} per person and ${dollars(rule.biPerAccident)} per crash for bodily injury, plus ${dollars(rule.pd)} for property damage${single}.`,
    )
  } else if (rule.pd !== null) {
    parts.push(`Under ${lawLabel}, ${name} requires ${minimumWords(rule).replace(/^the law asks for /, "")}.`)
  } else {
    return null
  }
  if (rule.effective) {
    parts.push(plainEffective(rule.effective))
  }
  return parts.join(" ")
}

function faqNoFaultAnswer(f: StateFigures): string | null {
  const rule = f.rule
  if (!rule || (rule.noFault === null && rule.pipRequired === null)) return null
  const name = inSentence(f.code)
  const short = shortName(f.code)
  const pipDetails = rule.pipAmount ? ` ${rule.pipAmount.replace(/per accident/g, "per crash")}` : ""
  if (rule.noFault === true) {
    return `Yes—${name} uses no-fault auto insurance rules, so your own ${short} personal injury protection (PIP) pays your medical bills first after a crash regardless of fault.${pipDetails}`
  }
  if (rule.noFault === NO_FAULT_CHOICE) {
    return `In ${name}, you choose between no-fault rules and traditional fault rules when you buy or renew a ${short} policy.${pipDetails}`
  }
  if (rule.pipRequired === true) {
    return `No—${name} is an at-fault state for crash liability, though ${short} law still requires personal injury protection (PIP) on auto policies.${pipDetails}`
  }
  if (
    rule.pipRequired === "required-unless-written-rejection" ||
    rule.pipRequired === "required-unless-written-deletion" ||
    (rule.pipRequired === false && rule.pipAmount !== null && /reject it in writing/i.test(rule.pipAmount))
  ) {
    return `No—${name} follows fault-based crash rules, but ${short} insurers must offer or include personal injury protection (PIP) unless you reject it in writing.${pipDetails}`
  }
  if (rule.pipRequired === "required-unless-rejected") {
    return `No—${name} uses fault-based crash rules, though ${short} policies include personal injury protection (PIP) unless you decline it.${pipDetails}`
  }
  const umDetails = rule.umLimits ? ` For uninsured/underinsured motorist coverage in ${short}: ${rule.umLimits.replace(/per accident/g, "per crash")}` : ""
  return `No—${name} is a fault-based (tort) state where the at-fault driver's insurer pays for crash damages, and ${short} does not require personal injury protection (PIP).${umDetails}`
}

export function stateFaqs(f: StateFigures): FaqItem[] {
  const name = inSentence(f.code)
  const short = shortName(f.code)
  const liabPct = Math.round(f.liabilityShare * 100)
  const items: FaqItem[] = [
    {
      question: `How much is car insurance in ${name}?`,
      answer: `In ${name}, full-coverage car insurance averaged ${naic(f.baseline.annual)} a year in ${f.baseline.dataYear} (${rankWords(f)} per NAIC), or about ${estimateDollars(f.start.annual)} a year (${monthlyDollars(f.start.annual)} a month) in ${short} as of ${trendMonthWords()}. ${capitalize(short)} liability-only coverage averaged ${naic(f.baseline.liabilityOnly)} in ${f.baseline.dataYear} (${liabPct}% of ${short}'s full-coverage figure, or about ${estimateDollars(f.liabilityToday)} today), and ${short} drivers spent ${naic(f.baseline.averageExpenditure)} per insured car across all policies.`,
    },
  ]

  const minAnswer = faqMinimumAnswer(f)
  if (minAnswer) {
    items.push({
      question: `What are the minimum car insurance limits in ${name}?`,
      answer: minAnswer,
    })
  }

  items.push({
    question: `How much does adding a 16-year-old teen driver cost in ${name}?`,
    answer: `Adding a 16-year-old to a parent's full-coverage policy in ${name} adds about ${differenceWords(f.teen.added.increase)} (${monthlyDollars(f.teen.added.increase)} a month), bringing the ${short} household policy to ${rangeWords(f.teen.added.after.low, f.teen.added.after.high)} a year versus about ${estimateDollars(f.teen.own.likely)} a year (${rangeWords(f.teen.own.low, f.teen.own.high)}) on a standalone ${short} teen policy.`,
  })

  const noFaultAnswer = faqNoFaultAnswer(f)
  if (noFaultAnswer) {
    items.push({
      question: `Is ${name} a no-fault car insurance state?`,
      answer: noFaultAnswer,
    })
  }

  if (f.survey?.kind === "rate-survey") {
    const baseProfile = f.survey.profiles[0]
    const places = baseProfile.places
    const sorted = [...places].sort((a, b) => a.median - b.median)
    const lowPlace = sorted[0]
    const highPlace = sorted.at(-1)!
    items.push({
      question: `How do sample car insurance rates vary across ${name} in ${f.survey.publisher}'s ${f.survey.dataYear} survey?`,
      answer:
        lowPlace.place === highPlace.place
          ? `In ${f.survey.publisher}'s ${f.survey.dataYear} comparison (${baseProfile.shortLabel}), the median quote across ${lowPlace.carrierCount} ${short} insurers in ${lowPlace.place} is ${dollars(lowPlace.median)} a year, ranging from ${dollars(lowPlace.low)} to ${dollars(lowPlace.high)} across companies.`
          : `In ${f.survey.publisher}'s ${f.survey.dataYear} rate comparison (${baseProfile.shortLabel}), the median company rate goes from ${dollars(lowPlace.median)} a year in ${lowPlace.place} (${dollars(lowPlace.low)}–${dollars(lowPlace.high)}) to ${dollars(highPlace.median)} a year in ${highPlace.place} (${dollars(highPlace.low)}–${dollars(highPlace.high)}).`,
    })
  } else if (f.survey?.kind === "surcharge-schedule") {
    const schedule = joinNames(
      f.survey.rows.map((r) => `${r.points} ${r.points === 1 ? "point raises the base rate by" : "points by"} ${r.surchargePercent}%`),
    )
    items.push({
      question: "How much do North Carolina SDIP insurance points increase your rate?",
      answer: `Under North Carolina's Safe Driver Incentive Plan (SDIP), ${schedule} for three years.`,
    })
  } else if (f.neighbors.length > 0) {
    const first = f.neighbors[0]
    const move = moveWords(first.move.delta, first.move.current.likely).toLowerCase()
    const rest =
      f.neighbors.length > 1
        ? ` Other bordering states averaged ${joinNames(f.neighbors.slice(1).map((row) => `${naic(row.baseline.annual)} in ${row.name}`))} in ${f.baseline.dataYear}.`
        : ""
    items.push({
      question: `How does ${name}'s car insurance cost compare with ${first.name}?`,
      answer: `${capitalize(name)} averaged ${naic(f.baseline.annual)} for full coverage in ${f.baseline.dataYear} (NAIC) against ${naic(first.baseline.annual)} in ${first.name} (${first.vs.words} ${first.name}), and moving a sample policy from ${first.name} to ${short} today is ${move}.${rest}`,
    })
  }

  return items
}

/**
 * Every formatted dollar value in `StateFigures` (including its `rule`,
 * `effective`, and `survey`), so tests can verify that every dollar figure in
 * an FAQ answer comes from the state's committed data.
 */
export function stateFigureDollars(f: StateFigures): Set<string> {
  const allowed = new Set<string>([
    dollars(f.baseline.annual),
    dollars(f.baseline.liabilityOnly),
    dollars(f.baseline.averageExpenditure),
    dollars(f.national.annual),
    dollars(f.national.liabilityOnly),
    dollars(f.national.averageExpenditure),
    estimateDollars(f.start.annual),
    monthlyDollars(f.start.annual),
    estimateDollars(f.liabilityToday),
    monthlyDollars(f.liabilityToday),
    estimateDollars(f.expenditureToday),
    dollars(Math.abs(shownYearly(f.teen.added.increase))),
    monthlyDollars(f.teen.added.increase),
    dollars(rangeEnds(f.teen.added.after.low, f.teen.added.after.high).low),
    dollars(rangeEnds(f.teen.added.after.low, f.teen.added.after.high).high),
    estimateDollars(f.teen.own.likely),
    monthlyDollars(f.teen.own.likely),
    dollars(rangeEnds(f.teen.own.low, f.teen.own.high).low),
    dollars(rangeEnds(f.teen.own.low, f.teen.own.high).high),
  ])
  for (const row of f.neighbors) {
    allowed.add(dollars(row.baseline.annual))
    allowed.add(dollars(Math.abs(shownYearly(row.move.delta))))
  }
  for (const item of f.teenCars) {
    allowed.add(dollars(Math.abs(shownYearly(item.added.increase))))
    allowed.add(estimateDollars(item.own.likely))
  }
  if (f.rule) {
    for (const amount of [f.rule.biPerPerson, f.rule.biPerAccident, f.rule.pd, f.rule.combinedSingleLimit]) {
      if (amount !== null) allowed.add(dollars(amount))
    }
    for (const text of [f.rule.pipAmount, f.rule.umLimits, f.rule.effective, f.rule.note, f.rule.goodToKnow]) {
      for (const m of text?.match(/\$[\d,]+(\.\d+)?/g) ?? []) allowed.add(m)
    }
  }
  if (f.survey?.kind === "rate-survey") {
    for (const prof of f.survey.profiles) {
      for (const place of prof.places) {
        allowed.add(dollars(place.median))
        allowed.add(dollars(place.low))
        allowed.add(dollars(place.high))
      }
      for (const m of prof.profileDescription.match(/\$[\d,]+(\.\d+)?/g) ?? []) allowed.add(m)
    }
  }
  return allowed
}

/** Every sentence the page is built around, for the uniqueness test. */
export function stateMainText(f: StateFigures): string {
  const surveyLines: string[] = []
  if (f.survey?.kind === "rate-survey") {
    surveyLines.push(f.survey.heading, f.survey.intro, f.survey.caveat)
    for (const prof of f.survey.profiles) {
      surveyLines.push(prof.shortLabel, prof.profileDescription)
      for (const place of prof.places) {
        surveyLines.push(`${place.place} ${dollars(place.median)} ${dollars(place.low)} ${dollars(place.high)}`)
      }
    }
  } else if (f.survey?.kind === "surcharge-schedule") {
    surveyLines.push(f.survey.heading, f.survey.intro, f.survey.caveat)
    for (const row of f.survey.rows) {
      surveyLines.push(`${row.points} ${row.surchargePercent}% ${row.whatCounts}`)
    }
  }

  return [
    stateTitle(f),
    stateHeading(f),
    stateDescription(f),
    leadText(f),
    typicalPriceHeading(f),
    typicalAttributionText(f),
    priceParagraph(f),
    ...surveyLines,
    neighborsHeading(f),
    neighborsSummary(f),
    ...f.neighbors.map((row) => `${row.name} ${naic(row.baseline.annual)} ${moveWords(row.move.delta, row.move.current.likely)}`),
    similarPricesSummary(f),
    minimumsHeading(f),
    minimumsOverviewText(f),
    liabilityOnlyText(f),
    faultText(f) ?? "",
    f.rule?.note ?? "",
    f.rule?.goodToKnow ?? "",
    f.rule?.pipAmount ?? "",
    f.rule?.umLimits ?? "",
    f.rule?.effective ? plainEffective(f.rule.effective) : "",
    ...f.evidence.map((ev) => `${ev.label} ${ev.quote ?? ""}`),
    teenHeading(f),
    teenCallout(f),
    ownPolicyParagraph(f),
    teenCarsSummary(f),
    ...f.teenCars.slice(0, TEEN_TOP).map((item) => `${item.car.label} ${differenceWords(item.added.increase)} ${estimateDollars(item.own.likely)}`),
    featuredCarsHeading(f),
    featuredCarsSummary(f),
    ...f.featuredCars.map((car) => `${car.name} ${estimateDollars(car.adultLikely)} ${differenceWords(car.teenIncrease)}`),
    faqHeading(f),
    ...stateFaqs(f).map((item) => `${item.question} ${item.answer}`),
  ]
    .filter(Boolean)
    .join("\n")
}
