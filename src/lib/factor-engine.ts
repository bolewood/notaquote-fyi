import factorFile from "@/data/model-factors.json"
import { compactName } from "@/lib/catalog-match"
import type { TrimConfidence } from "@/lib/catalog-match"
import type { CatalogStatus } from "@/lib/catalog"
import { MODEL_VERSION } from "@/lib/copy"
import {
  AGE_BANDS,
  COVERAGE_PACKAGES,
  INCIDENTS,
  MILEAGE_BANDS,
  YEARS_LICENSED,
  hasPhysicalDamage,
  regionLabel,
  stateName,
  vehicleLabel,
  type Scenario,
} from "@/lib/scenario"

export const FACTOR_BUNDLE_VERSION = factorFile.version
export const FACTOR_EFFECTIVE_DATE = factorFile.effectiveDate
export const FACTOR_FORMULA = factorFile.formula
export const FACTOR_CHANGELOG = factorFile.changelogNote

export const FAMILY_IDS = ["driver", "geography", "coverage", "vehicle"] as const
export type FamilyId = (typeof FAMILY_IDS)[number]
export type ConfidenceLevel = "low" | "lower"
export type FactorConfidence = "modeled" | "thin" | "locked" | "not-applied"

type Cell = { value: number; confidence: FactorConfidence }
type Rational = { num: bigint; den: bigint }

export type FamilySnapshot = {
  id: FamilyId
  parts: number[]
  key: string
  thin: boolean
}

export type FactorSnapshot = {
  families: FamilySnapshot[]
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
}

export type PublishedFactorRow = {
  key: string
  value: string
  confidence: string
}

export type PublishedFactorGroup = {
  family: string
  note: string
  rows: PublishedFactorRow[]
}

const NEUTRAL = 100
const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)
const HUNDRED = BigInt(100)

type ClassRule = (typeof factorFile.vehicle.class)[number]
type RawCell = { value: number; confidence: string }

function readCell(value: RawCell): Cell {
  if (
    value.confidence !== "modeled" &&
    value.confidence !== "thin" &&
    value.confidence !== "locked" &&
    value.confidence !== "not-applied"
  ) {
    throw new Error(`Unknown factor confidence ${value.confidence}`)
  }
  return { value: value.value, confidence: value.confidence }
}

function cell(value: number, confidence: FactorConfidence): Cell {
  return { value, confidence }
}

function ageCell(scenario: Scenario): Cell {
  return readCell(factorFile.driver.age[scenario.age])
}

function yearsCell(scenario: Scenario): Cell {
  return readCell(factorFile.driver.yearsLicensed[scenario.yearsLicensed])
}

function incidentCell(scenario: Scenario): Cell {
  return readCell(factorFile.driver.incidents[scenario.incidents])
}

function mileageCell(scenario: Scenario): Cell {
  return readCell(factorFile.driver.mileage[scenario.mileage])
}

function flagParts(scenario: Scenario): Cell[] {
  const flags = factorFile.driver.flags
  return [
    scenario.teen ? readCell(flags.teen) : cell(NEUTRAL, "modeled"),
    scenario.goodStudent ? readCell(flags.goodStudent) : cell(NEUTRAL, "modeled"),
    scenario.driverTraining ? readCell(flags.driverTraining) : cell(NEUTRAL, "modeled"),
    scenario.householdPolicy ? readCell(flags.householdPolicy) : cell(NEUTRAL, "modeled"),
  ]
}

function yearCell(year: number): Cell & { label: string } {
  const band =
    factorFile.vehicle.year.find((item) => year >= item.min) ??
    factorFile.vehicle.year[factorFile.vehicle.year.length - 1]
  return { ...readCell(band), label: band.label }
}

function vehicleClass(scenario: Scenario): ClassRule | (typeof factorFile.vehicle.other) {
  const make = compactName(scenario.make)
  const haystack = compactName(`${scenario.make} ${scenario.model} ${scenario.trim}`)
  for (const rule of factorFile.vehicle.class) {
    if (rule.makes.some((item) => make === item)) return rule
    if (rule.match.some((item) => haystack.includes(item))) return rule
  }
  return factorFile.vehicle.other
}

