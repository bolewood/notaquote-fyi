/**
 * A thin layer between the page and the factor engine. Every dollar figure on
 * the site comes from the engine (src/lib/factor-engine.ts); this file only
 * picks the starting point, names what changed, and turns the engine's
 * vehicle factors into a short phrase for the compare table.
 */
import type { VehicleFacts } from "./catalog-class"
import {
  BASIS_WORDS,
  compareVehicles,
  estimate,
  teenAddedToPolicy,
  FACTOR_BUNDLE,
  formatDollars,
  TYPICAL_START_ATTRIBUTION,
  typicalStart,
  vehicleAgeKey,
  whatIf,
  type Estimate,
  type StartingPoint,
  type TeenAdded,
  type VehicleComparisonRow,
  type VehicleRelativity,
  type WhatIf,
} from "./factor-engine"
import {
  AGE_BANDS,
  coverageLabel,
  hasPhysicalDamage,
  INCIDENTS,
  MILEAGE_BANDS,
  regionLabel,
  stateName,
  YEARS_LICENSED,
  type Scenario,
} from "./scenario"
import type { Situation } from "./situation"
import type { TrimConfidence } from "./catalog-match"
import { differenceWords } from "./format"

export { formatDollars, TYPICAL_START_ATTRIBUTION }

/**
 * Where every estimate starts: what they pay now (with the car and driver it
 * belongs to), or the typical yearly price for their state. "Your situation
 * now" is always the policyholder's own policy; a teen joins it only as a
 * what-if (see priceWhatIf).
 */
export function startingPoint(situation: Situation, nowVehicle: VehicleFacts): StartingPoint | null {
  if (situation.premium !== null) {
    return { annual: situation.premium, scenario: situation.scenario, vehicle: nowVehicle, kind: "yours" }
  }
  return typicalStart(situation.scenario)
}

/**
 * True when a what-if adds a 16–18-year-old to the policyholder's own
 * policy: the situation now is an older driver, the what-if is a teen, and
 * the visitor chose "Added to my policy".
 */
export function addsTeen(now: Scenario, next: Scenario, teenOnParentPolicy: boolean): boolean {
  return teenOnParentPolicy && next.age === "16-18" && now.age !== "16-18"
}

/** One short line about where the numbers start, for the top of a card. */
export function startShort(start: StartingPoint, state: string): string {
  if (start.kind === "yours") return `We start from the ${formatDollars(Math.round(start.annual))} a year you pay now, then adjust for what's different.`
  return `We start from the typical ${state} price, about ${formatDollars(roundTen(start.annual))} a year today, then adjust for your car and driver.`
}

/** The full line about where the numbers start, with its source. */
export function startLine(start: StartingPoint): string {
  if (start.kind === "yours") return `We started from the ${formatDollars(Math.round(start.annual))} a year you pay now.`
  return start.attribution ?? `We started from ${start.label ?? "a typical yearly price for your state"}. ${TYPICAL_START_ATTRIBUTION}.`
}

/** The estimate for the situation now (the policyholder's own policy). */
export function priceNow(
  situation: Situation,
  nowVehicle: VehicleFacts,
  trimConfidence: TrimConfidence | null = null,
): Estimate | null {
  const start = startingPoint(situation, nowVehicle)
  if (!start) return null
  return estimate(start, situation.scenario, { vehicle: nowVehicle, trimConfidence })
}

function amountWords(delta: number): string {
  const words = differenceWords(delta)
  return words === "about the same" ? words : `about ${words}`
}

/** One piece of a what-if's difference: "Newer car: +$120". */
export type ChangePart = { label: string; amount: number }

export type WhatIfMode =
  /** An ordinary change to the situation now. */
  | "change"
  /** A teen added to the policyholder's policy: both figures are the whole household's policy. */
  | "teen-added"
  /** A teen on their own policy: a separate bill, on top of the policyholder's. */
  | "teen-own"

export type WhatIfResult = WhatIf & {
  mode: WhatIfMode
  /** What made the difference, one piece at a time. Sums to `delta`. */
  parts: ChangePart[]
}

const TEEN_KEYS: readonly ChangeKey[] = ["age", "yearsLicensed", "goodStudent", "driverTraining"]

function roundTen(amount: number): number {
  return Math.round(amount / 10) * 10
}

