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
}
