import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import WhatWeDontAskPage from "../app/what-we-dont-ask/page"
import StatePage, { generateStaticParams as stateParams } from "../app/states/[state]/page"
import { FACTOR_BUNDLE } from "./factor-engine"
import {
  compareLine,
  compareRules,
  fromSummary,
  isBanned,
  RATING_FACTORS,
  ratingGroup,
  ratingRule,
  reviewProgressLine,
  reviewedStates,
  statusWords,
  SUMMARY_MARK,
  SUMMARY_NOTE,
  TABLE_FACTORS,
  validateRatingRules,
} from "./rating-rules"
import { STATES } from "./scenario"
import { todayIso } from "./state-rules"
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

test('"not-on-list" means no ban in the state\'s rating law, and only goes with "no-ban-found"', () => {
  const good = { version: "rating-rules-2026-11-15", checkedOn: "2026-11-15", about: "x", states: {} }
  const rule = {
    summary: "Ohio's rating law lists what insurers can't use, and credit isn't on it.",
    source: { label: "Law", url: "https://example.gov" },
    quote: "No insurer shall use race, religion, or national origin",
  }
  const withRule = (extra: object) => ({ ...good, states: { OH: { credit: { ...rule, ...extra } } } }) as never
  assert.doesNotThrow(() => validateRatingRules(withRule({ status: "no-ban-found", basis: "not-on-list" })))
  assert.doesNotThrow(() => validateRatingRules(withRule({ status: "no-ban-found", basis: "named" })))
  assert.doesNotThrow(() => validateRatingRules(withRule({ status: "banned", basis: "named" })))
  assert.throws(() => validateRatingRules(withRule({ status: "banned", basis: "not-on-list" })), /not-on-list/)
  assert.throws(() => validateRatingRules(withRule({ status: "limited", basis: "not-on-list" })), /not-on-list/)
  assert.throws(() => validateRatingRules(withRule({ status: "no-ban-found", basis: "maybe" })), /basis/)

  const base = { ...rule, checkedOn: "2026-11-15" }
  const notOnList = { ...base, status: "no-ban-found" as const, basis: "not-on-list" as const }
  const named = { ...base, status: "no-ban-found" as const, basis: "named" as const }
  const plain = { ...base, status: "no-ban-found" as const }
  assert.equal(statusWords(notOnList), "No ban in state law")
  assert.equal(statusWords(named), "Allowed")
  assert.equal(statusWords(plain), "Allowed")
  assert.equal(statusWords({ ...base, status: "banned" }), "Not allowed")
  assert.equal(ratingGroup(notOnList), "not-on-list")
  assert.equal(ratingGroup(named), "allowed")
  assert.equal(ratingGroup(plain), "allowed")
  assert.equal(ratingGroup({ ...base, status: "limited" }), "limited")
})

test("the page says how many states we've reviewed so far, worked out from the data", () => {
  const codes = STATES.map((item) => item.code)
  assert.equal(codes.length, 51)
  assert.equal(reviewProgressLine(["AA", "BB", "CC"], ["BB", "ZZ"]), "Reviewed so far: 1 of 3 (the 50 states and DC)")
  const reviewed = reviewedStates().filter((code) => codes.includes(code)).length
  assert.ok(reviewed > 0)
  const line = reviewProgressLine(codes)
  assert.equal(line, `Reviewed so far: ${reviewed} of 51 (the 50 states and DC)`)
  const text = visibleText(renderToStaticMarkup(WhatWeDontAskPage()))
  assert.ok(text.includes(line), "the progress line is on the page")
})