/**
 * The situation now against one what-if, with the engine's headline.
 * - Adding a teen to the policyholder's policy goes through the engine's
 *   teenAddedToPolicy, so both figures are the whole household's policy.
 * - A teen on their own policy is a separate bill, so it's shown as that,
 *   not as if it replaced the policyholder's.
 */
export function priceWhatIf(
  situation: Situation,
  nowVehicle: VehicleFacts,
  next: Scenario,
  nextVehicle: VehicleFacts,
  trimConfidence: TrimConfidence | null = null,
): WhatIfResult | null {
  const start = startingPoint(situation, nowVehicle)
  if (!start) return null
  const now = situation.scenario
  const newTeen = next.age === "16-18" && now.age !== "16-18"
  // A 19–21-year-old is always priced on their own policy, so a new one is a separate bill too.
  const newYoung = next.age === "19-21" && now.age !== "19-21" && now.age !== "16-18"
  if ((newTeen && !situation.teenOnParentPolicy) || newYoung) {
    const result = whatIf(start, now, next, { currentVehicle: nowVehicle, nextVehicle, trimConfidence })
    return {
      ...result,
      mode: "teen-own",
      parts: [],
      headline: `A ${newYoung ? "19–21" : "16–18"}-year-old on their own policy: about ${formatDollars(roundTen(result.next.likely))} a year, on top of your ${formatDollars(roundTen(result.current.likely))}.`,
    }
  }
  if (!newTeen) {
    const result = whatIf(start, now, next, {
      currentVehicle: nowVehicle,
      nextVehicle,
      trimConfidence,
      label: whatIfLabel(now, next, false),
    })
    return { ...result, mode: "change", parts: explainChange(start, now, nowVehicle, next, nextVehicle).parts }
  }
  // The same household, with anything else the visitor changed, before and
  // after adding the teen.
  const parent: Scenario = { ...next, age: now.age, yearsLicensed: now.yearsLicensed, teen: false }
  const current = estimate(start, now, { vehicle: nowVehicle, trimConfidence })
  const added = teenAddedToPolicy(start, parent, { vehicle: nextVehicle, trimConfidence })
  const delta = added.after.likely - current.likely
  const deltaRounded = roundTen(delta)
  const onlyTheTeen = changedKeys(now, parent).every((key) => key === "goodStudent" || key === "driverTraining")
  const headline = onlyTheTeen ? added.headline : `With these changes and your teen: ${amountWords(delta)}.`
  const others = explainChange(start, now, nowVehicle, parent, nextVehicle)
  const parts = [...others.parts, { label: "Adding your teen", amount: added.after.likely - others.last }]
  return { current, next: added.after, delta, deltaRounded, headline, mode: "teen-added", parts }
}

function carWords(scenario: Pick<Scenario, "make" | "model">): string {
  return `${scenario.make} ${scenario.model}`
}

/** How one car compares with another, in the same words as the compare table. */
export function carDifference(from: VehicleRelativity, to: VehicleRelativity, hasDamageCover: boolean): string {
  const words: string[] = []
  const damage = hasDamageCover ? to.physicalHundredths - from.physicalHundredths : 0
  const liability = to.liabilityHundredths - from.liabilityHundredths
  if (damage >= 8) words.push(REASON.pricierRepairs)
  if (damage <= -8) words.push(REASON.cheaperRepairs)
  if (liability >= 6) words.push(REASON.moreClaims)
  if (liability <= -6) words.push(REASON.fewerClaims)
  return words.length > 0 ? words.join(", ") : "similar claims"
}

/**
 * Explain a what-if as the difference, one change at a time: each piece is
 * the engine's estimate after that change minus the one before, so the pieces
 * always add up to the whole difference. A different car is split into its
 * model year (newer or older) and the car itself.
 */
