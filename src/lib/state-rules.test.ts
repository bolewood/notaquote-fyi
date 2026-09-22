import assert from "node:assert/strict"
import test from "node:test"
import rulesFile from "../../data/state-rules/state-rules.json"
import evidenceFile from "../../data/state-rules/evidence.json"
import { STATES } from "./scenario"
import {
  CREDIT_BUCKET,
  CREDIT_FACTOR,
  NO_FAULT_CHOICE,
  REQUIRED_UNLESS_REJECTED,
  REQUIRED_UNLESS_WRITTEN_DELETION,
  REQUIRED_UNLESS_WRITTEN_REJECTION,
  STATE_RULES,
  STATE_RULES_CHECKED_ON,
  STATE_RULES_VERSION,
  flagCell,
  isIsoDate,
  liabilityCell,
  liabilityShorthand,
  noFaultCell,
  noFaultDefaultText,
  overdueChanges,
  sourcedStateRules,
  stateMinimumAssumption,
  stateRule,
  todayIso,
  upcomingChanges,
  validateRawRule,
  validateRulesFile,
  type RawRule,
} from "./state-rules"

type RulesFile = Parameters<typeof validateRulesFile>[0]
const cloneFile = (): RulesFile => JSON.parse(JSON.stringify(rulesFile)) as RulesFile
const firstRow = (): RawRule => cloneFile().states[0]

// ---------------------------------------------------------------------------
// Shape checks. These hold for any correct edit of the data, so a contributor
// can fix a row, blank an uncertain figure, or re-check a source without
// touching this file.
// ---------------------------------------------------------------------------

test("the table covers 50 states and DC in the calculator's order", () => {
  assert.equal(STATE_RULES.length, 51)
  assert.deepEqual(
    STATE_RULES.map((rule) => rule.state),
    STATES.map((state) => state.code),
  )
  assert.equal(new Set(STATE_RULES.map((rule) => rule.state)).size, 51)
})

test("the version and dates line up", () => {
  assert.match(STATE_RULES_VERSION, /^state-rules-\d{4}-\d{2}-\d{2}$/)
  assert.equal(STATE_RULES_VERSION, `state-rules-${STATE_RULES_CHECKED_ON}`)
  assert.ok(isIsoDate(STATE_RULES_CHECKED_ON))
  const dates = STATE_RULES.flatMap((rule) => (rule.checkedOn ? [rule.checkedOn] : []))
  for (const date of dates) {
    assert.ok(isIsoDate(date), date)
    assert.ok(date <= STATE_RULES_CHECKED_ON, `${date} is after ${STATE_RULES_CHECKED_ON}`)
  }
  assert.equal([...dates].sort().at(-1), STATE_RULES_CHECKED_ON, "the file date is the newest row date")
})

test("every sourced row has https sources, a check date, and a note", () => {
  for (const rule of sourcedStateRules()) {
    assert.equal(rule.sourceUrl, rule.sources[0].url)
    for (const source of rule.sources) {
      assert.match(source.url, /^https:\/\//, `${rule.state} ${source.url}`)
      assert.ok(source.label.length > 0)
    }
    assert.ok(rule.pagesOpened.includes(rule.sourceUrl ?? ""))
    assert.ok(rule.checkedOn, rule.state)
    assert.equal(rule.lastVerified, rule.checkedOn)
    assert.ok(rule.note && rule.note.length > 40, rule.state)
  }
})

test("a dollar figure only appears on a sourced row, and the figures make sense", () => {
  for (const rule of STATE_RULES) {
    const amounts = [rule.biPerPerson, rule.biPerAccident, rule.pd, rule.combinedSingleLimit]
    if (amounts.some((amount) => amount !== null)) assert.ok(rule.sourceUrl, rule.state)
    for (const amount of amounts) {
      if (amount !== null) assert.ok(Number.isInteger(amount) && amount > 0, rule.state)
    }
    if (rule.biPerPerson !== null && rule.biPerAccident !== null) {
      assert.ok(rule.biPerAccident >= rule.biPerPerson, rule.state)
    }
  }
})

test("no-fault defaults are only recorded for choice states", () => {
  for (const rule of STATE_RULES) {
    if (rule.noFault !== NO_FAULT_CHOICE) assert.equal(rule.noFaultDefault, null, rule.state)
  }
})

test("credit stays out of it on every row", () => {
  for (const rule of STATE_RULES) {
    assert.equal(rule.creditBucket, CREDIT_BUCKET)
    assert.equal(rule.creditFactor, CREDIT_FACTOR)
  }
})

test("notes are plain words for visitors", () => {
  for (const rule of STATE_RULES) {
    const note = rule.note ?? ""
    assert.equal(/for counsel|legal conclusion|reviewer|assumption/i.test(note), false, rule.state)
  }
})

test("the evidence file matches the table", () => {
  assert.equal(evidenceFile.version, STATE_RULES_VERSION)
  const states = evidenceFile.states as Record<string, { url: string; quote: string | null }[]>
  for (const rule of sourcedStateRules()) {
    const rows = states[rule.state]
    assert.ok(rows, `${rule.state} has evidence`)
    assert.deepEqual(
      rows.map((row) => row.url),
      rule.sources.map((source) => source.url),
      `${rule.state} evidence lists the same sources in the same order`,
    )
    assert.ok(rows.some((row) => row.url === rule.sourceUrl && row.quote), rule.state)
  }
})

// ---------------------------------------------------------------------------
// Date tripwire. A scheduled change is a law that has passed but isn't in
// effect yet. Once its date arrives, this test fails until someone updates the
// row's figures and removes the entry (see data/state-rules/README.md).
// ---------------------------------------------------------------------------

test("no scheduled change has taken effect without the row being updated", () => {
  const overdue = overdueChanges(todayIso())
  assert.deepEqual(
    overdue.map(({ state, change }) => `${state} ${change.from}`),
    [],
    "A scheduled change has taken effect. Update the row's figures, effective text, and checkedOn, then remove the entry from scheduledChanges.",
  )
})

test("the tripwire fires on the right day", () => {
  const dc = stateRule("DC")
  assert.ok(dc)
  for (const change of dc.scheduledChanges) {
    assert.equal(overdueChanges(change.from).some((row) => row.state === "DC" && row.change === change), true)
    const dayBefore = new Date(`${change.from}T00:00:00Z`)
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1)
    assert.equal(overdueChanges(todayIso(dayBefore)).some((row) => row.change === change), false)
    assert.deepEqual(upcomingChanges(dc, todayIso(dayBefore)), [change])
  }
})

