import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement, createRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AskYourInsurer, AskYourInsurerView, copyChecklist, type CopyState } from "../components/ask-your-insurer"
import { WhatIfResult } from "../components/calculator"
import TeenCostGuide from "../app/guides/adding-a-teen-driver/page"
import { ASK_ITEMS, askContext, askItems, askPlainText, calculatorAskContexts, type AskContext } from "./ask-your-insurer"
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts } from "./catalog-class"
import { priceNow, priceWhatIf } from "./pricing"
import { PLAIN_LANGUAGE_BANNED, visibleText } from "./rendered-text"
import { starter, stateName, type Scenario, type StateCode } from "./scenario"
import { DEFAULT_SITUATION, type Situation } from "./situation"

const ids = (context: AskContext) => askItems(context).map((item) => item.id)

const TEEN_ITEMS = ["teen-car", "good-student", "drivers-ed", "distant-student", "drop-physical-damage", "usage-based", "new-driver-surcharge"]

function teenIn(state: StateCode, onParentPolicy = true): AskContext {
  const scenario: Scenario = { ...DEFAULT_SITUATION.scenario, state, ...starter("adding-teen").change(DEFAULT_SITUATION.scenario) }
  return askContext(scenario, onParentPolicy)
}

// ---------------------------------------------------------------------------
// Which items show

test("a teen added in Texas: every teen question, the credit question, then other companies last", () => {
  assert.deepEqual(ids(teenIn("TX")), [...TEEN_ITEMS, "credit-renewal", "other-companies"])
})

test("a teen added in California: no credit question, since California bans credit in pricing", () => {
  assert.deepEqual(ids(teenIn("CA")), [...TEEN_ITEMS, "other-companies"])
})

test("no teen: none of the teen questions", () => {
  const tx = ids(askContext({ ...DEFAULT_SITUATION.scenario, state: "TX" }, true))
  assert.deepEqual(tx, ["credit-renewal", "other-companies"])
  const ca = ids(askContext({ ...DEFAULT_SITUATION.scenario, state: "CA" }, true))
  assert.deepEqual(ca, ["other-companies"])
})

const CREDIT_IDS = ["credit-renewal", "credit-renewal-if-used"]
const creditIds = (context: AskContext) => ids(context).filter((id) => CREDIT_IDS.includes(id))

test("credit: asked plainly where reviewed and allowed, as a condition where unreviewed, never where banned", () => {
  for (const state of ["CA", "HI", "MA"] as const) assert.deepEqual(creditIds({ teen: null, state }), [], state)
  // Not reviewed yet: asked as a condition, never stated as allowed.
  for (const state of ["GA", "MT", "NY", "PA"] as const) assert.deepEqual(creditIds({ teen: null, state }), ["credit-renewal-if-used"], state)
  for (const state of ["TX", "OH", "WI", "NJ", "SC"] as const) assert.deepEqual(creditIds({ teen: null, state }), ["credit-renewal"], state)
  // No state (a guide): no credit question.
  assert.deepEqual(creditIds({ teen: "added" }), [])
  const conditional = askItems({ teen: null, state: "NY" }).find((item) => item.id === "credit-renewal-if-used")
  assert.match(conditional?.question ?? "", /^If you use credit/)
})

test("every state gets exactly one credit question unless it bans credit", async () => {
  const { STATES } = await import("./scenario")
  const { ratingRule } = await import("./rating-rules")
  for (const { code } of STATES) {
    const banned = ratingRule(code, "credit")?.status === "banned"
    assert.equal(creditIds({ teen: null, state: code }).length, banned ? 0 : 1, code)
  }
})

test("an at-fault accident brings the defensive-driving question; a clean record doesn't", () => {
  const withAccident = ids(askContext({ ...DEFAULT_SITUATION.scenario, state: "TX", incidents: "one" }, true))
  assert.deepEqual(withAccident, ["credit-renewal", "defensive-driving", "other-companies"])
  assert.ok(ids(askContext({ ...DEFAULT_SITUATION.scenario, incidents: "two-or-more" }, true)).includes("defensive-driving"))
  assert.ok(!ids(askContext({ ...DEFAULT_SITUATION.scenario, incidents: "clean" }, true)).includes("defensive-driving"))
})

test("a teen on their own policy: no questions about the household's cars or being away at college", () => {
  const own = ids(teenIn("TX", false))
  assert.ok(!own.includes("teen-car"))
  assert.ok(!own.includes("distant-student"))
  assert.ok(own.includes("good-student"))
})

