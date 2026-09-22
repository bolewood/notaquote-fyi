/**
 * The one pricing engine. Every dollar figure comes from here.
 *
 * How it works, in short:
 *
 *   index = whole × (split × limits × vehicleLiability
 *                    + (1 − split) × hasDamageCover × deductible × loanLease × vehicleAge × vehicleDamage)
 *
 *   estimate = starting premium × index(target) ÷ index(start)
 *
 * "whole" is the product of the driver, record, mileage, discount, and area
 * factors. "split" is the share of a full-coverage premium that pays for
 * liability (and the other non-damage coverages); the rest pays for collision
 * and comprehensive. Vehicle factors come from HLDI insurance-loss results:
 * collision and comprehensive move only the damage share, and property-damage
 * and bodily-injury liability move only the liability share.
 *
 * The starting premium is either the visitor's own premium or a typical
 * premium (for example a state figure), together with the scenario it belongs
 * to. Because only ratios are used, anything the two scenarios share cancels.
 *
 * Arithmetic is exact: factors are integers in hundredths, products are
 * BigInt fractions, and dollars round half up once at the end.
 *
 * Every factor carries its basis (sourced, indicative, assumed). The range
 * adds up, in quadrature, the spread of every factor that changed between the
 * start and the target, so the more of a change we had to assume, the wider
 * the range.
 */
import bundleFile from "@/data/model-factors.json"
import { compactName, normalizeName } from "@/lib/catalog-match"
import type { TrimConfidence } from "@/lib/catalog-match"
import type { CatalogStatus } from "@/lib/catalog"
import { vehicleFacts, type VehicleFacts } from "@/lib/catalog-class"
import type {
  AppliesTo,
  FactorBasis,
  FactorBundle,
  FactorCell,
  FactorGroup,
  VehicleClassRow,
  VehicleLossRow,
} from "@/lib/factor-types"
import { MODEL_VERSION } from "@/lib/copy"
import {
  hasPhysicalDamage,
  stateName,
  vehicleLabel,
  type AgeBand,
  type Scenario,
  type StateCode,
} from "@/lib/scenario"

const bundle = bundleFile as unknown as FactorBundle

export const FACTOR_BUNDLE = bundle
export const FACTOR_BUNDLE_VERSION = bundle.version
export const FACTOR_EFFECTIVE_DATE = bundle.effectiveDate
export const FACTOR_FORMULA = bundle.formula
export const FACTOR_CHANGELOG = bundle.changelogNote

/** The model year used to work out vehicle age. */
export const FACTOR_YEAR = Number(bundle.effectiveDate.slice(0, 4))

// ---------------------------------------------------------------------------
// Exact fractions

type Rational = { num: bigint; den: bigint }

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)
const BP = BigInt(10000)

function gcd(left: bigint, right: bigint): bigint {
  let a = left < ZERO ? -left : left
  let b = right < ZERO ? -right : right
  while (b !== ZERO) {
    const next = a % b
    a = b
    b = next
  }
  return a
}

function reduce(value: Rational): Rational {
  const divisor = gcd(value.num, value.den)
  if (divisor === ZERO) return { num: ZERO, den: ONE }
  return { num: value.num / divisor, den: value.den / divisor }
}

function rat(num: number | bigint, den: number | bigint = 1): Rational {
  return reduce({ num: BigInt(num), den: BigInt(den) })
}

function hundredths(value: number): Rational {
  return rat(value, 100)
}

function mul(...values: Rational[]): Rational {
  return values.reduce(
    (product, value) => reduce({ num: product.num * value.num, den: product.den * value.den }),
    { num: ONE, den: ONE },
  )
}

function add(left: Rational, right: Rational): Rational {
  return reduce({ num: left.num * right.den + right.num * left.den, den: left.den * right.den })
}

function sub(left: Rational, right: Rational): Rational {
  return reduce({ num: left.num * right.den - right.num * left.den, den: left.den * right.den })
}

function div(left: Rational, right: Rational): Rational {
  return reduce({ num: left.num * right.den, den: left.den * right.num })
}

/** Round a non-negative fraction half up to a whole number. */
function roundHalfUp(value: Rational): number {
  return Number((value.num * TWO + value.den) / (value.den * TWO))
}

function isqrt(value: bigint): bigint {
  if (value < TWO) return value
  let x = value
  let y = (x + ONE) / TWO
  while (y < x) {
    x = y
    y = (x + value / x) / TWO
  }
  return x
}

// ---------------------------------------------------------------------------
// Cells and groups

export const GROUP_IDS = [
  "driver-age",
  "driving-experience",
  "driving-record",
  "annual-mileage",
  "good-student",
  "driver-training",
  "multi-policy",
  "area",
  "liability-limits",
  "deductible",
  "loan-lease",
  "vehicle-age",
] as const
export type GroupId = (typeof GROUP_IDS)[number]

function group(id: string): FactorGroup {
  const found = bundle.groups[id]
  if (!found) throw new Error(`Missing factor group ${id}`)
  return found
}

function cellOf(groupId: string, key: string): FactorCell {
  const found = group(groupId).cells[key]
  if (!found) throw new Error(`Missing factor ${groupId}.${key}`)
  return found
}

const YOUNG: readonly AgeBand[] = ["16-18", "19-21"]
const UNDER_26: readonly AgeBand[] = ["16-18", "19-21", "22-25"]

