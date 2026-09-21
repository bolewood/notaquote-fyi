/**
 * Join FuelEconomy.gov model names to NHTSA vPIC models.
 * Trim labels are source strings. This module does not invent marketing trims.
 */

export type TrimConfidence = "high" | "limited" | "unresolved"

export const UNRESOLVED_TRIM_NAME = "Trim not resolved"

const GENERIC_SUFFIXES = [
  "pluginhybrid",
  "plug-inhybrid",
  "phev",
  "hybrid",
  "pickup",
  "passenger",
  "cargo",
  "wagon",
  "hatchback",
  "convertible",
  "4x4",
  "4x2",
  "4wd",
  "2wd",
  "awd",
  "fwd",
  "rwd",
  "4dr",
  "5dr",
  "2dr",
  "ffv",
  "hev",
  "lwb",
  "swb",
  "ev",
  "diesel",
  "sedan",
  "coupe",
  "van",
].sort((left, right) => right.length - left.length)

const EXCLUDED_NAME =
  /\b(cab chassis|chassis|incomplete|motorhome|motor home|trailer|bus|motorcycle|scooter|moped|robotaxi|robo taxi|taxi|hearse|limo|limousine|cutaway|glider)\b/i

const RAM_CHASSIS = new Set(["2500", "3500", "4000", "4500", "5500"])

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function compactName(value: string): string {
  return normalizeName(value).replace(/ /g, "")
}

export function isExcludedVehicleName(value: string): boolean {
  return EXCLUDED_NAME.test(normalizeName(value))
}

/**
 * Ram 2500–5500 and the Ford E-450 are commercial chassis cabs, not personal
 * light-duty cars or light trucks. The model name has to be the whole name so
 * a personal trim that merely contains those digits stays.
 */
export function isCommercialChassisModel(make: string, model: string): boolean {
  const compactMake = compactName(make)
  const compactModel = compactName(model)
  if (compactMake === "ram" && RAM_CHASSIS.has(compactModel)) return true
  return compactMake === "ford" && compactModel === "e450"
}

export function includesQuery(value: string, query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true
  if (normalizeName(value).includes(normalizeName(trimmed))) return true
  const compactQuery = compactName(trimmed)
  return compactQuery.length > 0 && compactName(value).includes(compactQuery)
}

function genericRemainder(remainder: string): boolean {
  let rest = remainder
  while (rest.length > 0) {
    const suffix = GENERIC_SUFFIXES.find((item) => rest.endsWith(item))
    if (!suffix) return false
    rest = rest.slice(0, -suffix.length)
  }
  return true
}

function equivalent(left: string, right: string): boolean {
  if (left === right) return true
  if (left.startsWith(right) && genericRemainder(left.slice(right.length))) return true
  if (right.startsWith(left) && genericRemainder(right.slice(left.length))) return true
  return false
}

export type ModelMatch = {
  name: string
  confidence: "high" | "limited"
}

/**
 * Pick the NHTSA model a FuelEconomy row belongs to.
 * High means the base names agree. Limited means the names only share a prefix
 * or the FuelEconomy row names more than one trim.
 */
export function matchFeRow(
  baseModel: string,
  model: string,
  nhtsaModels: readonly string[],
): ModelMatch | null {
  const baseCompact = compactName(baseModel)
  const modelCompact = compactName(model)
  let best: { name: string; score: number } | null = null
  let runnerUp = 0

  for (const candidate of nhtsaModels) {
    if (isExcludedVehicleName(candidate)) continue
    const compact = compactName(candidate)
    if (compact.length < 2) continue
    let score = 0
    if (compact === modelCompact) score = 400 + compact.length
    else if (compact === baseCompact || equivalent(compact, baseCompact)) {
      score = 300 + compact.length
    } else if (
      (modelCompact.startsWith(compact) || baseCompact.startsWith(compact)) &&
      compact.length >= 3
    ) {
      score = 120 + compact.length
    }
    if (score === 0) continue
    if (!best || score > best.score) {
      runnerUp = best?.score ?? 0
      best = { name: candidate, score }
    } else if (score > runnerUp) {
      runnerUp = score
    }
  }

  if (!best || best.score < 120) return null
  const slash = model.includes("/")
  const close = runnerUp > 0 && best.score - runnerUp <= 15
  const confidence = best.score >= 280 && !slash && !close ? "high" : "limited"
  return { name: best.name, confidence }
}

export function higherConfidence(
  left: TrimConfidence,
  right: TrimConfidence,
): TrimConfidence {
  const rank: Record<TrimConfidence, number> = {
    high: 3,
    limited: 2,
    unresolved: 1,
  }
  return rank[left] >= rank[right] ? left : right
}