test("dropping collision shows only when there's collision to drop and no lender requiring it", () => {
  const base = teenIn("TX")
  assert.ok(ids({ ...base, coverage: "full" }).includes("drop-physical-damage"))
  assert.ok(ids({ ...base, coverage: "high" }).includes("drop-physical-damage"))
  assert.ok(!ids({ ...base, coverage: "standard" }).includes("drop-physical-damage"))
  assert.ok(!ids({ ...base, coverage: "state-minimum" }).includes("drop-physical-damage"))
  assert.ok(!ids({ ...base, coverage: "full", loanLease: true }).includes("drop-physical-damage"))
  assert.ok(!ids({ ...askContext(DEFAULT_SITUATION.scenario, true), coverage: "full" }).includes("drop-physical-damage"))
})

test("the guide (a teen, no situation): the general teen questions, then other companies", () => {
  assert.deepEqual(ids({ teen: "added" }), [...TEEN_ITEMS, "other-companies"])
})

test("other companies is always shown, always last, and links to why prices differ", () => {
  const contexts: AskContext[] = [{ teen: null }, teenIn("TX"), teenIn("CA", false), { teen: null, state: "TX", incidents: "one" }]
  for (const context of contexts) {
    const items = askItems(context)
    assert.equal(items.at(-1)?.id, "other-companies")
    assert.equal(items.at(-1)?.link?.href, "/what-we-dont-ask#why-insurers-disagree")
  }
  assert.equal(ASK_ITEMS.at(-1)?.id, "other-companies")
})

test("item ids are unique, and shown items carry no rule", () => {
  assert.equal(new Set(ASK_ITEMS.map((item) => item.id)).size, ASK_ITEMS.length)
  for (const item of askItems(teenIn("TX"))) assert.ok(!("shownWhen" in item))
})

// ---------------------------------------------------------------------------
// Copy as text

test("the plain-text copy: numbered questions, each with why we're asking, no dollar amounts", () => {
  const text = askPlainText(askItems({ teen: null, state: "TX", incidents: "one" }))
  assert.equal(
    text,
    [
      "Questions to ask your insurer",
      "",
      "1. Do you check credit again at renewal if my score has improved?",
      "   Why we're asking: Many insurers use credit when they set a price, and some look at it again only if you ask.",
      "",
      "2. Can I qualify for a defensive-driving course discount with an accident on my record? Which courses qualify?",
      "   Why we're asking: Whether you qualify, and which courses count, differs by insurer. A course discount may not remove the extra charge for the accident itself.",
      "",
      "3. Ask two or three other companies for the same coverage.",
      "   Why we're asking: For the same driver and car, companies' prices can be far apart. Getting a few quotes is usually the biggest thing you control.",
      "   Why companies' prices differ so much: https://notaquote.fyi/what-we-dont-ask#why-insurers-disagree",
      "",
      "From NotAQuote.FYI. We don't sell insurance or recommend any company.",
    ].join("\n"),
  )
  assert.doesNotMatch(askPlainText(askItems(teenIn("TX"))), /\$/)
})

// ---------------------------------------------------------------------------
// Plain language