export type Selection = { group: GroupId; key: string; appliesTo: AppliesTo; cell: FactorCell }

/**
 * The factor key each group uses for a scenario. Some groups only apply to
 * some drivers, so that nothing is counted twice:
 * - Years licensed only applies from age 22. For younger drivers the age
 *   factor already reflects a new driver, so it stays at the reference.
 * - Good student applies to drivers under 26; driver training to drivers
 *   under 22.
 * - Deductible, loan or lease, and vehicle age only apply when the coverage
 *   includes collision and comprehensive.
 * There is no teen checkbox in the model: the 16–18 age band is the teen
 * factor.
 */
export function selectionKeys(scenario: Scenario): Record<GroupId, string> {
  const damage = hasPhysicalDamage(scenario.coverage)
  return {
    "driver-age": scenario.age,
    "driving-experience": YOUNG.includes(scenario.age) ? "not-used" : scenario.yearsLicensed,
    "driving-record": scenario.incidents,
    "annual-mileage": scenario.mileage,
    "good-student": scenario.goodStudent && UNDER_26.includes(scenario.age) ? "yes" : "no",
    "driver-training": scenario.driverTraining && YOUNG.includes(scenario.age) ? "yes" : "no",
    "multi-policy": scenario.householdPolicy ? "yes" : "no",
    area: scenario.region,
    "liability-limits":
      scenario.coverage === "state-minimum"
        ? "state-minimum"
        : scenario.coverage === "high"
          ? "250-500-250"
          : "100-300-100",
    deductible: damage ? String(scenario.deductible) : "1000",
    "loan-lease": damage && scenario.loanLease ? "yes" : "no",
    "vehicle-age": damage ? vehicleAgeKey(scenario.year) : "0-3",
  }
}

export function vehicleAgeKey(modelYear: number): string {
  const age = Math.max(0, FACTOR_YEAR - modelYear)
  if (age <= 3) return "0-3"
  if (age <= 7) return "4-7"
  if (age <= 12) return "8-12"
  return "13-plus"
}

export function selections(scenario: Scenario): Selection[] {
  const keys = selectionKeys(scenario)
  return GROUP_IDS.map((id) => ({
    group: id,
    key: keys[id],
    appliesTo: group(id).appliesTo,
    cell: cellOf(id, keys[id]),
  }))
}

// ---------------------------------------------------------------------------
// Vehicles

export type VehicleLevel = "model" | "class" | "average" | "unknown"

export type VehicleRelativity = {
  level: VehicleLevel
  /** Plain label: the vehicle, or what we used instead. */
  label: string
  /** HLDI rows used, when level is "model". */
  rows: VehicleLossRow[]
  /** Liability-share multiplier (1 = average vehicle). */
  liability: Rational
  /** Damage-share multiplier (1 = average vehicle). */
  physical: Rational
  /** Hundredths, for display. */
  liabilityHundredths: number
  physicalHundredths: number
  /** Range cell that describes how sure we are. */
  spreadKey: string
  /** True when the model year is outside the HLDI model years. */
  outsideYears: boolean
  /** A stable key: two vehicles with the same key have the same factors. */
  key: string
  basis: FactorBasis
}

function rowPowertrain(facts: VehicleFacts): VehicleLossRow["powertrain"] {
  if (facts.powertrain === "electric") return "electric"
  if (facts.powertrain === "plug-in-hybrid") return "plug-in-hybrid"
  if (facts.powertrain === "hybrid") return "hybrid"
  return "combustion"
}

function factsDrive(facts: VehicleFacts): "2wd" | "4wd" | null {
  if (facts.epaClass) {
    if (/4wd/i.test(facts.epaClass)) return "4wd"
    if (/2wd/i.test(facts.epaClass)) return "2wd"
  }
  const words = normalizeName(`${facts.model} ${facts.trim}`)
  if (/\b(4wd|awd|4x4|4motion|xdrive|quattro|all wheel)\b/.test(words)) return "4wd"
  if (/\b(2wd|fwd|rwd|4x2)\b/.test(words)) return "2wd"
  return null
}

function median(values: number[]): Rational {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return rat(sorted[middle])
  return rat(sorted[middle - 1] + sorted[middle], 2)
}

function medianOf(rows: VehicleLossRow[], pick: (row: VehicleLossRow) => number | null): Rational | null {
  const values = rows.map(pick).filter((value): value is number => value !== null)
  return values.length === 0 ? null : median(values)
}

function weighted(
  first: Rational | null,
  second: Rational | null,
  firstShareHundredths: number,
): Rational | null {
  if (first && second) {
    return div(
      add(mul(first, rat(firstShareHundredths)), mul(second, rat(100 - firstShareHundredths))),
      rat(10000),
    )
  }
  if (first) return div(first, rat(100))
  if (second) return div(second, rat(100))
  return null
}

function toHundredths(value: Rational): number {
  return roundHalfUp(mul(value, rat(100)))
}

function splitShare(key: "collision-in-physical" | "bodily-injury-in-liability"): number {
  return cellOf("premium-split", key).value
}

