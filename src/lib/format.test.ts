import assert from "node:assert/strict"
import test from "node:test"
import {
  differenceWords,
  dollars,
  estimateDollars,
  limitsWords,
  longDate,
  monthlyDollars,
  percentRangeWords,
  percentWords,
  rangeDollars,
  rangeEnds,
  rangeWords,
  signedDollars,
} from "./format"

test("estimates round to $10, monthly to $5, ranges to $50", () => {
  assert.equal(estimateDollars(1717), "$1,720")
  assert.equal(estimateDollars(6748), "$6,750")
  assert.equal(estimateDollars(3), "$10")
  assert.equal(monthlyDollars(1717), "$145")
  assert.equal(monthlyDollars(10), "$5")
  assert.equal(rangeDollars(1251, 2498), "$1,250–$2,500")
  assert.equal(rangeWords(1251, 2498), "roughly $1,250–$2,500")
})

test("a range never collapses to one number", () => {
  assert.deepEqual(rangeEnds(1010, 1030), { low: 1000, high: 1050 })
  assert.deepEqual(rangeEnds(10, 20), { low: 50, high: 100 })
})

test("a typed number stays exact", () => {
  assert.equal(dollars(1717), "$1,717")
  assert.equal(dollars(250000), "$250,000")
})

test("differences read as words in sentences and signs in cells", () => {
  assert.equal(differenceWords(627), "$630 more a year")
  assert.equal(differenceWords(-88), "$90 less a year")
  assert.equal(differenceWords(4), "about the same")
  assert.equal(differenceWords(627, "month"), "$50 more a month")
  assert.equal(signedDollars(352), "+$350")
  assert.equal(signedDollars(-88), "−$90")
  assert.equal(signedDollars(2), "$0")
})

test("percentages use one format", () => {
  assert.equal(percentWords(52), "+52%")
  assert.equal(percentWords(-8), "−8%")
  assert.equal(percentWords(0), "no change")
  assert.equal(percentRangeWords(-5, 16), "−5% to +16%")
  assert.equal(percentRangeWords(0, 73), "0% to +73%")
  assert.equal(percentRangeWords(-12, -6), "−12% to −6%")
})

test("limits and dates", () => {
  assert.equal(limitsWords(100000, 300000, 100000), "$100,000/$300,000/$100,000")
  assert.equal(longDate("2026-09-22"), "September 22, 2026")
  assert.equal(longDate("soon"), "soon")
})