const ADVICE = /\b(you should|you must|we recommend|be sure to|make sure|don't forget)\b/i
const INSURER_NAMES = /\b(state farm|geico|progressive|allstate|usaa|liberty mutual|farmers|nationwide|travelers|american family|erie)\b/i

test("plain language: no banned words, no 'do this' advice, no insurer names, no gendered pronouns", () => {
  for (const item of ASK_ITEMS) {
    for (const text of [item.question, item.why, item.link?.text ?? ""]) {
      assert.doesNotMatch(text, PLAIN_LANGUAGE_BANNED, `${item.id}: ${text}`)
      assert.doesNotMatch(text, ADVICE, `${item.id}: ${text}`)
      assert.doesNotMatch(text, INSURER_NAMES, `${item.id}: ${text}`)
      assert.doesNotMatch(text, /\b(she|he|her|his|him)\b/i, `${item.id}: ${text}`)
    }
    assert.ok(item.why.length <= 200, `${item.id}: keep "why" to a line or two`)
  }
  const rendered = visibleText(renderToStaticMarkup(createElement(AskYourInsurer, { context: teenIn("TX") })))
  assert.doesNotMatch(rendered, PLAIN_LANGUAGE_BANNED)
  assert.doesNotMatch(rendered, ADVICE)
  assert.doesNotMatch(rendered, INSURER_NAMES)
})

// ---------------------------------------------------------------------------
// Where it renders

const catalog = JSON.parse(readFileSync("public/catalog/vehicle-catalog.json", "utf8")) as VehicleCatalog

/** The calculator's what-if result, rendered the way calculator.tsx renders it. */
function renderResult(situation: Situation, next: Scenario): string {
  const now = situation.scenario
  const result = priceWhatIf(situation, vehicleFacts(catalog, now), next, vehicleFacts(catalog, next))
  assert.ok(result)
  return renderToStaticMarkup(
    createElement(WhatIfResult, {
      headingRef: createRef<HTMLHeadingElement>(),
      mode: result.mode,
      parts: result.parts,
      compareHref: "/compare",
      headline: result.headline,
      changesLabel: null,
      delta: result.delta,
      current: result.current,
      next: result.next,
      startKind: "typical",
      sender: false,
      plural: false,
      state: stateName(next.state),
      stateCode: next.state,
      chips: [],
      onUndo: () => {},
      onReset: () => {},
      onKeep: () => {},
      neutral: false,
      tradeOff: null,
      moveNote: null,
      vehicleChanged: false,
      nextCarName: "",
      carPage: null,
      carPageName: "",
      versionPicker: null,
      // The same mapping calculator.tsx uses: with a result, its checklist is the printed one too.
      ask: calculatorAskContexts(situation.scenario, next, result).print,
    }),
  )
}

function shownIds(html: string): string[] {
  return [...html.matchAll(/data-item="([^"]+)"/g)].map((match) => match[1])
}

function teenResult(state: StateCode): string {
  const situation: Situation = { ...DEFAULT_SITUATION, scenario: { ...DEFAULT_SITUATION.scenario, state } }
  const next = { ...situation.scenario, ...starter("adding-teen").change(situation.scenario) }
  return renderResult(situation, next)
}

test("the teen result shows the checklist, collapsed, with the state's own credit question", () => {
  const tx = teenResult("TX")
  assert.match(tx, /data-testid="ask-your-insurer"/)
  assert.doesNotMatch(tx, /<details[^>]*data-testid="ask-your-insurer"[^>]*\sopen/)
  assert.deepEqual(shownIds(tx), [...TEEN_ITEMS, "credit-renewal", "other-companies"])
  assert.deepEqual(shownIds(teenResult("CA")), [...TEEN_ITEMS, "other-companies"])
})

test("a standard what-if with an accident shows only the non-teen questions", () => {
  const situation: Situation = { ...DEFAULT_SITUATION, scenario: { ...DEFAULT_SITUATION.scenario, state: "TX" } }
  const html = renderResult(situation, { ...situation.scenario, incidents: "one" })
  assert.deepEqual(shownIds(html), ["credit-renewal", "defensive-driving", "other-companies"])
})

test("the checklist is left out of what makes a page its own (data-shared)", () => {
  assert.match(renderToStaticMarkup(createElement(AskYourInsurer, { context: { teen: null } })), /<details[^>]*data-shared/)
})

test("the teen guide shows the checklist open, with the general teen questions", () => {
  const html = renderToStaticMarkup(TeenCostGuide())
  assert.match(html, /<details[^>]*\sopen=""[^>]*data-testid="ask-your-insurer"|<details[^>]*data-testid="ask-your-insurer"[^>]*\sopen=""/)
  assert.deepEqual(shownIds(html), [...TEEN_ITEMS, "other-companies"])
  assert.match(visibleText(html), /What to ask your insurer/)
})

// ---------------------------------------------------------------------------
// The calculator's mapping: what was priced, not the teen-policy preference

const shownFor = (context: AskContext | null) => (context ? ids(context) : [])

test("a teen's own base estimate, with the preference left on 'add to our policy': no parent-only questions", () => {
  const teen: Scenario = { ...DEFAULT_SITUATION.scenario, state: "TX", age: "16-18", yearsLicensed: "under-1", teen: true }
  const situation: Situation = { ...DEFAULT_SITUATION, teenOnParentPolicy: true, scenario: teen }
  assert.ok(priceNow(situation, vehicleFacts(catalog, teen)), "the base estimate prices")
  const contexts = calculatorAskContexts(situation.scenario, situation.scenario, null)
  for (const shown of [shownFor(contexts.estimate), shownFor(contexts.print)]) {
    assert.ok(!shown.includes("teen-car"))
    assert.ok(!shown.includes("distant-student"))
    assert.ok(shown.includes("good-student"), "still a teen's questions")
  }
  assert.equal(contexts.result, null)
})

test("'Make this my new starting point' after adding a teen: later what-ifs don't ask parent-only questions", () => {
  const parent: Situation = { ...DEFAULT_SITUATION, teenOnParentPolicy: true, scenario: { ...DEFAULT_SITUATION.scenario, state: "TX" } }
  const withTeen = { ...parent.scenario, ...starter("adding-teen").change(parent.scenario) }
  const added = priceWhatIf(parent, vehicleFacts(catalog, parent.scenario), withTeen, vehicleFacts(catalog, withTeen))
  assert.equal(added?.mode, "teen-added")
  const before = calculatorAskContexts(parent.scenario, withTeen, added)
  assert.ok(shownFor(before.result).includes("teen-car"), "adding the teen to the policy asks which car")
  assert.ok(shownFor(before.print).includes("distant-student"))
  // Keep it: the teen is now the situation, and the preference stays on.
  const kept: Situation = { ...parent, scenario: withTeen }
  const next = { ...withTeen, goodStudent: true }
  const change = priceWhatIf(kept, vehicleFacts(catalog, withTeen), next, vehicleFacts(catalog, next))
  assert.equal(change?.mode, "change")
  const after = calculatorAskContexts(kept.scenario, next, change)
  for (const shown of [shownFor(after.estimate), shownFor(after.result), shownFor(after.print)]) {
    assert.ok(!shown.includes("teen-car"))
    assert.ok(!shown.includes("distant-student"))
    assert.ok(shown.includes("good-student"))
  }
  // And the rendered result agrees.
  const html = renderResult(kept, next)
  assert.ok(!shownIds(html).includes("teen-car"))
})

test("a teen on their own policy (the preference off): teen questions without the parent-only two", () => {
  const parent: Situation = { ...DEFAULT_SITUATION, teenOnParentPolicy: false, scenario: { ...DEFAULT_SITUATION.scenario, state: "TX" } }
  const withTeen = { ...parent.scenario, ...starter("adding-teen").change(parent.scenario) }
  const own = priceWhatIf(parent, vehicleFacts(catalog, parent.scenario), withTeen, vehicleFacts(catalog, withTeen))
  assert.equal(own?.mode, "teen-own")
  assert.deepEqual(shownFor(calculatorAskContexts(parent.scenario, withTeen, own).result), [
    "good-student",
    "drivers-ed",
    "drop-physical-damage",
    "usage-based",
    "new-driver-surcharge",
    "credit-renewal",
    "other-companies",
  ])
})

// ---------------------------------------------------------------------------
// Copy as text: the manual box always shows the list on the page

function decode(text: string): string {
  return text.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
}

function renderView(context: AskContext, copyState: CopyState): { textarea: string | null; status: string | null; questions: string[] } {
  const html = renderToStaticMarkup(createElement(AskYourInsurerView, { context, copyState, onCopy: () => {}, onPrint: () => {} }))
  const box = /<textarea[^>]*>([\s\S]*?)<\/textarea>/.exec(html)
  const status = /role="status"[^>]*>([\s\S]*?)<\/p>/.exec(html)
  const questions = [...html.matchAll(/<li[^>]*data-item="[^"]+"[^>]*><p class="font-medium">([\s\S]*?)<\/p>/g)].map((match) => decode(match[1]))
  return { textarea: box ? decode(box[1]) : null, status: status ? visibleText(status[1]) : null, questions }
}

test("copy: a denied clipboard asks for a manual copy; a missing one too; a working one copies that text", async () => {
  const denied = { writeText: () => Promise.reject(new Error("denied")) }
  assert.deepEqual(await copyChecklist("a list", denied), { kind: "manual" })
  assert.deepEqual(await copyChecklist("a list", undefined), { kind: "manual" })
  let written = ""
  const works = { writeText: async (text: string) => void (written = text) }
  assert.deepEqual(await copyChecklist("a list", works), { kind: "copied", text: "a list" })
  assert.equal(written, "a list")
})

test("copy denied, then the state changes: the text box matches the list now on the page", async () => {
  const tx = teenIn("TX")
  const state = await copyChecklist(askPlainText(askItems(tx)), { writeText: () => Promise.reject(new Error("denied")) })
  const before = renderView(tx, state)
  assert.equal(before.textarea, askPlainText(askItems(tx)))
  assert.match(before.status ?? "", /Select the text below/)
  // The visitor moves to California, where credit is banned.
  const ca = teenIn("CA")
  const after = renderView(ca, state)
  assert.equal(after.textarea, askPlainText(askItems(ca)))
  assert.doesNotMatch(after.textarea ?? "", /credit/i)
  for (const question of after.questions) assert.ok(after.textarea?.includes(question), question)
  assert.equal(after.questions.length, askItems(ca).length)
})

test("'Copied' shows only while the copied text is still the list on the page", () => {
  const tx = teenIn("TX")
  const copied: CopyState = { kind: "copied", text: askPlainText(askItems(tx)) }
  assert.match(renderView(tx, copied).status ?? "", /^Copied/)
  const moved = renderView(teenIn("CA"), copied)
  assert.equal(moved.status, null)
  assert.equal(moved.textarea, null)
})
