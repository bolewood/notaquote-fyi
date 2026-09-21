/**
 * Versioned state_rules table. Figures appear only when this file cites a
 * statute or insurance-department page opened on lastVerified. A blank source
 * URL means the dollars stay null. This is source research, not a legal
 * conclusion, and it is not a premium baseline.
 */

export const STATE_RULES_VERSION = "state-rules-2026-09-21"

export const STATE_RULES_CHECKED_ON = "2026-09-21"

export const CREDIT_BUCKET = "unreviewed" as const

export const CREDIT_FACTOR = 1

export type CreditBucket = typeof CREDIT_BUCKET

/** The opened page says the policy must include the coverage unless a named insured deletes it in writing. */
export const REQUIRED_UNLESS_WRITTEN_DELETION = "required-unless-written-deletion" as const

/** The opened page says the insurer may not issue the policy unless the coverage is provided, and a written rejection removes it. */
export const REQUIRED_UNLESS_WRITTEN_REJECTION = "required-unless-written-rejection" as const

export type RequirementFlag =
  | boolean
  | typeof REQUIRED_UNLESS_WRITTEN_DELETION
  | typeof REQUIRED_UNLESS_WRITTEN_REJECTION
  | null

export type StateRule = {
  state: string
  biPerPerson: number | null
  biPerAccident: number | null
  pd: number | null
  pipRequired: RequirementFlag
  noFault: boolean | null
  umRequired: RequirementFlag
  uimRequired: RequirementFlag
  creditBucket: CreditBucket
  creditFactor: typeof CREDIT_FACTOR
  sourceUrl: string | null
  pagesOpened: readonly string[]
  lastVerified: string | null
  reviewer: string | null
  note: string | null
}

const CA_STATUTE =
  "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=16056."
const CA_DMV = "https://www.dmv.ca.gov/portal/vehicle-registration/insurance-requirements/"
const CA_UM =
  "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=INS&sectionNum=11580.2"

const TX_LIABILITY = "https://statutes.capitol.texas.gov/Docs/TN/htm/TN.601.htm"
const TX_UM_PIP =
  "https://statutes.capitol.texas.gov/?artSec=1952.101&chapter=IN.1952&code=IN&tab=1"

const FL_PD = "https://www.flsenate.gov/Laws/Statutes/2026/324.022"
const FL_NO_FAULT = "https://www.flsenate.gov/Laws/Statutes/2026/627.730"
const FL_PIP = "https://www.flsenate.gov/Laws/Statutes/2026/627.736"

const NY_DFS = "https://www.dfs.ny.gov/faqs/consumer-auto/how-much-auto-insurance-must-i-carry"

const PA_FAQ = "https://www.pa.gov/agencies/dmv/faqs/motor-vehicle-faqs/insurance-law-faqs"
const PA_CHAPTER = "https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/75/00.017..HTM"

const IL_LIABILITY =
  "https://www.ilga.gov/Documents/legislation/ilcs/documents/062500050K7-203.htm"
const IL_UM = "https://www.ilga.gov/legislation/ilcs/documents/021500050K143a.htm"

type SourcedRule = Pick<
  StateRule,
  | "biPerPerson"
  | "biPerAccident"
  | "pd"
  | "pipRequired"
  | "noFault"
  | "umRequired"
  | "uimRequired"
  | "sourceUrl"
  | "pagesOpened"
  | "note"
>