/** The HLDI rows for a vehicle, or an empty list. */
export function matchVehicleRows(facts: VehicleFacts): VehicleLossRow[] {
  const make = compactName(facts.make)
  const catalogModel = compactName(facts.model)
  if (!make || !catalogModel) return []
  const model = bundle.vehicle.aliases[`${make}|${catalogModel}`] ?? catalogModel
  const trimWords = compactName(facts.trim)
  const sameMake = bundle.vehicle.models.filter((row) => compactName(row.make) === make)
  // A more specific HLDI series whose extra words are in the trim name, for
  // example "F-150 Lightning" for the trim "F-150 Lightning 4WD".
  const specific = sameMake.filter((row) => {
    if (!row.family.startsWith(model) || row.family === model) return false
    const extra = row.family.slice(model.length)
    return extra.length >= 2 && trimWords.includes(extra)
  })
  let pool = specific.length > 0 ? specific : sameMake.filter((row) => row.family === model)
  const powertrain = rowPowertrain(facts)
  const samePowertrain = pool.filter((row) => row.powertrain === powertrain)
  // HLDI lists a hybrid as its own series when there are enough of them. When
  // a family has no hybrid series (mild hybrids, low-volume hybrids), HLDI's
  // conventional series is the closest match. Electric and plug-in vehicles
  // never fall back to gas series.
  pool =
    samePowertrain.length > 0 || powertrain !== "hybrid"
      ? samePowertrain
      : pool.filter((row) => row.powertrain === "combustion")
  if (pool.length === 0) return []
  const drive = factsDrive(facts)
  if (drive) {
    const sameDrive = pool.filter((row) => row.drive === drive)
    if (sameDrive.length > 0) pool = sameDrive
  }
  return pool
}

function classRow(facts: VehicleFacts): VehicleClassRow | null {
  if (!facts.classId) return null
  if (facts.powertrain === "electric") {
    const electric = bundle.vehicle.electricClasses[facts.classId]
    if (electric) return electric
  }
  return bundle.vehicle.classes[facts.classId] ?? null
}

const AVERAGE: Pick<VehicleRelativity, "liability" | "physical" | "liabilityHundredths" | "physicalHundredths"> = {
  liability: rat(1),
  physical: rat(1),
  liabilityHundredths: 100,
  physicalHundredths: 100,
}

/**
 * How a vehicle moves each share of the premium. `"average"` is the average
 * vehicle (HLDI's 100), used with a typical starting premium.
 */
export function vehicleRelativity(vehicle: VehicleFacts | "average"): VehicleRelativity {
  if (vehicle === "average") {
    return {
      level: "average",
      label: "an average vehicle",
      rows: [],
      ...AVERAGE,
      spreadKey: "",
      outsideYears: false,
      key: "average",
      basis: "reference",
    }
  }
  const outsideYears =
    vehicle.year < bundle.vehicle.yearMin || vehicle.year > bundle.vehicle.yearMax
  const rows = matchVehicleRows(vehicle)
  const klass = classRow(vehicle)
  const bi = splitShare("bodily-injury-in-liability")
  const collision = splitShare("collision-in-physical")

  if (rows.length > 0) {
    const liability =
      weighted(
        medianOf(rows, (row) => row.bodilyInjury),
        medianOf(rows, (row) => row.propertyDamage),
        bi,
      ) ?? (klass ? hundredths(klass.liability.value) : rat(1))
    const physical =
      weighted(
        medianOf(rows, (row) => row.collision),
        medianOf(rows, (row) => row.comprehensive),
        collision,
      ) ?? (klass ? hundredths(klass.physical.value) : rat(1))
    return {
      level: "model",
      label: `${vehicle.make} ${vehicle.model}`,
      rows,
      liability,
      physical,
      liabilityHundredths: toHundredths(liability),
      physicalHundredths: toHundredths(physical),
      spreadKey: "vehicle-model",
      outsideYears,
      key: `model:${rows.map((row) => row.series).join("+")}`,
      basis: "sourced",
    }
  }

  if (klass) {
    return {
      level: "class",
      label: klass.liability.label,
      rows: [],
      liability: hundredths(klass.liability.value),
      physical: hundredths(klass.physical.value),
      liabilityHundredths: klass.liability.value,
      physicalHundredths: klass.physical.value,
      spreadKey: "vehicle-class",
      outsideYears,
      key: `class:${vehicle.classId}:${vehicle.powertrain === "electric" ? "electric" : "any"}`,
      basis: "indicative",
    }
  }

  return {
    level: "unknown",
    label: "an average vehicle",
    rows: [],
    ...AVERAGE,
    spreadKey: "vehicle-unknown",
    outsideYears: false,
    key: `unknown:${compactName(vehicle.make)}|${compactName(vehicle.model)}`,
    basis: "assumed",
  }
}

// ---------------------------------------------------------------------------
// The index

export type VehicleInput = VehicleFacts | "average" | null | undefined

function resolveVehicle(scenario: Scenario, vehicle: VehicleInput): VehicleFacts | "average" {
  if (vehicle === "average") return "average"
  return vehicle ?? vehicleFacts(null, scenario)
}

type IndexParts = {
  whole: Rational
  liabilityPart: Rational
  physicalPart: Rational
  total: Rational
  picks: Selection[]
  vehicle: VehicleRelativity
}

