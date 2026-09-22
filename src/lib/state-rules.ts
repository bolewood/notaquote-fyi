/**
 * State minimum rules: the least car insurance each state (and DC) asks a
 * driver to carry. The data lives in data/state-rules/state-rules.json so a
 * contributor can fix a row without touching code. Every figure has a source
 * link and the date it was checked. A figure we could not confirm stays null,
 * and the row's note says what is missing.
 *
 * These are minimums, not advice. They are not a premium figure either.
 */

import rulesFile from "../../data/state-rules/state-rules.json"

/** The policy must include the coverage unless you delete it in writing. */
export const REQUIRED_UNLESS_WRITTEN_DELETION = "required-unless-written-deletion" as const

/** The policy must include the coverage unless you reject it in writing. */
export const REQUIRED_UNLESS_WRITTEN_REJECTION = "required-unless-written-rejection" as const

/**
 * The policy must include the coverage unless you reject it. The statute
 * doesn't say the first rejection has to be in writing (insurers usually ask
 * for a signed form anyway).
 */
export const REQUIRED_UNLESS_REJECTED = "required-unless-rejected" as const

/**
 * What a minimum policy in the state must include.
 * true: you must carry it. false: you don't have to (an insurer may still
 * have to offer it). The three string values: it comes with the policy unless
 * you turn it down. null: we couldn't confirm it from a primary source yet.
 */
export type RequirementFlag =
  | boolean
  | typeof REQUIRED_UNLESS_WRITTEN_DELETION
  | typeof REQUIRED_UNLESS_WRITTEN_REJECTION
  | typeof REQUIRED_UNLESS_REJECTED
  | null

function isIncludedUnlessDeclined(value: RequirementFlag): boolean {
  return (
    value === REQUIRED_UNLESS_WRITTEN_DELETION ||
    value === REQUIRED_UNLESS_WRITTEN_REJECTION ||
    value === REQUIRED_UNLESS_REJECTED
  )
}

export const CREDIT_BUCKET = "unreviewed" as const

export const CREDIT_FACTOR = 1

export type CreditBucket = typeof CREDIT_BUCKET

export type StateRuleSource = {
  label: string
  url: string
}

export type StateRule = {
  state: string
  /** false only where most drivers are not required to buy a policy (New Hampshire). */
  insuranceRequired: boolean | null
  biPerPerson: number | null
  biPerAccident: number | null
  pd: number | null
  /** A single combined limit the state accepts instead of split limits, if it names one. */
  combinedSingleLimit: number | null
  pipRequired: RequirementFlag
  pipAmount: string | null
  noFault: boolean | null
  umRequired: RequirementFlag
  uimRequired: RequirementFlag
  medPayRequired: RequirementFlag
  umLimits: string | null
  /** Effective dates and recent or scheduled changes, in plain words. */
  effective: string | null
  /** We don't ask about credit. Kept at 1.00 on every row. */
  creditBucket: CreditBucket
  creditFactor: typeof CREDIT_FACTOR
  /** The best primary source for the liability limits. */
  sourceUrl: string | null
  sources: readonly StateRuleSource[]
  /** Every source URL for the row. Same list as `sources`, kept for older callers. */
  pagesOpened: readonly string[]
  checkedOn: string | null
  /** Same as checkedOn, kept for older callers. */
  lastVerified: string | null
  note: string | null
  /** What we could not confirm from a primary source, if anything. */
  uncertain: string | null
}

type RawRule = Omit<StateRule, "creditBucket" | "creditFactor" | "sourceUrl" | "pagesOpened" | "lastVerified">

type RawFile = {
  version: string
  checkedOn: string
  states: RawRule[]
}

const FLAG_VALUES = new Set<unknown>([
  true,
  false,
  null,
  REQUIRED_UNLESS_WRITTEN_DELETION,
  REQUIRED_UNLESS_WRITTEN_REJECTION,
  REQUIRED_UNLESS_REJECTED,
])

