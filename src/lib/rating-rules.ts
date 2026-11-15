/**
 * What each state lets car insurers use to set a price: credit, gender, age,
 * and a few others. Every entry quotes the law it comes from
 * (data/state-rules/rating-rules.json). A factor that isn't listed for a state
 * hasn't been reviewed yet; that's never read as "allowed."
 *
 * Safe for the browser: plain JSON, no file reads.
 */
import rulesFile from "../../data/state-rules/rating-rules.json"
import { isIsoDate } from "./state-rules"

export const RATING_FACTORS = [
  "credit",
  "gender",
  "age",
  "maritalStatus",
  "educationOccupation",
  "territory",
  "priorInsurance",
] as const

export type RatingFactor = (typeof RATING_FACTORS)[number]

/** The factors shown in the state-by-state table, in reading order. */
export const TABLE_FACTORS: readonly RatingFactor[] = [
  "credit",
  "gender",
  "age",
  "maritalStatus",
  "educationOccupation",
  "priorInsurance",
]

export const RATING_STATUSES = ["banned", "limited", "no-ban-found"] as const

export type RatingStatus = (typeof RATING_STATUSES)[number]

export type RatingRule = {
  status: RatingStatus
  /** One plain sentence for visitors. */
  summary: string
  /** The law it comes from. */
  source: { label: string; url: string }
  /** A short quote from that law, so anyone can check it. */
  quote: string
  /** YYYY-MM-DD. Only for rules that start in the future or started recently. */
  effective?: string
  checkedOn: string
}

type RawFile = {
  version: string
  checkedOn: string
  about: string
  states: Record<string, Partial<Record<string, Omit<RatingRule, "checkedOn"> & { checkedOn?: string }>>>
}

/** Names for each factor, as visitors read them. */
export const FACTOR_NAMES: Record<RatingFactor, string> = {
  credit: "Credit",
  gender: "Gender",
  age: "Age",
  maritalStatus: "Marital status",
  educationOccupation: "Education or job",
  territory: "Where you live",
  priorInsurance: "A gap in insurance",
}

/** Throws with a clear message when the file's shape is wrong. Used on load and in tests. */
export function validateRatingRules(data: RawFile): void {
  const where = "data/state-rules/rating-rules.json"
  if (!isIsoDate(data.checkedOn)) throw new Error(`${where}: "checkedOn" must be YYYY-MM-DD`)
  if (data.version !== `rating-rules-${data.checkedOn}`) {
    throw new Error(`${where}: "version" must be "rating-rules-${data.checkedOn}"`)
  }
  for (const [state, factors] of Object.entries(data.states)) {
    if (!/^[A-Z]{2}$/.test(state)) throw new Error(`${where}: "${state}" isn't a two-letter state code`)
    for (const [factor, rule] of Object.entries(factors)) {
      const at = `${where}, ${state} ${factor}`
      if (!(RATING_FACTORS as readonly string[]).includes(factor)) {
        throw new Error(`${at}: unknown factor. Use one of ${RATING_FACTORS.join(", ")}`)
      }
      if (!rule || !(RATING_STATUSES as readonly string[]).includes(rule.status)) {
        throw new Error(`${at}: "status" must be ${RATING_STATUSES.join(", ")}`)
      }
      if (typeof rule.summary !== "string" || rule.summary.length < 10 || rule.summary.length > 200) {
        throw new Error(`${at}: "summary" must be one plain sentence (10–200 characters)`)
      }
      if (!rule.source || typeof rule.source.label !== "string" || !/^https:\/\//.test(rule.source.url ?? "")) {
        throw new Error(`${at}: needs a "source" with a "label" and an https "url"`)
      }
      if (typeof rule.quote !== "string" || rule.quote.length < 10) {
        throw new Error(`${at}: needs a "quote" from the law`)
      }
      if (rule.effective !== undefined && !isIsoDate(rule.effective)) {
        throw new Error(`${at}: "effective" must be YYYY-MM-DD`)
      }
      if (rule.checkedOn !== undefined && (!isIsoDate(rule.checkedOn) || rule.checkedOn > data.checkedOn)) {
        throw new Error(`${at}: "checkedOn" must be YYYY-MM-DD and not after the file's date`)
      }
    }
  }
}

const file = rulesFile as RawFile
validateRatingRules(file)

export const RATING_RULES_VERSION = file.version
export const RATING_RULES_CHECKED_ON = file.checkedOn

/** The rule for one state and factor, or undefined if it hasn't been reviewed. */
export function ratingRule(state: string, factor: RatingFactor): RatingRule | undefined {
  const rule = file.states[state]?.[factor]
  if (!rule) return undefined
  return { ...rule, checkedOn: rule.checkedOn ?? file.checkedOn }
}

/** True where the state bars insurers from using the factor for car insurance. */
export function isBanned(state: string, factor: RatingFactor): boolean {
  return ratingRule(state, factor)?.status === "banned"
}

/** States with at least one reviewed factor. */
export function reviewedStates(): string[] {
  return Object.keys(file.states).filter((state) => Object.keys(file.states[state] ?? {}).length > 0)
}

/** Short words for a table cell. */
export function statusWords(rule: RatingRule | undefined): string {
  if (!rule) return "Not reviewed yet"
  const words = rule.status === "banned" ? "Not allowed" : rule.status === "limited" ? "Allowed, with limits" : "Allowed"
  return rule.effective ? `${words} (from ${effectiveWords(rule.effective)})` : words
}

/** "Nov. 23, 2026", for a rule's start date. */
export function effectiveWords(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  const months = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
  return `${months[month - 1]} ${day}, ${year}`
}