const SOURCED: Record<string, SourcedRule> = {
  CA: {
    biPerPerson: 30000,
    biPerAccident: 60000,
    pd: 15000,
    pipRequired: null,
    noFault: null,
    umRequired: REQUIRED_UNLESS_WRITTEN_DELETION,
    uimRequired: REQUIRED_UNLESS_WRITTEN_DELETION,
    sourceUrl: CA_STATUTE,
    pagesOpened: [CA_STATUTE, CA_DMV, CA_UM],
    note: "Checked 21 September 2026. Vehicle Code section 16056(a)(2) states $30,000 because of bodily injury to or death of one person, $60,000 because of bodily injury to or death of two or more persons, and $15,000 because of injury to or destruction of property, for a policy or bond issued or renewed on or after January 1, 2025. Paragraph (a)(1) states $15,000, $30,000, and $5,000. Paragraph (d) states a further increase for a policy or bond issued or renewed on or after January 1, 2035. This row uses paragraph (a)(2) only. The California DMV insurance-requirements page states the same $30,000, $60,000, and $15,000 figures and cites Insurance Code section 11580.1(b). Insurance Code section 11580.2 says no bodily-injury liability policy shall be issued or delivered unless it contains uninsured-motorist coverage, and that a named insured may delete that coverage by written agreement. The same page says an uninsured motor vehicle includes an underinsured motor vehicle. This row marks both required unless deleted in writing. It does not add a separate dollar limit for that coverage. The pages opened do not state a required personal-injury-protection amount or a no-fault rule. Credit stays unreviewed. This is source research, not a legal conclusion.",
  },
  TX: {
    biPerPerson: 30000,
    biPerAccident: 60000,
    pd: 25000,
    pipRequired: REQUIRED_UNLESS_WRITTEN_REJECTION,
    noFault: null,
    umRequired: REQUIRED_UNLESS_WRITTEN_REJECTION,
    uimRequired: REQUIRED_UNLESS_WRITTEN_REJECTION,
    sourceUrl: TX_LIABILITY,
    pagesOpened: [TX_LIABILITY, TX_UM_PIP],
    note: "Checked 21 September 2026. Transportation Code section 601.072(a-1) states $30,000 for bodily injury to or death of one person in one collision, $60,000 for two or more persons, and $25,000 for property damage, effective January 1, 2011. Subsection (b) says the coverage may exclude the first $250, $500, and $250. Those amounts are not subtracted here. Insurance Code section 1952.101 says an insurer may not issue an automobile liability policy unless it provides uninsured or underinsured motorist coverage, and that the coverage does not apply if a named insured rejects it in writing. Section 1952.152 says the same for personal injury protection. This row marks those coverages required unless rejected in writing. No no-fault flag was recorded. Credit stays unreviewed. This is source research, not a legal conclusion.",
  },
  FL: {
    biPerPerson: null,
    biPerAccident: null,
    pd: 10000,
    pipRequired: true,
    noFault: true,
    umRequired: null,
    uimRequired: null,
    sourceUrl: FL_PD,
    pagesOpened: [FL_PD, FL_NO_FAULT, FL_PIP],
    note: "Checked 21 September 2026. Section 324.022 states $10,000 because of damage to, or destruction of, property of others in any one crash. It also says that requirement may be met by a policy of at least $30,000 for combined property-damage liability and bodily-injury liability. This row does not treat that combined amount as a bodily-injury minimum, so the bodily-injury fields stay blank. Section 627.730 names sections 627.730 through 627.7405 the Florida Motor Vehicle No-Fault Law. Section 627.736 states required personal injury protection to a limit of $10,000 in medical and disability benefits and $5,000 in death benefits. This check did not open an uninsured-motorist section, so those flags are not recorded. Credit stays unreviewed. This is source research, not a legal conclusion.",
  },
  NY: {
    biPerPerson: 25000,
    biPerAccident: 50000,
    pd: 10000,
    pipRequired: true,
    noFault: true,
    umRequired: true,
    uimRequired: false,
    sourceUrl: NY_DFS,
    pagesOpened: [NY_DFS],
    note: "Checked 21 September 2026. The Department of Financial Services page “How much auto insurance must I carry?” states liability insurance of $25,000 for bodily injury to one person, $50,000 for bodily injury to all persons, and $10,000 for property damage in any one accident. It states mandatory no-fault coverage of $50,000. It says the law requires uninsured motorists coverage for bodily injury, subject to the same minimums. It says supplementary uninsured/underinsured motorists coverage can also be purchased, and that an insurer must offer specified higher limits. This row marks personal injury protection, no-fault, and uninsured motorist coverage required. It does not mark underinsured motorist coverage required. The Vehicle and Traffic Law section 311 page did not load on this check, so the row cites the department page that opened, not a statute text. Credit stays unreviewed. This is source research, not a legal conclusion.",
  },
  PA: {
    biPerPerson: 15000,
    biPerAccident: 30000,
    pd: 5000,
    pipRequired: true,
    noFault: null,
    umRequired: false,
    uimRequired: false,
    sourceUrl: PA_FAQ,
    pagesOpened: [PA_FAQ, PA_CHAPTER],
    note: "Checked 21 September 2026. The PennDOT insurance-law FAQ states $15,000 for injury or death of one person in an accident, $30,000 for injury or death of more than one person, and $5,000 for damage to property of another person. Title 75 section 1702, on the chapter page opened the same day, defines financial responsibility with those same three amounts. Section 1711(a) says an insurer issuing or delivering liability policies shall include a medical benefit in the amount of $5,000. This row marks personal injury protection required. It does not mark a no-fault flag. Section 1731(a) says purchase of uninsured motorist and underinsured motorist coverages is optional. This row does not mark them required. Credit stays unreviewed. This is source research, not a legal conclusion.",
  },
  IL: {
    biPerPerson: 25000,
    biPerAccident: 50000,
    pd: 20000,
    pipRequired: null,
    noFault: null,
    umRequired: true,
    uimRequired: null,
    sourceUrl: IL_LIABILITY,
    pagesOpened: [IL_LIABILITY, IL_UM],
    note: "Checked 21 September 2026. 625 ILCS 5/7-203 states a limit of not less than $25,000 because of bodily injury to or death of any one person in any one motor vehicle crash, $50,000 because of bodily injury to or death of two or more persons, and $20,000 because of injury to or destruction of property. The page says the changes made by the 98th General Assembly apply to policies issued or renewed on or after January 1, 2015, and cites Public Act 102-982, effective July 1, 2023. 215 ILCS 5/143a says a bodily-injury liability policy shall not be renewed, delivered, or issued for delivery unless uninsured-motorist coverage is provided in the limits set forth in section 7-203. This row marks uninsured motorist coverage required. The same section says uninsured-motorist property-damage coverage is made available and that the absence of a premium payment is proof it was not accepted. Underinsured motorist coverage, personal injury protection, and no-fault were not recorded from the pages opened. Credit stays unreviewed. This is source research, not a legal conclusion.",
  },
}

