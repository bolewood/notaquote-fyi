/**
 * State minimum rules: the least car insurance each state (and DC) asks a
 * driver to carry. The data lives in data/state-rules/state-rules.json so a
 * contributor can fix a row without touching code. Every figure has a source
 * link and the date it was checked. A figure we could not confirm stays null,
 * and the row's `uncertain` field says what is missing.
 *
 * These are minimums, not advice. They are not a premium figure either.
 * How the table was built: data/state-rules/README.md.
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

/** You pick no-fault or ordinary fault rules. The row's noFaultDefault says what you get if you don't pick. */
export const NO_FAULT_CHOICE = "choice" as const

/** true: no-fault. false: ordinary fault rules. "choice": you pick. null: not confirmed. */
export type NoFaultValue = boolean | typeof NO_FAULT_CHOICE | null

export const CREDIT_BUCKET = "unreviewed" as const

export const CREDIT_FACTOR = 1

export type CreditBucket = typeof CREDIT_BUCKET

export type StateRuleSource = {
  label: string
  url: string
}

/** A change in the law that takes effect on a future date. */
export type ScheduledChange = {
  /** YYYY-MM-DD. Usually "policies issued or renewed on or after" this date. */
  from: string
  biPerPerson: number | null
  biPerAccident: number | null
  pd: number | null
  summary: string
  sourceUrl: string
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
  noFault: NoFaultValue
  /** Only for "choice" states: true if no-fault applies when you don't pick, false if fault rules do, null if unconfirmed. */
  noFaultDefault: boolean | null
  umRequired: RequirementFlag
  uimRequired: RequirementFlag
  medPayRequired: RequirementFlag
  umLimits: string | null
  /** Effective dates and recent changes, in plain words. */
  effective: string | null
  /** Future changes already in law. A test fails once one takes effect, as a reminder to update the row. */
  scheduledChanges: readonly ScheduledChange[]
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
  /** One to three plain sentences for visitors. */
  note: string | null
  /** A helpful caveat that isn't a gap in our research (shown as "Good to know"). */
  goodToKnow: string | null
  /** What we could not confirm from a primary source, if anything. */
  uncertain: string | null
}

export type RawRule = Omit<
  StateRule,
  "creditBucket" | "creditFactor" | "sourceUrl" | "pagesOpened" | "lastVerified"
>

type RawFile = {
  version: string
  checkedOn: string
  states: RawRule[]
}

const FLAG_VALUES: readonly unknown[] = [
  true,
  false,
  null,
  REQUIRED_UNLESS_WRITTEN_DELETION,
  REQUIRED_UNLESS_WRITTEN_REJECTION,
  REQUIRED_UNLESS_REJECTED,
]

const DOLLAR_FIELDS = ["biPerPerson", "biPerAccident", "pd", "combinedSingleLimit"] as const
const FLAG_FIELDS = ["pipRequired", "umRequired", "uimRequired", "medPayRequired"] as const
const TEXT_FIELDS = ["pipAmount", "umLimits", "effective", "note", "goodToKnow", "uncertain"] as const
const REQUIRED_FIELDS = [
  "state",
  "insuranceRequired",
  ...DOLLAR_FIELDS,
  ...FLAG_FIELDS,
  "noFault",
  "noFaultDefault",
  ...TEXT_FIELDS,
  "scheduledChanges",
  "sources",
  "checkedOn",
] as const

function isIncludedUnlessDeclined(value: RequirementFlag): boolean {
  return (
    value === REQUIRED_UNLESS_WRITTEN_DELETION ||
    value === REQUIRED_UNLESS_WRITTEN_REJECTION ||
    value === REQUIRED_UNLESS_REJECTED
  )
}

function isDollars(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value > 0)
}

