/**
 * "Your situation now": the driver, place, coverage, and car the visitor
 * starts from, plus what they pay now if they told us. It is kept in this
 * browser's local storage so the What-if and Compare pages share it. It is
 * never sent anywhere.
 */
import { scenarioFromRecord } from "./share-link"
import { DEFAULT_SCENARIO, withTeenFlag, type Scenario } from "./scenario"

export const SITUATION_STORAGE_KEY = "notaquote.situation.v1"
export const SITUATION_EVENT = "notaquote-situation"

export const PREMIUM_MAX = 100_000

export type PremiumPeriod = "year" | "six-months" | "month"

export const PREMIUM_PERIODS: readonly { id: PremiumPeriod; label: string; perYear: number }[] = [
  { id: "year", label: "a year", perYear: 1 },
  { id: "six-months", label: "every 6 months", perYear: 2 },
  { id: "month", label: "a month", perYear: 12 },
]

export type Situation = {
  scenario: Scenario
  /** Price a 16–18-year-old as added to a parent's policy. */
  teenOnParentPolicy: boolean
  /** What they pay now, in whole dollars a year, or null. */
  premium: number | null
}

export const DEFAULT_SITUATION: Situation = {
  scenario: DEFAULT_SCENARIO,
  teenOnParentPolicy: true,
  premium: null,
}

/**
 * Read a premium the visitor typed. Accepts "1800", "$1,800", "1,812.50".
 * Returns whole dollars a year, or null for anything else.
 */
export function parsePremium(raw: string, period: PremiumPeriod = "year"): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, "")
  if (cleaned === "") return null
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const perYear = PREMIUM_PERIODS.find((item) => item.id === period)?.perYear ?? 1
  const annual = Math.round(Number(cleaned) * perYear)
  return normalizePremium(annual)
}

/** Whole dollars from 1 to 100,000, or null. */
export function normalizePremium(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > PREMIUM_MAX) return null
  return numeric
}

export function situationFromRecord(value: unknown): Situation | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const scenario = scenarioFromRecord(record.scenario)
  if (!scenario) return null
  if (typeof record.teenOnParentPolicy !== "boolean") return null
  if (record.premium !== null && normalizePremium(record.premium) === null) return null
  return {
    scenario: withTeenFlag(scenario),
    teenOnParentPolicy: record.teenOnParentPolicy,
    premium: normalizePremium(record.premium),
  }
}

/** Parse the stored snapshot. Anything unreadable gives null (use the default). */
export function situationFromSnapshot(raw: string): Situation | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; situation?: unknown }
    if (parsed?.version !== 1) return null
    return situationFromRecord(parsed.situation)
  } catch {
    return null
  }
}

/** Only the known fields are written: never an estimate. */
export function situationSnapshot(situation: Situation): string {
  const clean = situationFromRecord(situation)
  if (!clean) throw new Error("This situation could not be saved")
  return JSON.stringify({ version: 1, situation: clean })
}

export function readSituation(storage: Pick<Storage, "getItem">): Situation | null {
  try {
    return situationFromSnapshot(storage.getItem(SITUATION_STORAGE_KEY) ?? "")
  } catch {
    return null
  }
}

export function writeSituation(storage: Pick<Storage, "setItem">, situation: Situation): void {
  storage.setItem(SITUATION_STORAGE_KEY, situationSnapshot(situation))
}

/** A premium belongs to one situation. Changing the "now" car or driver keeps it; the visitor decides. */
export function withScenario(situation: Situation, scenario: Scenario): Situation {
  return { ...situation, scenario: withTeenFlag(scenario) }
}
