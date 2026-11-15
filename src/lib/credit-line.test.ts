import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CreditLine } from "../components/credit-line"
import sourcesFile from "../../data/factors/sources/sources.json"
import { CREDIT_EFFECT, CREDIT_FIGURES_NOTE, CREDIT_RULES_HREF, creditLine } from "./credit-line"
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

test("banned (California): credit won't move the quote", () => {
  assert.equal(ratingRule("CA", "credit")?.status, "banned")
  assert.deepEqual(creditLine("CA"), {
    text: "In California, insurers can't use your credit to set your price, so it won't move your quote.",
    usesFigures: false,
  })
})

test("limited (Texas): with limits, and the survey's figures", () => {
  assert.equal(ratingRule("TX", "credit")?.status, "limited")
  assert.equal(fromSummary(ratingRule("TX", "credit")), false)
  assert.equal(
    creditLine("TX").text,
    "In Texas, insurers can use your credit (with limits), so a real quote could be about 17% lower or 19% higher than ours.",
  )
})

test("summary-based (New Jersey): the sentence ends with (from a summary)", () => {
  assert.equal(fromSummary(ratingRule("NJ", "credit")), true)
  assert.equal(
    creditLine("NJ").text,
    "In New Jersey, insurers can use your credit (with limits), so a real quote could be about 17% lower or 19% higher than ours (from a summary).",
  )
})

test("no ban found drops (with limits), for any basis", () => {
  const base = { summary: "A plain sentence about the rule.", source: { label: "Law", url: "https://example.gov" }, quote: "a quote from the law", checkedOn: "2026-11-15" }
  for (const basis of [undefined, "named", "not-on-list"] as const) {
    const rule: RatingRule = { ...base, status: "no-ban-found", ...(basis ? { basis } : {}) }
    assert.equal(
      creditLine("OH", rule).text,
      "In Ohio, insurers can use your credit, so a real quote could be about 17% lower or 19% higher than ours.",
    )
  }
  assert.match(creditLine("OH", { ...base, status: "no-ban-found", evidence: "summary" }).text, /than ours \(from a summary\)\.$/)
})

test("not reviewed: the general line, never read as allowed or banned", () => {
  const unreviewed = STATES.map((item) => item.code).find((code) => !reviewedStates().includes(code) || !ratingRule(code, "credit"))
  const line = "Where it's allowed, credit can move a quote about 17% down or 19% up."
  assert.ok(unreviewed, "some state's credit rule isn't reviewed yet")
  assert.equal(creditLine(unreviewed).text, line)
})

test("each line links to the credit rules, says where the figures come from, and reads in plain words", () => {
  const codes = STATES.map((item) => item.code)
  for (const code of codes) {
    const html = renderToStaticMarkup(createElement(CreditLine, { state: code }))
    assert.ok(html.includes(`href="${CREDIT_RULES_HREF}"`), `${code} links to ${CREDIT_RULES_HREF}`)
    const line = creditLine(code)
    if (line.usesFigures) assert.ok(html.includes(`title="${CREDIT_FIGURES_NOTE.replace(/'/g, "&#x27;")}"`), `${code} labels Texas's survey`)
    const text = visibleText(html)
    assert.doesNotMatch(text, /\b(baseline|relativity|anchor|underwrit\w*|actuar\w*|cleared|for counsel)\b/i, `${code} reads plainly`)
    assert.ok(text.length < 200, `${code} stays short`)
  }
  assert.match(CREDIT_FIGURES_NOTE, /Texas's survey/)
  assert.doesNotMatch(CREDIT_FIGURES_NOTE, /\b(baseline|relativity|anchor|underwrit\w*|actuar\w*)\b/i)
})

test("the line explains; credit still stays out of the factor bundle", () => {
  for (const [id, group] of Object.entries(FACTOR_BUNDLE.groups)) {
    assert.doesNotMatch(id, /credit/i)
    for (const cellId of Object.keys(group.cells)) assert.doesNotMatch(cellId, /credit/i)
  }
})
