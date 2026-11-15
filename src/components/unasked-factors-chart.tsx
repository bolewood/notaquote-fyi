"use client"

import { SelectField } from "@/components/fields"
import { dollars } from "@/lib/format"
import { FACTOR_NAMES, isBanned, ratingRule } from "@/lib/rating-rules"
import { STATES, type StateCode } from "@/lib/scenario"
import type { RatioSummary, UnaskedFactor } from "@/lib/unasked-factors"
import { useSituation } from "@/lib/use-stored"
import { useState } from "react"

/** The axis, as multipliers of the example price. Wide enough for every sourced bar. */
const AXIS_LOW = 0.7
const AXIS_HIGH = 1.6

function position(ratio: number): number {
  const clamped = Math.min(AXIS_HIGH, Math.max(AXIS_LOW, ratio))
  return ((clamped - AXIS_LOW) / (AXIS_HIGH - AXIS_LOW)) * 100
}

function roundTen(amount: number): number {
  return Math.round(amount / 10) * 10
}

type SpreadByState = Partial<Record<StateCode, RatioSummary & { sourceId: string; stateName: string }>>

function Bar({ factor, collapsed }: { factor: UnaskedFactor; collapsed: boolean }) {
  const middle = position(1)
  if (collapsed) {
    return (
      <div className="relative h-6" aria-hidden>
        <div className="absolute inset-y-0 w-px bg-[var(--chart-axis)]" style={{ left: `${middle}%` }} />
        <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-[var(--chart-grid)]" />
      </div>
    )
  }
  if (factor.low === null || factor.high === null) {
    return (
      <div className="relative h-6" aria-hidden>
        <div className="absolute inset-y-1 left-0 right-0 rounded-full border border-dashed border-[var(--chart-axis)]" />
        <div className="absolute inset-y-0 w-px bg-[var(--chart-axis)]" style={{ left: `${middle}%` }} />
      </div>
    )
  }
  const left = position(Math.min(factor.low, 1))
  const right = position(Math.max(factor.high, 1))
  return (
    <div className="relative h-6" aria-hidden>
      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-[var(--chart-grid)]" />
      <div
        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full"
        style={{
          left: `${left}%`,
          width: `${Math.max(right - left, 1)}%`,
          background: "var(--primary)",
          opacity: factor.kind === "asked" ? 0.35 : 0.85,
        }}
      />
      <div className="absolute inset-y-0 w-px bg-[var(--chart-axis)]" style={{ left: `${middle}%` }} />
    </div>
  )
}

/**
 * One row per thing we don't ask, each a bar around an example driver's price:
 * how far that one thing can move it. Pick a state and anything banned there
 * collapses. Every row opens to say why, where the number comes from, and what
 * you can do. Works as a plain list without JavaScript.
 */
export function UnaskedFactorsChart({
  factors,
  examplePrice,
  spreads,
}: {
  factors: readonly UnaskedFactor[]
  examplePrice: number
  spreads: SpreadByState
}) {
  const saved = useSituation()
  const [picked, setPicked] = useState<StateCode | null>(null)
  const state: StateCode | null = picked ?? saved.value?.scenario.state ?? null
  const stateName = state ? (STATES.find((item) => item.code === state)?.name ?? state) : null

  const rows = factors.map((factor) => {
    const own = factor.id === "insurer" && state ? spreads[state] : undefined
    const shown: UnaskedFactor = own
      ? {
          ...factor,
          low: own.p25,
          high: own.p75,
          reading: `${Math.round((1 - own.p25) * 100)}% less to ${Math.round((own.p75 - 1) * 100)}% more than the middle company, in ${own.stateName}'s own survey`,
        }
      : factor
    const banned = state !== null && factor.ruleFactor !== null && isBanned(state, factor.ruleFactor)
    const rule = state !== null && factor.ruleFactor !== null ? ratingRule(state, factor.ruleFactor) : undefined
    return { factor: shown, banned, rule }
  })

  return (
    <div className="grid gap-4" data-testid="unasked-chart">
      <div className="max-w-xs">
        <SelectField
          id="unasked-state"
          label="Show the rules for"
          value={state ?? ""}
          options={[{ value: "", label: "Any state" }, ...STATES.map((item) => ({ value: item.code, label: item.name }))]}
          onChange={(value) => setPicked(value === "" ? null : (value as StateCode))}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Each bar shows how far one thing can move a typical yearly price of about {dollars(examplePrice)}, with everything
        else the same. The line in each row is that typical price. Tap a row to see why, where the number comes from, and
        what you can do.
      </p>
      <ul className="grid gap-2" aria-live="polite">
        {rows.map(({ factor, banned, rule }) => {
          const low = factor.low !== null ? roundTen(examplePrice * Math.min(factor.low, 1)) : null
          const high = factor.high !== null ? roundTen(examplePrice * Math.max(factor.high, 1)) : null
          const reading = banned && stateName
            ? `Not allowed in ${stateName}`
            : factor.reading
          return (
            <li key={factor.id} className="rounded-2xl bg-card ring-1 ring-border" data-testid={`unasked-${factor.id}`}>
              <details>
                <summary className="grid cursor-pointer gap-1 p-4 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-4">
                  <span className="grid font-medium">
                    {factor.name}
                    {factor.kind === "asked" ? <span className="text-xs font-normal text-muted-foreground">We ask this one</span> : null}
                  </span>
                  <span className="grid gap-1">
                    <Bar factor={factor} collapsed={banned} />
                    <span className="text-sm text-muted-foreground">
                      {reading}
                      {!banned && low !== null && high !== null ? ` (about ${dollars(low)}–${dollars(high)} a year)` : null}
                    </span>
                  </span>
                </summary>
                <div className="grid gap-3 border-t border-border p-4 text-sm">
                  <p>{factor.what}</p>
                  {rule && stateName ? (
                    <p>
                      <strong>In {stateName}:</strong> {rule.summary}{" "}
                      <a href={rule.source.url} rel="noreferrer">
                        {rule.source.label}
                      </a>
                    </p>
                  ) : null}
                  <p className="text-muted-foreground">
                    <strong>How we got this:</strong> {factor.howWorkedOut}
                    {factor.sources.length > 0 ? (
                      <>
                        {" "}
                        Sources:{" "}
                        {factor.sources.map((source, index) => (
                          <span key={source.id}>
                            {index > 0 ? ", " : ""}
                            <a href={source.url} rel="noreferrer">
                              {source.publisher}
                            </a>
                          </span>
                        ))}
                        .
                      </>
                    ) : null}
                  </p>
                  {factor.whatYouCanDo.length > 0 ? (
                    <div>
                      <p className="font-medium">What you can do</p>
                      <ul className="bullets">
                        {factor.whatYouCanDo.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {factor.ruleFactor ? (
                    <p>
                      <a href={`#rules-${factor.ruleFactor}`}>Where {FACTOR_NAMES[factor.ruleFactor].toLowerCase()} is banned or limited</a>
                    </p>
                  ) : null}
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