function isFlag(value: unknown): value is RequirementFlag {
  return FLAG_VALUES.has(value)
}

function isDollars(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value > 0)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Throws with a clear message when a contributor's edit breaks the shape. */
export function validateRawRule(raw: RawRule): void {
  const where = `state-rules.json ${raw.state}`
  for (const key of ["biPerPerson", "biPerAccident", "pd", "combinedSingleLimit"] as const) {
    if (!isDollars(raw[key])) throw new Error(`${where}: ${key} must be a positive whole number or null`)
  }
  for (const key of ["pipRequired", "umRequired", "uimRequired", "medPayRequired"] as const) {
    if (!isFlag(raw[key])) throw new Error(`${where}: ${key} is not a known requirement value`)
  }
  if (raw.noFault !== null && typeof raw.noFault !== "boolean") {
    throw new Error(`${where}: noFault must be true, false, or null`)
  }
  if (raw.insuranceRequired !== null && typeof raw.insuranceRequired !== "boolean") {
    throw new Error(`${where}: insuranceRequired must be true, false, or null`)
  }
  if (raw.checkedOn !== null && !isIsoDate(raw.checkedOn)) {
    throw new Error(`${where}: checkedOn must be YYYY-MM-DD`)
  }
  for (const source of raw.sources) {
    if (!source.label || !/^https:\/\//.test(source.url)) {
      throw new Error(`${where}: every source needs a label and an https URL`)
    }
  }
  const hasFigure =
    raw.biPerPerson !== null ||
    raw.biPerAccident !== null ||
    raw.pd !== null ||
    raw.combinedSingleLimit !== null
  if (hasFigure && (raw.sources.length === 0 || raw.checkedOn === null)) {
    throw new Error(`${where}: a dollar figure needs a source and a checkedOn date`)
  }
}

const file = rulesFile as RawFile

export const STATE_RULES_VERSION: string = file.version

/** The date this edition of the table was checked. Rows carry their own checkedOn too. */
export const STATE_RULES_CHECKED_ON: string = file.checkedOn

export const STATE_RULES: readonly StateRule[] = file.states.map((raw) => {
  validateRawRule(raw)
  return {
    ...raw,
    creditBucket: CREDIT_BUCKET,
    creditFactor: CREDIT_FACTOR,
    sourceUrl: raw.sources[0]?.url ?? null,
    pagesOpened: [...new Set(raw.sources.map((source) => source.url))],
    lastVerified: raw.checkedOn,
  }
})

const BY_STATE = new Map(STATE_RULES.map((rule) => [rule.state, rule]))

export function stateRule(state: string): StateRule | undefined {
  return BY_STATE.get(state)
}

/** Rows with at least one source. */
export function sourcedStateRules(): StateRule[] {
  return STATE_RULES.filter((rule) => rule.sourceUrl !== null)
}

/** Rows with no source yet. */
export function unsourcedStateRules(): StateRule[] {
  return STATE_RULES.filter((rule) => rule.sourceUrl === null)
}

/** Rows where all three liability figures (or a combined limit) are confirmed. */
export function fullySourcedStateRules(): StateRule[] {
  return STATE_RULES.filter((rule) => rule.sourceUrl !== null && hasLiabilityFigures(rule))
}

function hasLiabilityFigures(rule: StateRule): boolean {
  return (
    (rule.biPerPerson !== null && rule.biPerAccident !== null && rule.pd !== null) ||
    rule.combinedSingleLimit !== null
  )
}

