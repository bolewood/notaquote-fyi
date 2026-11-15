/**
 * The live checker, end to end, with fetch mocked (test-support/mock-fetch.ts): a dead link fails
 * the run even on a site that sometimes needs a browser, and a browser exception stops excusing
 * its failure once it expires.
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test from "node:test"
import { BROWSER_EXCEPTIONS, fetchFailureStatus } from "./law"

const ROOT = path.resolve(__dirname, "../..")
const ILGA = "https://www.ilga.gov/legislation/ilcs/documents/021501570K20.htm"

function liveCheck(state: string, mock: object, today = "2026-11-15") {
  const run = spawnSync(
    process.execPath,
    ["--import", "tsx", "--import", "./scripts/rating-quotes/test-support/mock-fetch.ts", "scripts/check-rating-quotes.ts", "--live", "--state", state],
    { cwd: ROOT, encoding: "utf8", env: { ...process.env, MOCK_FETCH: JSON.stringify(mock), RATING_CHECK_TODAY: today, RATING_CHECK_NO_WAIT: "1" } },
  )
  const rows = run.stdout.split("\n").filter((line) => /^[A-Z_]+\s+[A-Z]{2}\s/.test(line))
  return { code: run.status, rows, out: run.stdout + run.stderr }
}

test("live: with every page answering, Illinois passes (the mock serves the saved copies)", () => {
  const run = liveCheck("IL", {})
  assert.equal(run.code, 0, run.out)
  assert.ok(run.rows.length > 0 && run.rows.every((row) => row.startsWith("OK")), run.out)
})

for (const status of [404, 410]) {
  test(`live: an HTTP ${status} fails the run, even for a page with a browser exception`, () => {
    const run = liveCheck("IL", { "www.ilga.gov": { status } })
    assert.equal(run.code, 1, run.out)
    const ilga = run.rows.filter((row) => row.includes("215 ILCS 157/20"))
    assert.ok(ilga.length > 0 && ilga.every((row) => row.startsWith("FETCH_FAILED")), run.out)
  })
}

test("live: a thin \"page not found\" served as 200 is fatal, not a JavaScript shell", () => {
  const body = "<html><body><script></script><p>Page not found</p></body></html>"
  const run = liveCheck("IL", { "www.ilga.gov": { status: 200, body } })
  assert.equal(run.code, 1, run.out)
  const ilga = run.rows.filter((row) => row.includes("215 ILCS 157/20"))
  assert.ok(ilga.length > 0 && ilga.every((row) => row.startsWith("FETCH_FAILED")), run.out)
})

test("live: a DNS failure is fatal", () => {
  const run = liveCheck("IL", { "www.ilga.gov": { errorCode: "ENOTFOUND" } })
  assert.equal(run.code, 1, run.out)
})

test("live: the one failure an exception names needs a browser until the exception expires, then fails", () => {
  const tls = { "www.ilga.gov": { errorCode: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } }
  const before = liveCheck("IL", tls, BROWSER_EXCEPTIONS[ILGA].expires)
  assert.equal(before.code, 0, before.out)
  assert.ok(before.rows.filter((row) => row.includes("215 ILCS 157/20")).every((row) => row.startsWith("NEEDS_BROWSER")), before.out)

  const after = liveCheck("IL", tls, "2099-01-01")
  assert.equal(after.code, 1, after.out)
  assert.ok(after.rows.filter((row) => row.includes("215 ILCS 157/20")).every((row) => row.startsWith("FETCH_FAILED")), after.out)
  assert.match(after.out, /expired/)
})

test("fetchFailureStatus: exceptions are per URL and per failure, and every one can expire", () => {
  const exceptions = {
    "https://example.gov/law": { reason: "test", lastVerified: "2026-11-01", expires: "2026-12-31", when: { status: 404 } },
  }
  const judge = (url: string, failure: object, today = "2026-11-15") =>
    fetchFailureStatus(url, { error: "x", ...failure }, today, exceptions).status
  assert.equal(judge("https://example.gov/law", { status: 404 }), "NEEDS_BROWSER")
  assert.equal(judge("https://example.gov/law", { status: 410 }), "FETCH_FAILED", "a different failure isn't excused")
  assert.equal(judge("https://example.gov/other", { status: 404 }), "FETCH_FAILED", "the same site's other pages aren't excused")
  assert.equal(judge("https://example.gov/law", { status: 404 }, "2027-01-01"), "FETCH_FAILED", "expired")
  assert.equal(judge("https://example.gov/x", { needsBrowser: true }), "NEEDS_BROWSER", "a bot check")
  for (const [url, exception] of Object.entries(BROWSER_EXCEPTIONS)) {
    assert.match(url, /^https:\/\/[^#]+$/, "an exact URL")
    assert.ok(exception.reason.length > 20, url)
    assert.match(exception.lastVerified, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(exception.expires > exception.lastVerified && exception.expires <= "2027-12-31", `${url}: an exception lasts months, not years`)
  }
})