/** A real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function describe(value: unknown): string {
  return value === undefined ? "missing" : JSON.stringify(value)
}

/** Throws with a clear message when a contributor's edit breaks the shape of one row. */
export function validateRawRule(raw: RawRule): void {
  const row = raw as unknown as Record<string, unknown>
  const where = `data/state-rules/state-rules.json, row ${typeof row.state === "string" ? row.state : "(no state code)"}`

  for (const key of REQUIRED_FIELDS) {
    if (!(key in row)) throw new Error(`${where}: missing field "${key}" (use null if it's unknown)`)
  }
  if (typeof raw.state !== "string" || !/^[A-Z]{2}$/.test(raw.state)) {
    throw new Error(`${where}: "state" must be a two-letter code like "OH", got ${describe(row.state)}`)
  }
  for (const key of DOLLAR_FIELDS) {
    if (!isDollars(row[key])) {
      throw new Error(`${where}: "${key}" must be a positive whole number of dollars or null, got ${describe(row[key])}`)
    }
  }
  for (const key of FLAG_FIELDS) {
    if (!FLAG_VALUES.includes(row[key])) {
      throw new Error(
        `${where}: "${key}" must be true, false, null, "${REQUIRED_UNLESS_WRITTEN_REJECTION}", "${REQUIRED_UNLESS_WRITTEN_DELETION}", or "${REQUIRED_UNLESS_REJECTED}", got ${describe(row[key])}`,
      )
    }
  }
  for (const key of TEXT_FIELDS) {
    if (row[key] !== null && typeof row[key] !== "string") {
      throw new Error(`${where}: "${key}" must be text or null, got ${describe(row[key])}`)
    }
  }
  if (![true, false, null, NO_FAULT_CHOICE].includes(raw.noFault as never)) {
    throw new Error(`${where}: "noFault" must be true, false, "choice", or null, got ${describe(row.noFault)}`)
  }
  if (raw.noFaultDefault !== null && typeof raw.noFaultDefault !== "boolean") {
    throw new Error(`${where}: "noFaultDefault" must be true, false, or null, got ${describe(row.noFaultDefault)}`)
  }
  if (raw.noFault !== NO_FAULT_CHOICE && raw.noFaultDefault !== null) {
    throw new Error(`${where}: "noFaultDefault" is only for rows where "noFault" is "choice". Set it to null.`)
  }
  if (raw.insuranceRequired !== null && typeof raw.insuranceRequired !== "boolean") {
    throw new Error(`${where}: "insuranceRequired" must be true, false, or null, got ${describe(row.insuranceRequired)}`)
  }
  if (raw.checkedOn !== null && !isIsoDate(raw.checkedOn)) {
    throw new Error(`${where}: "checkedOn" must be a real date written YYYY-MM-DD, got ${describe(row.checkedOn)}`)
  }
  if (!Array.isArray(raw.sources)) throw new Error(`${where}: "sources" must be a list`)
  raw.sources.forEach((source, index) => {
    if (!source || typeof source.label !== "string" || source.label.length === 0) {
      throw new Error(`${where}: source ${index + 1} needs a "label"`)
    }
    if (typeof source.url !== "string" || !/^https:\/\//.test(source.url)) {
      throw new Error(`${where}: source ${index + 1} needs an https "url", got ${describe(source.url)}`)
    }
  })
  if (!Array.isArray(raw.scheduledChanges)) throw new Error(`${where}: "scheduledChanges" must be a list (use [] for none)`)
  raw.scheduledChanges.forEach((change, index) => {
    const at = `${where}: scheduled change ${index + 1}`
    if (!isIsoDate(change.from)) throw new Error(`${at}: "from" must be a date written YYYY-MM-DD`)
    for (const key of ["biPerPerson", "biPerAccident", "pd"] as const) {
      if (!isDollars(change[key])) throw new Error(`${at}: "${key}" must be a positive whole number or null`)
    }
    if (!change.summary) throw new Error(`${at}: needs a "summary"`)
    if (typeof change.sourceUrl !== "string" || !/^https:\/\//.test(change.sourceUrl)) {
      throw new Error(`${at}: needs an https "sourceUrl"`)
    }
  })
  const hasFigure = DOLLAR_FIELDS.some((key) => raw[key] !== null)
  if (hasFigure && (raw.sources.length === 0 || raw.checkedOn === null)) {
    throw new Error(`${where}: a dollar figure needs at least one source and a "checkedOn" date`)
  }
}