export function formatVerifiedDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatLiabilityDollars(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

/** "25/50/25" style shorthand, in thousands. Null when a figure is missing. */
export function liabilityShorthand(rule: StateRule): string | null {
  if (rule.biPerPerson === null || rule.biPerAccident === null || rule.pd === null) return null
  const k = (amount: number) => String(Math.round(amount / 1000))
  return `${k(rule.biPerPerson)}/${k(rule.biPerAccident)}/${k(rule.pd)}`
}

export function liabilityCell(rule: StateRule, amount: number | null): string {
  if (rule.sourceUrl === null) return "Not checked yet"
  if (amount === null) return "None set"
  return formatLiabilityDollars(amount)
}

export function flagCell(value: RequirementFlag): string {
  if (value === true) return "Required"
  if (value === false) return "Not required"
  if (value === REQUIRED_UNLESS_WRITTEN_DELETION) return "Included unless you decline in writing"
  if (value === REQUIRED_UNLESS_WRITTEN_REJECTION) return "Included unless you decline in writing"
  if (value === REQUIRED_UNLESS_REJECTED) return "Included unless you decline"
  return "Not confirmed yet"
}

function requirementClause(value: RequirementFlag, name: string): string | null {
  if (value === true) return `You also need ${name}.`
  if (value === REQUIRED_UNLESS_REJECTED) return `Your policy includes ${name} unless you turn it down.`
  if (isIncludedUnlessDeclined(value)) {
    return `Your policy includes ${name} unless you turn it down in writing.`
  }
  return null
}

const NO_PHYSICAL =
  "This doesn't include comprehensive or collision, which pay to fix your own car."

/**
 * One plain sentence or three describing the state minimum, for the
 * calculator's "State minimum" choice.
 */
export function stateMinimumAssumption(state: string): string {
  const rule = stateRule(state)
  if (!rule || rule.sourceUrl === null || rule.checkedOn === null) {
    return `State minimum. We haven't confirmed this state's minimum yet. ${NO_PHYSICAL}`
  }

  const parts: string[] = []
  if (rule.insuranceRequired === false) {
    parts.push("Most drivers here aren't required to buy insurance.")
  }

  if (rule.biPerPerson !== null && rule.biPerAccident !== null && rule.pd !== null) {
    parts.push(
      `${formatLiabilityDollars(rule.biPerPerson)} per person and ${formatLiabilityDollars(rule.biPerAccident)} per accident for injuries you cause, plus ${formatLiabilityDollars(rule.pd)} for property damage.`,
    )
  } else if (rule.combinedSingleLimit !== null) {
    parts.push(
      `${formatLiabilityDollars(rule.combinedSingleLimit)} of liability coverage for injuries and property damage combined.`,
    )
  } else {
    const named: string[] = []
    if (rule.biPerPerson !== null) {
      named.push(`${formatLiabilityDollars(rule.biPerPerson)} per person for injuries you cause`)
    }
    if (rule.biPerAccident !== null) {
      named.push(`${formatLiabilityDollars(rule.biPerAccident)} per accident for injuries`)
    }
    if (rule.pd !== null) {
      named.push(`${formatLiabilityDollars(rule.pd)} for property damage`)
    }
    if (named.length === 0) {
      parts.push("We haven't confirmed a dollar minimum for this state yet.")
    } else {
      parts.push(`${named.join(", ")}.`)
      if (rule.biPerPerson === null || rule.biPerAccident === null) {
        parts.push("There's no general injury-liability minimum here.")
      }
    }
  }

  const sameMotoristRule = rule.umRequired === rule.uimRequired
  for (const clause of [
    requirementClause(rule.pipRequired, "personal injury protection (PIP)"),
    requirementClause(rule.medPayRequired, "medical payments coverage"),
    sameMotoristRule
      ? requirementClause(rule.umRequired, "uninsured and underinsured motorist coverage")
      : requirementClause(rule.umRequired, "uninsured motorist coverage"),
    sameMotoristRule ? null : requirementClause(rule.uimRequired, "underinsured motorist coverage"),
  ]) {
    if (clause) parts.push(clause)
  }

  parts.push(`Checked ${formatVerifiedDate(rule.checkedOn)}.`)
  parts.push(NO_PHYSICAL)
  return `State minimum: ${parts.join(" ")}`
}
