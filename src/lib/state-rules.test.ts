import assert from "node:assert/strict"
import test from "node:test"
import { DISCLAIMER, STATE_MINIMUM_COUNSEL_LABEL, STATE_MINIMUM_COUNSEL_NOTICE } from "./copy"
import { coverageAssumption, MOLLY, STATES } from "./scenario"
import {
  CREDIT_BUCKET,
  CREDIT_FACTOR,
  REQUIRED_UNLESS_WRITTEN_DELETION,
  REQUIRED_UNLESS_WRITTEN_REJECTION,
  STATE_RULES,
  STATE_RULES_CHECKED_ON,
  STATE_RULES_VERSION,
  flagCell,
  sourcedStateRules,
  stateMinimumAssumption,
  stateRule,
  unsourcedStateRules,
} from "./state-rules"

const VERBATIM_DISCLAIMER =
  "THIS IS NOT A QUOTE. NotAQuote.FYI is an independent educational estimate tool, not an insurance company, agency, broker, producer, or lead-generation service. Actual premiums are set by licensed insurers after underwriting and may vary materially."

test("the state_rules table covers 50 states and DC", () => {
  assert.equal(STATE_RULES.length, 51)
  assert.deepEqual(
    STATE_RULES.map((rule) => rule.state),
    STATES.map((state) => state.code),
  )
  assert.equal(new Set(STATE_RULES.map((rule) => rule.state)).size, 51)
})

test("every row locks credit as unreviewed at 1.00 and leaves the reviewer unsigned", () => {
  for (const rule of STATE_RULES) {
    assert.equal(rule.creditBucket, CREDIT_BUCKET)
    assert.equal(rule.creditBucket, "unreviewed")
    assert.equal(rule.creditFactor, CREDIT_FACTOR)
    assert.equal(rule.creditFactor, 1)
    assert.equal(rule.reviewer, null)
  }
})

test("a row without a source URL has no dollar minimum", () => {
  const blank = unsourcedStateRules()
  assert.equal(blank.length, 45)
  assert.equal(sourcedStateRules().length, 6)
  for (const rule of blank) {
    assert.equal(rule.sourceUrl, null)
    assert.equal(rule.biPerPerson, null)
    assert.equal(rule.biPerAccident, null)
    assert.equal(rule.pd, null)
    assert.equal(rule.pipRequired, null)
    assert.equal(rule.noFault, null)
    assert.equal(rule.umRequired, null)
    assert.equal(rule.uimRequired, null)
    assert.equal(rule.lastVerified, null)
    assert.deepEqual(rule.pagesOpened, [])
    const text = stateMinimumAssumption(rule.state)
    assert.match(text, /The sourced table has no figure yet/)
    assert.equal(text.includes("$"), false)
    assert.equal(text.includes("Required"), false)
  }
})

test("a dollar figure exists only on a row with a source URL", () => {
  for (const rule of STATE_RULES) {
    const hasMoney =
      rule.biPerPerson !== null || rule.biPerAccident !== null || rule.pd !== null
    if (hasMoney) assert.ok(rule.sourceUrl)
    if (rule.sourceUrl) {
      assert.equal(rule.lastVerified, STATE_RULES_CHECKED_ON)
      assert.ok(rule.pagesOpened.includes(rule.sourceUrl))
      assert.ok(rule.note)
    }
  }
})

