import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import sourcesFile from "../../data/factors/sources/sources.json"
import { EXCLUDED_CARRIERS, parseCsv, percentile } from "./factor-derivation"
import { stateSurveyFor, SURVEY_STATE_CODES } from "./state-surveys"

const SOURCES_DIR = join(process.cwd(), "data/factors/sources")

test("stateSurveyFor covers TX, CA, CO, OK, ND, DC, and NC, and returns null elsewhere", () => {
  assert.deepEqual(SURVEY_STATE_CODES, ["TX", "CA", "CO", "OK", "ND", "DC", "NC"])
  for (const code of SURVEY_STATE_CODES) {
    const survey = stateSurveyFor(code)
    assert.ok(survey, `${code} should have a survey section`)
    const meta = sourcesFile.sources.find((item) => item.id === survey.sourceId)
    assert.ok(meta, `${code}: missing ${survey.sourceId} in sources.json`)
    assert.equal(survey.title, meta.title)
    assert.equal(survey.publisher, meta.publisher)
    assert.equal(survey.url, meta.url)
    assert.equal(survey.checkedOn, meta.checkedOn)
    assert.match(survey.url, /^https:\/\//)
  }
  assert.equal(stateSurveyFor("WA"), null)
  assert.equal(stateSurveyFor("OH"), null)
})

test("rate-survey figures match the committed CSVs for every profile and territory", () => {
  for (const code of ["TX", "CA", "CO", "OK", "ND", "DC"] as const) {
    const survey = stateSurveyFor(code)
    assert.ok(survey && survey.kind === "rate-survey", code)
    assert.ok(survey.profiles.length >= 2, `${code} has base and young/alt profiles`)

    const excluded = new Set(EXCLUDED_CARRIERS[survey.sourceId] ?? [])
    const premiums = parseCsv(readFileSync(join(SOURCES_DIR, `${survey.sourceId}-premiums.csv`), "utf8"))
    const profilesCsv = parseCsv(readFileSync(join(SOURCES_DIR, `${survey.sourceId}-profiles.csv`), "utf8"))

    for (const profile of survey.profiles) {
      const csvRow = profilesCsv.find((row) => row.profile_id === profile.profileId)
      assert.ok(csvRow, `${code}: missing ${profile.profileId} in profiles.csv`)
      assert.equal(profile.csvDescription, csvRow.description)
      assert.ok(profile.profileDescription.length > 40)
      assert.ok(profile.places.length >= 1)

      for (const place of profile.places) {
        const values = premiums
          .filter(
            (row) =>
              row.profile_id === profile.profileId &&
              row.territory === place.territory &&
              !excluded.has(row.carrier) &&
              Number(row.annual_premium) > 0,
          )
          .map((row) => Number(row.annual_premium))
          .sort((a, b) => a - b)

        assert.equal(place.carrierCount, values.length, `${code} ${profile.profileId} ${place.territory} count`)
        assert.equal(place.median, Math.round(percentile(values, 0.5)), `${code} ${profile.profileId} ${place.territory} median`)
        assert.equal(place.low, Math.round(values[0]), `${code} ${profile.profileId} ${place.territory} low`)
        assert.equal(place.high, Math.round(values.at(-1)!), `${code} ${profile.profileId} ${place.territory} high`)
        assert.ok(place.low <= place.median && place.median <= place.high)
      }
    }
  }
})

test("North Carolina SDIP schedule matches nc-sdip-2026.csv", () => {
  const nc = stateSurveyFor("NC")
  assert.ok(nc && nc.kind === "surcharge-schedule")
  const csv = parseCsv(readFileSync(join(SOURCES_DIR, "nc-sdip-2026.csv"), "utf8"))
  assert.equal(nc.rows.length, csv.length)
  assert.equal(nc.rows.length, 7)
  nc.rows.forEach((row, index) => {
    assert.deepEqual(row, {
      points: Number(csv[index].points),
      surchargePercent: Number(csv[index].surcharge_percent),
      whatCounts: csv[index].what_counts,
    })
  })
})
