/**
 * The offline quote check, as part of `npm test`: every quote in
 * data/state-rules/rating-rules.json must be in the saved copy of the law it
 * cites (data/state-rules/law). No network.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { citations, quoteFound } from "./law"
import { loadSnapshots, readRulesFile } from "./store"

const cites = citations(readRulesFile())
const snapshots = loadSnapshots()

test("every cited law has exactly one saved copy, in its state's folder", () => {
  assert.ok(cites.length > 0)
  for (const cite of cites) {
    const saved = snapshots.get(cite.url)
    assert.ok(
      saved,
      `${cite.state} ${cite.factor} (${cite.where}) cites ${cite.url}, which has no saved copy. Run: npm run rules:snapshot -- --state ${cite.state}`,
    )
    assert.equal(saved.state, cite.state, `${saved.file} should be under data/state-rules/law/${cite.state}/`)
  }
})

test("every quote is in the saved copy of its law", () => {
  for (const cite of cites) {
    const saved = snapshots.get(cite.url)
    if (!saved) continue // reported above
    assert.ok(
      quoteFound(cite.quote, saved.body),
      `${cite.state} ${cite.factor} (${cite.where}): the quote isn't in ${saved.file}. Copy it exactly from the law, or re-save the law with npm run rules:snapshot -- --state ${cite.state}.`,
    )
  }
})

test("every saved copy is cited by a rule, and says where it came from", () => {
  const cited = new Set(cites.map((cite) => cite.url))
  for (const [url, saved] of snapshots) {
    assert.ok(cited.has(url), `${saved.file} isn't cited by any rule any more. Delete it.`)
    assert.match(saved.meta.url, /^https:\/\//)
    if (/law\.cornell\.edu|law\.justia\.com|case\.law|public\.law|casetext\.com|courtlistener\.com/.test(url)) {
      assert.ok(saved.meta.mirror, `${saved.file} comes from a mirror; say so in "mirror"`)
    }
    assert.ok(saved.body.length >= 80, `${saved.file} is nearly empty`)
  }
})