function indexParts(scenario: Scenario, vehicle: VehicleInput): IndexParts {
  const picks = selections(scenario)
  const relativity = vehicleRelativity(resolveVehicle(scenario, vehicle))
  let whole = rat(1)
  let liability = hundredths(cellOf("premium-split", "liability").value)
  let physical = hasPhysicalDamage(scenario.coverage)
    ? sub(rat(1), hundredths(cellOf("premium-split", "liability").value))
    : rat(0)
  for (const pick of picks) {
    const factor = hundredths(pick.cell.value)
    if (pick.appliesTo === "whole") whole = mul(whole, factor)
    else if (pick.appliesTo === "liability") liability = mul(liability, factor)
    else physical = mul(physical, factor)
  }
  const liabilityPart = mul(whole, liability, relativity.liability)
  const physicalPart = mul(whole, physical, relativity.physical)
  return {
    whole,
    liabilityPart,
    physicalPart,
    total: add(liabilityPart, physicalPart),
    picks,
    vehicle: relativity,
  }
}

// ---------------------------------------------------------------------------
// Estimates

export type StartKind = "yours" | "typical"

export type StartingPoint = {
  /** Whole dollars a year. */
  annual: number
  /** The scenario that premium belongs to. */
  scenario: Scenario
  /**
   * The vehicle on that premium. Use "average" with a typical premium that is
   * not for a particular vehicle. Leave out to use the scenario's names.
   */
  vehicle?: VehicleInput
  kind: StartKind
  /** Optional words for the start, e.g. "a typical yearly price in Illinois". */
  label?: string
}

export type EstimateOptions = {
  /** The target vehicle. Leave out to use the scenario's names. */
  vehicle?: VehicleInput
  /**
   * Typical yearly premiums by state on one coverage basis. When the target
   * state differs from the start, the ratio of these moves the estimate.
   */
  stateAnnual?: Partial<Record<StateCode, number>>
  trimConfidence?: TrimConfidence | null
}

export type ChangeStep = {
  group: GroupId | "vehicle" | "state"
  title: string
  from: string
  to: string
  basis: FactorBasis
  sources: string[]
}

export type Estimate = {
  low: number
  likely: number
  high: number
  monthly: number
  /** True when the figure had to be held at $1 or pulled apart to keep low < likely < high. */
  floored: boolean
  steps: ChangeStep[]
  vehicle: VehicleRelativity
  /** How many of the changes were sourced, indicative, or assumed. */
  basisCount: Record<Exclude<FactorBasis, "reference">, number>
  /** Range edges in basis points below and above the likely figure. */
  spread: { down: number; up: number }
  /** Plain-language summary for the page. */
  summary: string
  /** Plain-language reason for the range width. */
  rangeNote: string
}

type Spread = { down: bigint; up: bigint; weight: Rational }

function cellSpread(cell: FactorCell): { down: bigint; up: bigint } {
  if (cell.value <= 0) return { down: ZERO, up: ZERO }
  const value = BigInt(cell.value)
  return {
    down: ((value - BigInt(cell.low)) * BP) / value,
    up: ((BigInt(cell.high) - value) * BP) / value,
  }
}

function rangeCell(key: string): FactorCell {
  return cellOf("range", key)
}

function share(part: Rational, total: Rational): Rational {
  if (total.num === ZERO) return rat(0)
  return div(part, total)
}

function scaled(value: bigint, weight: Rational): bigint {
  return (value * weight.num) / weight.den
}

const GROUP_FAMILY: Record<GroupId, "driver" | "geography" | "coverage" | "vehicle"> = {
  "driver-age": "driver",
  "driving-experience": "driver",
  "driving-record": "driver",
  "annual-mileage": "driver",
  "good-student": "driver",
  "driver-training": "driver",
  "multi-policy": "driver",
  area: "geography",
  "liability-limits": "coverage",
  deductible: "coverage",
  "loan-lease": "coverage",
  "vehicle-age": "vehicle",
}

