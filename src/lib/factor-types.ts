/**
 * Shapes shared by the factor derivation (scripts/derive-factors.ts) and the
 * factor engine (src/lib/factor-engine.ts). The generated file is
 * src/data/model-factors.json.
 */

/**
 * Where a number comes from.
 * - reference: the comparison point. Always 1.00.
 * - sourced: computed from public prices or an official rule where the two
 *   profiles differ in only the thing being measured.
 * - indicative: computed from public data, but the profiles also differ in
 *   something else, or the data measures losses rather than prices. The note
 *   says what else differs. The range is wider.
 * - assumed: our own estimate. No public source yet; help wanted. The range is
 *   wider still.
 */
export type FactorBasis = "reference" | "sourced" | "indicative" | "assumed"

export type FactorCell = {
  label: string
  /** Hundredths: 100 means 1.00. */
  value: number
  /** Hundredths. The lower edge of what real insurers do (for example the 25th percentile across companies). */
  low: number
  /** Hundredths. The upper edge. */
  high: number
  basis: FactorBasis
  /** Ids from FactorBundle.sources. Empty for reference and assumed cells. */
  sources: string[]
  /** How the value was computed, in plain words, or why it is assumed. */
  derivation: string
  /** How many company comparisons (or rows) went into the value. Null when not counted. */
  n: number | null
}

export type AppliesTo = "whole" | "liability" | "physical"

export type FactorGroup = {
  title: string
  appliesTo: AppliesTo
  note: string
  cells: Record<string, FactorCell>
}

export type FactorSource = {
  id: string
  title: string
  publisher: string
  url: string
  dataYear: string
  checkedOn: string
  /** Terms of use as found, or a note that none were found. */
  terms: string
}

export type VehicleLossRow = {
  /** HLDI series name exactly as published. */
  series: string
  make: string
  /**
   * The HLDI model name, compacted, with body, cab, drive, and powertrain words
   * removed (for example "f150", "f150lightning", "rav4prime", "modely").
   */
  family: string
  powertrain: "combustion" | "hybrid" | "plug-in-hybrid" | "electric"
  drive: "2wd" | "4wd"
  /**
   * Body words from the HLDI name: "convertible", "hatchback", "wagon", and
   * "2dr" (two doors). Empty for the plain version of the model.
   */
  body: string[]
  hldiClass: string
  modelYears: string
  yearMin: number
  yearMax: number
  /** HLDI relative results, 100 = average for all passenger vehicles. Null where HLDI shows no result. */
  collision: number | null
  comprehensive: number | null
  propertyDamage: number | null
  bodilyInjury: number | null
}

export type VehicleClassRow = {
  /** HLDI subtotal label this class maps to. */
  hldiSubtotal: string
  liability: FactorCell
  physical: FactorCell
}

export type VehicleData = {
  /** False when the per-model HLDI file is switched off or missing; the engine then uses class averages. */
  modelsEnabled: boolean
  sourceId: string
  modelYears: string
  yearMin: number
  yearMax: number
  note: string
  models: VehicleLossRow[]
  /**
   * Catalog model names that HLDI spells differently, keyed by
   * "compact make|compact catalog model" (for example "mazda|mazda3" → "3").
   */
  aliases: Record<string, string>
  classes: Record<string, VehicleClassRow>
  /** Class fallback for electric vehicles: median of HLDI electric rows in the mapped HLDI class, when there are enough rows. */
  electricClasses: Record<string, VehicleClassRow>
  /** Class fallback for luxury makes (see luxuryMakes), from HLDI's luxury and sports-car class averages. */
  luxuryClasses: Record<string, VehicleClassRow>
  /** Compact make names treated as luxury for the class fallback. */
  luxuryMakes: string[]
  /**
   * How much of HLDI's liability result we pass on to the liability share
   * (hundredths): relativity = 1 + weight × (HLDI − 1), then kept between
   * liabilityFloor and liabilityCap.
   */
  liabilityWeight: FactorCell
  liabilityFloor: number
  liabilityCap: number
  /** Class fallback for two-doors and convertibles from luxury makes: HLDI's sports-car averages. */
  luxurySportsClasses: Record<string, VehicleClassRow>
  /** How HLDI damage results turn into prices, fitted to California's survey. */
  calibration: VehicleCalibration
}

export type CalibrationPoint = {
  vehicle: string
  /** Median premium ÷ the Accord's, same company, place, and driver. */
  observed: number
  /** What the fitted model gives for the same ratio. */
  fitted: number
  /** What the model gave before calibration (exponent 1, no luxury term). */
  uncalibrated: number
  n: number
  luxury: boolean
}

export type VehicleCalibration = {
  /** Damage factor = HLDI damage result ^ exponent (hundredths: 38 means 0.38). */
  exponent: FactorCell
  /** Extra multiplier on the damage share for makes HLDI files as luxury (hundredths). */
  luxury: FactorCell
  /** Lookup table: damageCurve[h - damageCurveMin] is the damage factor for an HLDI damage result of h hundredths. */
  damageCurveMin: number
  damageCurve: number[]
  /** False when HLDI's model rows are off; the damage curve is then 1:1 and there is no luxury term. */
  fitted: boolean
  points: CalibrationPoint[]
  /** Sum of squared log errors, before and after. */
  errorBefore: number
  errorAfter: number
  /** California's liability share used in the fit (NAIC 2023, hundredths). */
  liabilityShare: number
}

export type TypicalStartData = {
  /** Average vehicle age behind the typical price, and the band we use for it. */
  fleetAgeYears: number
  vehicleAgeBand: string
  fleetAgeNote: string
  /** Price change since the typical price's year (BLS CPI, motor vehicle insurance). */
  trend: {
    basePeriod: string
    baseValue: number
    latestPeriod: string
    latestValue: number
    cell: FactorCell
  }
  sources: string[]
}

export type FactorBundle = {
  version: string
  effectiveDate: string
  checkedOn: string
  scale: 100
  formula: string
  changelogNote: string
  sources: FactorSource[]
  groups: Record<string, FactorGroup>
  vehicle: VehicleData
  typicalStart: TypicalStartData
}
