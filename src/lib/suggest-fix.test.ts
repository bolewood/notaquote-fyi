import assert from "node:assert/strict"
import test from "node:test"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import {
  cleanPagePath,
  cleanSourceUrl,
  cleanValue,
  FIELD_MAX,
  FIX_KINDS,
  FIX_TEMPLATES,
  GITHUB_REPO_URL,
  suggestFixUrl,
} from "./suggest-fix"

const TEMPLATE_DIR = path.join(process.cwd(), ".github", "ISSUE_TEMPLATE")

function params(url: string): URLSearchParams {
  return new URL(url).searchParams
}

function templateText(file: string): string {
  return readFileSync(path.join(TEMPLATE_DIR, file), "utf8")
}

test("every kind opens a new issue with an issue form that exists", () => {
  for (const kind of FIX_KINDS) {
    const url = suggestFixUrl({ kind })
    assert.ok(url.startsWith(`${GITHUB_REPO_URL}/issues/new?`), url)
    const file = params(url).get("template")
    assert.equal(file, FIX_TEMPLATES[kind].file)
    assert.ok(existsSync(path.join(TEMPLATE_DIR, file!)), `missing ${file}`)
  }
})

test("prefilled field ids match ids in the issue form, since GitHub ignores unknown ones", () => {
  for (const kind of FIX_KINDS) {
    const text = templateText(FIX_TEMPLATES[kind].file)
    const ids = new Set([...text.matchAll(/^\s+id:\s*([A-Za-z0-9_-]+)\s*$/gm)].map((m) => m[1]))
    for (const field of FIX_TEMPLATES[kind].fields) {
      assert.ok(ids.has(field), `${FIX_TEMPLATES[kind].file} has no field with id "${field}"`)
    }
  }
})

test("the title prefix matches each form's default title", () => {
  for (const kind of FIX_KINDS) {
    const text = templateText(FIX_TEMPLATES[kind].file)
    const match = text.match(/^title:\s*"(.*)"\s*$/m)
    assert.ok(match, `${FIX_TEMPLATES[kind].file} has no default title`)
    assert.equal(match[1], FIX_TEMPLATES[kind].titlePrefix)
  }
})

test("a factor link prefills the title and the allowed fields", () => {
  const url = suggestFixUrl({
    kind: "factor",
    title: "Teen driver adjustment",
    fields: {
      factor: "Teen driver adjustment",
      page: "/methodology",
      shown: "1.80",
      source_url: "https://insurance.example.gov/auto/rate-guide",
    },
  })
  const p = params(url)
  assert.equal(p.get("title"), "Number looks wrong: Teen driver adjustment")
  assert.equal(p.get("factor"), "Teen driver adjustment")
  assert.equal(p.get("page"), "/methodology")
  assert.equal(p.get("shown"), "1.80")
  assert.equal(
    p.get("source_url"),
    "https://insurance.example.gov/auto/rate-guide",
  )
})

test("field ids that aren't on the form are not sent", () => {
  const url = suggestFixUrl({
    kind: "vehicle",
    title: "2025 Tesla Model Y",
    fields: {
      vehicle: "2025 Tesla Model Y",
      // Not a field on the vehicle form; a caller bypassing the types must not leak it.
      ...({ premium: "1850", vin: "whatever", body: "free text" } as Record<string, string>),
    },
  })
  const p = params(url)
  assert.equal(p.get("vehicle"), "2025 Tesla Model Y")
  assert.equal(p.has("premium"), false)
  assert.equal(p.has("vin"), false)
  assert.equal(p.has("body"), false)
})

test("dollar amounts, VINs, emails, and phone numbers are dropped, never sent", () => {
  const vin = "1HGBH41JXMN109186"
  const url = suggestFixUrl({
    kind: "factor",
    title: `My premium is $1,850`,
    fields: {
      factor: `VIN ${vin}`,
      shown: "$1,850 a year",
      suggested: "me@example.com",
      page: "/",
    },
  })
  const p = params(url)
  assert.equal(p.has("title"), false)
  assert.equal(p.has("factor"), false)
  assert.equal(p.has("shown"), false)
  assert.equal(p.has("suggested"), false)
  assert.equal(p.get("page"), "/")
  const decoded = decodeURIComponent(url)
  assert.equal(decoded.includes("1,850"), false)
  assert.equal(decoded.includes(vin), false)
  assert.equal(decoded.includes("@example.com"), false)

  assert.equal(cleanValue("call 555-123-4567"), null)
  assert.equal(cleanValue(vin.toLowerCase()), null)
  assert.equal(cleanValue("$ 900"), null)
})

test("a share link used as the page keeps only the path, so the premium stays out", () => {
  const shareLink =
    "https://example.test/?share=1&mv=0.2.0&state=TX&year=2025&make=Tesla&car=Model+Y&anchor=1850#top"
  assert.equal(cleanPagePath(shareLink), "/")
  assert.equal(cleanPagePath("/methodology?anchor=1850"), "/methodology")

  const url = suggestFixUrl({ kind: "bug", fields: { page: shareLink, what_happened: "The table didn't sort" } })
  assert.equal(url.includes("anchor"), false)
  assert.equal(url.includes("1850"), false)
  assert.equal(params(url).get("page"), "/")
  assert.equal(params(url).get("what_happened"), "The table didn't sort")
})

test("source links must be public http(s) pages that aren't this site", () => {
  assert.equal(cleanSourceUrl("javascript:alert(1)"), null)
  assert.equal(cleanSourceUrl("not a url"), null)
  assert.equal(cleanSourceUrl("https://user:pass@example.gov/rule"), null)
  assert.equal(cleanSourceUrl("http://127.0.0.1:41731/"), null)
  assert.equal(cleanSourceUrl("https://notaquote.fyi/?anchor=1850"), null)
  assert.equal(
    cleanSourceUrl("https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/1HGBH41JXMN109186"),
    null,
  )
  assert.equal(
    cleanSourceUrl("https://statutes.example.gov/transportation/601.htm#601.072"),
    "https://statutes.example.gov/transportation/601.htm",
  )
})

test("long values are shortened so the link stays a reasonable length", () => {
  const long = "word ".repeat(400)
  const cleaned = cleanValue(long)!
  assert.ok(cleaned.length <= FIELD_MAX)
  assert.ok(cleaned.endsWith("…"))

  const url = suggestFixUrl({
    kind: "state-rule",
    title: long,
    fields: { state: long, rule: long, shown: long, suggested: long },
  })
  assert.ok(url.length < 4000, `url is ${url.length} characters`)
})

test("empty and whitespace-only values are left out", () => {
  const url = suggestFixUrl({ kind: "state-rule", title: "   ", fields: { state: "", rule: " \n " } })
  assert.deepEqual([...params(url).keys()], ["template"])
})