function blankRule(state: string): StateRule {
  return {
    state,
    biPerPerson: null,
    biPerAccident: null,
    pd: null,
    pipRequired: null,
    noFault: null,
    umRequired: null,
    uimRequired: null,
    creditBucket: CREDIT_BUCKET,
    creditFactor: CREDIT_FACTOR,
    sourceUrl: null,
    pagesOpened: [],
    lastVerified: null,
    reviewer: null,
    note: null,
  }
}

const STATE_CODES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const

export const STATE_RULES: readonly StateRule[] = STATE_CODES.map((state) => {
  const sourced = SOURCED[state]
  if (!sourced) return blankRule(state)
  return {
    state,
    ...sourced,
    creditBucket: CREDIT_BUCKET,
    creditFactor: CREDIT_FACTOR,
    lastVerified: STATE_RULES_CHECKED_ON,
    reviewer: null,
  }
})

const BY_STATE = new Map(STATE_RULES.map((rule) => [rule.state, rule]))

export function stateRule(state: string): StateRule | undefined {
  return BY_STATE.get(state)
}

export function sourcedStateRules(): StateRule[] {
  return STATE_RULES.filter((rule) => rule.sourceUrl !== null)
}

export function unsourcedStateRules(): StateRule[] {
  return STATE_RULES.filter((rule) => rule.sourceUrl === null)
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

export function liabilityCell(rule: StateRule, amount: number | null): string {
  if (rule.sourceUrl === null) return "No figure yet"
  if (amount === null) return "No figure in the sourced row"
  return formatLiabilityDollars(amount)
}

export function flagCell(value: RequirementFlag): string {
  if (value === true) return "Required"
  if (value === false) return "Not marked required"
  if (value === REQUIRED_UNLESS_WRITTEN_DELETION) return "Required unless deleted in writing"
  if (value === REQUIRED_UNLESS_WRITTEN_REJECTION) return "Required unless rejected in writing"
  return "Not recorded"
}

function requirementClause(value: RequirementFlag, name: string): string | null {
  if (value === true) return `Required ${name} is included in this assumption.`
  if (value === REQUIRED_UNLESS_WRITTEN_DELETION) {
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} is required unless a named insured deletes it in writing.`
  }
  if (value === REQUIRED_UNLESS_WRITTEN_REJECTION) {
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} is required unless a named insured rejects it in writing.`
  }
  return null
}

const NO_PHYSICAL = "No comprehensive or collision. This is not coverage advice."

export function stateMinimumAssumption(state: string): string {
  const rule = stateRule(state)
  if (!rule || rule.sourceUrl === null || rule.lastVerified === null) {
    return `State minimum. The sourced table has no figure yet. ${NO_PHYSICAL}`
  }

  const parts: string[] = []
  if (
    rule.biPerPerson !== null &&
    rule.biPerAccident !== null &&
    rule.pd !== null
  ) {
    parts.push(
      `Assumption: ${formatLiabilityDollars(rule.biPerPerson)} bodily injury per person, ${formatLiabilityDollars(rule.biPerAccident)} bodily injury per accident, ${formatLiabilityDollars(rule.pd)} property damage.`,
    )
  } else {
    const named: string[] = []
    if (rule.biPerPerson !== null) {
      named.push(`${formatLiabilityDollars(rule.biPerPerson)} bodily injury per person`)
    }
    if (rule.biPerAccident !== null) {
      named.push(`${formatLiabilityDollars(rule.biPerAccident)} bodily injury per accident`)
    }
    if (rule.pd !== null) {
      named.push(`${formatLiabilityDollars(rule.pd)} property damage`)
    }
    if (named.length === 0) {
      parts.push("The sourced table has no figure yet.")
    } else {
      parts.push(`Assumption: ${named.join(", ")}.`)
      if (rule.biPerPerson === null || rule.biPerAccident === null) {
        parts.push("The sourced table has no bodily-injury figure.")
      }
      if (rule.pd === null) {
        parts.push("The sourced table has no property-damage figure.")
      }
    }
  }

  for (const clause of [
    requirementClause(rule.pipRequired, "personal injury protection"),
    rule.noFault ? "The sourced row marks no-fault as required." : null,
    requirementClause(rule.umRequired, "uninsured motorist coverage"),
    requirementClause(rule.uimRequired, "underinsured motorist coverage"),
  ]) {
    if (clause) parts.push(clause)
  }

  parts.push(`Checked ${formatVerifiedDate(rule.lastVerified)}.`)
  parts.push(NO_PHYSICAL)
  return `State minimum. ${parts.join(" ")}`
}
