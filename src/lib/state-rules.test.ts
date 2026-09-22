import assert from "node:assert/strict"
import test from "node:test"
import rulesFile from "../../data/state-rules/state-rules.json"
import evidenceFile from "../../data/state-rules/evidence.json"
import { STATES } from "./scenario"
import {
  CREDIT_BUCKET,
  CREDIT_FACTOR,
  REQUIRED_UNLESS_REJECTED,
  REQUIRED_UNLESS_WRITTEN_DELETION,
  REQUIRED_UNLESS_WRITTEN_REJECTION,
  STATE_RULES,
  STATE_RULES_CHECKED_ON,
  STATE_RULES_VERSION,
  flagCell,
  fullySourcedStateRules,
  liabilityCell,
  liabilityShorthand,
  sourcedStateRules,
  stateMinimumAssumption,
  stateRule,
  unsourcedStateRules,
  validateRawRule,
} from "./state-rules"

test("the table covers 50 states and DC in the calculator's order", () => {
  assert.equal(STATE_RULES.length, 51)
  assert.deepEqual(
    STATE_RULES.map((rule) => rule.state),
    STATES.map((state) => state.code),
  )
  assert.equal(new Set(STATE_RULES.map((rule) => rule.state)).size, 51)
})

test("every row has a source, a check date, and a note", () => {
  assert.equal(sourcedStateRules().length, 51)
  assert.equal(unsourcedStateRules().length, 0)
  for (const rule of STATE_RULES) {
    assert.ok(rule.sources.length > 0, rule.state)
    assert.equal(rule.sourceUrl, rule.sources[0].url)
    for (const source of rule.sources) {
      assert.match(source.url, /^https:\/\//, `${rule.state} ${source.url}`)
      assert.ok(source.label.length > 0)
    }
    assert.ok(rule.pagesOpened.includes(rule.sourceUrl ?? ""))
    assert.equal(rule.checkedOn, STATE_RULES_CHECKED_ON)
    assert.equal(rule.lastVerified, rule.checkedOn)
    assert.ok(rule.note && rule.note.length > 40, rule.state)
  }
})

test("all 51 rows have confirmed liability figures except Florida's injury limits", () => {
  const full = fullySourcedStateRules().map((rule) => rule.state)
  assert.equal(full.length, 50)
  assert.deepEqual(
    STATE_RULES.filter((rule) => !full.includes(rule.state)).map((rule) => rule.state),
    ["FL"],
  )
})

test("dollar figures are positive whole numbers and per-accident is at least per-person", () => {
  for (const rule of STATE_RULES) {
    for (const amount of [rule.biPerPerson, rule.biPerAccident, rule.pd, rule.combinedSingleLimit]) {
      if (amount !== null) assert.ok(Number.isInteger(amount) && amount > 0, rule.state)
    }
    if (rule.biPerPerson !== null && rule.biPerAccident !== null) {
      assert.ok(rule.biPerAccident >= rule.biPerPerson, rule.state)
    }
  }
})

test("credit stays out of it on every row", () => {
  for (const rule of STATE_RULES) {
    assert.equal(rule.creditBucket, CREDIT_BUCKET)
    assert.equal(rule.creditFactor, CREDIT_FACTOR)
    assert.equal(rule.creditFactor, 1)
  }
})

test("notes are plain words for visitors", () => {
  for (const rule of STATE_RULES) {
    const note = rule.note ?? ""
    assert.equal(/for counsel|legal conclusion|reviewer|assumption/i.test(note), false, rule.state)
  }
})

test("the evidence file has a quote for every row and matches the version", () => {
  assert.equal(evidenceFile.version, STATE_RULES_VERSION)
  const states = evidenceFile.states as Record<string, { url: string; quote: string | null }[]>
  for (const rule of STATE_RULES) {
    const rows = states[rule.state]
    assert.ok(rows && rows.length === rule.sources.length, rule.state)
    assert.ok(rows.some((row) => row.url === rule.sourceUrl && row.quote), rule.state)
  }
})

test("a broken row fails loudly", () => {
  const good = rulesFile.states[0] as Parameters<typeof validateRawRule>[0]
  assert.doesNotThrow(() => validateRawRule(good))
  assert.throws(() => validateRawRule({ ...good, pd: -5 }), /pd/)
  assert.throws(() => validateRawRule({ ...good, umRequired: "maybe" as never }), /umRequired/)
  assert.throws(() => validateRawRule({ ...good, sources: [] }), /needs a source/)
  assert.throws(
    () => validateRawRule({ ...good, sources: [{ label: "x", url: "http://example.com" }] }),
    /https/,
  )
})

test("spot rows match the statutes checked on 22 September 2026", () => {
  assert.equal(STATE_RULES_VERSION, "state-rules-2026-09-22")

  const ca = stateRule("CA")
  assert.ok(ca)
  assert.equal(liabilityShorthand(ca), "30/60/15")
  assert.equal(ca.umRequired, REQUIRED_UNLESS_WRITTEN_DELETION)
  assert.equal(ca.uimRequired, REQUIRED_UNLESS_WRITTEN_DELETION)

  const tx = stateRule("TX")
  assert.ok(tx)
  assert.equal(liabilityShorthand(tx), "30/60/25")
  assert.equal(tx.pipRequired, REQUIRED_UNLESS_WRITTEN_REJECTION)
  assert.equal(tx.umRequired, REQUIRED_UNLESS_WRITTEN_REJECTION)

  const fl = stateRule("FL")
  assert.ok(fl)
  assert.equal(fl.biPerPerson, null)
  assert.equal(fl.biPerAccident, null)
  assert.equal(fl.pd, 10000)
  assert.equal(fl.pipRequired, true)
  assert.equal(fl.noFault, true)
  assert.equal(fl.umRequired, false)

  assert.equal(liabilityShorthand(stateRule("NY")!), "25/50/10")
  assert.equal(stateRule("NY")?.umRequired, true)
  assert.equal(liabilityShorthand(stateRule("PA")!), "15/30/5")
  assert.equal(stateRule("PA")?.umRequired, false)
  assert.equal(liabilityShorthand(stateRule("IL")!), "25/50/20")
  assert.equal(liabilityShorthand(stateRule("HI")!), "40/80/20")
  assert.equal(liabilityShorthand(stateRule("NC")!), "50/100/50")
  assert.equal(liabilityShorthand(stateRule("VA")!), "50/100/25")
  assert.equal(liabilityShorthand(stateRule("UT")!), "30/65/25")
  assert.equal(stateRule("UT")?.combinedSingleLimit, 90000)
  assert.equal(liabilityShorthand(stateRule("NJ")!), "35/70/25")
  assert.equal(liabilityShorthand(stateRule("MA")!), "25/50/30")
  assert.equal(stateRule("NH")?.insuranceRequired, false)
  assert.equal(stateRule("AL")?.umRequired, REQUIRED_UNLESS_REJECTED)
  assert.equal(stateRule("TN")?.uimRequired, null)
})

test("table cells read in plain words", () => {
  assert.equal(flagCell(true), "Required")
  assert.equal(flagCell(false), "Not required")
  assert.equal(flagCell(REQUIRED_UNLESS_WRITTEN_REJECTION), "Included unless you decline in writing")
  assert.equal(flagCell(REQUIRED_UNLESS_WRITTEN_DELETION), "Included unless you decline in writing")
  assert.equal(flagCell(REQUIRED_UNLESS_REJECTED), "Included unless you decline")
  assert.equal(flagCell(null), "Not confirmed yet")
  const fl = stateRule("FL")!
  assert.equal(liabilityCell(fl, fl.biPerPerson), "None set")
  assert.equal(liabilityCell(fl, fl.pd), "$10,000")
})

test("the state-minimum line describes the sourced row", () => {
  assert.equal(
    stateMinimumAssumption("CA"),
    "State minimum: $30,000 per person and $60,000 per accident for injuries you cause, plus $15,000 for property damage. Your policy includes uninsured and underinsured motorist coverage unless you turn it down in writing. Checked 22 September 2026. This doesn't include comprehensive or collision, which pay to fix your own car.",
  )

  const texas = stateMinimumAssumption("TX")
  assert.match(texas, /\$30,000 per person/)
  assert.match(texas, /personal injury protection \(PIP\) unless you turn it down in writing/)

  const florida = stateMinimumAssumption("FL")
  assert.match(florida, /\$10,000 for property damage/)
  assert.match(florida, /no general injury-liability minimum/)
  assert.match(florida, /You also need personal injury protection/)
  assert.equal(florida.includes("uninsured"), false)

  const illinois = stateMinimumAssumption("IL")
  assert.match(illinois, /You also need uninsured motorist coverage\./)
  assert.equal(illinois.includes("underinsured"), false)

  assert.match(stateMinimumAssumption("NH"), /aren't required to buy insurance/)
  assert.match(stateMinimumAssumption("ZZ"), /haven't confirmed/)
  assert.equal(stateMinimumAssumption("ZZ").includes("$"), false)
})
