import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CreditLine } from "../components/credit-line"
import { HowWeGotThis } from "../components/how-we-got-this"
import { readFileSync } from "node:fs"
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts } from "./catalog-class"
import { priceNow, priceWhatIf } from "./pricing"
import { DEFAULT_SITUATION, type Situation } from "./situation"
import { stateName, type StateCode } from "./scenario"
import sourcesFile from "../../data/factors/sources/sources.json"
import { CREDIT_EFFECT, CREDIT_RULES_HREF, creditLine, TEXAS_SENTENCE } from "./credit-line"
import { FACTOR_BUNDLE } from "./factor-engine"
import { fromSummary, ratingRule, reviewedStates, type RatingRule } from "./rating-rules"
import { visibleText } from "./rendered-text"
import { STATES } from "./scenario"
import { pairedRatios } from "./unasked-factors"

test("credit-effect.json matches the Texas survey CSVs, recomputed with pairedRatios", () => {
  const good = pairedRatios(CREDIT_EFFECT.sourceId, "tx-creditGood", "tx-base")
  const poor = pairedRatios(CREDIT_EFFECT.sourceId, "tx-creditPoor", "tx-base")
  assert.deepEqual(CREDIT_EFFECT.goodCredit, { median: good.median, n: good.n })
  assert.deepEqual(CREDIT_EFFECT.poorCredit, { median: poor.median, n: poor.n })
  const source = sourcesFile.sources.find((item) => item.id === CREDIT_EFFECT.sourceId)
  assert.ok(source, "the source is listed in sources.json")
  assert.equal(CREDIT_EFFECT.checkedOn, source.checkedOn)
})

const TX_LINE = "In Texas's survey, the same driver paid about 19% more with poor credit and 17% less with good credit than with average credit."

test("banned (California): credit won't move the quote, and no Texas figures", () => {
  assert.equal(ratingRule("CA", "credit")?.status, "banned")
  assert.equal(creditLine("CA"), "In California, insurers can't use your credit to set your price, so it won't move your quote.")
})

test("limited (Texas): with limits, then the survey's figures, labeled inline", () => {
  assert.equal(ratingRule("TX", "credit")?.status, "limited")
  assert.equal(fromSummary(ratingRule("TX", "credit")), false)
  assert.equal(TEXAS_SENTENCE, TX_LINE)
  assert.equal(creditLine("TX"), `In Texas, insurers can use your credit (with limits). ${TX_LINE}`)
})

test("summary-based (New Jersey): says so in words, without stacked brackets", () => {
  assert.equal(fromSummary(ratingRule("NJ", "credit")), true)
  assert.equal(creditLine("NJ"), `In New Jersey, insurers can use your credit (with limits), according to a summary of the law. ${TX_LINE}`)
})

const fixture = { summary: "A plain sentence about the rule.", source: { label: "Law", url: "https://example.gov" }, quote: "a quote from the law", checkedOn: "2026-11-15" }

test("no ban found, named: can use, without limits", () => {
  for (const basis of [undefined, "named"] as const) {
    const rule: RatingRule = { ...fixture, status: "no-ban-found", ...(basis ? { basis } : {}) }
    assert.equal(creditLine("OH", rule), `In Ohio, insurers can use your credit. ${TX_LINE}`)
  }
})

test("not on the list: mirrors compareLine and never says 'can use'", () => {
  const rule: RatingRule = { ...fixture, status: "no-ban-found", basis: "not-on-list" }
  const line = creditLine("OH", rule)
  assert.equal(line, `Ohio's rating law doesn't list credit as banned. ${TX_LINE}`)
  assert.doesNotMatch(line, /can use/)
})

test("not reviewed: the general line, with the same Texas label", () => {
  const unreviewed = STATES.map((item) => item.code).find((code) => !reviewedStates().includes(code) || !ratingRule(code, "credit"))
  assert.ok(unreviewed, "some state's credit rule isn't reviewed yet")
  assert.equal(creditLine(unreviewed), `Where it's allowed, insurers can use your credit. ${TX_LINE}`)
})

test("each line links to the credit rules, names Texas inline when it quotes figures, and reads in plain words", () => {
  for (const { code } of STATES) {
    const html = renderToStaticMarkup(createElement(CreditLine, { state: code }))
    assert.ok(html.includes(`href="${CREDIT_RULES_HREF}"`), `${code} links to ${CREDIT_RULES_HREF}`)
    assert.doesNotMatch(html, /title=/, `${code}: nothing hides on hover`)
    const text = visibleText(html)
    if (/%/.test(text)) assert.ok(text.includes(TX_LINE), `${code} names Texas's survey next to the figures`)
    assert.doesNotMatch(text, /\)\s*\(/, `${code}: no stacked brackets`)
    assert.doesNotMatch(text, /\b(baseline|relativity|anchor|underwrit\w*|actuar\w*|cleared|for counsel)\b/i, `${code} reads plainly`)
    assert.ok(text.length < 260, `${code} stays short`)
  }
})

test("the line explains; credit still stays out of the factor bundle", () => {
  for (const [id, group] of Object.entries(FACTOR_BUNDLE.groups)) {
    assert.doesNotMatch(id, /credit/i)
    for (const cellId of Object.keys(group.cells)) assert.doesNotMatch(cellId, /credit/i)
  }
})

// The calculator passes HowWeGotThis the state's name for display and its code for the credit rule.
// Render the real component the way calculator.tsx does, so a name can't stand in for the code again.
const catalog = JSON.parse(readFileSync("public/catalog/vehicle-catalog.json", "utf8")) as VehicleCatalog

function creditText(html: string): string {
  const at = html.indexOf('data-testid="credit-line"')
  assert.ok(at > 0, "the estimate shows a credit line")
  return visibleText(html.slice(html.lastIndexOf("<p", at), html.indexOf("</p>", at)))
}

function renderEstimate(code: StateCode): string {
  const situation: Situation = { ...DEFAULT_SITUATION, scenario: { ...DEFAULT_SITUATION.scenario, state: code } }
  const now = situation.scenario
  const estimate = priceNow(situation, vehicleFacts(catalog, now))
  assert.ok(estimate)
  return renderToStaticMarkup(createElement(HowWeGotThis, { estimate, startKind: "typical", state: stateName(now.state), stateCode: now.state }))
}

test("the estimate's own credit line follows its state: California's ban, Texas's limits, New Jersey's summary", () => {
  assert.equal(creditText(renderEstimate("CA")), "In California, insurers can't use your credit to set your price, so it won't move your quote. Credit rules by state")
  assert.equal(creditText(renderEstimate("TX")), `In Texas, insurers can use your credit (with limits). ${TX_LINE} Credit rules by state`)
  assert.match(creditText(renderEstimate("NJ")), /^In New Jersey, insurers can use your credit \(with limits\), according to a summary of the law\./)
})

test("a what-if move from California to Texas shows Texas's credit line, not California's", () => {
  const situation: Situation = { ...DEFAULT_SITUATION, scenario: { ...DEFAULT_SITUATION.scenario, state: "CA" } }
  const next = { ...situation.scenario, state: "TX" as const }
  const result = priceWhatIf(situation, vehicleFacts(catalog, situation.scenario), next, vehicleFacts(catalog, next))
  assert.ok(result)
  const html = renderToStaticMarkup(
    createElement(HowWeGotThis, { estimate: result.next, startKind: "typical", state: stateName(next.state), stateCode: next.state }),
  )
  assert.match(creditText(html), /^In Texas, insurers can use your credit \(with limits\)\./)
})