// ---------------------------------------------------------------------------
// Validation: a broken edit fails with a message that says what to fix.
// ---------------------------------------------------------------------------

test("a broken row fails loudly", () => {
  const good = firstRow()
  assert.doesNotThrow(() => validateRawRule(good))
  assert.throws(() => validateRawRule({ ...good, pd: -5 }), /"pd" must be a positive whole number/)
  assert.throws(() => validateRawRule({ ...good, umRequired: "maybe" as never }), /"umRequired" must be/)
  assert.throws(() => validateRawRule({ ...good, noFault: "sometimes" as never }), /"noFault" must be/)
  assert.throws(() => validateRawRule({ ...good, noFaultDefault: true }), /only for rows where "noFault" is "choice"/)
  assert.throws(() => validateRawRule({ ...good, sources: [] }), /needs at least one source/)
  assert.throws(() => validateRawRule({ ...good, checkedOn: "2026-02-30" }), /real date/)
  assert.throws(
    () => validateRawRule({ ...good, sources: [{ label: "x", url: "http://example.com" }] }),
    /source 1 needs an https "url"/,
  )
  const { medPayRequired: _dropped, ...withoutMedPay } = good
  void _dropped
  assert.throws(() => validateRawRule(withoutMedPay as RawRule), /missing field "medPayRequired"/)
})

test("blanking an uncertain figure is a valid edit", () => {
  const data = cloneFile()
  const row = data.states.find((state) => state.state === "AR")
  assert.ok(row)
  row.biPerPerson = null
  row.umRequired = null
  row.uncertain = "Blanked while we re-check the statute."
  assert.doesNotThrow(() => validateRulesFile(data))
})