export function explainChange(
  start: StartingPoint,
  now: Scenario,
  nowVehicle: VehicleFacts,
  next: Scenario,
  nextVehicle: VehicleFacts,
): { parts: ChangePart[]; last: number } {
  let current: Scenario = now
  let facts: VehicleFacts = nowVehicle
  let before = estimate(start, current, { vehicle: facts })
  const parts: ChangePart[] = []
  const step = (label: string, scenario: Scenario, vehicle: VehicleFacts) => {
    const after = estimate(start, scenario, { vehicle })
    parts.push({ label, amount: after.likely - before.likely })
    current = scenario
    facts = vehicle
    const previous = before
    before = after
    return { previous, after }
  }
  for (const key of changedKeys(now, next)) {
    if (TEEN_KEYS.includes(key) && next.age === "16-18" && now.age !== "16-18") continue
    if (key === "vehicle") {
      if (now.year !== next.year) {
        step(next.year > now.year ? `Newer car (${next.year})` : `Older car (${next.year})`, { ...current, year: next.year }, { ...facts, year: next.year })
      }
      if (now.make !== next.make || now.model !== next.model || now.trim !== next.trim) {
        const scenario = { ...current, make: next.make, model: next.model, trim: next.trim }
        const { previous, after } = step("", scenario, nextVehicle)
        const why = carDifference(previous.vehicle, after.vehicle, hasPhysicalDamage(scenario.coverage))
        parts[parts.length - 1].label =
          now.make === next.make && now.model === next.model
            ? `A different version (${why})`
            : `${carWords(now)} → ${carWords(next)} (${why})`
      }
      continue
    }
    step(changeChip(key, next), { ...current, [key]: next[key] } as Scenario, facts)
  }
  return { parts, last: before.likely }
}

/** Many cars for one driver on their own policy, in the order given. */
export function priceCars(start: StartingPoint, driver: Scenario, vehicles: VehicleFacts[]): VehicleComparisonRow[] {
  return compareVehicles(start, driver, vehicles)
}

/**
 * The parent whose policy a teen joins: the visitor's own situation if it's
 * an adult's, otherwise a 40–64-year-old with a clean record. Where they live
 * and what coverage they carry come from the compare page's driver.
 */
export function parentFor(driver: Scenario, situation: Situation): Scenario {
  const own = situation.scenario.age === "16-18" ? null : situation.scenario
  return {
    ...driver,
    age: own?.age ?? "40-64",
    yearsLicensed: own?.yearsLicensed ?? "10+",
    incidents: own?.incidents ?? "clean",
    teen: false,
  }
}

/**
 * Adding a teen to a parent's policy, one car at a time: the household's
 * policy with that car, before and after adding the teen. Both figures are
 * the whole household's premium.
 */
