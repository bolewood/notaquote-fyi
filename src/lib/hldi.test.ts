import assert from "node:assert/strict"
import test from "node:test"
import { SERVER_CATALOG } from "./agent-catalog"
import { carFigures, carPages, MODELS_ENABLED } from "./car-pages"
import {
  HLDI_RATING_BANDS,
  hldiDataLine,
  hldiShortLine,
  hldiPercentWords,
  hldiRating,
  hldiReport,
  priceMeaning,
  shareCounted,
  shareWords,
} from "./hldi"

test("HLDI's five ratings, with the provisional cutoffs at their edges", () => {
  assert.equal(HLDI_RATING_BANDS.length, 5)
  assert.equal(hldiRating(50), "Substantially better than average")
  assert.equal(hldiRating(51), "Better than average")
  assert.equal(hldiRating(79), "Better than average")
  assert.equal(hldiRating(80), "Average")
  assert.equal(hldiRating(122), "Average")
  assert.equal(hldiRating(123), "Worse than average")
  assert.equal(hldiRating(149), "Worse than average")
  assert.equal(hldiRating(150), "Substantially worse than average")
  // A middle value is rounded first, so it never falls between bands.
  assert.equal(hldiRating(79.5), "Average")
  assert.equal(hldiRating(122.4), "Average")
})

test("HLDI's percent is 100 minus the index; injury results are how often claims are filed", () => {
  assert.equal(hldiPercentWords(79), "21% better than average")
  assert.equal(hldiPercentWords(130), "30% worse than average")
  assert.equal(hldiPercentWords(100), "the same as average")
  assert.equal(hldiPercentWords(76, "frequency"), "filed 24% less often than average")
  assert.equal(hldiPercentWords(110, "frequency"), "filed 10% more often than average")
})

test("the share we count, in words", () => {
  assert.equal(shareWords(0.373), "about 40%")
  assert.equal(shareWords(0.513), "about half")
  assert.equal(shareWords(0.34), "about a third")
  assert.equal(shareCounted(94, 83.93)?.toFixed(3), "0.373")
  assert.equal(shareCounted(99, 99.5), null, "too close to average to say")
})

test("the Subaru Legacy: HLDI's ratings, then 16% → 6% and 21% → 11%", { skip: !MODELS_ENABLED }, () => {
  const f = carFigures(SERVER_CATALOG, "subaru-legacy")!
  const report = hldiReport(f.page.relativity)!
  assert.equal(report.modelYears, "2022–24")
  assert.deepEqual(
    report.rows.map((row) => [row.key, row.index, row.rating]),
    [
      ["collision", 79, "Better than average"],
      ["comprehensive", 96, "Average"],
      ["propertyDamage", 82, "Average"],
      ["bodilyInjury", 76, "Better than average"],
    ],
  )
  const meaning = priceMeaning(f.page.relativity, "the Legacy", f.parts)!
  assert.equal(Math.round(100 - meaning.damage.hldi), 16)
  assert.equal(Math.round(100 - meaning.damage.ours), 6)
  assert.equal(Math.round(100 - meaning.liability.hldi), 21)
  assert.equal(Math.round(100 - meaning.liability.ours), 11)
  assert.equal(meaning.damage.shareText, "about 40%")
  assert.equal(meaning.liability.shareText, "about half")
  assert.match(meaning.paragraph, /weighted about 71% and 29%/)
  assert.match(meaning.paragraph, /the Legacy comes out about 16% better than average\. We count about 40% of that difference, so the part of the bill that fixes the car is about 6% less than average: about \$900 a year vs \$950\./)
  assert.match(meaning.paragraph, /combine to about 21% better than average\. We count about half, so that part is about 11% less: \$880 a year vs \$990\./)
})

test("every car page's explanation reads cleanly and agrees with its own dollars", { skip: !MODELS_ENABLED }, () => {
  for (const page of carPages(SERVER_CATALOG)) {
    const f = carFigures(SERVER_CATALOG, page.slug)!
    const report = hldiReport(f.page.relativity)
    assert.ok(report && report.rows.length >= 1, `${page.slug}: HLDI rows`)
    const meaning = priceMeaning(f.page.relativity, "this car", f.parts)!
    assert.doesNotMatch(meaning.paragraph, /NaN|Infinity|undefined|\b0% (better|worse|less|more)/, page.slug)
    for (const side of [meaning.damage, meaning.liability]) {
      if (side.share !== null) assert.ok(side.share > 0 && side.share <= 1.2, `${page.slug}: share ${side.share}`)
    }
    // Our percent is the same one the dollars show (the rest of the bill is the same for both cars).
    const ownCar = (1 - f.parts.car.ownCar / f.parts.average.ownCar) * 100
    const liability = (1 - f.parts.car.liability / f.parts.average.liability) * 100
    assert.ok(Math.abs(ownCar - (100 - meaning.damage.ours)) < 1, `${page.slug}: damage ${ownCar} vs ${100 - meaning.damage.ours}`)
    assert.ok(Math.abs(liability - (100 - meaning.liability.ours)) < 1, `${page.slug}: liability ${liability} vs ${100 - meaning.liability.ours}`)
  }
})

test("a car HLDI publishes without an injury figure says so instead of claiming a combination", { skip: !MODELS_ENABLED }, () => {
  const f = carFigures(SERVER_CATALOG, "toyota-tacoma")!
  assert.equal(hldiReport(f.page.relativity)!.rows.some((row) => row.key === "bodilyInjury"), false)
  const meaning = priceMeaning(f.page.relativity, "the Tacoma", f.parts)!
  assert.match(meaning.paragraph, /HLDI publishes damage to others' property but not injury claims for the Tacoma/)
  assert.doesNotMatch(meaning.paragraph, /injury claims combine/)
})

test("the What-if panel's short form: HLDI's line, then ours", { skip: !MODELS_ENABLED }, () => {
  const f = carFigures(SERVER_CATALOG, "subaru-legacy")!
  assert.equal(
    hldiShortLine(hldiReport(f.page.relativity)!),
    "crash repairs 21% better than average, non-crash damage 4% better, damage to others' property 18% better, and injury claims filed 24% less often",
  )
  assert.equal(
    priceMeaning(f.page.relativity, "it", null)!.short,
    "We estimate the part of the bill that fixes the car is about 6% less than average, and the liability part is about 11% less than average.",
  )
})

test("the sources page names HLDI's newest window and when we pulled it", () => {
  assert.match(hldiDataLine() ?? "", /^HLDI data through \d{4}–\d{2} models, retrieved [A-Z][a-z]+ \d{4}\.$/)
})
