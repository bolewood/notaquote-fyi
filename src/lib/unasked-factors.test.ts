import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import WhatWeDontAskPage from "../app/what-we-dont-ask/page"
import { FACTOR_BUNDLE } from "./factor-engine"
import {
  compareLine,
  isBanned,
  RATING_FACTORS,
  ratingRule,
  reviewedStates,
  statusWords,
  validateRatingRules,
} from "./rating-rules"
import { STATES } from "./scenario"
import { maskDollars, visibleText } from "./rendered-text"
import { chartAxis, insurerSpread, northCarolinaDui, pairedRatios, percentWords, stateInsurerSpreads, unaskedFactors } from "./unasked-factors"

test("credit reproduces the Texas figures in data/factors/README.md: poor about 19% more, good about 17% less", () => {
  const poor = pairedRatios("tx-2025", "tx-creditPoor", "tx-base")
  const good = pairedRatios("tx-2025", "tx-creditGood", "tx-base")
  assert.equal(poor.n, 180)
  assert.equal(good.n, 180)
  assert.equal(percentWords(poor.median), "19% more")
  assert.equal(percentWords(good.median), "17% less")
})

test("the national insurer spread is the bundle's typical-start range cell", () => {
  const insurer = unaskedFactors().find((factor) => factor.id === "insurer")
  const cell = FACTOR_BUNDLE.groups.range.cells["typical-start"]
  assert.ok(insurer)
  assert.equal(insurer.low, cell.low / 100)
  assert.equal(insurer.high, cell.high / 100)
})

test("each survey state's own insurer spread is a sensible middle half around 1", () => {
  const spreads = stateInsurerSpreads()
  assert.ok(Object.keys(spreads).length >= 3)
  for (const spread of Object.values(spreads)) {
    assert.ok(spread && spread.p25 < 1 && spread.p75 > 1, `${spread?.sourceId} should straddle the middle company`)
    assert.ok(spread.n > 100)
  }
  // California's middle half: about 1.6 times from low to high.
  const ca = insurerSpread("ca-2026")
  assert.ok(ca.p75 / ca.p25 > 1.4 && ca.p75 / ca.p25 < 1.9)
})

test("every factor is either sourced, with a method and sources, or plainly has no public number", () => {
  const factors = unaskedFactors()
  assert.ok(factors.length >= 6)
  for (const factor of factors) {
    assert.ok(factor.what.length > 20, `${factor.id} needs a plain explanation`)
    assert.ok(factor.whatYouCanDo.length > 0, `${factor.id} needs something a person can do`)
    if (factor.kind === "no-public-number") {
      assert.equal(factor.low, null)
      assert.equal(factor.high, null)
      assert.match(factor.reading, /No public source/)
    } else if (factor.kind === "state-rule") {
      // A state-set figure, not a survey ratio: no bar, but a source.
      assert.equal(factor.low, null)
      assert.ok(factor.sources.length > 0, `${factor.id} needs its state's source`)
    } else {
      assert.ok(factor.low !== null && factor.high !== null, `${factor.id} needs a range`)
      assert.ok(factor.sources.length > 0, `${factor.id} needs a source`)
      assert.match(factor.howWorkedOut, /comparisons|prices/, `${factor.id} should say how many comparisons`)
    }
  }
})

test("the gender bar is for the example adult driver, not an 18-year-old", () => {
  const gender = unaskedFactors().find((factor) => factor.id === "gender")
  const woman18 = pairedRatios("tx-2025", "tx-age18_female", "tx-age18")
  assert.ok(gender && gender.low !== null)
  assert.notEqual(gender.low, woman18.median)
  assert.ok(gender.low > 0.95, "an adult woman's price is about the same as a man's in Texas's survey")
})

test("credit stays out of the factor bundle: it's explained, never priced", () => {
  for (const [id, group] of Object.entries(FACTOR_BUNDLE.groups)) {
    assert.doesNotMatch(id, /credit/i)
    for (const cellId of Object.keys(group.cells)) assert.doesNotMatch(cellId, /credit/i)
  }
})

