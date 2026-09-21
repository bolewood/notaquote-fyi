import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  CORRECTION_CATEGORIES,
  CORRECTION_PAGES,
  correctionHttpStatus,
  correctionInsertBody,
  correctionsQueueLive,
  parseCorrection,
  submitCorrection,
} from "./corrections"

const liveEnv = {
  SUPABASE_URL: "https://exampleproject.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-not-a-real-secret",
} as NodeJS.ProcessEnv

const row = {
  state: "IL",
  page: "sources",
  sourceUrl: "https://www.ilga.gov/Documents/legislation/ilcs/documents/062500050K7-203.htm",
  category: "wrong-minimum",
}

test("the queue is not live without operator credentials", () => {
  assert.equal(correctionsQueueLive({} as NodeJS.ProcessEnv), false)
  assert.equal(correctionsQueueLive({ SUPABASE_URL: "https://example.supabase.co" } as NodeJS.ProcessEnv), false)
  assert.equal(
    correctionsQueueLive({
      SUPABASE_URL: "http://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-not-a-real-secret",
    } as NodeJS.ProcessEnv),
    false,
  )
  assert.equal(correctionsQueueLive(liveEnv), true)
})

test("a correction is state, page, source URL, and one category", () => {
  const parsed = parseCorrection(row)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const body = correctionInsertBody(parsed.row)
  assert.deepEqual(Object.keys(body).sort(), ["category", "page", "source_url", "state"])
  assert.equal(body.state, "IL")
  assert.equal(body.page, "sources")
  assert.equal(body.category, "wrong-minimum")
  assert.equal(body.source_url.startsWith("https://www.ilga.gov/"), true)
  assert.deepEqual(
    CORRECTION_CATEGORIES.map((item) => item.label),
    ["Wrong minimum", "Stale source", "Vehicle mapping", "Display error", "Other"],
  )
  assert.equal(CORRECTION_PAGES.some((item) => item.id === "sources"), true)
})

test("identity fields, notes, a carrier, and a premium are rejected", () => {
  const extras = [
    { ...row, name: "Ada" },
    { ...row, email: "ada@example.com" },
    { ...row, phone: "555-0100" },
    { ...row, carrier: "Example Mutual" },
    { ...row, premium: 1800 },
    { ...row, note: "Please call me" },
    { ...row, message: "A longer story" },
    { ...row, vin: "1FTFW1E50MFC12345" },
    { ...row, scenario: { state: "IL" } },
  ]
  for (const input of extras) {
    assert.equal(parseCorrection(input).ok, false)
  }
  assert.equal(parseCorrection({ ...row, sourceUrl: "This is a note, not a URL" }).ok, false)
  assert.equal(parseCorrection({ ...row, sourceUrl: "javascript:alert(1)" }).ok, false)
  assert.equal(parseCorrection({ ...row, sourceUrl: "mailto:ada@example.com" }).ok, false)
  assert.equal(parseCorrection({ ...row, page: "a free text page name" }).ok, false)
  assert.equal(parseCorrection({ ...row, category: "other story" }).ok, false)
  assert.equal(parseCorrection({ ...row, state: "Illinois" }).ok, false)
})

test("a missing queue does not report a saved row, and a failed write does not either", async () => {
  let calls = 0
  const absent = await submitCorrection(row, {} as NodeJS.ProcessEnv, async () => {
    calls += 1
    throw new Error("should not be called")
  })
  assert.deepEqual(absent, { saved: false, reason: "not-live" })
  assert.equal(calls, 0)
  assert.equal(correctionHttpStatus(absent), 503)

  const refused = await submitCorrection(
    { ...row, email: "ada@example.com" },
    liveEnv,
    async () => {
      calls += 1
      throw new Error("should not be called")
    },
  )
  assert.deepEqual(refused, { saved: false, reason: "invalid" })
  assert.equal(calls, 0)

  const failed = await submitCorrection(row, liveEnv, async () => {
    calls += 1
    return new Response("no", { status: 401 })
  })
  assert.deepEqual(failed, { saved: false, reason: "not-saved" })
  assert.equal(calls, 1)
  assert.equal(correctionHttpStatus(failed), 502)

  const thrown = await submitCorrection(row, liveEnv, async () => {
    throw new Error("network")
  })
  assert.deepEqual(thrown, { saved: false, reason: "not-saved" })
})

test("a live write sends only the four queue columns", async () => {
  let sent = ""
  const result = await submitCorrection(row, liveEnv, async (_url, init) => {
    sent = String(init?.body ?? "")
    return new Response(null, { status: 201 })
  })
  assert.deepEqual(result, { saved: true })
  assert.equal(correctionHttpStatus(result), 201)
  const body = JSON.parse(sent) as Record<string, unknown>
  assert.deepEqual(Object.keys(body).sort(), ["category", "page", "source_url", "state"])
  assert.equal(JSON.stringify(body).includes("premium"), false)
  assert.equal(JSON.stringify(body).includes("email"), false)
  assert.equal(sent.includes(liveEnv.SUPABASE_SERVICE_ROLE_KEY ?? "missing"), false)
})

test("the form has no identity, premium, carrier, or free-text field", () => {
  const form = readFileSync("src/components/corrections-form.tsx", "utf8")
  const page = readFileSync("src/app/corrections/page.tsx", "utf8")
  const combined = `${form}\n${page}`
  assert.match(combined, /The corrections queue is not live/)
  assert.doesNotMatch(combined, /<textarea/i)
  assert.doesNotMatch(combined, /type="email"|type="tel"|type="password"/i)
  for (const name of ["name", "email", "phone", "carrier", "premium", "message", "note", "comment", "vin"]) {
    assert.equal(combined.includes(`name="${name}"`), false, name)
  }
  assert.match(form, /name="state"/)
  assert.match(form, /name="page"/)
  assert.match(form, /name="sourceUrl"/)
  assert.match(form, /name="category"/)
  assert.match(form, /CORRECTION_CATEGORIES/)
  assert.equal(form.includes("SUPABASE"), false)
  assert.equal(form.includes("submitCorrection"), false)
  const queue = readFileSync("src/lib/correction-fields.ts", "utf8")
  assert.match(queue, /Wrong minimum/)
  assert.match(queue, /Stale source/)
  assert.match(queue, /Vehicle mapping/)
  assert.match(queue, /Display error/)
  assert.match(queue, /label: "Other"/)
})
