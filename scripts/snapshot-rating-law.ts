/**
 * Save the text of each law cited in data/state-rules/rating-rules.json as
 * data/state-rules/law/<STATE>/<slug>.md, one file per cited page: the cited
 * section only, never a whole code.
 *
 *   npm run rules:snapshot                       every cited law
 *   npm run rules:snapshot -- --state TX         one state
 *   npm run rules:snapshot -- --url <url> --page <file>
 *       save a page you opened in a real browser (for NEEDS_BROWSER sites)
 *
 * Some sites send a bot check now and then, or build the page with JavaScript
 * (SITE_RULES' needsBrowser). When a fetch gets one of those, open the page
 * in a browser, save its HTML (in DevTools: copy
 * document.documentElement.outerHTML to a file), and pass it with --page.
 * A failed fetch never overwrites or deletes a saved copy, and a copy whose
 * text hasn't changed is left exactly as it is (front matter included).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { citations, extractSection, formatSnapshot, normalizeText, SITE_RULES, sectionTitle, snapshotSlug, type Citation } from "./rating-quotes/law"
import { fetchPage, flagValue, LAW_DIR, loadSnapshots, readRulesFile, ROOT } from "./rating-quotes/store"
import { todayIso } from "../src/lib/state-rules"

type Row = { url: string; state: string; result: string; note: string }

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const onlyState = flagValue(args, "--state")?.toUpperCase()
  const pageFile = flagValue(args, "--page")
  const onlyUrl = flagValue(args, "--url")
  if (pageFile && !onlyUrl) throw new Error("--page needs --url, the address the page came from")

  const rules = readRulesFile()
  const all = citations(rules, onlyState)
  const byUrl = new Map<string, Citation[]>()
  for (const cite of all) byUrl.set(cite.url, [...(byUrl.get(cite.url) ?? []), cite])
  if (onlyUrl && !byUrl.has(onlyUrl)) throw new Error(`no rule cites ${onlyUrl}`)

  const existing = loadSnapshots()
  const rows: Row[] = []
  for (const [url, cites] of byUrl) {
    if (onlyUrl && url !== onlyUrl) continue
    const states = [...new Set(cites.map((cite) => cite.state))]
    if (states.length > 1) {
      rows.push({ url, state: states.join(","), result: "SKIPPED", note: "cited by more than one state; give each its own snapshot folder by hand" })
      continue
    }
    const state = states[0]
    const label = cites[0].label
    const host = new URL(url).host
    const site = SITE_RULES[host]
    if (!site) {
      rows.push({ url, state, result: "NO_SITE_RULE", note: `add ${host} to SITE_RULES in scripts/rating-quotes/law.ts` })
      continue
    }
    const saved = existing.get(url)

    let page: string
    let isPdfText = false
    let fetchedWith: "fetch" | "browser"
    if (pageFile) {
      const raw = readFileSync(pageFile, "utf8")
      // A page saved by a browser tool may arrive as one JSON string.
      page = raw.trimStart().startsWith('"') ? (JSON.parse(raw) as string) : raw
      fetchedWith = "browser"
    } else {
      const fetched = await fetchPage(url)
      if (!fetched.ok) {
        rows.push(keepOrAsk(url, state, saved?.meta.retrieved, fetched.needsBrowser || site.needsBrowser ? "NEEDS_BROWSER" : "FETCH_FAILED", fetched.error))
        continue
      }
      page = fetched.body
      isPdfText = fetched.isPdfText
      fetchedWith = "fetch"
    }

    const extracted = extractSection(url, page, label, isPdfText)
    if ("error" in extracted) {
      rows.push(keepOrAsk(url, state, saved?.meta.retrieved, extracted.needsBrowser ? "NEEDS_BROWSER" : "FAILED", extracted.error))
      continue
    }
    const title = sectionTitle(label)
    const file = saved ? path.join(ROOT, saved.file) : path.join(LAW_DIR, state, `${snapshotSlug(title)}.md`)
    if (saved && normalizeText(saved.body) === normalizeText(extracted.text)) {
      rows.push({ url, state, result: "UNCHANGED", note: path.relative(ROOT, file) })
      continue
    }
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(
      file,
      formatSnapshot(
        {
          url,
          title,
          retrieved: todayIso(),
          fetchedWith,
          site: site.site,
          ...(site.mirror ? { mirror: site.mirror } : {}),
          ...(saved?.meta.sourceTerms ? { sourceTerms: saved.meta.sourceTerms } : site.terms ? { sourceTerms: site.terms } : {}),
        },
        extracted.text,
      ),
    )
    rows.push({ url, state, result: saved ? "UPDATED" : "WROTE", note: `${path.relative(ROOT, file)} (${fetchedWith})` })
  }

  for (const row of rows) console.log(`${row.result.padEnd(13)} ${row.state}  ${row.url}\n${" ".repeat(17)}${row.note}`)
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.result, (counts.get(row.result) ?? 0) + 1)
  console.log(`\n${[...counts].map(([result, count]) => `${result}: ${count}`).join(", ")}`)
  if (rows.some((row) => ["FAILED", "NO_SITE_RULE", "SKIPPED"].includes(row.result))) process.exitCode = 1
}

/** A failed fetch never touches a saved copy: say it's kept, or what to do. */
function keepOrAsk(url: string, state: string, savedOn: string | undefined, result: string, error: string): Row {
  if (result === "NEEDS_BROWSER") {
    return {
      url,
      state,
      result: savedOn ? "KEPT" : result,
      note: `${error}. ${savedOn ? `Kept the copy saved on ${savedOn}.` : "Open it in a browser, save the HTML, then rerun with --url and --page."}`,
    }
  }
  return { url, state, result: savedOn && result === "FETCH_FAILED" ? "KEPT" : result, note: savedOn ? `${error}. Kept the copy saved on ${savedOn}.` : error }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