function driverFamily(scenario: Scenario): FamilySnapshot {
  const parts = [
    ageCell(scenario),
    yearsCell(scenario),
    incidentCell(scenario),
    mileageCell(scenario),
    ...flagParts(scenario),
  ]
  return {
    id: "driver",
    parts: parts.map((item) => item.value),
    key: [
      `age:${scenario.age}`,
      `years:${scenario.yearsLicensed}`,
      `incidents:${scenario.incidents}`,
      `mileage:${scenario.mileage}`,
      `teen:${scenario.teen ? 1 : 0}`,
      `student:${scenario.goodStudent ? 1 : 0}`,
      `training:${scenario.driverTraining ? 1 : 0}`,
      `household:${scenario.householdPolicy ? 1 : 0}`,
    ].join("|"),
    thin: parts.some((item) => item.confidence === "thin"),
  }
}

function geographyFamily(scenario: Scenario): FamilySnapshot {
  const region = readCell(factorFile.geography.region[scenario.region])
  const state = readCell(factorFile.geography.state)
  return {
    id: "geography",
    parts: [state.value, region.value],
    key: `state:${scenario.state}|region:${scenario.region}`,
    thin: state.confidence === "thin" || region.confidence === "thin",
  }
}

function coverageFamily(scenario: Scenario): FamilySnapshot {
  const pack = readCell(factorFile.coverage.package[scenario.coverage])
  const deductible = hasPhysicalDamage(scenario.coverage)
    ? readCell(factorFile.coverage.deductible[String(scenario.deductible) as "500" | "1000" | "2000"])
    : cell(NEUTRAL, "modeled")
  const loan = scenario.loanLease ? readCell(factorFile.coverage.loanLease) : cell(NEUTRAL, "modeled")
  const parts = [pack, deductible, loan]
  return {
    id: "coverage",
    parts: parts.map((item) => item.value),
    key: `package:${scenario.coverage}|deductible:${
      hasPhysicalDamage(scenario.coverage) ? scenario.deductible : "na"
    }|loan:${scenario.loanLease ? 1 : 0}`,
    thin: parts.some((item) => item.confidence === "thin"),
  }
}

function vehicleFamily(scenario: Scenario): FamilySnapshot {
  const named = vehicleClass(scenario)
  const klass = readCell(named)
  const year = yearCell(scenario.year)
  return {
    id: "vehicle",
    parts: [klass.value, year.value],
    key: `class:${named.id}|year:${year.label}|vehicle:${scenario.year}|${scenario.make}|${scenario.model}|${scenario.trim}`,
    thin: klass.confidence === "thin" || year.confidence === "thin",
  }
}

export function factorSnapshot(scenario: Scenario): FactorSnapshot {
  return {
    families: [
      driverFamily(scenario),
      geographyFamily(scenario),
      coverageFamily(scenario),
      vehicleFamily(scenario),
    ],
  }
}

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

function rationalFromParts(parts: number[]): Rational {
  let num = ONE
  let den = ONE
  for (const part of parts) {
    num *= BigInt(part)
    den *= HUNDRED
  }
  const divisor = gcd(num, den)
  return { num: num / divisor, den: den / divisor }
}

function multiply(left: Rational, right: Rational): Rational {
  const divisorLeft = gcd(left.num, right.den)
  const divisorRight = gcd(right.num, left.den)
  return {
    num: (left.num / divisorLeft) * (right.num / divisorRight),
    den: (left.den / divisorRight) * (right.den / divisorLeft),
  }
}

function familyRational(family: FamilySnapshot): Rational {
  return rationalFromParts(family.parts)
}

function snapshotRational(snapshot: FactorSnapshot): Rational {
  return snapshot.families.reduce(
    (product, family) => multiply(product, familyRational(family)),
    { num: ONE, den: ONE } as Rational,
  )
}

function applyRational(amount: number, current: Rational, anchor: Rational): number {
  const num = BigInt(amount) * current.num * anchor.den
  const den = current.den * anchor.num
  return Number((num + den / TWO) / den)
}

function applyHundredths(amount: number, hundredths: number): number {
  const num = BigInt(amount) * BigInt(hundredths)
  return Number((num + HUNDRED / TWO) / HUNDRED)
}

