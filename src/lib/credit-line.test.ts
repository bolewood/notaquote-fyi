import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CreditLine } from "../components/credit-line"
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

const TX_LINE = "In Texas's survey, credit moved the same driver's price about 17% down or 19% up."

test("banned (California): credit won't move the quote, and no Texas figures", () => {
  assert.equal(ratingRule("CA", "credit")?.status, "banned")
  assert.equal(creditLine("CA"), "In California, insurers can't use your credit to set your price, so it won't move your quote.")
})

test("limited (Texas): with limits, then the survey's figures, labeled inline", () => {
  assert.equal(ratingRule("TX", "credit")?.status, "limited")
  assert.equal(fromSummary(ratingRule("TX", "credit")), false)
  assert.equal(TEXAS_SENTENCE, TX_LINE)
  assert.equal(creditLine("TX"), `In Texas, insurers can use your credit with limits. ${TX_LINE}`)
})

test("summary-based (New Jersey): says so in words, without stacked brackets", () => {
  assert.equal(fromSummary(ratingRule("NJ", "credit")), true)
  assert.equal(creditLine("NJ"), `In New Jersey, insurers can use your credit with limits, according to a summary of the law. ${TX_LINE}`)
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
    assert.ok(text.length < 220, `${code} stays short`)
  }
})

test("the line explains; credit still stays out of the factor bundle", () => {
  for (const [id, group] of Object.entries(FACTOR_BUNDLE.groups)) {
    assert.doesNotMatch(id, /credit/i)
    for (const cellId of Object.keys(group.cells)) assert.doesNotMatch(cellId, /credit/i)
  }
})
