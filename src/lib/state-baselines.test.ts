import assert from "node:assert/strict"
import test from "node:test"
import baselineFile from "@/data/state-baselines.json"
import { STATES } from "./scenario"
import {
  allStateBaselines,
  baselineTrendInputs,
  countrywideBaseline,
  STATE_BASELINE_DATA_YEAR,
  STATE_BASELINE_SOURCES,
  STATE_BASELINES_CHECKED_ON,
  STATE_BASELINES_VERSION,
  stateBaseline,
} from "./state-baselines"

test("there is one baseline for each of the 50 states and DC", () => {
  const baselines = allStateBaselines()
  assert.equal(baselines.length, 51)
  assert.deepEqual(
    baselines.map((row) => row.state),
    STATES.map((state) => state.code),
  )
})

test("every figure is a positive whole number with a known source", () => {
  const ids = new Set(STATE_BASELINE_SOURCES.map((source) => source.id))
  for (const row of allStateBaselines()) {
    assert.ok(Number.isInteger(row.annual), `${row.state} annual is whole dollars`)
    assert.ok(row.annual > 0, `${row.state} annual is positive`)
    assert.equal(row.annual, Math.round(row.exact), `${row.state} annual rounds the printed figure`)
    assert.ok(row.liabilityOnly > 0 && row.liabilityOnly < row.exact)
    assert.ok(row.averageExpenditure > 0)
    assert.ok(ids.has(row.source.id))
    assert.match(row.source.url, /^https:\/\//)
    assert.equal(row.coverage, "full")
    assert.equal(row.dataYear, STATE_BASELINE_DATA_YEAR)
  }
})

test("the figures stay in a believable range for a year of car insurance", () => {
  for (const row of allStateBaselines()) {
    assert.ok(row.annual >= 500 && row.annual <= 5000, `${row.state} ${row.annual}`)
  }
})

test("the version and dates have the expected shape", () => {
  assert.match(STATE_BASELINES_VERSION, /^state-baselines-\d{4}-\d{2}-\d{2}$/)
  assert.equal(STATE_BASELINES_VERSION, `state-baselines-${STATE_BASELINES_CHECKED_ON}`)
  assert.match(STATE_BASELINES_CHECKED_ON, /^\d{4}-\d{2}-\d{2}$/)
  for (const source of STATE_BASELINE_SOURCES) {
    assert.match(source.checkedOn, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(source.terms.length > 0)
  }
  assert.ok(STATE_BASELINE_DATA_YEAR >= 2020)
})

test("spot values match NAIC Table 5 (2023) as printed", () => {
  assert.equal(stateBaseline("CA")?.exact, 1417.94)
  assert.equal(stateBaseline("CA")?.annual, 1418)
  assert.equal(stateBaseline("TX")?.exact, 1726.91)
  assert.equal(stateBaseline("NY")?.exact, 1895.99)
  assert.equal(stateBaseline("FL")?.exact, 1993.81)
  assert.equal(stateBaseline("OH")?.exact, 1037.61)
  assert.equal(stateBaseline("oh")?.state, "OH")
  assert.equal(countrywideBaseline().exact, 1438.6)
})

test("an unknown code returns null", () => {
  assert.equal(stateBaseline("PR"), null)
  assert.equal(stateBaseline(""), null)
})

test("the price trend is recorded but not applied", () => {
  const trend = baselineTrendInputs()
  assert.equal(trend.applied, false)
  assert.equal(baselineFile.trend.applied, false)
  assert.equal(trend.dataYearAverage.period, String(STATE_BASELINE_DATA_YEAR))
  assert.match(trend.latest.period, /^\d{4}-\d{2}$/)
  assert.ok(trend.dataYearAverage.value > 0 && trend.latest.value > 0)
  assert.match(trend.series.name, /CUUR0000SETE/)
})