export function priceCarsTeenAdded(start: StartingPoint, parent: Scenario, vehicles: VehicleFacts[]): TeenAdded[] {
  return vehicles.map((vehicle) =>
    teenAddedToPolicy(
      start,
      { ...parent, year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
      { vehicle },
    ),
  )
}

/**
 * The same driver on an average car: its range note describes the driver,
 * not any one car. For a teen added to a parent's policy, pass the parent.
 */
export function driverOnlyEstimate(start: StartingPoint, driver: Scenario, parent: Scenario | null = null): Estimate {
  if (parent) return teenAddedToPolicy(start, parent, { vehicle: "average" }).after
  return estimate(start, driver, { vehicle: "average" })
}

// ---------------------------------------------------------------------------
// What changed

const DRIVER_KEYS = [
  "age",
  "yearsLicensed",
  "incidents",
  "mileage",
  "goodStudent",
  "driverTraining",
  "householdPolicy",
  "loanLease",
  "state",
  "region",
  "coverage",
  "deductible",
] as const satisfies readonly (keyof Scenario)[]

export type ChangeKey = (typeof DRIVER_KEYS)[number] | "vehicle"

export function sameVehicle(left: Pick<Scenario, "year" | "make" | "model" | "trim">, right: Pick<Scenario, "year" | "make" | "model" | "trim">): boolean {
  return left.year === right.year && left.make === right.make && left.model === right.model && left.trim === right.trim
}

/** Which inputs differ between two scenarios, in a stable order. */
export function changedKeys(now: Scenario, next: Scenario): ChangeKey[] {
  const keys: ChangeKey[] = []
  if (!sameVehicle(now, next)) keys.push("vehicle")
  for (const key of DRIVER_KEYS) {
    if (now[key] !== next[key]) keys.push(key)
  }
  return keys
}

function labelOf<T extends { id: string; label: string }>(items: readonly T[], id: string): string {
  return items.find((item) => item.id === id)?.label ?? id
}

function lower(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

/**
 * Words for a single change, used at the start of the engine's headline
 * ("Raising your deductible to $2,000: about −$90 a year."). Returns
 * undefined for a car or a state, where the engine's own words are right,
 * and for several changes at once.
 */
export function whatIfLabel(now: Scenario, next: Scenario, teenOnParentPolicy: boolean): string | undefined {
  const keys = changedKeys(now, next)
  // A new teen driver usually comes with a new-driver record and discounts.
  const driverKeys: ChangeKey[] = ["age", "yearsLicensed", "goodStudent", "driverTraining"]
  if (keys.includes("age") && keys.every((key) => driverKeys.includes(key))) {
    const age = labelOf(AGE_BANDS, next.age)
    if (next.age === "16-18") {
      return teenOnParentPolicy
        ? `Adding a ${age}-year-old to your policy`
        : `A ${age}-year-old on their own policy`
    }
    return `With a ${age}-year-old driver`
  }
  if (keys.length > 1) return "With these changes"
  if (keys.length !== 1) return undefined
  switch (keys[0]) {
    case "vehicle":
    case "state":
      return undefined
    case "region":
      return next.region === "rural"
        ? "Moving to a small town or the country"
        : next.region === "urban"
          ? "Moving to the city"
          : "Moving to the suburbs"
    case "coverage":
      return `Switching to ${lower(coverageLabel(next.coverage))}`
    case "deductible":
      return `${next.deductible > now.deductible ? "Raising" : "Lowering"} your deductible to $${next.deductible.toLocaleString("en-US")}`
    case "incidents":
      return `With ${lower(labelOf(INCIDENTS, next.incidents))}`
    case "mileage":
      return `Driving ${lower(labelOf(MILEAGE_BANDS, next.mileage))}`
    case "yearsLicensed":
      return `Licensed ${lower(labelOf(YEARS_LICENSED, next.yearsLicensed))}`
    case "goodStudent":
      return next.goodStudent ? "With a good-student discount" : "Without the good-student discount"
    case "driverTraining":
      return next.driverTraining ? "With a driver-training discount" : "Without the driver-training discount"
    case "householdPolicy":
      return next.householdPolicy ? "Bundling with home or renters insurance" : "Without bundling"
    case "loanLease":
      return next.loanLease ? "With a loan or lease on the car" : "Owning the car outright"
    default:
      return undefined
  }
}

/** A short chip label for one changed input: "Deductible: $2,000". */
export function changeChip(key: ChangeKey, next: Scenario): string {
  switch (key) {
    case "vehicle":
      return `${next.year} ${next.make} ${next.model}`
    case "age":
      return `Age ${labelOf(AGE_BANDS, next.age)}`
    case "yearsLicensed":
      return `Licensed ${lower(labelOf(YEARS_LICENSED, next.yearsLicensed))}`
    case "incidents":
      return labelOf(INCIDENTS, next.incidents)
    case "mileage":
      return labelOf(MILEAGE_BANDS, next.mileage)
    case "goodStudent":
      return next.goodStudent ? "Good student" : "No good-student discount"
    case "driverTraining":
      return next.driverTraining ? "Driver training" : "No driver training"
    case "householdPolicy":
      return next.householdPolicy ? "Bundled" : "Not bundled"
    case "loanLease":
      return next.loanLease ? "Loan or lease" : "Owned outright"
    case "state":
      return `Moving to ${stateName(next.state)}`
    case "region":
      return regionLabel(next.region)
    case "coverage":
      return coverageLabel(next.coverage)
    case "deductible":
      return `$${next.deductible.toLocaleString("en-US")} deductible`
  }
}

// ---------------------------------------------------------------------------
// Why a car costs what it does

/** One short vocabulary for why a car costs what it does, used on the page, in print, and in the spreadsheet. */
export const REASON = {
  pricierRepairs: "pricier repairs",
  cheaperRepairs: "cheaper repairs",
  moreClaims: "more at-fault claims",
  fewerClaims: "fewer at-fault claims",
  newer: "newer, costs more to replace",
  older: "older, cheaper to replace",
  average: "about average",
} as const

/**
 * A short phrase for why a car sits where it does, from the engine's vehicle
 * factors: "higher repair costs", "fewer at-fault crash claims".
 * `hasDamageCover` is false for liability-only coverage, where repair costs
 * don't matter.
 */
/**
 * Short phrases for why a car sits where it does, compared with an average
 * car, biggest first: "higher repair costs", "fewer at-fault crash claims".
 * `hasDamageCover` is false for liability-only coverage, where repair costs
 * and the car's age don't matter. A typical start already assumes an
 * 8–12-year-old car, so newer cars cost more to replace and older ones less.
 */
export function vehicleReasonParts(vehicle: VehicleRelativity, hasDamageCover: boolean, modelYear?: number): string[] {
  if (vehicle.level === "unknown") return ["we don't know this car, so we used an average one"]
  if (vehicle.level === "average") return []
  const parts: { size: number; words: string }[] = []
  const damage = hasDamageCover ? vehicle.physicalHundredths - 100 : 0
  const liability = vehicle.liabilityHundredths - 100
  if (damage >= 10) parts.push({ size: damage, words: REASON.pricierRepairs })
  if (damage <= -10) parts.push({ size: -damage, words: REASON.cheaperRepairs })
  if (liability >= 8) parts.push({ size: liability, words: REASON.moreClaims })
  if (liability <= -8) parts.push({ size: -liability, words: REASON.fewerClaims })
  parts.sort((left, right) => right.size - left.size)
  const words = parts.map((part) => part.words)
  const age = modelYear === undefined ? null : vehicleAgeKey(modelYear)
  if (hasDamageCover && (age === "0-3" || age === "4-7")) words.push(REASON.newer)
  if (hasDamageCover && age === "13-plus") words.push(REASON.older)
  if (vehicle.level === "class") words.push(`no data for this exact model, so we used the ${vehicle.label} average`)
  return words
}

export function vehicleReason(vehicle: VehicleRelativity, hasDamageCover: boolean, modelYear?: number): string {
  const words = vehicleReasonParts(vehicle, hasDamageCover, modelYear)
  return words.length > 0 ? words.join(", ") : REASON.average
}

/**
 * Drop the phrases every car in a list shares (they don't help choose), and
 * join the rest. With one car, nothing is dropped.
 */
export function distinctReasons(lists: readonly string[][]): string[] {
  const shared =
    lists.length > 1 ? new Set(lists[0].filter((phrase) => lists.every((list) => list.includes(phrase)))) : new Set<string>()
  return lists.map((list) => {
    const kept = list.filter((phrase) => !shared.has(phrase))
    if (kept.length > 0) return kept.join(", ")
    return REASON.average
  })
}

/** What we matched a car to, in the site's own words, for a "Tell us" link. */
export function vehicleMatchWords(vehicle: VehicleRelativity): string {
  if (vehicle.level === "model") {
    return `Matched to ${vehicle.rows.map((row) => row.series).join("; ")}. Liability factor ${(vehicle.liabilityHundredths / 100).toFixed(2)}, damage factor ${(vehicle.physicalHundredths / 100).toFixed(2)}.`
  }
  if (vehicle.level === "class") return `No model match. Used the ${vehicle.label} average.`
  return "Not recognized. Treated as an average vehicle."
}

export function reasonParts(estimate: Estimate, modelYear: number, driver: Scenario): string[] {
  return vehicleReasonParts(estimate.vehicle, hasPhysicalDamage(driver.coverage), modelYear)
}

// ---------------------------------------------------------------------------
// "Here's how we got this"

export type SourceLink = { id: string; title: string; publisher: string; url: string }

const SOURCES = new Map(FACTOR_BUNDLE.sources.map((source) => [source.id, source]))

export function sourceLinks(ids: readonly string[]): SourceLink[] {
  return ids.flatMap((id) => {
    const source = SOURCES.get(id)
    return source ? [{ id, title: source.title, publisher: source.publisher, url: source.url }] : []
  })
}

export function basisWords(basis: keyof typeof BASIS_WORDS): string {
  return BASIS_WORDS[basis]
}

/** Which state's published prices a source is. */
const SURVEY_STATES: Record<string, string> = {
  "ca-2026": "California",
  "tx-2025": "Texas",
  "ok-2026": "Oklahoma",
  "dc-2024": "District of Columbia",
  "nd-2026": "North Dakota",
  "co-2023": "Colorado",
  "nc-sdip-2026": "North Carolina",
}

/**
 * How we know a step, and, when its prices come from other states, which
 * ones: "From published prices in Texas and Oklahoma (Illinois may differ)".
 */
export function basisLabel(basis: keyof typeof BASIS_WORDS, sourceIds: readonly string[], state: string): string {
  const words = BASIS_WORDS[basis]
  const states = [...new Set(sourceIds.flatMap((id) => (SURVEY_STATES[id] ? [SURVEY_STATES[id]] : [])))]
  if (basis === "reference" || states.length === 0 || states.includes(state)) return words
  const named =
    states.length === 1 ? states[0] : `${states.slice(0, -1).join(", ")}${states.length > 2 ? "," : ""} and ${states[states.length - 1]}`
  return `${words} in ${named} (${state} may differ)`
}