test("file dates must stay in step", () => {
  const later = cloneFile()
  later.states[0].checkedOn = "2099-01-01"
  assert.throws(() => validateRulesFile(later), /is after the file's "checkedOn"/)

  const stale = cloneFile()
  stale.checkedOn = "2099-01-01"
  stale.version = "state-rules-2099-01-01"
  assert.throws(() => validateRulesFile(stale), /newest row was checked/)

  const badVersion = cloneFile()
  badVersion.version = "state-rules-2000-01-01"
  assert.throws(() => validateRulesFile(badVersion), /"version" must be/)

  const twice = cloneFile()
  twice.states.push(twice.states[0])
  assert.throws(() => validateRulesFile(twice), /appears more than once/)
})

// ---------------------------------------------------------------------------
// Words on the page.
// ---------------------------------------------------------------------------

test("table cells read in plain words", () => {
  assert.equal(flagCell(true), "Required")
  assert.equal(flagCell(false), "Not required")
  assert.equal(flagCell(REQUIRED_UNLESS_WRITTEN_REJECTION), "Included unless you decline in writing")
  assert.equal(flagCell(REQUIRED_UNLESS_WRITTEN_DELETION), "Included unless you decline in writing")
  assert.equal(flagCell(REQUIRED_UNLESS_REJECTED), "Included unless you decline")
  assert.equal(flagCell(null), "Not confirmed yet")

  assert.equal(noFaultCell(true), "Yes")
  assert.equal(noFaultCell(false), "No")
  assert.equal(noFaultCell(NO_FAULT_CHOICE), "Your choice")
  assert.equal(noFaultCell(null), "Not confirmed yet")
  for (const rule of STATE_RULES) {
    assert.notEqual(noFaultCell(rule.noFault), "Required", rule.state)
  }

  assert.equal(noFaultDefaultText({ noFault: true, noFaultDefault: null }), null)
  assert.match(noFaultDefaultText({ noFault: NO_FAULT_CHOICE, noFaultDefault: true }) ?? "", /no-fault rules apply/)
  assert.match(noFaultDefaultText({ noFault: NO_FAULT_CHOICE, noFaultDefault: null }) ?? "", /haven't confirmed/)
})

test("the state-minimum line never skips an unconfirmed coverage", () => {
  for (const rule of STATE_RULES) {
    const text = stateMinimumAssumption(rule.state)
    assert.match(text, /^State minimum/)
    if (rule.umRequired === null) assert.match(text, /haven't confirmed whether uninsured/, rule.state)
    if (rule.uimRequired === null) assert.match(text, /haven't confirmed whether (uninsured and )?underinsured/, rule.state)
    if (rule.insuranceRequired === false) {
      assert.match(text, /aren't required to buy insurance/)
      assert.match(text, /If you buy a policy, it must include/)
      assert.equal(text.includes("You also need"), false, "an optional policy never says 'you need'")
    }
  }
  assert.match(stateMinimumAssumption("ZZ"), /haven't confirmed/)
  assert.equal(stateMinimumAssumption("ZZ").includes("$"), false)
})

// ---------------------------------------------------------------------------
// PINNED SPOT CHECKS. These pin rows that were verified against the statute
// text on the date shown. If you change one of these rows on purpose (the law
// changed, or we got it wrong), update the value here too and say why in your
// pull request. Don't pin rows with open questions in their `uncertain` field.
// ---------------------------------------------------------------------------

test("pinned: liability minimums for well-verified rows", () => {
  const pinned: Record<string, string> = {
    CA: "30/60/15",
    TX: "30/60/25",
    NY: "25/50/10",
    PA: "15/30/5",
    IL: "25/50/20",
    HI: "40/80/20",
    NC: "50/100/50",
    VA: "50/100/25",
    UT: "30/65/25",
    NJ: "35/70/25",
    MA: "25/50/30",
  }
  for (const [state, shorthand] of Object.entries(pinned)) {
    assert.equal(liabilityShorthand(stateRule(state)!), shorthand, state)
  }
  assert.equal(stateRule("UT")?.combinedSingleLimit, 90000)
})

test("pinned: special cases", () => {
  const ca = stateRule("CA")!
  assert.equal(ca.umRequired, REQUIRED_UNLESS_WRITTEN_DELETION)
  assert.equal(ca.scheduledChanges[0]?.from, "2035-01-01")
  assert.equal(liabilityShorthand(ca.scheduledChanges[0]!), "50/100/25")

  const tx = stateRule("TX")!
  assert.equal(tx.pipRequired, REQUIRED_UNLESS_WRITTEN_REJECTION)

  const fl = stateRule("FL")!
  assert.equal(fl.biPerPerson, null)
  assert.equal(fl.pd, 10000)
  assert.equal(fl.pipRequired, true)
  assert.equal(fl.noFault, true)
  assert.equal(fl.umRequired, false)
  assert.equal(liabilityCell(fl, fl.biPerPerson), "None set")
  assert.equal(liabilityCell(fl, fl.pd), "$10,000")

  assert.equal(stateRule("NH")?.insuranceRequired, false)
  assert.equal(stateRule("PA")?.noFault, NO_FAULT_CHOICE)
  assert.equal(stateRule("PA")?.noFaultDefault, false)
  assert.equal(stateRule("KY")?.noFaultDefault, true)
  assert.equal(stateRule("DC")?.scheduledChanges[0]?.from, "2027-10-01")
})

test("pinned: the California state-minimum line", () => {
  assert.equal(
    stateMinimumAssumption("CA"),
    "State minimum: $30,000 per person and $60,000 per accident for injuries you cause, plus $15,000 for property damage. Your policy includes uninsured and underinsured motorist coverage unless you turn it down in writing. Checked 22 September 2026. This doesn't include comprehensive or collision, which pay to fix your own car.",
  )
  const nh = stateMinimumAssumption("NH")
  assert.match(nh, /If you buy a policy, it must include \$25,000 per person/)
  assert.match(nh, /It must also include medical payments coverage\./)
  const fl = stateMinimumAssumption("FL")
  assert.match(fl, /no general injury-liability minimum/)
  assert.match(fl, /You also need personal injury protection/)
})
