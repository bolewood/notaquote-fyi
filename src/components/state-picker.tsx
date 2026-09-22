"use client"

import { SelectField } from "@/components/fields"
import { StateNoteBody } from "@/components/state-rules-table"
import { dollars } from "@/lib/format"
import { STATES, type StateCode } from "@/lib/scenario"
import { STATE_BASELINE_ATTRIBUTION, stateBaseline } from "@/lib/state-baselines"
import { flagCell, liabilityCell, noFaultCell, stateRule, type StateRule } from "@/lib/state-rules"
import { useSituation } from "@/lib/use-stored"
import { useState } from "react"

function limits(rule: StateRule): string {
  if (rule.sourceUrl === null) return "Not checked yet"
  if (rule.biPerPerson === null && rule.biPerAccident === null && rule.pd === null) {
    return liabilityCell(rule, rule.combinedSingleLimit)
  }
  const one = (amount: number | null) => (amount === null ? "none" : dollars(amount))
  return `${one(rule.biPerPerson)}/${one(rule.biPerAccident)}/${one(rule.pd)}`
}

/**
 * One state at a time: its typical price and its legal minimums, with the
 * notes and sources. Starts on the state in your saved situation, if any.
 */
export function StatePicker() {
  const saved = useSituation()
  const [picked, setPicked] = useState<StateCode | null>(null)
  const state: StateCode = picked ?? saved.value?.scenario.state ?? "IL"
  const name = STATES.find((item) => item.code === state)?.name ?? state
  const baseline = stateBaseline(state)
  const rule = stateRule(state)
  return (
    <div className="grid gap-5">
      <div className="max-w-xs">
        <SelectField
          id="source-state"
          label="Pick your state"
          value={state}
          options={STATES.map((item) => ({ value: item.code, label: item.name }))}
          onChange={(value) => setPicked(value as StateCode)}
        />
      </div>
      <div className="grid gap-4 rounded-2xl bg-card p-5 ring-1 ring-border" aria-live="polite">
        <h3 className="!mt-0 text-lg font-semibold">{name}</h3>
        {baseline ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">Typical yearly price, 2023</p>
            <p>
              <span className="money text-2xl font-semibold">{dollars(baseline.annual)}</span> for full coverage,{" "}
              <span className="money font-semibold">{dollars(baseline.liabilityOnly)}</span> for liability only.
            </p>
            <p className="text-sm text-muted-foreground">
              What an average driver paid for one car. {STATE_BASELINE_ATTRIBUTION}. The math brings it up to today and
              adjusts it for your driver, car, and coverage.
            </p>
          </div>
        ) : null}
        {rule ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium text-muted-foreground">The least insurance the law asks for</p>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-medium">Liability (per person / per crash / property)</dt>
              <dd className="money">{limits(rule)}</dd>
              <dt className="font-medium">Personal injury protection (PIP)</dt>
              <dd>{flagCell(rule.pipRequired)}</dd>
              <dt className="font-medium">Medical payments</dt>
              <dd>{flagCell(rule.medPayRequired)}</dd>
              <dt className="font-medium">No-fault</dt>
              <dd>{noFaultCell(rule.noFault)}</dd>
              <dt className="font-medium">Uninsured motorist</dt>
              <dd>{flagCell(rule.umRequired)}</dd>
              <dt className="font-medium">Underinsured motorist</dt>
              <dd>{flagCell(rule.uimRequired)}</dd>
            </dl>
            <StateNoteBody rule={rule} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
