"use client"

import { SelectField } from "@/components/fields"
import {
  compareLine,
  FACTOR_NAMES,
  fromSummary,
  ratingRule,
  statusWords,
  SUMMARY_MARK,
  SUMMARY_NOTE,
  TABLE_FACTORS,
  type RatingRule,
} from "@/lib/rating-rules"
import { STATES, type StateCode } from "@/lib/scenario"
import { useSituation } from "@/lib/use-stored"
import { useState } from "react"

function Cell({ rule }: { rule: RatingRule | undefined }) {
  if (!rule) return <span className="text-muted-foreground">Not reviewed yet</span>
  return (
    <>
      <a href={rule.source.url} rel="noreferrer" title={rule.summary}>
        {statusWords(rule)}
      </a>
      {fromSummary(rule) ? <SummaryMark /> : null}
    </>
  )
}

/** The dagger on a summary-based answer. Screen readers hear the footnote's words instead. */
function SummaryMark() {
  return (
    <sup className="ml-0.5 text-muted-foreground" data-testid="summary-mark" title={SUMMARY_NOTE}>
      <span aria-hidden="true">{SUMMARY_MARK}</span>
      <span className="sr-only"> ({SUMMARY_NOTE})</span>
    </sup>
  )
}

/** The footnote under a table with at least one summary-based answer. */
function SummaryFootnote() {
  return (
    <p className="mt-2 text-xs text-muted-foreground" data-testid="summary-footnote">
      <span aria-hidden="true">{SUMMARY_MARK}</span> {SUMMARY_NOTE}
    </p>
  )
}

/**
 * Every state and DC, one row each: what insurers may use to price car
 * insurance. Your saved state is highlighted. Each cell links to the law; a
 * blank one says it hasn't been reviewed yet.
 */
export function RatingRulesTable() {
  const saved = useSituation()
  const mine = saved.value?.scenario.state ?? null
  return (
    <div className="overflow-x-auto" data-testid="rating-rules-table">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="py-2 text-left text-sm text-muted-foreground">
          What car insurers may use to set a price, by state. Each answer links to its source: the law itself, or a summary
          of it where marked {SUMMARY_MARK}.
        </caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="py-2 pr-3 align-bottom font-medium">
              State
            </th>
            {TABLE_FACTORS.map((factor) => (
              <th key={factor} scope="col" className="py-2 pr-3 align-bottom font-medium">
                {FACTOR_NAMES[factor]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STATES.map((state) => (
            <tr
              key={state.code}
              id={`state-${state.code}`}
              className={`scroll-mt-4 border-b border-border/60 align-top ${state.code === mine ? "bg-accent" : ""}`}
            >
              <th scope="row" className="py-2 pr-3 font-medium">
                {state.name}
                {state.code === mine ? <span className="ml-1 text-xs text-muted-foreground">(yours)</span> : null}
              </th>
              {TABLE_FACTORS.map((factor) => (
                <td key={factor} className="py-2 pr-3">
                  <Cell rule={ratingRule(state.code, factor)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {STATES.some((state) => TABLE_FACTORS.some((factor) => fromSummary(ratingRule(state.code, factor)))) ? (
        <SummaryFootnote />
      ) : null}
    </div>
  )
}


/** Two states side by side, with a plain summary of what changes if you move. */
export function CompareStateRules() {
  const saved = useSituation()
  const [first, setFirst] = useState<StateCode | null>(null)
  const [second, setSecond] = useState<StateCode>("TX")
  const a: StateCode = first ?? saved.value?.scenario.state ?? "CA"
  const b: StateCode = second === a ? (a === "CA" ? "TX" : "CA") : second
  const name = (code: StateCode) => STATES.find((item) => item.code === code)?.name ?? code
  const changes = TABLE_FACTORS.map((factor) => compareLine(factor, a, b, name(a), name(b))).filter(
    (line): line is string => line !== null,
  )
  const unreviewed = (code: StateCode) =>
    TABLE_FACTORS.filter((factor) => !ratingRule(code, factor)).map((factor) => FACTOR_NAMES[factor].toLowerCase())
  const gaps = [a, b]
    .map((code) => ({ code, list: unreviewed(code) }))
    .filter((item) => item.list.length > 0)
  const options = STATES.map((item) => ({ value: item.code, label: item.name }))
  return (
    <div className="grid gap-4 rounded-2xl bg-card p-5 ring-1 ring-border" data-testid="compare-state-rules">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField id="compare-a" label="From" value={a} options={options} onChange={(value) => setFirst(value as StateCode)} />
        <SelectField id="compare-b" label="To" value={b} options={options} onChange={(value) => setSecond(value as StateCode)} />
      </div>
      <div aria-live="polite" className="grid gap-3">
        {changes.length > 0 ? (
          <ul className="bullets">
            {changes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            We haven&apos;t found a difference between these two states in the rules we&apos;ve reviewed so far.
          </p>
        )}
        {gaps.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {gaps.map((item) => `Not reviewed yet for ${name(item.code)}: ${item.list.join(", ")}.`).join(" ")}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  What insurers may use
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {name(a)}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {name(b)}
                </th>
              </tr>
            </thead>
            <tbody>
              {TABLE_FACTORS.map((factor) => (
                <tr key={factor} className="border-b border-border/60 align-top">
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {FACTOR_NAMES[factor]}
                  </th>
                  <td className="py-2 pr-3">
                    <Cell rule={ratingRule(a, factor)} />
                    {ratingRule(a, factor) ? <p className="text-xs text-muted-foreground">{ratingRule(a, factor)?.summary}</p> : null}
                  </td>
                  <td className="py-2 pr-3">
                    <Cell rule={ratingRule(b, factor)} />
                    {ratingRule(b, factor) ? <p className="text-xs text-muted-foreground">{ratingRule(b, factor)?.summary}</p> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {TABLE_FACTORS.some((factor) => fromSummary(ratingRule(a, factor)) || fromSummary(ratingRule(b, factor))) ? (
            <SummaryFootnote />
          ) : null}
        </div>
      </div>
    </div>
  )
}
