import assert from "node:assert/strict"
import test from "node:test"
import {
  citations,
  cutText,
  decodeEntities,
  elementHtml,
  extractSection,
  formatSnapshot,
  htmlToText,
  looksLikeBotCheck,
  normalizeText,
  parseSnapshot,
  quoteFound,
  quoteParts,
  reflowPdfText,
  sectionNumber,
  sectionTitle,
  shortDiff,
  snapshotSlug,
  summaryTable,
} from "./law"

test("normalizing: whitespace, curly quotes, dashes, ellipses, and § all compare equal", () => {
  assert.equal(normalizeText("  the\n\tinsured’s  “driving” record "), `the insured's "driving" record`)
  assert.equal(normalizeText("§27–501 and §§ 1861.02—1861.05"), "§ 27-501 and §§ 1861.02-1861.05")
  assert.equal(normalizeText("§   1861.02"), normalizeText("§1861.02"))
  assert.equal(normalizeText("a … b"), "a ... b")
  assert.equal(normalizeText("Sec.&nbsp;559.052 &sect; 1 &#8217; &#x2014;"), "Sec. 559.052 § 1 ' -")
  assert.equal(normalizeText("non­credit"), "noncredit")
  assert.equal(normalizeText("Credit"), "Credit", "case is kept: a quote is copied exactly")
})

test("a quote is found once normalized; with '...' its parts must appear in order", () => {
  const law = "(4) Those other factors that the commissioner may adopt by regulation. The regulations shall set forth the weight. Notwithstanding any other provision of law, the use of any criterion without approval shall constitute unfair discrimination."
  assert.equal(quoteFound("Those other factors that the commissioner may adopt by regulation.", law), true)
  assert.equal(quoteFound("Those  other factors\nthat the commissioner", law), true)
  assert.equal(quoteFound("Those other factors that the commissioner may adopt by regulation. ... Notwithstanding any other provision of law", law), true)
  assert.equal(quoteFound("Those other factors … unfair discrimination.", law), true)
  assert.equal(quoteFound("unfair discrimination. ... Those other factors", law), false, "parts out of order")
  assert.equal(quoteFound("the commissioner shall not adopt", law), false)
  assert.equal(quoteFound("...", law), false, "an empty quote never passes")
  assert.equal(quoteFound("the insured’s record", "the insured's record"), true)
  assert.deepEqual(quoteParts("a ... b … c"), ["a", "b", "c"])
})

test("HTML to text drops scripts and styles, keeps one line per block, and decodes entities", () => {
  const html = `<html><head><title>x</title><style>p{}</style></head><body><script>var a = "<p>no</p>"</script>
    <p>(a) An insurer
       may not use &ldquo;credit&rdquo;.</p><div>(b) Second&nbsp;line<br>third</div><!-- hidden --></body></html>`
  assert.equal(htmlToText(html), "(a) An insurer may not use “credit”.\n\n(b) Second line\nthird")
  assert.equal(decodeEntities("&amp;&lt;&#167;&unknown;"), "&<§&unknown;")
})

test("elementHtml finds an element by id or class, including nested tags of the same name", () => {
  const html = `<div id="nav">menu</div><div class="a statereg-text b"><div>one</div><div>two</div></div><div>after</div>`
  assert.equal(elementHtml(html, { className: "statereg-text" }), "<div>one</div><div>two</div>")
  assert.equal(elementHtml(html, { id: "nav" }), "menu")
  assert.equal(elementHtml(html, { id: "missing" }), null)
  assert.equal(elementHtml("<body class='x'><p>hi</p></body>", { tag: "body" }), "<p>hi</p>")
})

test("cutting a section out of a chapter stops at the next section", () => {
  const chapter = "Sec. 559.051. DEFINITIONS. x\nSec. 559.052. PROHIBITED USE OF CREDIT. (a) An insurer may not:\n(1) one\nSec. 559.053. NEXT. y"
  assert.equal(cutText(chapter, /^Sec\.\s+559\.052\./m, /^Sec\. \d+\.\d+\./m), "Sec. 559.052. PROHIBITED USE OF CREDIT. (a) An insurer may not:\n(1) one")
  assert.equal(cutText(chapter, /^Sec\. 9\./m), null)
})

test("extractSection cuts the cited section, and spots bot checks and empty pages", () => {
  const tx = `<html><body><div id="docViewer"><p>Sec. 559.051. DEFINITIONS. In this chapter a word means something long enough to count.</p>
    <p>Sec. 559.052. PROHIBITED USE OF CREDIT INFORMATION. (a) An insurer may not deny a policy solely on the basis of credit information.</p>
    <p>Sec. 559.053. NEXT.</p></div></body></html>`
  const got = extractSection("https://statutes.capitol.texas.gov/Docs/IN/htm/IN.559.htm", tx, "Tex. Ins. Code § 559.052(a)(2)")
  assert.ok("text" in got)
  assert.match(got.text, /^Sec\. 559\.052\./)
  assert.doesNotMatch(got.text, /559\.053|DEFINITIONS/)

  const challenge = "<html><head><title>Just a moment...</title></head><body>Enable JavaScript and cookies to continue</body></html>"
  const blocked = extractSection("https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=INS&sectionNum=1861.02", challenge, "x")
  assert.ok("error" in blocked && blocked.needsBrowser)
  assert.equal(looksLikeBotCheck(challenge), true)

  const shell = `<html><body><app-root></app-root><script src="main.js"></script></body></html>`
  const empty = extractSection("https://statutes.capitol.texas.gov/Docs/IN/htm/IN.559.htm", shell, "Tex. Ins. Code § 559.052")
  assert.ok("error" in empty && empty.needsBrowser, "a JavaScript app shell needs a browser")

  const unknown = extractSection("https://example.com/law", "<p>text</p>", "x")
  assert.ok("error" in unknown && /SITE_RULES/.test(unknown.error))
})