test("rating rules: every entry quotes its law, and a broken entry fails loudly", () => {
  for (const state of reviewedStates()) {
    for (const factor of RATING_FACTORS) {
      const rule = ratingRule(state, factor)
      if (!rule) continue
      assert.match(rule.source.url, /^https:\/\//)
      assert.ok(rule.quote.length >= 10)
      assert.doesNotMatch(rule.summary, /underwrit|actuar|baseline|relativity/i, `${state} ${factor} should be plain words`)
    }
  }
  const good = { version: "rating-rules-2026-11-15", checkedOn: "2026-11-15", about: "x", states: {} }
  assert.doesNotThrow(() => validateRatingRules(good))
  const rule = { summary: "Insurers can't use your credit.", source: { label: "Law", url: "https://example.gov" }, quote: "a quote from the law" }
  assert.throws(() => validateRatingRules({ ...good, states: { CA: { credit: { ...rule, status: "maybe" } } } } as never), /status/)
  assert.throws(() => validateRatingRules({ ...good, states: { CA: { color: { ...rule, status: "banned" } } } } as never), /unknown factor/)
  assert.throws(
    () => validateRatingRules({ ...good, states: { CA: { credit: { ...rule, status: "banned", source: { label: "Law", url: "http://x" } } } } } as never),
    /https/,
  )
  assert.equal(statusWords(undefined), "Not reviewed yet")
})

test("unreviewed is never read as allowed", () => {
  const unreviewed = STATES.map((item) => item.code).find((code) => !reviewedStates().includes(code))
  if (unreviewed) {
    assert.equal(isBanned(unreviewed, "credit"), false)
    assert.equal(ratingRule(unreviewed, "credit"), undefined)
  }
})

test("the page renders every state, works as plain HTML, and reads in plain words", () => {
  const html = renderToStaticMarkup(WhatWeDontAskPage())
  const text = maskDollars(visibleText(html))
  for (const state of STATES) assert.ok(text.includes(state.name), `${state.name} should appear in the table`)
  assert.match(text, /What moves the price/)
  assert.match(text, /Why insurers disagree so much/)
  assert.match(html, /<blockquote/, "the law's own words are on the page")
  // Quotes from the law keep their legal words; everything we wrote must be plain.
  const ours = maskDollars(visibleText(html.replace(/<blockquote[\s\S]*?<\/blockquote>/g, "")))
  assert.doesNotMatch(ours, /\b(baseline|relativity|anchor|underwriting)\b/i)
})

test("pinned rows: California bans credit, gender, and age; Montana repealed its gender ban", () => {
  for (const factor of ["credit", "gender", "age"] as const) assert.equal(ratingRule("CA", factor)?.status, "banned", `CA ${factor}`)
  assert.equal(ratingRule("MT", "gender")?.status, "no-ban-found")
  for (const state of ["CA", "HI", "MA"]) assert.equal(isBanned(state, "credit"), true, `${state} credit`)
  assert.equal(isBanned("TX", "credit"), false)
})

test("the DUI row cites North Carolina's state-set surcharge instead of claiming no public figure", () => {
  const dui = unaskedFactors().find((factor) => factor.id === "dui")
  const nc = northCarolinaDui()
  assert.ok(dui)
  assert.equal(nc.points, 12)
  assert.match(dui.reading, new RegExp(`${nc.surcharge}%`))
  assert.doesNotMatch(dui.reading, /No public source/)
})

test("the chart's axis fits every bar any state choice can show, so nothing is clipped", () => {
  const axis = chartAxis()
  for (const spread of Object.values(stateInsurerSpreads())) {
    assert.ok(spread && spread.p25 >= axis.low && spread.p75 <= axis.high, `${spread?.sourceId} fits`)
  }
  for (const factor of unaskedFactors()) {
    if (factor.low !== null) assert.ok(factor.low >= axis.low)
    if (factor.high !== null) assert.ok(factor.high <= axis.high)
  }
})

test("a state's insurer spread carries its own method, count, and source", () => {
  const spreads = stateInsurerSpreads()
  for (const spread of Object.values(spreads)) {
    assert.ok(spread)
    assert.match(spread.howWorkedOut, new RegExp(spread.n.toLocaleString("en-US")))
    assert.equal(spread.source.id, spread.sourceId)
  }
  assert.match(spreads.TX?.howWorkedOut ?? "", /liability-only/)
})

test("comparing two states that both limit a factor says how each one does", () => {
  const line = compareLine("credit", "MD", "TX", "Maryland", "Texas")
  assert.ok(line, "Maryland and Texas both limit credit, differently")
  assert.match(line, /Maryland:/)
  assert.match(line, /Texas:/)
  assert.equal(compareLine("credit", "CA", "HI", "California", "Hawaii"), null)
})

test("every reviewed rule, including allowed ones and extra sources, shows its quote on the page", () => {
  const html = renderToStaticMarkup(WhatWeDontAskPage())
  const quotes = (html.match(/<blockquote/g) ?? []).length
  let expected = 0
  for (const state of reviewedStates()) {
    for (const factor of RATING_FACTORS) {
      const rule = ratingRule(state, factor)
      if (rule) expected += 1 + (rule.moreSources?.length ?? 0)
    }
  }
  assert.equal(quotes, expected)
  assert.match(html, /id="rules-territory"/)
})
