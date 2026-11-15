/**
 * Check that every quote in data/state-rules/rating-rules.json is really in the law it cites.
 *
 *   npm run rules:check-quotes                   offline: against the saved copies in data/state-rules/law
 *   npm run rules:check-quotes -- --live         fetch each law and compare it with the saved copy
 *   npm run rules:check-quotes -- --state TX     one state (either mode)
 *
 * Results: OK, MISSING (the quote isn't in the law's text), NO_SNAPSHOT (no
 * saved copy yet: run `npm run rules:snapshot`), CHANGED (live only: the law's
 * text no longer matches the saved copy), FETCH_FAILED, and NEEDS_BROWSER (the
 * site sent a bot check or builds the page with JavaScript, so check it by hand).
 *
 * Exits non-zero on MISSING or NO_SNAPSHOT (offline), or MISSING, CHANGED, or
 * FETCH_FAILED (live: a dead link, a page whose layout no longer matches its
 * site rule, or a site still failing after retries). NEEDS_BROWSER (a bot
 * check) is reported, never fatal.
 */
import { citations, extractSection, fatalStatuses, quoteFound, shortDiff, SITE_RULES, summaryTable, type CheckStatus, type Citation } from "./rating-quotes/law"
import { fetchPage, flagValue, loadSnapshots, readRulesFile } from "./rating-quotes/store"

type Row = { status: CheckStatus; state: string; what: string; note?: string }

function what(cite: Citation): string {
  return `${cite.factor} (${cite.where}): ${cite.label}`
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const live = args.includes("--live")
  const onlyState = flagValue(args, "--state")?.toUpperCase()
  const all = citations(readRulesFile(), onlyState)
  if (all.length === 0) throw new Error(onlyState ? `no rules for ${onlyState}` : "no rules found")
  const snapshots = loadSnapshots()
  const rows: Row[] = []
  const diffs: string[] = []

  if (!live) {
    for (const cite of all) {
      const saved = snapshots.get(cite.url)
      if (!saved) {
        rows.push({ status: "NO_SNAPSHOT", state: cite.state, what: what(cite), note: `run: npm run rules:snapshot -- --state ${cite.state}` })
      } else {
        rows.push({ status: quoteFound(cite.quote, saved.body) ? "OK" : "MISSING", state: cite.state, what: what(cite), note: saved.file })
      }
    }
  } else {
    const byUrl = new Map<string, Citation[]>()
    for (const cite of all) byUrl.set(cite.url, [...(byUrl.get(cite.url) ?? []), cite])
    for (const [url, cites] of byUrl) {
      process.stderr.write(`fetching ${url}\n`)
      const fetched = await fetchPage(url)
      let liveText: string | null = null
      let problem: Row["status"] | null = null
      let note = ""
      if (!fetched.ok) {
        // Same rule as the snapshot script: a site known to need a browser is checked by hand, not failed.
        problem = fetched.needsBrowser || SITE_RULES[new URL(url).host]?.needsBrowser ? "NEEDS_BROWSER" : "FETCH_FAILED"
        note = fetched.error
      } else {
        const extracted = extractSection(url, fetched.body, cites[0].label, fetched.isPdfText)
        if ("error" in extracted) {
          problem = extracted.needsBrowser ? "NEEDS_BROWSER" : "FETCH_FAILED"
          note = extracted.error
        } else {
          liveText = extracted.text
        }
      }
      const saved = snapshots.get(url)
      const diff = liveText !== null && saved ? shortDiff(saved.body, liveText) : null
      if (diff) diffs.push(`${cites[0].state} ${cites[0].label}\n${url}\n${diff}`)
      for (const cite of cites) {
        if (problem) {
          rows.push({ status: problem, state: cite.state, what: what(cite), note })
        } else if (!quoteFound(cite.quote, liveText ?? "")) {
          rows.push({ status: "MISSING", state: cite.state, what: what(cite), note: "not in today's page" })
        } else if (!saved) {
          rows.push({ status: "NO_SNAPSHOT", state: cite.state, what: what(cite), note: `found live; run: npm run rules:snapshot -- --state ${cite.state}` })
        } else if (diff) {
          rows.push({ status: "CHANGED", state: cite.state, what: what(cite), note: "quote still there; the law's text moved (see below)" })
        } else {
          rows.push({ status: "OK", state: cite.state, what: what(cite) })
        }
      }
    }
  }

  console.log(`Rating rule quotes, ${live ? "live" : "offline, against data/state-rules/law"}${onlyState ? `, ${onlyState} only` : ""}\n`)
  console.log(summaryTable(rows))
  if (diffs.length > 0) console.log(`\nWhat changed:\n\n${diffs.join("\n\n")}`)
  const fatal = fatalStatuses(live)
  if (rows.some((row) => fatal.includes(row.status))) {
    console.log(`\nSomething needs a look: ${fatal.join(" or ")} above. See data/state-rules/README.md.`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(2)
})