test("PDF text is joined back into paragraphs at numbered items", () => {
  const pdf = "100.     USE OF CREDIT FACTORS.\n\n     01.   Application. To determine whether\na decision is based on credit:   (3-31-22)\n   a.  If an insurer\ndeclines to issue"
  assert.equal(
    reflowPdfText(pdf),
    "100. USE OF CREDIT FACTORS.\n\n01. Application. To determine whether a decision is based on credit: (3-31-22)\na. If an insurer declines to issue",
  )
})

test("titles and file names come from the label, without subsections", () => {
  assert.equal(sectionTitle("Cal. Ins. Code § 1861.02(a)"), "Cal. Ins. Code § 1861.02")
  assert.equal(sectionTitle("10 CCR § 2632.5(d), the list of optional factors"), "10 CCR § 2632.5")
  assert.equal(sectionTitle("Md. Code, Ins. § 27-501(e-2)(3)"), "Md. Code, Ins. § 27-501")
  assert.equal(sectionTitle("Mich. Comp. Laws § 500.2111(4)-(5)"), "Mich. Comp. Laws § 500.2111")
  assert.equal(sectionTitle("IDAPA 18.02.01.100.01.b"), "IDAPA 18.02.01.100")
  assert.equal(snapshotSlug("Cal. Ins. Code § 1861.02"), "cal-ins-code-1861.02")
  assert.equal(snapshotSlug("Haw. Rev. Stat. § 431:10C-207"), "haw-rev-stat-431-10c-207")
  assert.equal(snapshotSlug("Md. Code, Ins. § 27-501"), "md-code-ins-27-501")
  assert.equal(sectionNumber("Tex. Ins. Code § 559.052(a)(2)"), "559.052")
  assert.equal(sectionNumber("Haw. Rev. Stat. § 431:10C-207"), "431:10C-207")
})

test("a snapshot's front matter survives a round trip, URLs with ? & : included", () => {
  const meta = {
    url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=INS&sectionNum=1861.02",
    title: 'Cal. Ins. Code § 1861.02 "quoted"',
    retrieved: "2026-11-15",
    fetchedWith: "browser" as const,
    site: "California Legislative Information",
    mirror: "a mirror: not official",
  }
  const file = formatSnapshot(meta, "1861.02.\n(a) Rates and premiums\n\n\n(b) Every person")
  const back = parseSnapshot(file)
  assert.deepEqual(back.meta, meta)
  assert.equal(back.body, "1861.02.\n\n(a) Rates and premiums\n\n(b) Every person")
  assert.throws(() => parseSnapshot("no front matter"), /front matter/)
  assert.throws(() => parseSnapshot(file.replace('"browser"', '"curl"')), /fetchedWith/)
  assert.throws(() => parseSnapshot(file.replace(/^title: .*$/m, "")), /title/)
})

test("citations lists every main source and every extra source", () => {
  const rule = { source: { label: "A", url: "https://a" }, quote: "qa", moreSources: [{ label: "B", url: "https://b", quote: "qb" }] }
  const list = citations({ states: { CA: { credit: rule }, TX: { credit: { ...rule, moreSources: undefined } } } })
  assert.deepEqual(
    list.map((cite) => `${cite.state} ${cite.where} ${cite.url}`),
    ["CA source https://a", "CA more source 1 https://b", "TX source https://a"],
  )
  assert.equal(citations({ states: { CA: { credit: rule }, TX: { credit: rule } } }, "TX").length, 2)
})

test("shortDiff shows where two texts part, and nothing when they match once normalized", () => {
  assert.equal(shortDiff("the insurer’s  rate", "the insurer's rate"), null)
  const diff = shortDiff("An insurer may not use credit to set a rate.", "An insurer may use credit to set a rate.")
  assert.ok(diff)
  assert.match(diff, /saved: "not"/)
  assert.match(diff, /live: {2}\(nothing\)/)
})

test("the summary table lists each result and the counts", () => {
  const table = summaryTable([
    { status: "OK", state: "CA", what: "credit" },
    { status: "MISSING", state: "TX", what: "credit", note: "x" },
    { status: "OK", state: "HI", what: "age" },
  ])
  assert.match(table, /^Status\s+State\s+What\s+Note/)
  assert.match(table, /MISSING\s+TX\s+credit\s+x/)
  assert.match(table, /Total 3\. OK: 2, MISSING: 1/)
})
