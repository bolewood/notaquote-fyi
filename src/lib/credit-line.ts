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

/** The Texas figures, always named as Texas's, so they're never read as the visitor's own state's. */
export const TEXAS_SENTENCE = `In Texas's survey, credit moved the same driver's price about ${lower}% down or ${higher}% up.`

/** The line for a state, from its credit rule (or a rule passed in, for tests): what the law says, then the Texas figures. */
export function creditLine(state: string, rule: RatingRule | undefined = ratingRule(state, "credit")): string {
  const name = stateName(state as StateCode)
  if (!rule) return `Where it's allowed, insurers can use your credit. ${TEXAS_SENTENCE}`
  if (rule.status === "banned") return `In ${name}, insurers can't use your credit to set your price, so it won't move your quote.`
  // Mirrors compareLine: a state whose rating law just doesn't list credit never reads as "can use".
  if (rule.status === "no-ban-found" && rule.basis === "not-on-list") return `${name}'s rating law doesn't list credit as banned. ${TEXAS_SENTENCE}`
  const limits = rule.status === "limited" ? " with limits" : ""
  const summary = fromSummary(rule) ? ", according to a summary of the law" : ""
  return `In ${name}, insurers can use your credit${limits}${summary}. ${TEXAS_SENTENCE}`
}