test("launch rows record the pages opened on 21 September 2026", () => {
  const illinois = stateRule("IL")
  const california = stateRule("CA")
  const florida = stateRule("FL")
  const texas = stateRule("TX")
  const newYork = stateRule("NY")
  const pennsylvania = stateRule("PA")
  assert.ok(illinois && california && florida && texas && newYork && pennsylvania)

  assert.equal(illinois.biPerPerson, 25000)
  assert.equal(illinois.biPerAccident, 50000)
  assert.equal(illinois.pd, 20000)
  assert.equal(illinois.umRequired, true)
  assert.equal(illinois.pipRequired, null)
  assert.equal(
    illinois.sourceUrl,
    "https://www.ilga.gov/Documents/legislation/ilcs/documents/062500050K7-203.htm",
  )

  assert.equal(california.biPerPerson, 30000)
  assert.equal(california.biPerAccident, 60000)
  assert.equal(california.pd, 15000)
  assert.notEqual(california.umRequired, false)
  assert.notEqual(california.uimRequired, false)
  assert.equal(california.umRequired, REQUIRED_UNLESS_WRITTEN_DELETION)
  assert.equal(california.uimRequired, REQUIRED_UNLESS_WRITTEN_DELETION)
  assert.equal(flagCell(california.umRequired), "Required unless deleted in writing")
  assert.equal(flagCell(california.uimRequired), "Required unless deleted in writing")
  assert.equal(
    california.sourceUrl,
    "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=16056.",
  )

  assert.equal(florida.biPerPerson, null)
  assert.equal(florida.biPerAccident, null)
  assert.equal(florida.pd, 10000)
  assert.equal(florida.pipRequired, true)
  assert.equal(florida.noFault, true)
  assert.equal(florida.umRequired, null)

  assert.equal(texas.biPerPerson, 30000)
  assert.equal(texas.biPerAccident, 60000)
  assert.equal(texas.pd, 25000)
  assert.notEqual(texas.umRequired, false)
  assert.notEqual(texas.uimRequired, false)
  assert.notEqual(texas.pipRequired, false)
  assert.equal(texas.umRequired, REQUIRED_UNLESS_WRITTEN_REJECTION)
  assert.equal(texas.uimRequired, REQUIRED_UNLESS_WRITTEN_REJECTION)
  assert.equal(texas.pipRequired, REQUIRED_UNLESS_WRITTEN_REJECTION)
  assert.equal(flagCell(texas.umRequired), "Required unless rejected in writing")

  assert.equal(newYork.biPerPerson, 25000)
  assert.equal(newYork.biPerAccident, 50000)
  assert.equal(newYork.pd, 10000)
  assert.equal(newYork.umRequired, true)
  assert.equal(newYork.uimRequired, false)
  assert.equal(newYork.pipRequired, true)

  assert.equal(pennsylvania.biPerPerson, 15000)
  assert.equal(pennsylvania.biPerAccident, 30000)
  assert.equal(pennsylvania.pd, 5000)
  assert.equal(pennsylvania.pipRequired, true)
  assert.equal(pennsylvania.umRequired, false)
  assert.equal(pennsylvania.uimRequired, false)

  assert.equal(STATE_RULES_VERSION, "state-rules-2026-09-21")
})

test("the state-minimum line shows sourced dollars and hides a blank row", () => {
  const illinois = stateMinimumAssumption("IL")
  assert.match(illinois, /\$25,000 bodily injury per person/)
  assert.match(illinois, /\$50,000 bodily injury per accident/)
  assert.match(illinois, /\$20,000 property damage/)
  assert.match(illinois, /Required uninsured motorist coverage/)
  assert.equal(illinois.includes("Required personal injury protection"), false)
  assert.match(illinois, /This is not coverage advice/)

  const florida = stateMinimumAssumption("FL")
  assert.match(florida, /\$10,000 property damage/)
  assert.match(florida, /The sourced table has no bodily-injury figure/)
  assert.match(florida, /Required personal injury protection/)
  assert.equal(florida.includes("$25,000"), false)
  assert.equal(florida.includes("$30,000"), false)
  assert.equal(florida.includes("Required uninsured"), false)

  const ohio = stateMinimumAssumption("OH")
  assert.match(ohio, /The sourced table has no figure yet/)
  assert.equal(ohio.includes("$"), false)

  const california = stateMinimumAssumption("CA")
  assert.equal(
    california,
    "State minimum. Assumption: $30,000 bodily injury per person, $60,000 bodily injury per accident, $15,000 property damage. Uninsured motorist coverage is required unless a named insured deletes it in writing. Underinsured motorist coverage is required unless a named insured deletes it in writing. Checked 21 September 2026. No comprehensive or collision. This is not coverage advice.",
  )

  const texas = stateMinimumAssumption("TX")
  assert.equal(
    texas,
    "State minimum. Assumption: $30,000 bodily injury per person, $60,000 bodily injury per accident, $25,000 property damage. Personal injury protection is required unless a named insured rejects it in writing. Uninsured motorist coverage is required unless a named insured rejects it in writing. Underinsured motorist coverage is required unless a named insured rejects it in writing. Checked 21 September 2026. No comprehensive or collision. This is not coverage advice.",
  )
  assert.equal(texas.includes("$2,500"), false)

  assert.equal(stateRule("OH")?.sourceUrl, null)
  assert.equal(STATE_MINIMUM_COUNSEL_LABEL, "For counsel, not a legal conclusion.")
  assert.match(STATE_MINIMUM_COUNSEL_NOTICE, /not a suggestion to buy only that amount/)
  assert.equal(DISCLAIMER, VERBATIM_DISCLAIMER)

  assert.equal(
    coverageAssumption("standard", MOLLY.state),
    "Standard liability. Assumption: 100/300/100. No comprehensive or collision.",
  )
  assert.equal(
    coverageAssumption("full", MOLLY.state),
    "Full coverage. Assumption: 100/300/100, plus comprehensive and collision.",
  )
  assert.equal(
    coverageAssumption("high", MOLLY.state),
    "High limits. Assumption: 250/500/250, plus comprehensive and collision.",
  )
})