test("tripwire: a rule's start date stops showing within 30 days of it passing", () => {
  const today = todayIso()
  const cutoff = new Date(`${today}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - 30)
  const oldest = cutoff.toISOString().slice(0, 10)
  for (const state of reviewedStates()) {
    for (const factor of RATING_FACTORS) {
      const rule = ratingRule(state, factor)
      if (!rule?.effective) continue
      assert.ok(
        rule.effective >= oldest,
        `${state} ${factor} started on ${rule.effective}, more than 30 days ago. Remove "effective" from that entry in data/state-rules/rating-rules.json so the page stops showing "(from ...)".`,
      )
    }
  }
})

test("comparing a not-on-list state never says insurers there may use the factor, in either order", () => {
  const base = { summary: "A plain sentence about the rule.", source: { label: "Law", url: "https://example.gov" }, quote: "a quote from the law", checkedOn: "2026-11-15" }
  const notOnList = { ...base, status: "no-ban-found" as const, basis: "not-on-list" as const }
  const others = {
    banned: { ...base, status: "banned" as const },
    limited: { ...base, status: "limited" as const },
    allowed: { ...base, status: "no-ban-found" as const },
  }
  const expected = {
    banned: "insurers in Hawaii can't use it",
    limited: "insurers in Hawaii can use it, with limits",
    allowed: "insurers in Hawaii can use it",
  }
  for (const [group, other] of Object.entries(others) as [keyof typeof others, (typeof others)[keyof typeof others]][]) {
    assert.equal(
      compareRules("credit", notOnList, other, "Texas", "Hawaii"),
      `Credit: Texas's rating law doesn't list it as banned; ${expected[group]}.`,
    )
    assert.equal(
      compareRules("credit", other, notOnList, "Hawaii", "Texas"),
      `Credit: ${expected[group]}; Texas's rating law doesn't list it as banned.`,
    )
    for (const line of [compareRules("credit", notOnList, other, "Texas", "Hawaii"), compareRules("credit", other, notOnList, "Hawaii", "Texas")]) {
      assert.doesNotMatch(line ?? "", /insurers in Texas can use/)
    }
  }
  assert.equal(compareRules("credit", notOnList, notOnList, "Texas", "Ohio"), null)
})

test('"evidence" is "law" or "summary", and a summary can\'t stand in for the state\'s list', () => {
  const good = { version: "rating-rules-2026-11-15", checkedOn: "2026-11-15", about: "x", states: {} }
  const rule = {
    status: "no-ban-found",
    summary: "Insurers may use your age, according to the state insurance department.",
    source: { label: "Insurance department guide", url: "https://example.gov" },
    quote: "Insurers may consider your age",
  }
  const withRule = (extra: object) => ({ ...good, states: { OH: { age: { ...rule, ...extra } } } }) as never
  assert.doesNotThrow(() => validateRatingRules(withRule({})))
  assert.doesNotThrow(() => validateRatingRules(withRule({ evidence: "law" })))
  assert.doesNotThrow(() => validateRatingRules(withRule({ evidence: "summary" })))
  assert.throws(() => validateRatingRules(withRule({ evidence: "rumor" })), /evidence/)
  assert.throws(() => validateRatingRules(withRule({ evidence: "summary", basis: "not-on-list" })), /summary/)

  const base = { ...rule, status: "no-ban-found" as const, checkedOn: "2026-11-15" }
  assert.equal(fromSummary({ ...base, evidence: "summary" }), true)
  assert.equal(fromSummary({ ...base, evidence: "law" }), false)
  assert.equal(fromSummary(base), false, "left out means the law itself")
  assert.equal(fromSummary(undefined), false)
  // The table words don't change; the mark sits beside them.
  assert.equal(statusWords({ ...base, evidence: "summary" }), statusWords(base))
})

test("summary-based answers are marked everywhere they show, and only those", () => {
  const summaryRules = STATES.flatMap((state) =>
    TABLE_FACTORS.filter((factor) => fromSummary(ratingRule(state.code, factor))).map((factor) => ({ state, factor })),
  )
  const html = renderToStaticMarkup(WhatWeDontAskPage())
  const marks = html.match(/data-testid="summary-mark"/g)?.length ?? 0
  // Every summary-based cell in the big table gets the mark; the comparison box adds its own for the two states it shows.
  assert.ok(marks >= summaryRules.length, `expected at least ${summaryRules.length} marks, found ${marks}`)
  if (summaryRules.length === 0) {
    assert.equal(marks, 0)
    assert.doesNotMatch(html, /data-testid="summary-footnote"/)
    return
  }
  assert.match(html, /data-testid="summary-footnote"/)
  const text = visibleText(html)
  assert.ok(text.includes(SUMMARY_NOTE), "the footnote explains the mark")
  assert.ok(text.includes(SUMMARY_MARK))
  for (const { state, factor } of summaryRules) {
    const section = html.slice(html.indexOf(`id="rules-${factor}"`))
    const line = section.slice(0, section.indexOf("</section>"))
    assert.ok(line.includes(`${state.name} (from a summary)`), `${state.code} ${factor}: its line says "(from a summary)"`)
  }
})

test("the page opens with a plain note that it's a guide, not legal advice", () => {
  const html = renderToStaticMarkup(WhatWeDontAskPage())
  const at = html.indexOf('data-testid="rating-rules-disclaimer"')
  assert.ok(at > 0, "the note is on the page")
  assert.ok(at < html.indexOf('id="what-moves-the-price"'), "the note comes before the first section")
  const note = visibleText(html.slice(at, html.indexOf("</div>", at)))
  assert.match(note, /not legal advice/)
  assert.match(note, /from a summary/)
  assert.match(note, /insurance department/)
})

test("pinned: Colorado limits credit (renewal price and turning you down), from C.R.S. 10-4-116, and age through the 55+ discount", () => {
  const rule = ratingRule("CO", "credit")
  assert.equal(rule?.status, "limited")
  assert.match(rule?.source.label ?? "", /10-4-116/)
  assert.equal(fromSummary(rule), false, "it rests on the law itself")
  assert.equal(ratingRule("CO", "priorInsurance")?.status, "limited")
  // Age rests only on the required 55+ course discount, which limits age pricing; it doesn't show age is allowed in general.
  const age = ratingRule("CO", "age")
  assert.equal(age?.status, "limited")
  assert.match(age?.source.label ?? "", /10-4-632/)
  assert.match(age?.summary ?? "", /haven't found other limits/)
})

test("comparisons say which side rests on a summary, in either order", () => {
  for (const state of ["NJ", "TX"]) assert.equal(fromSummary(ratingRule(state, state === "NJ" ? "gender" : "educationOccupation")), true)
  assert.equal(
    compareLine("gender", "CA", "NJ", "California", "New Jersey"),
    "Gender: insurers in California can't use it; insurers in New Jersey can use it (from a summary).",
  )
  assert.equal(
    compareLine("gender", "NJ", "CA", "New Jersey", "California"),
    "Gender: insurers in New Jersey can use it (from a summary); insurers in California can't use it.",
  )
  assert.equal(
    compareLine("educationOccupation", "CA", "TX", "California", "Texas"),
    "Education or job: insurers in California can use it, with limits; insurers in Texas can use it (from a summary).",
  )
  assert.equal(
    compareLine("educationOccupation", "TX", "CA", "Texas", "California"),
    "Education or job: insurers in Texas can use it (from a summary); insurers in California can use it, with limits.",
  )
  // Both limit it: each state's own sentence is shown, and the summary-based one is labeled.
  const base = { source: { label: "Law", url: "https://example.gov" }, quote: "a quote from the law", checkedOn: "2026-11-15" }
  const law = { ...base, status: "limited" as const, summary: "Insurers can use credit, but not alone." }
  const summary = { ...law, evidence: "summary" as const, summary: "Insurers can't use it to cancel, according to the department." }
  assert.equal(
    compareRules("credit", law, summary, "Ohio", "New Jersey"),
    "Credit: both states limit it, in different ways. Ohio: Insurers can use credit, but not alone. New Jersey (from a summary): Insurers can't use it to cancel, according to the department.",
  )
  assert.equal(compareRules("credit", law, law, "Ohio", "Illinois")?.includes("(from a summary)"), false, "law-based answers carry no label")
})

test("a state page's rules box labels a summary-based answer", async () => {
  const slug = stateParams().find((item) => /jersey/.test(item.state))?.state
  assert.ok(slug, "New Jersey has a state page")
  const html = renderToStaticMarkup(await StatePage({ params: Promise.resolve({ state: slug }) } as never))
  const at = html.indexOf('data-testid="state-rating-rules"')
  assert.ok(at > 0)
  const box = visibleText(html.slice(at, html.indexOf("</div>", at)))
  assert.match(box, /Gender: allowed \(from a summary\)\./)
  assert.doesNotMatch(box, /Credit: allowed \(from a summary\)/)
})
