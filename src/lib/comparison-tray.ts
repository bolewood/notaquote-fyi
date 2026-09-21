import { scenarioFromRecord, normalizeAnchor } from "./share-link"
import {
  PERSONA_DETAILS,
  PRESETS,
  type PersonaId,
  type Scenario,
} from "./scenario"

export const COMPARISON_STORAGE_KEY = "notaquote.comparisons.v1"
export const COMPARISON_EVENT = "notaquote-comparisons"
export const COMPARISON_SNAPSHOT_ERROR = "error"
export const COMPARISON_LIMIT = 8

export type SavedComparison = {
  id: string
  label: string
  savedAt: string
  scenario: Scenario
  anchorAmount: number | null
}

export function matchingPersona(scenario: Scenario): PersonaId | null {
  const ids: PersonaId[] = ["molly", "jayden", "ava"]
  for (const id of ids) {
    if (sameScenario(scenario, PRESETS[id])) return id
  }
  return null
}

export function comparisonLabel(scenario: Scenario): string {
  const persona = matchingPersona(scenario)
  return persona ? PERSONA_DETAILS[persona].name : "Custom scenario"
}

export function comparisonSnapshot(storage: Pick<Storage, "getItem">): string {
  try {
    return storage.getItem(COMPARISON_STORAGE_KEY) ?? ""
  } catch {
    return COMPARISON_SNAPSHOT_ERROR
  }
}

export function comparisonsFromSnapshot(raw: string): SavedComparison[] {
  if (!raw || raw === COMPARISON_SNAPSHOT_ERROR) return []
  return readComparisons({
    getItem: () => raw,
  })
}

export function readComparisons(storage: Pick<Storage, "getItem">): SavedComparison[] {
  const raw = storage.getItem(COMPARISON_STORAGE_KEY)
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== "object") return []
  const record = parsed as { version?: unknown; items?: unknown }
  if (record.version !== 1 || !Array.isArray(record.items)) return []
  return record.items.flatMap((item) => {
    const saved = parseSaved(item)
    return saved ? [saved] : []
  })
}

export function writeComparisons(storage: Pick<Storage, "setItem">, items: SavedComparison[]): void {
  const payload = {
    version: 1 as const,
    items: items.map(stripSaved),
  }
  storage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(payload))
}

export function rememberComparison(
  items: SavedComparison[],
  input: {
    scenario: Scenario
    anchorAmount: number | null
    now?: string
    id?: string
  },
): SavedComparison[] {
  const scenario = scenarioFromRecord(input.scenario)
  if (!scenario) return items
  const anchorAmount = normalizeAnchor(input.anchorAmount)
  const entry: SavedComparison = {
    id: input.id ?? createId(),
    label: comparisonLabel(scenario),
    savedAt: input.now ?? new Date().toISOString(),
    scenario,
    anchorAmount,
  }
  const key = comparisonKey(scenario, anchorAmount)
  const without = items.filter((item) => comparisonKey(item.scenario, item.anchorAmount) !== key)
  return [entry, ...without].slice(0, COMPARISON_LIMIT)
}

export function comparisonKey(scenario: Scenario, anchorAmount: number | null): string {
  return JSON.stringify({
    age: scenario.age,
    yearsLicensed: scenario.yearsLicensed,
    incidents: scenario.incidents,
    mileage: scenario.mileage,
    teen: scenario.teen,
    goodStudent: scenario.goodStudent,
    driverTraining: scenario.driverTraining,
    householdPolicy: scenario.householdPolicy,
    loanLease: scenario.loanLease,
    state: scenario.state,
    region: scenario.region,
    coverage: scenario.coverage,
    deductible: scenario.deductible,
    year: scenario.year,
    make: scenario.make,
    model: scenario.model,
    trim: scenario.trim,
    anchorAmount,
  })
}

function parseSaved(value: unknown): SavedComparison | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== "string" || record.id.length === 0 || record.id.length > 80) return null
  if (typeof record.label !== "string" || record.label.length === 0 || record.label.length > 80) {
    return null
  }
  if (typeof record.savedAt !== "string" || record.savedAt.length === 0 || record.savedAt.length > 40) {
    return null
  }
  const scenario = scenarioFromRecord(record.scenario)
  if (!scenario) return null
  if (record.anchorAmount !== null && normalizeAnchor(record.anchorAmount) === null) return null
  return stripSaved({
    id: record.id,
    label: record.label,
    savedAt: record.savedAt,
    scenario,
    anchorAmount: normalizeAnchor(record.anchorAmount),
  })
}

function stripSaved(item: SavedComparison): SavedComparison {
  return {
    id: item.id,
    label: item.label,
    savedAt: item.savedAt,
    scenario: { ...item.scenario },
    anchorAmount: item.anchorAmount,
  }
}

function sameScenario(left: Scenario, right: Scenario): boolean {
  return comparisonKey(left, null) === comparisonKey(right, null)
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `saved-${Date.now().toString(36)}`
}
