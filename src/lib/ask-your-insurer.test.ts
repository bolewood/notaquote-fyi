import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement, createRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AskYourInsurer } from "../components/ask-your-insurer"
import { WhatIfResult } from "../components/calculator"
import TeenCostGuide from "../app/guides/adding-a-teen-driver/page"
import { ASK_ITEMS, askContext, askItems, askPlainText, type AskContext } from "./ask-your-insurer"
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts } from "./catalog-class"
import { priceWhatIf } from "./pricing"
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

test("credit shows only where the state's rule is reviewed and isn't a ban", () => {
  for (const state of ["CA", "HI", "MA"] as const) assert.ok(!ids({ teen: null, state }).includes("credit-renewal"), state)
  // Not reviewed yet: never read as allowed.
  for (const state of ["GA", "MT", "NY", "PA"] as const) assert.ok(!ids({ teen: null, state }).includes("credit-renewal"), state)
  for (const state of ["TX", "OH", "WI", "NJ"] as const) assert.ok(ids({ teen: null, state }).includes("credit-renewal"), state)
  // No state (a guide): no credit question.
  assert.ok(!ids({ teen: "added" }).includes("credit-renewal"))
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
      "2. Would a defensive-driving course remove or reduce the extra charge for a ticket or accident?",
      "   Why we're asking: Some insurers lower that charge, or give a discount, after an approved course. It's worth asking before you sign up for one.",
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
      ask: askContext(next, situation.teenOnParentPolicy),
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