/** Throws when the file as a whole is inconsistent: bad version, duplicate rows, or dates out of step. */
export function validateRulesFile(data: RawFile): void {
  const where = "data/state-rules/state-rules.json"
  if (!isIsoDate(data.checkedOn)) throw new Error(`${where}: top-level "checkedOn" must be YYYY-MM-DD`)
  if (data.version !== `state-rules-${data.checkedOn}`) {
    throw new Error(`${where}: "version" must be "state-rules-${data.checkedOn}" to match "checkedOn", got ${describe(data.version)}`)
  }
  const seen = new Set<string>()
  let newest: string | null = null
  for (const raw of data.states) {
    validateRawRule(raw)
    if (seen.has(raw.state)) throw new Error(`${where}: ${raw.state} appears more than once`)
    seen.add(raw.state)
    if (raw.checkedOn !== null) {
      if (raw.checkedOn > data.checkedOn) {
        throw new Error(`${where}, row ${raw.state}: "checkedOn" ${raw.checkedOn} is after the file's "checkedOn" ${data.checkedOn}. Bump the file date and version too.`)
      }
      if (newest === null || raw.checkedOn > newest) newest = raw.checkedOn
    }
  }
  if (newest !== null && newest !== data.checkedOn) {
    throw new Error(`${where}: top-level "checkedOn" is ${data.checkedOn}, but the newest row was checked ${newest}. They should match.`)
  }
}

const file = rulesFile as RawFile
validateRulesFile(file)

export const STATE_RULES_VERSION: string = file.version

/** The newest check date across all rows. Rows carry their own checkedOn too. */
export const STATE_RULES_CHECKED_ON: string = file.checkedOn

export const STATE_RULES: readonly StateRule[] = file.states.map((raw) => ({
  ...raw,
  creditBucket: CREDIT_BUCKET,
  creditFactor: CREDIT_FACTOR,
  sourceUrl: raw.sources[0]?.url ?? null,
  pagesOpened: [...new Set(raw.sources.map((source) => source.url))],
  lastVerified: raw.checkedOn,
}))

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
  return STATE_RULES.filter(
    (rule) =>
      rule.sourceUrl !== null &&
      ((rule.biPerPerson !== null && rule.biPerAccident !== null && rule.pd !== null) ||
        rule.combinedSingleLimit !== null),
  )
}

/** Today's date as YYYY-MM-DD in UTC. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Scheduled changes that haven't taken effect yet, soonest first. */
export function upcomingChanges(rule: StateRule, today: string = todayIso()): ScheduledChange[] {
  return rule.scheduledChanges
    .filter((change) => change.from > today)
    .sort((a, b) => a.from.localeCompare(b.from))
}

/** Scheduled changes whose date has arrived. Each one means a row needs updating. */
export function overdueChanges(today: string = todayIso()): { state: string; change: ScheduledChange }[] {
  return STATE_RULES.flatMap((rule) =>
    rule.scheduledChanges
      .filter((change) => change.from <= today)
      .map((change) => ({ state: rule.state, change })),
  )
}

export function formatVerifiedDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
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
export function liabilityShorthand(rule: Pick<StateRule, "biPerPerson" | "biPerAccident" | "pd">): string | null {
  if (rule.biPerPerson === null || rule.biPerAccident === null || rule.pd === null) return null
  const k = (amount: number) => String(Math.round(amount / 1000))
  return `${k(rule.biPerPerson)}/${k(rule.biPerAccident)}/${k(rule.pd)}`
}

export function liabilityCell(rule: StateRule, amount: number | null): string {
  if (rule.sourceUrl === null) return "Not checked yet"
  if (amount === null) return "None set"
  return formatLiabilityDollars(amount)
}

/** Table text for a coverage requirement. */
export function flagCell(value: RequirementFlag): string {
  if (value === true) return "Required"
  if (value === false) return "Not required"
  if (value === REQUIRED_UNLESS_WRITTEN_DELETION || value === REQUIRED_UNLESS_WRITTEN_REJECTION) {
    return "Included unless you decline in writing"
  }
  if (value === REQUIRED_UNLESS_REJECTED) return "Included unless you decline"
  return "Not confirmed yet"
}

/** Table text for the no-fault column. No-fault is a system, not a coverage you buy. */
export function noFaultCell(value: NoFaultValue): string {
  if (value === true) return "Yes"
  if (value === false) return "No"
  if (value === NO_FAULT_CHOICE) return "Your choice"
  return "Not confirmed yet"
}

