import factorBundle from "@/data/model-factors.json"
import sourceManifest from "@/data/source-manifest.json"
import { CATALOG_VERSION } from "./catalog-meta"
import { longDate } from "./format"

export const PUBLISHER = "Bolewood Group, LLC"

export const MODEL_VERSION = "0.2.0"

export const DATA_BUNDLE_VERSION = factorBundle.version

export const MANIFEST_VERSION = sourceManifest.version

export { CATALOG_VERSION }

/** The one "not a quote" message. Show it once per page, in one place. */
export const DISCLAIMER =
  "This is an estimate to help you plan, not a quote. We don't sell insurance, and we never pass your info to anyone. Only an insurer can give you a real price."

/** Said once, near the premium field. */
export const PREMIUM_HINT =
  "If you know it, we'll start from your real number. It stays on your device."

export { longDate }

/** When the numbers were last checked, in words: "September 22, 2026". */
export const DATA_UPDATED = longDate(factorBundle.checkedOn)

/**
 * How many public sources the numbers come from: every source the factors
 * cite, plus the two government datasets behind the list of cars.
 */
export const SOURCE_COUNT = new Set([...factorBundle.sources.map((source) => source.id), "nhtsa-vpic", "fueleconomy"]).size
