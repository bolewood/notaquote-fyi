/**
 * The words on a state page, as plain strings, so tests can check that every
 * page says something of its own (docs/VOICE.md applies to all of it). The
 * page adds links and layout around them.
 */
import { FACTOR_BUNDLE } from "./factor-engine"
import { aboutTheSame, differenceWords, dollars, estimateDollars, longDate, monthlyDollars, rangeEnds, rangeWords, shownYearly } from "./format"
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
  return style === "cell" ? listed.replace(/ of personal injury protection/, " PIP").replace(/ of property damage liability/, " property damage") : `the law asks for ${listed}`
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

/** The page's opening direct-answer block: answers the cost and minimum questions in two sentences. */
export function leadText(f: StateFigures): string {
  const name = inSentence(f.code)
  const vs = f.vsNational.words
    .replace(" more than", " above")
    .replace(" less than", " below")
    .replace("about the same as", "about the same as")
  return `Average car insurance in ${name} cost ${naic(f.baseline.annual)} a year for full coverage in ${f.baseline.dataYear} (NAIC), ${vs} the ${naic(f.national.annual)} national average, or about ${estimateDollars(f.start.annual)} a year today (about ${monthlyDollars(f.start.annual)} a month, brought up to ${trendMonthWords()} with the government's price index). In ${name}, ${minimumWords(f.rule)}, and liability-only coverage—the closest NAIC figure to a minimum policy—averaged ${naic(f.baseline.liabilityOnly)} in ${f.baseline.dataYear} (about ${estimateDollars(f.liabilityToday)} today).`
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

// ---------------------------------------------------------------------------
// FAQ items built strictly from StateFigures and StateRule

function faqMinimumAnswer(f: StateFigures): string | null {
  const rule = f.rule
  if (!rule || rule.sourceUrl === null) return null
  const name = inSentence(f.code)
  const parts: string[] = []
  if (rule.insuranceRequired === false && rule.biPerPerson !== null && rule.biPerAccident !== null && rule.pd !== null) {
    parts.push(
      `Car insurance is optional for most drivers in ${name}, but any policy you buy must include at least ${dollars(rule.biPerPerson)} per person and ${dollars(rule.biPerAccident)} per crash for bodily injury and ${dollars(rule.pd)} for property damage (${liabilityShorthand(rule)}).`,
    )
  } else if (rule.biPerPerson !== null && rule.biPerAccident !== null && rule.pd !== null) {
    const single = rule.combinedSingleLimit !== null ? ` (or a ${dollars(rule.combinedSingleLimit)} combined single limit)` : ""
    parts.push(
      `${capitalize(name)} requires at least ${dollars(rule.biPerPerson)} per person and ${dollars(rule.biPerAccident)} per crash for bodily-injury liability, plus ${dollars(rule.pd)} for property-damage liability (${liabilityShorthand(rule)})${single}.`,
    )
  } else if (rule.pd !== null) {
    parts.push(`${capitalize(name)} requires ${ minimumWords(rule).replace(/^the law asks for /, "") }.`)
  } else {
    return null
  }
  const extra = requirementClause(rule)
  if (extra) {
    parts.push(`Policies also include ${extra}.`)
  } else if (rule.pipRequired === false && rule.umRequired === false) {
    parts.push("Personal injury protection (PIP) and uninsured-motorist coverage are optional.")
  }
  if (rule.checkedOn) {
    parts.push(`Checked against ${name}'s statute on ${longDate(rule.checkedOn)}.`)
  }
  return parts.join(" ")
}

function faqNoFaultAnswer(f: StateFigures): string | null {
  const rule = f.rule
  if (!rule || (rule.noFault === null && rule.pipRequired === null)) return null
  const name = inSentence(f.code)
  if (rule.noFault === true) {
    return `Yes. ${capitalize(name)} is a no-fault state: after a crash, your own policy's personal injury protection (PIP) pays for your medical bills first, regardless of who caused the crash, and state law limits when you can sue the other driver.`
  }
  if (rule.noFault === NO_FAULT_CHOICE) {
    return `You choose. In ${name}, drivers pick between no-fault coverage and traditional fault rules when buying or renewing a policy. Under no-fault, your own policy pays for your injuries first regardless of fault.`
  }
  if (rule.pipRequired === true) {
    return `No. ${capitalize(name)} uses fault-based rules, so the driver who caused the crash is responsible for the damage, but state law still requires personal injury protection (PIP) on your policy for medical bills.`
  }
  if (
    rule.pipRequired === "required-unless-written-rejection" ||
    rule.pipRequired === "required-unless-written-deletion" ||
    (rule.pipRequired === false && rule.pipAmount !== null && /reject it in writing/i.test(rule.pipAmount))
  ) {
    return `No. ${capitalize(name)} is a fault-based state (the at-fault driver's insurance pays for injuries and damage they cause), though insurers must offer personal injury protection (PIP) and include it unless you reject it in writing.`
  }
  if (rule.pipRequired === "required-unless-rejected") {
    return `No. ${capitalize(name)} is a fault-based state, though insurers must include personal injury protection (PIP) on a policy unless you turn it down.`
  }
  return `No. ${capitalize(name)} is a fault-based (tort) state: the driver who caused the crash is financially responsible for the injuries and property damage, and personal injury protection (PIP) is not required.`
}

export function stateFaqs(f: StateFigures): FaqItem[] {
  const name = inSentence(f.code)
  const items: FaqItem[] = [
    {
      question: `How much is car insurance in ${name}?`,
      answer: `Full-coverage car insurance in ${name} averaged ${naic(f.baseline.annual)} a year in ${f.baseline.dataYear} (NAIC), or about ${estimateDollars(f.start.annual)} a year (about ${monthlyDollars(f.start.annual)} a month) today after price changes through ${trendMonthWords()}. Liability-only coverage—the closest NAIC figure to a minimum policy—averaged ${naic(f.baseline.liabilityOnly)} in ${f.baseline.dataYear} (about ${estimateDollars(f.liabilityToday)} a year today).`,
    },
    {
      question: `What is the average cost of car insurance in ${name}?`,
      answer: `In ${f.baseline.dataYear}, ${name}'s combined average premium for full coverage was ${naic(f.baseline.annual)} a year (${f.vsNational.words} the ${naic(f.national.annual)} national average), making ${name} ${rankWords(f)} (NAIC). Drivers in ${name} spent ${naic(f.baseline.averageExpenditure)} per insured car on average in ${f.baseline.dataYear} (versus ${naic(f.national.averageExpenditure)} nationally); average expenditure is lower than the full-coverage average because some drivers carry liability without collision or comprehensive coverage.`,
    },
  ]

  const minAnswer = faqMinimumAnswer(f)
  if (minAnswer) {
    items.push({
      question: `What is the minimum car insurance required in ${name}?`,
      answer: minAnswer,
    })
  }

  items.push({
    question: `How much does adding a teen driver cost in ${name}?`,
    answer: `Adding a 16-year-old to a parent's full-coverage policy on an average car in ${name} adds about ${differenceWords(f.teen.added.increase)} (about ${monthlyDollars(f.teen.added.increase)} a month), bringing the whole policy to ${rangeWords(f.teen.added.after.low, f.teen.added.after.high)} a year. On a separate policy of their own, the same teen would pay about ${estimateDollars(f.teen.own.likely)} a year (${rangeWords(f.teen.own.low, f.teen.own.high)}).`,
  })

  const noFaultAnswer = faqNoFaultAnswer(f)
  if (noFaultAnswer) {
    items.push({
      question: `Is ${name} a no-fault state?`,
      answer: noFaultAnswer,
    })
  }

  if (f.neighbors.length > 0) {
    const first = f.neighbors[0]
    const move = moveWords(first.move.delta, first.move.current.likely).toLowerCase()
    const leadWord =
      f.baseline.annual > first.baseline.annual
        ? `Yes—in ${f.baseline.dataYear}, full coverage in ${name} averaged ${naic(f.baseline.annual)} a year, compared with ${naic(first.baseline.annual)} in ${first.name} (NAIC).`
        : f.baseline.annual < first.baseline.annual
          ? `No—in ${f.baseline.dataYear}, full coverage in ${name} averaged ${naic(f.baseline.annual)} a year, which was less than ${first.name}'s ${naic(first.baseline.annual)} average (NAIC).`
          : `They were the same in ${f.baseline.dataYear}, at ${naic(f.baseline.annual)} a year (NAIC).`
    const others =
      f.neighbors.length > 1
        ? ` Among ${name}'s other neighbors, the ${f.baseline.dataYear} average was ${joinNames(f.neighbors.slice(1).map((row) => `${naic(row.baseline.annual)} in ${row.name}`))}.`
        : ""
    items.push({
      question: `Is car insurance in ${name} more expensive than in ${first.name}?`,
      answer: `${leadWord} Moving the same driver and car from ${first.name} to ${name} today works out to ${move}.${others}`,
    })
  }

  return items
}

/**
 * Every formatted dollar value in `StateFigures`, so tests can verify that
 * every dollar figure in an FAQ answer comes straight from `StateFigures`.
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
    const pipMatch = f.rule.pipAmount?.match(/^\$[\d,]+/)?.[0]
    if (pipMatch) allowed.add(pipMatch)
  }
  return allowed
}

/** Every sentence the page is built around, for the uniqueness test. */
export function stateMainText(f: StateFigures): string {
  return [
    stateTitle(f),
    stateHeading(f),
    stateDescription(f),
    leadText(f),
    typicalPriceHeading(f),
    priceParagraph(f),
    neighborsHeading(f),
    neighborsSummary(f),
    ...f.neighbors.map((row) => `${row.name} ${naic(row.baseline.annual)} ${moveWords(row.move.delta, row.move.current.likely)}`),
    minimumsHeading(f),
    liabilityOnlyText(f),
    faultText(f) ?? "",
    f.rule?.note ?? "",
    f.rule?.goodToKnow ?? "",
    teenHeading(f),
    teenCallout(f),
    ownPolicyParagraph(f),
    teenCarsSummary(f),
    ...f.teenCars.slice(0, TEEN_TOP).map((item) => `${item.car.label} ${differenceWords(item.added.increase)} ${estimateDollars(item.own.likely)}`),
    faqHeading(f),
    ...stateFaqs(f).map((item) => `${item.question} ${item.answer}`),
  ]
    .filter(Boolean)
    .join("\n")
}
