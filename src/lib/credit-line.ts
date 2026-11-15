/**
 * One plain line about credit for the visitor's state, shown under "Why the
 * range is this wide". It explains; it never changes an estimate. Credit stays
 * out of FACTOR_BUNDLE (assertFactorBundleSafe forbids it).
 *
 * Safe for the browser: the Texas figures come from data/factors/credit-effect.json,
 * which a test recomputes from the survey CSVs (see unasked-factors.ts, server-only).
 */
import creditEffect from "../../data/factors/credit-effect.json"
import { fromSummary, ratingRule, type RatingRule } from "./rating-rules"
import { stateName, type StateCode } from "./scenario"

export const CREDIT_EFFECT = creditEffect

/** Where each line links: the credit rules on /what-we-dont-ask. */
export const CREDIT_RULES_HREF = "/what-we-dont-ask#rules-credit"

const lower = Math.round((1 - CREDIT_EFFECT.goodCredit.median) * 100)
const higher = Math.round((CREDIT_EFFECT.poorCredit.median - 1) * 100)

/** Where the percentages come from, shown on hover. */
export const CREDIT_FIGURES_NOTE = `From Texas's survey: the middle of ${CREDIT_EFFECT.goodCredit.n} comparisons each, same company and same place, good or poor credit vs. average.`

export type CreditLine = {
  text: string
  /** True when the text quotes the Texas figures, so the page can say where they come from. */
  usesFigures: boolean
}

/** The sentence for a state, from its credit rule (or a rule passed in, for tests). */
export function creditLine(state: string, rule: RatingRule | undefined = ratingRule(state, "credit")): CreditLine {
  const name = stateName(state as StateCode)
  if (!rule) {
    return { text: `Where it's allowed, credit can move a quote about ${lower}% down or ${higher}% up.`, usesFigures: true }
  }
  if (rule.status === "banned") {
    return { text: `In ${name}, insurers can't use your credit to set your price, so it won't move your quote.`, usesFigures: false }
  }
  const limits = rule.status === "limited" ? " (with limits)" : ""
  const summary = fromSummary(rule) ? " (from a summary)" : ""
  return {
    text: `In ${name}, insurers can use your credit${limits}, so a real quote could be about ${lower}% lower or ${higher}% higher than ours${summary}.`,
    usesFigures: true,
  }
}