function describeVehicle(facts: VehicleFacts | "average"): string {
  if (facts === "average") return "an average vehicle"
  return vehicleLabel({ year: facts.year, make: facts.make, model: facts.model, trim: "" })
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

export function formatDollars(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`
}

function joinWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

function separate(low: number, likely: number, high: number): {
  low: number
  likely: number
  high: number
  held: boolean
} {
  let held = false
  if (likely < 2) {
    likely = 2
    held = true
  }
  if (low < 1) {
    low = 1
    held = true
  }
  if (low >= likely) {
    low = likely - 1
    held = true
  }
  if (high <= likely) {
    high = likely + 1
    held = true
  }
  return { low, likely, high, held }
}

/**
 * Estimate the yearly premium for `target`, starting from `start`.
 */
export function estimate(start: StartingPoint, target: Scenario, options: EstimateOptions = {}): Estimate {
  if (!Number.isFinite(start.annual) || start.annual < 1) {
    throw new Error("A starting premium must be at least $1 a year")
  }
  const startVehicle = resolveVehicle(start.scenario, start.vehicle)
  const targetVehicle = resolveVehicle(target, options.vehicle)
  const from = indexParts(start.scenario, startVehicle)
  const to = indexParts(target, targetVehicle)

  let ratio = div(to.total, from.total)
  const steps: ChangeStep[] = []
  const spreads: Spread[] = []

  // Factor groups that changed.
  for (let index = 0; index < from.picks.length; index += 1) {
    const before = from.picks[index]
    const after = to.picks[index]
    if (before.key === after.key) continue
    // Two starting-point cells (for example "not used under 22" and "10+
    // years") are the same number; there is nothing to explain.
    if (before.cell.basis === "reference" && after.cell.basis === "reference") continue
    const weight =
      after.appliesTo === "whole"
        ? rat(1)
        : share(after.appliesTo === "liability" ? to.liabilityPart : to.physicalPart, to.total)
    const beforeSpread = cellSpread(before.cell)
    const afterSpread = cellSpread(after.cell)
    spreads.push({ down: beforeSpread.down, up: beforeSpread.up, weight })
    spreads.push({ down: afterSpread.down, up: afterSpread.up, weight })
    const basis = weakerBasis(before.cell.basis, after.cell.basis)
    steps.push({
      group: after.group,
      title: group(after.group).title,
      from: before.cell.label,
      to: after.cell.label,
      basis,
      sources: [...new Set([...before.cell.sources, ...after.cell.sources])],
    })
  }

  // Coverage with or without collision and comprehensive.
  const hadDamage = hasPhysicalDamage(start.scenario.coverage)
  const hasDamage = hasPhysicalDamage(target.coverage)
  if (hadDamage !== hasDamage) {
    const split = cellOf("premium-split", "liability")
    const spread = cellSpread(split)
    spreads.push({ down: spread.down, up: spread.up, weight: rat(1) })
    steps.push({
      group: "liability-limits",
      title: "Collision and comprehensive",
      from: hadDamage ? "Included" : "Not included",
      to: hasDamage ? "Included" : "Not included",
      basis: split.basis,
      sources: split.sources,
    })
  }

  // Vehicle.
  if (from.vehicle.key !== to.vehicle.key) {
    for (const relativity of [from.vehicle, to.vehicle]) {
      if (!relativity.spreadKey) continue
      const spread = cellSpread(rangeCell(relativity.spreadKey))
      spreads.push({ down: spread.down, up: spread.up, weight: rat(1) })
      if (relativity.outsideYears) {
        const extra = cellSpread(rangeCell("vehicle-model-years"))
        spreads.push({ down: extra.down, up: extra.up, weight: share(to.physicalPart, to.total) })
      }
    }
    steps.push({
      group: "vehicle",
      title: "Vehicle",
      from: describeVehicle(startVehicle),
      to: describeVehicle(targetVehicle),
      basis: weakerBasis(from.vehicle.basis, to.vehicle.basis),
      sources: [bundle.vehicle.sourceId],
    })
  }

  // State.
  if (start.scenario.state !== target.state) {
    const startTypical = options.stateAnnual?.[start.scenario.state]
    const targetTypical = options.stateAnnual?.[target.state]
    if (startTypical && targetTypical && startTypical > 0 && targetTypical > 0) {
      ratio = mul(ratio, rat(Math.round(targetTypical)), rat(1, Math.round(startTypical)))
      const spread = cellSpread(rangeCell("state-typical"))
      spreads.push({ down: spread.down, up: spread.up, weight: rat(1) })
      steps.push({
        group: "state",
        title: "State",
        from: stateName(start.scenario.state),
        to: stateName(target.state),
        basis: rangeCell("state-typical").basis,
        sources: [],
      })
    } else {
      const spread = cellSpread(rangeCell("state-unknown"))
      spreads.push({ down: spread.down, up: spread.up, weight: rat(1) })
      steps.push({
        group: "state",
        title: "State",
        from: stateName(start.scenario.state),
        to: stateName(target.state),
        basis: "assumed",
        sources: [],
      })
    }
  }

  // Starting point and trim.
  if (start.kind === "typical") {
    const spread = cellSpread(rangeCell("typical-start"))
    spreads.push({ down: spread.down, up: spread.up, weight: rat(1) })
  }
  if (options.trimConfidence === "limited" || options.trimConfidence === "unresolved") {
    const spread = cellSpread(rangeCell(`trim-${options.trimConfidence}`))
    spreads.push({ down: spread.down, up: spread.up, weight: rat(1) })
  }

  let downSquares = ZERO
  let upSquares = ZERO
  for (const item of spreads) {
    const down = scaled(item.down, item.weight)
    const up = scaled(item.up, item.weight)
    downSquares += down * down
    upSquares += up * up
  }
  let down = isqrt(downSquares)
  const up = isqrt(upSquares)
  const cap = BigInt(8000)
  if (down > cap) down = cap

  const likelyRaw = roundHalfUp(mul(rat(Math.round(start.annual)), ratio))
  const lowRaw = roundHalfUp(mul(rat(likelyRaw), rat(BP - down, BP)))
  const highRaw = roundHalfUp(mul(rat(likelyRaw), rat(BP + up, BP)))
  const kept = separate(lowRaw, likelyRaw, highRaw)
  const monthly = Math.max(1, Math.round(kept.likely / 12))

  const basisCount = { sourced: 0, indicative: 0, assumed: 0 }
  for (const step of steps) {
    if (step.basis !== "reference") basisCount[step.basis] += 1
  }

  return {
    low: kept.low,
    likely: kept.likely,
    high: kept.high,
    monthly,
    floored: kept.held,
    steps,
    vehicle: to.vehicle,
    basisCount,
    spread: { down: Number(down), up: Number(up) },
    summary: summarySentence(start, steps, kept.likely),
    rangeNote: rangeSentence(start, steps, to.vehicle, from.vehicle, options.trimConfidence ?? null),
  }
}

const BASIS_ORDER: FactorBasis[] = ["reference", "sourced", "indicative", "assumed"]

function weakerBasis(left: FactorBasis, right: FactorBasis): FactorBasis {
  return BASIS_ORDER.indexOf(left) >= BASIS_ORDER.indexOf(right) ? left : right
}

function startWords(start: StartingPoint): string {
  if (start.kind === "yours") return `the ${formatDollars(Math.round(start.annual))} a year you pay now`
  return start.label
    ? `${start.label} (${formatDollars(Math.round(start.annual))} a year)`
    : `a typical price of ${formatDollars(Math.round(start.annual))} a year`
}

function summarySentence(start: StartingPoint, steps: ChangeStep[], likely: number): string {
  if (steps.length === 0) {
    return start.kind === "yours"
      ? `This is the ${formatDollars(Math.round(start.annual))} a year you told us you pay now.`
      : `We started from ${startWords(start)}. Nothing here differs from that starting point.`
  }
  const changed = joinWords(steps.map((step) => lowerFirst(step.title)))
  return `We started from ${startWords(start)} and adjusted for the ${changed}. That comes to about ${formatDollars(likely)} a year (about ${formatDollars(Math.max(1, Math.round(likely / 12)))} a month).`
}

function rangeSentence(
  start: StartingPoint,
  steps: ChangeStep[],
  target: VehicleRelativity,
  origin: VehicleRelativity,
  trim: TrimConfidence | null,
): string {
  const parts: string[] = []
  if (start.kind === "typical") {
    parts.push("Even for the same driver and car, companies' prices differ a lot, so real quotes can land well above or below this.")
  } else if (steps.length > 0) {
    parts.push("The range shows how differently insurance companies price the same change.")
  }
  const assumed = steps.filter((step) => step.basis === "assumed" && step.group !== "vehicle" && step.group !== "state")
  if (assumed.length > 0) {
    parts.push(
      `It's wider because our figure for ${joinWords(assumed.map((step) => lowerFirst(step.title)))} is our own estimate. We haven't found a published source for it yet.`,
    )
  }
  const vehicleChanged = steps.some((step) => step.group === "vehicle")
  if (vehicleChanged) {
    for (const relativity of [origin, target]) {
      if (relativity.level === "class") {
        parts.push(`We don't have loss data for that exact model, so we used the average for its class (${lowerFirst(relativity.label)}).`)
      }
      if (relativity.level === "unknown") {
        parts.push("We couldn't tell what kind of vehicle that is, so we treated it as an average one and widened the range.")
      }
      if (relativity.level === "model" && relativity.outsideYears) {
        parts.push("Our loss data is for newer model years, so the range is wider for this one.")
      }
    }
  }
  if (steps.some((step) => step.group === "state" && step.basis === "assumed")) {
    parts.push("We don't have a typical price for the new state yet, so the range is much wider.")
  }
  if (trim === "limited" || trim === "unresolved") {
    parts.push("We couldn't pin down the exact version of the car, which widens the range a little.")
  }
  if (parts.length === 0) return "This is your own number, so there's no range yet. Change something to see an estimate."
  return parts.join(" ")
}