function lookupLabel(
  rows: readonly { id: string; label: string }[],
  id: string,
): string {
  return rows.find((row) => row.id === id)?.label ?? id
}

function scenarioSentence(scenario: Scenario): string {
  const age = lookupLabel(AGE_BANDS, scenario.age)
  const coverage = lookupLabel(COVERAGE_PACKAGES, scenario.coverage)
  return `Driver ${age}. Geography ${stateName(scenario.state)}, ${regionLabel(scenario.region).toLowerCase()}. Coverage ${coverage.toLowerCase()}. Vehicle ${vehicleLabel(scenario)}.`
}

function joinLabels(ids: FamilyId[]): string {
  const labels = ids.map((id) => id)
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`
}

function changedSentence(changed: FamilyId[]): string {
  if (changed.length === 0) {
    return "No factor family has changed since that premium was entered."
  }
  if (changed.length === 1) return `${capitalize(changed[0])} factor changed.`
  const labels = changed.map((id, index) => (index === 0 ? capitalize(id) : id))
  if (labels.length === 2) return `${labels[0]} and ${labels[1]} factors changed.`
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]} factors changed.`
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function widthSentence(thin: FamilyId[], trimConfidence: TrimConfidence | null): string {
  const reasons: string[] = []
  if (thin.length === 1) reasons.push(`the ${thin[0]} factor is thin`)
  if (thin.length > 1) reasons.push(`the ${joinLabels(thin)} factors are thin`)
  if (trimConfidence === "limited") reasons.push("the trim match is limited")
  if (trimConfidence === "unresolved") reasons.push("the trim is not resolved")
  if (reasons.length === 0) {
    return "The range uses the width for an uncleared general baseline."
  }
  return `The range is wider because ${reasons.join(" and ")}.`
}

function spreadHundredths(thinCount: number, trimConfidence: TrimConfidence | null): {
  low: number
  high: number
} {
  const band = factorFile.range
  let low = band.low - thinCount * band.thinLow
  let high = band.high + thinCount * band.thinHigh
  if (trimConfidence === "limited") {
    low -= band.limitedTrimLow
    high += band.limitedTrimHigh
  }
  if (trimConfidence === "unresolved") {
    low -= band.unresolvedTrimLow
    high += band.unresolvedTrimHigh
  }
  if (low < 1) low = 1
  if (high > 400) high = 400
  return { low, high }
}

function separateRange(low: number, likely: number, high: number): {
  low: number
  likely: number
  high: number
  held: boolean
} {
  let held = false
  if (likely < 1) {
    likely = 1
    held = true
  }
  if (low < 1) {
    low = 1
    held = true
  }
  if (high < 1) {
    high = 1
    held = true
  }
  if (low >= likely) {
    held = true
    if (likely - 1 >= 1) low = likely - 1
    else {
      likely = 2
      low = 1
    }
  }
  if (high <= likely) {
    held = true
    high = likely + 1
  }
  return { low, likely, high, held }
}

function confidenceCopy(input: {
  trimConfidence: TrimConfidence | null
  catalogStatus: CatalogStatus
  stale: boolean
}): { level: ConfidenceLevel; detail: string } {
  const lower =
    input.trimConfidence === "limited" || input.trimConfidence === "unresolved"
  const lead = lower ? "Lower." : "Low."
  const trim =
    input.trimConfidence === "high"
      ? "Trim match is strong."
      : input.trimConfidence === "limited"
        ? "The trim match is limited, so confidence is lower."
        : input.trimConfidence === "unresolved"
          ? "The trim is not resolved, so confidence is lower."
          : "Trim confidence is not available yet."
  const catalog =
    input.catalogStatus === "loading"
      ? "The vehicle catalog is loading."
      : input.catalogStatus === "failed"
        ? "The vehicle catalog did not load."
        : ""
  const stale = input.stale ? "This snapshot is past its refresh date." : ""
  const detail = [lead, "The general baseline is not cleared.", trim, catalog, stale]
    .filter(Boolean)
    .join(" ")
  return { level: lower ? "lower" : "low", detail }
}

export function runFactorEngine(input: {
  scenario: Scenario
  anchor: PremiumAnchor | null
  trimConfidence: TrimConfidence | null
  catalogStatus: CatalogStatus
  stale: boolean
}): EngineResult {
  const current = factorSnapshot(input.scenario)
  const confidence = confidenceCopy(input)
  const thin = current.families.filter((family) => family.thin).map((family) => family.id)

  if (input.anchor === null) {
    return {
      baselineCleared: false,
      trendApplied: false,
      creditFactor: 1,
      dollars: null,
      explanation: [
        "The factor engine did not emit a dollar range.",
        "The general baseline is not cleared.",
        scenarioSentence(input.scenario),
        "These figures are a labeled sample, not this engine's output.",
      ].join(" "),
      familiesChanged: [],
      confidence: confidence.level,
      confidenceDetail: confidence.detail,
      modelVersion: MODEL_VERSION,
      bundleVersion: FACTOR_BUNDLE_VERSION,
    }
  }

  const changed = FAMILY_IDS.filter((id) => {
    const next = current.families.find((family) => family.id === id)
    const previous = input.anchor?.snapshot.families.find((family) => family.id === id)
    return next?.key !== previous?.key
  })
  const likelyRaw =
    changed.length === 0
      ? input.anchor.amount
      : applyRational(
          input.anchor.amount,
          snapshotRational(current),
          snapshotRational(input.anchor.snapshot),
        )
  const spread = spreadHundredths(thin.length, input.trimConfidence)
  const likelyDraft = likelyRaw >= 1 ? likelyRaw : 1
  const lowDraft = applyHundredths(likelyDraft, spread.low)
  const highDraft = applyHundredths(likelyDraft, spread.high)
  const separated = separateRange(lowDraft, likelyDraft, highDraft)
  let monthly = Math.round(separated.likely / 12)
  let displayFloor = separated.held || likelyRaw < 1
  if (monthly < 1) {
    monthly = 1
    displayFloor = true
  }

  const moved = separated.likely !== input.anchor.amount

  return {
    baselineCleared: false,
    trendApplied: false,
    creditFactor: 1,
    dollars: {
      low: separated.low,
      likely: separated.likely,
      high: separated.high,
      monthly,
      displayFloor,
    },
    explanation: [
      changedSentence(changed),
      moved
        ? "The likely figure moved from the amount entered."
        : "The likely figure stays on the amount entered.",
      "The current annual premium is the base for this scenario only.",
      "The general baseline is not cleared.",
      "Trend is not applied.",
      "The lawful sensitivity factor stays at 1.00.",
      widthSentence(thin, input.trimConfidence),
    ].join(" "),
    familiesChanged: changed,
    confidence: confidence.level,
    confidenceDetail: confidence.detail,
    modelVersion: MODEL_VERSION,
    bundleVersion: FACTOR_BUNDLE_VERSION,
  }
}

function formatFactor(value: number): string {
  return (value / factorFile.scale).toFixed(2)
}

export function publishedFactorGroups(): PublishedFactorGroup[] {
  const driver = factorFile.driver
  const driverRows: PublishedFactorRow[] = [
    ...Object.entries(driver.age).map(([key, cell]) => ({
      key: `Age ${lookupLabel(AGE_BANDS, key)}`,
      value: formatFactor(cell.value),
      confidence: cell.confidence,
    })),
    ...Object.entries(driver.yearsLicensed).map(([key, cell]) => ({
      key: `Years licensed ${lookupLabel(YEARS_LICENSED, key)}`,
      value: formatFactor(cell.value),
      confidence: cell.confidence,
    })),
    ...Object.entries(driver.incidents).map(([key, cell]) => ({
      key: `Incidents ${lookupLabel(INCIDENTS, key)}`,
      value: formatFactor(cell.value),
      confidence: cell.confidence,
    })),
    ...Object.entries(driver.mileage).map(([key, cell]) => ({
      key: `Mileage ${lookupLabel(MILEAGE_BANDS, key)}`,
      value: formatFactor(cell.value),
      confidence: cell.confidence,
    })),
    { key: "Teen driver, when checked", value: formatFactor(driver.flags.teen.value), confidence: driver.flags.teen.confidence },
    { key: "Good student, when checked", value: formatFactor(driver.flags.goodStudent.value), confidence: driver.flags.goodStudent.confidence },
    { key: "Driver training, when checked", value: formatFactor(driver.flags.driverTraining.value), confidence: driver.flags.driverTraining.confidence },
    { key: "Household policy, when checked", value: formatFactor(driver.flags.householdPolicy.value), confidence: driver.flags.householdPolicy.confidence },
  ]

  const geography = factorFile.geography
  const coverage = factorFile.coverage
  const vehicle = factorFile.vehicle

  return [
    { family: "Driver", note: driver.note, rows: driverRows },
    {
      family: "Geography",
      note: `${geography.note} ${geography.state.note}`,
      rows: [
        {
          key: "State, every state and DC",
          value: formatFactor(geography.state.value),
          confidence: geography.state.confidence,
        },
        ...Object.entries(geography.region).map(([key, cell]) => ({
          key: `Region ${key}`,
          value: formatFactor(cell.value),
          confidence: cell.confidence,
        })),
      ],
    },
    {
      family: "Coverage",
      note: coverage.note,
      rows: [
        ...Object.entries(coverage.package).map(([key, cell]) => ({
          key: lookupLabel(COVERAGE_PACKAGES, key),
          value: formatFactor(cell.value),
          confidence: cell.confidence,
        })),
        ...Object.entries(coverage.deductible).map(([key, cell]) => ({
          key: `Deductible $${Number(key).toLocaleString("en-US")}, when comprehensive and collision apply`,
          value: formatFactor(cell.value),
          confidence: cell.confidence,
        })),
        {
          key: "Loan or lease, when checked",
          value: formatFactor(coverage.loanLease.value),
          confidence: coverage.loanLease.confidence,
        },
      ],
    },
    {
      family: "Vehicle",
      note: `${vehicle.note} ${vehicle.other.note}`,
      rows: [
        ...vehicle.year.map((band) => ({
          key: `Model year ${band.label}`,
          value: formatFactor(band.value),
          confidence: band.confidence,
        })),
        ...vehicle.class.map((rule) => ({
          key: rule.label,
          value: formatFactor(rule.value),
          confidence: rule.confidence,
        })),
        {
          key: vehicle.other.label,
          value: formatFactor(vehicle.other.value),
          confidence: vehicle.other.confidence,
        },
      ],
    },
    {
      family: "Trend",
      note: factorFile.trend.note,
      rows: [
        {
          key: "BLS motor-vehicle-insurance CPI",
          value: factorFile.trend.applied ? formatFactor(factorFile.trend.value) : "Not applied",
          confidence: factorFile.trend.confidence,
        },
      ],
    },
    {
      family: "Lawful sensitivity",
      note: factorFile.lawfulSensitivity.note,
      rows: [
        {
          key: "Credit",
          value: formatFactor(factorFile.lawfulSensitivity.credit.value),
          confidence: factorFile.lawfulSensitivity.credit.confidence,
        },
      ],
    },
  ]
}

export function assertFactorBundleSafe(): void {
  if (factorFile.baselineCleared !== false) {
    throw new Error("The general baseline is not cleared")
  }
  if (factorFile.trend.applied !== false) {
    throw new Error("Trend must not be applied")
  }
  if (factorFile.lawfulSensitivity.credit.value !== 100) {
    throw new Error("Credit factor must stay at 1.00")
  }
  if (factorFile.geography.state.value !== 100 || factorFile.geography.state.confidence !== "thin") {
    throw new Error("State geography must stay a thin 1.00")
  }
  const blob = JSON.stringify(factorFile)
  if (/naic estimate/i.test(blob) || /\$\s?\d/.test(blob)) {
    throw new Error("Factor bundle contains a dollar figure or an estimate claim")
  }
  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object") return
    if ("value" in value && "confidence" in value) {
      const cell = value as Cell
      if (!Number.isInteger(cell.value) || cell.value <= 0) {
        throw new Error("Factor values must be positive hundredths")
      }
    }
    for (const nested of Object.values(value)) walk(nested)
  }
  walk(factorFile.driver)
  walk(factorFile.geography)
  walk(factorFile.coverage)
  walk(factorFile.vehicle)
}

export function formatHundredths(value: number): string {
  return formatFactor(value)
}