/** Plain words for what happens in a choice state if you don't pick. */
export function noFaultDefaultText(rule: Pick<StateRule, "noFault" | "noFaultDefault">): string | null {
  if (rule.noFault !== NO_FAULT_CHOICE) return null
  if (rule.noFaultDefault === true) return "If you don't choose, no-fault rules apply."
  if (rule.noFaultDefault === false) return "If you don't choose, ordinary fault rules apply."
  return "We haven't confirmed which rules apply if you don't choose."
}

const NO_PHYSICAL =
  "This doesn't include comprehensive or collision, which pay to fix your own car."

function coverageClause(value: RequirementFlag, name: string, optionalPolicy: boolean): string | null {
  if (value === true) return optionalPolicy ? `It must also include ${name}.` : `You also need ${name}.`
  if (value === REQUIRED_UNLESS_REJECTED) return `Your policy includes ${name} unless you turn it down.`
  if (isIncludedUnlessDeclined(value)) return `Your policy includes ${name} unless you turn it down in writing.`
  if (value === null) return `We haven't confirmed whether ${name} is included.`
  return null
}

function liabilitySentence(rule: StateRule): string {
  if (rule.biPerPerson !== null && rule.biPerAccident !== null && rule.pd !== null) {
    return `${formatLiabilityDollars(rule.biPerPerson)} per person and ${formatLiabilityDollars(rule.biPerAccident)} per accident for injuries you cause, plus ${formatLiabilityDollars(rule.pd)} for property damage.`
  }
  if (rule.combinedSingleLimit !== null) {
    return `${formatLiabilityDollars(rule.combinedSingleLimit)} of liability coverage for injuries and property damage combined.`
  }
  const named: string[] = []
  if (rule.biPerPerson !== null) named.push(`${formatLiabilityDollars(rule.biPerPerson)} per person for injuries you cause`)
  if (rule.biPerAccident !== null) named.push(`${formatLiabilityDollars(rule.biPerAccident)} per accident for injuries`)
  if (rule.pd !== null) named.push(`${formatLiabilityDollars(rule.pd)} for property damage`)
  if (named.length === 0) return "We haven't confirmed a dollar minimum for this state yet."
  const missingInjury = rule.biPerPerson === null || rule.biPerAccident === null
  return `${named.join(", ")}.${missingInjury ? " There's no general injury-liability minimum here." : ""}`
}

/**
 * A few plain sentences describing the state minimum, for the calculator's
 * "State minimum" choice.
 */
export function stateMinimumAssumption(state: string): string {
  const rule = stateRule(state)
  if (!rule || rule.sourceUrl === null || rule.checkedOn === null) {
    return `State minimum. We haven't confirmed this state's minimum yet. ${NO_PHYSICAL}`
  }

  const optionalPolicy = rule.insuranceRequired === false
  const parts: string[] = []
  const liability = liabilitySentence(rule)
  if (optionalPolicy) {
    parts.push("Most drivers here aren't required to buy insurance.")
    parts.push(`If you buy a policy, it must include ${liability}`)
  } else {
    parts.push(liability)
  }

  const sameMotoristRule = rule.umRequired === rule.uimRequired
  for (const clause of [
    coverageClause(rule.pipRequired, "personal injury protection (PIP)", optionalPolicy),
    coverageClause(rule.medPayRequired, "medical payments coverage", optionalPolicy),
    sameMotoristRule
      ? coverageClause(rule.umRequired, "uninsured and underinsured motorist coverage", optionalPolicy)
      : coverageClause(rule.umRequired, "uninsured motorist coverage", optionalPolicy),
    sameMotoristRule
      ? null
      : coverageClause(rule.uimRequired, "underinsured motorist coverage", optionalPolicy),
  ]) {
    if (clause) parts.push(clause)
  }

  if (rule.noFault === NO_FAULT_CHOICE) {
    parts.push(`You choose whether no-fault rules apply. ${noFaultDefaultText(rule)}`)
  }

  parts.push(`Checked ${formatVerifiedDate(rule.checkedOn)}.`)
  parts.push(NO_PHYSICAL)
  return `State minimum: ${parts.join(" ")}`
}