// ---------------------------------------------------------------------------
// Many vehicles, and what-ifs

export type VehicleComparisonRow = {
  vehicle: VehicleFacts
  estimate: Estimate
}

/**
 * The same driver and coverage with each vehicle in turn, for a comparison
 * table. The order of `vehicles` is kept.
 */
export function compareVehicles(
  start: StartingPoint,
  driver: Scenario,
  vehicles: VehicleFacts[],
  options: Omit<EstimateOptions, "vehicle"> = {},
): VehicleComparisonRow[] {
  return vehicles.map((vehicle) => ({
    vehicle,
    estimate: estimate(
      start,
      { ...driver, year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
      { ...options, vehicle },
    ),
  }))
}

export type WhatIf = {
  current: Estimate
  next: Estimate
  /** Next minus current, in whole dollars a year. */
  delta: number
  /** Delta rounded to the nearest $10 for the headline. */
  deltaRounded: number
  headline: string
}

export function whatIf(
  start: StartingPoint,
  current: Scenario,
  next: Scenario,
  options: {
    currentVehicle?: VehicleInput
    nextVehicle?: VehicleInput
    stateAnnual?: Partial<Record<StateCode, number>>
    label?: string
  } = {},
): WhatIf {
  const now = estimate(start, current, { vehicle: options.currentVehicle, stateAnnual: options.stateAnnual })
  const then = estimate(start, next, { vehicle: options.nextVehicle, stateAnnual: options.stateAnnual })
  const delta = then.likely - now.likely
  const deltaRounded = Math.round(delta / 10) * 10
  const label = options.label ?? whatIfLabel(current, next)
  const amount =
    deltaRounded === 0
      ? "about the same"
      : `about ${deltaRounded > 0 ? "+" : "−"}${formatDollars(Math.abs(deltaRounded))} a year`
  return { current: now, next: then, delta, deltaRounded, headline: `${label}: ${amount}.` }
}

function whatIfLabel(current: Scenario, next: Scenario): string {
  if (
    current.make !== next.make ||
    current.model !== next.model ||
    current.year !== next.year ||
    current.trim !== next.trim
  ) {
    return `Switching to a ${next.year} ${next.make} ${next.model}`
  }
  return "With that change"
}

// ---------------------------------------------------------------------------
// The older calculator API, kept so the current page keeps working.

export const FAMILY_IDS = ["driver", "geography", "coverage", "vehicle"] as const
export type FamilyId = (typeof FAMILY_IDS)[number]
export type ConfidenceLevel = "low" | "lower"

export type FamilySnapshot = {
  id: FamilyId
  key: string
}

export type FactorSnapshot = {
  families: FamilySnapshot[]
  scenario: Scenario
  vehicle?: VehicleInput
}

export type PremiumAnchor = {
  amount: number
  snapshot: FactorSnapshot
}

export type EngineDollars = {
  low: number
  likely: number
  high: number
  monthly: number
  displayFloor: boolean
}

export type EngineResult = {
  baselineCleared: false
  trendApplied: false
  creditFactor: 1
  dollars: EngineDollars | null
  explanation: string
  familiesChanged: FamilyId[]
  confidence: ConfidenceLevel
  confidenceDetail: string
  modelVersion: string
  bundleVersion: string
  /** The full estimate, when there is one. */
  estimate: Estimate | null
}

export function factorSnapshot(scenario: Scenario, vehicle?: VehicleInput): FactorSnapshot {
  const keys = selectionKeys(scenario)
  const byFamily: Record<FamilyId, string[]> = { driver: [], geography: [], coverage: [], vehicle: [] }
  for (const id of GROUP_IDS) byFamily[GROUP_FAMILY[id]].push(`${id}:${keys[id]}`)
  byFamily.geography.push(`state:${scenario.state}`)
  byFamily.coverage.push(`package:${scenario.coverage}`)
  byFamily.vehicle.push(`vehicle:${scenario.year}|${scenario.make}|${scenario.model}|${scenario.trim}`)
  return {
    families: FAMILY_IDS.map((id) => ({ id, key: byFamily[id].join("|") })),
    scenario,
    vehicle,
  }
}

function confidenceWords(input: {
  trimConfidence: TrimConfidence | null
  catalogStatus: CatalogStatus
  stale: boolean
}): { level: ConfidenceLevel; detail: string } {
  const weak = input.trimConfidence === "limited" || input.trimConfidence === "unresolved"
  const parts = ["This is a ballpark, not a price. Real quotes can land well above or below it."]
  if (input.trimConfidence === "limited") parts.push("We're not fully sure which version of the car this is.")
  if (input.trimConfidence === "unresolved") parts.push("We couldn't find the exact version of this car.")
  if (input.catalogStatus === "loading") parts.push("The vehicle list is still loading.")
  if (input.catalogStatus === "failed") parts.push("The vehicle list didn't load, so we're going by the car's name.")
  if (input.stale) parts.push("Our vehicle list is due for a refresh.")
  return { level: weak ? "lower" : "low", detail: parts.join(" ") }
}

/**
 * The calculator's entry point. With an entered premium (`anchor`) it
 * estimates from that; with `typical` it estimates from a typical premium;
 * with neither it returns no dollars.
 */
export function runFactorEngine(input: {
  scenario: Scenario
  anchor: PremiumAnchor | null
  trimConfidence: TrimConfidence | null
  catalogStatus: CatalogStatus
  stale: boolean
  vehicle?: VehicleInput
  typical?: { annual: number; scenario: Scenario; vehicle?: VehicleInput; label?: string } | null
  stateAnnual?: Partial<Record<StateCode, number>>
}): EngineResult {
  const confidence = confidenceWords(input)
  const base = {
    baselineCleared: false as const,
    trendApplied: false as const,
    creditFactor: 1 as const,
    confidence: confidence.level,
    confidenceDetail: confidence.detail,
    modelVersion: MODEL_VERSION,
    bundleVersion: FACTOR_BUNDLE_VERSION,
  }

  const start: StartingPoint | null = input.anchor
    ? {
        annual: input.anchor.amount,
        scenario: input.anchor.snapshot.scenario,
        vehicle: input.anchor.snapshot.vehicle,
        kind: "yours",
      }
    : input.typical
      ? { ...input.typical, kind: "typical" }
      : null

  if (start === null || start.annual < 1) {
    return {
      ...base,
      dollars: null,
      explanation:
        "Tell us what you pay now and we'll estimate how this changes it. Your number stays on your device.",
      familiesChanged: [],
      estimate: null,
    }
  }

  const result = estimate(start, input.scenario, {
    vehicle: input.vehicle,
    trimConfidence: input.trimConfidence,
    stateAnnual: input.stateAnnual,
  })
  const before = factorSnapshot(start.scenario)
  const after = factorSnapshot(input.scenario)
  const familiesChanged = FAMILY_IDS.filter(
    (id) =>
      before.families.find((family) => family.id === id)?.key !==
      after.families.find((family) => family.id === id)?.key,
  )
  return {
    ...base,
    dollars: {
      low: result.low,
      likely: result.likely,
      high: result.high,
      monthly: result.monthly,
      displayFloor: result.floored,
    },
    explanation: `${result.summary} ${result.rangeNote}`,
    familiesChanged,
    estimate: result,
  }
}

// ---------------------------------------------------------------------------
// Published tables ("Here's how we got this")

export type PublishedFactorRow = {
  key: string
  value: string
  /** Plain words for the basis. Kept under this name for the current table component. */
  confidence: string
  range: string
  basis: FactorBasis
  sources: string[]
  derivation: string
}

export type PublishedFactorGroup = {
  family: string
  note: string
  rows: PublishedFactorRow[]
}

export const BASIS_WORDS: Record<FactorBasis, string> = {
  reference: "Starting point",
  sourced: "From public prices or rules",
  indicative: "From public data, roughly",
  assumed: "Our estimate (help wanted)",
}

export function formatHundredths(value: number): string {
  return (value / bundle.scale).toFixed(2)
}

function publishedRow(cell: FactorCell): PublishedFactorRow {
  return {
    key: cell.label,
    value: formatHundredths(cell.value),
    confidence: BASIS_WORDS[cell.basis],
    range:
      cell.low === cell.high
        ? formatHundredths(cell.value)
        : `${formatHundredths(cell.low)}–${formatHundredths(cell.high)}`,
    basis: cell.basis,
    sources: cell.sources,
    derivation: cell.derivation,
  }
}

const PUBLISHED_ORDER = [...GROUP_IDS, "premium-split", "range"] as const

export function publishedFactorGroups(): PublishedFactorGroup[] {
  const groups: PublishedFactorGroup[] = PUBLISHED_ORDER.map((id) => {
    const item = group(id)
    return { family: item.title, note: item.note, rows: Object.values(item.cells).map(publishedRow) }
  })
  groups.push({
    family: "Vehicle class averages",
    note: bundle.vehicle.note,
    rows: Object.values(bundle.vehicle.classes).flatMap((row) => [
      publishedRow(row.liability),
      publishedRow(row.physical),
    ]),
  })
  groups.push({
    family: "Credit",
    note:
      "We don't ask about credit. Many insurers use it where the law allows, so your real quote could move up or down because of it.",
    rows: [],
  })
  return groups
}

// ---------------------------------------------------------------------------
// Guardrails

/**
 * Checks the bundle before it ships:
 * - every cell has a known basis, positive hundredths, and low ≤ value ≤ high;
 * - reference cells are exactly 1.00 with no spread;
 * - sourced and indicative cells name at least one listed source, say how
 *   they were derived, and count what went in;
 * - assumed cells say so plainly and carry a spread (they widen the range);
 * - every source has a URL and a check date;
 * - every HLDI row has at least one result and a plausible model-year range;
 * - there is no credit factor.
 */
export function assertFactorBundleSafe(candidate: FactorBundle = bundle): void {
  const sourceIds = new Set(candidate.sources.map((source) => source.id))
  for (const source of candidate.sources) {
    if (!/^https:\/\//.test(source.url)) throw new Error(`Source ${source.id} needs an https URL`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checkedOn)) throw new Error(`Source ${source.id} needs a check date`)
  }
  const checkCell = (where: string, cell: FactorCell) => {
    if (!BASIS_ORDER.includes(cell.basis)) throw new Error(`${where}: unknown basis`)
    for (const value of [cell.value, cell.low, cell.high]) {
      if (!Number.isInteger(value) || value <= 0) throw new Error(`${where}: factors must be positive hundredths`)
    }
    if (!(cell.low <= cell.value && cell.value <= cell.high)) throw new Error(`${where}: low ≤ value ≤ high`)
    if (!cell.label.trim()) throw new Error(`${where}: needs a label`)
    if (cell.basis === "reference") {
      if (cell.value !== 100 || cell.low !== 100 || cell.high !== 100) {
        throw new Error(`${where}: a reference cell is exactly 1.00`)
      }
      return
    }
    if (!cell.derivation.trim()) throw new Error(`${where}: needs a derivation`)
    if (cell.basis === "sourced" || cell.basis === "indicative") {
      if (cell.sources.length === 0) throw new Error(`${where}: a ${cell.basis} cell needs a source`)
      for (const id of cell.sources) {
        if (!sourceIds.has(id)) throw new Error(`${where}: unknown source ${id}`)
      }
      if (!cell.n || cell.n < 1) throw new Error(`${where}: a ${cell.basis} cell needs a count`)
    }
    if (cell.basis === "assumed") {
      if (cell.sources.length !== 0) throw new Error(`${where}: an assumed cell cites no source`)
      if (!/estimate/i.test(cell.derivation) || !/help wanted/i.test(cell.derivation)) {
        throw new Error(`${where}: an assumed cell must say it is an estimate and that help is wanted`)
      }
      if (cell.low === cell.high) throw new Error(`${where}: an assumed cell must widen the range`)
    }
  }
  for (const [id, item] of Object.entries(candidate.groups)) {
    if (/credit/i.test(id)) throw new Error("There is no credit factor")
    for (const [key, cell] of Object.entries(item.cells)) checkCell(`${id}.${key}`, cell)
  }
  for (const id of [...GROUP_IDS, "premium-split", "range"]) {
    if (!candidate.groups[id]) throw new Error(`Missing group ${id}`)
  }
  if (!sourceIds.has(candidate.vehicle.sourceId)) throw new Error("Vehicle data needs a listed source")
  for (const row of candidate.vehicle.models) {
    const results = [row.collision, row.comprehensive, row.propertyDamage, row.bodilyInjury]
    if (results.every((value) => value === null)) throw new Error(`${row.series}: no results`)
    for (const value of results) {
      if (value !== null && (!Number.isInteger(value) || value <= 0)) throw new Error(`${row.series}: bad result`)
    }
    if (row.yearMin > row.yearMax) throw new Error(`${row.series}: model years`)
  }
  for (const [id, row] of [
    ...Object.entries(candidate.vehicle.classes),
    ...Object.entries(candidate.vehicle.electricClasses),
  ]) {
    checkCell(`vehicle.${id}.liability`, row.liability)
    checkCell(`vehicle.${id}.physical`, row.physical)
  }
}
