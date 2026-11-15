"use client"

import { SelectField } from "@/components/fields"
import { dollars } from "@/lib/format"
import { FACTOR_NAMES, isBanned, ratingRule } from "@/lib/rating-rules"
import { STATES, type StateCode } from "@/lib/scenario"
import type { StateSpread, UnaskedFactor } from "@/lib/unasked-factors"
import { useSituation } from "@/lib/use-stored"
import { useState } from "react"

type Axis = { low: number; high: number }

function position(ratio: number, axis: Axis): number {
  const clamped = Math.min(axis.high, Math.max(axis.low, ratio))
  return ((clamped - axis.low) / (axis.high - axis.low)) * 100
}

type SpreadByState = Partial<Record<StateCode, StateSpread & { stateName: string }>>

function Bar({ factor, collapsed, axis }: { factor: UnaskedFactor; collapsed: boolean; axis: Axis }) {
  const middle = position(1, axis)
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
  const left = position(Math.min(factor.low, 1), axis)
  const right = position(Math.max(factor.high, 1), axis)
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
 * One row per thing we don't ask: how much that one thing changed a price in
 * the survey it comes from, as a percentage. Pick a state and anything banned
 * there collapses; the insurer row switches to that state's own survey where
 * we have one. Every row opens to say why, where the number comes from, and
 * what you can do. Works as a plain list without JavaScript.
 */
export function UnaskedFactorsChart({
  factors,
  examplePrice,
  spreads,
  axis,
}: {
  factors: readonly UnaskedFactor[]
  examplePrice: number
  spreads: SpreadByState
  axis: Axis
}) {
  const saved = useSituation()
  // undefined: not chosen yet, so follow the saved state. null: "Any state," chosen on purpose.
  const [picked, setPicked] = useState<StateCode | null | undefined>(undefined)
  const state: StateCode | null = picked === undefined ? (saved.value?.scenario.state ?? null) : picked
  const stateName = state ? (STATES.find((item) => item.code === state)?.name ?? state) : null
  const scale = Math.round((examplePrice * 0.1) / 10) * 10

  const rows = factors.map((factor) => {
    const own = factor.id === "insurer" && state ? spreads[state] : undefined
    const shown: UnaskedFactor = own
      ? {
          ...factor,
          low: own.p25,
          high: own.p75,
          reading: `${Math.round((1 - own.p25) * 100)}% less to ${Math.round((own.p75 - 1) * 100)}% more than the middle company, in ${own.stateName}'s own survey`,
          howWorkedOut: own.howWorkedOut,
          sources: [own.source],
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
      <div className="grid gap-2 text-sm text-muted-foreground">
        <p>
          Each bar shows how much one thing changed a price, with everything else the same. The line in each row is
          &ldquo;no change.&rdquo;
        </p>
        <p>
          Most bars come from Texas&apos;s 2025 sample rates for one driver: a 30-year-old man with liability-only
          coverage. Your driver, coverage, and state will differ, so read them as rough sizes, not your numbers. For
          scale, on a typical full-coverage price of about {dollars(examplePrice)} a year, 10% is about {dollars(scale)}.
        </p>
        <p>Tap a row to see why, where the number comes from, and what you can do.</p>
      </div>
      <ul className="grid gap-2" aria-live="polite">
        {rows.map(({ factor, banned, rule }) => {
          const reading = banned && stateName ? `Not allowed in ${stateName}` : factor.reading
          return (
            <li key={factor.id} className="rounded-2xl bg-card ring-1 ring-border" data-testid={`unasked-${factor.id}`}>
              <details>
                <summary className="grid cursor-pointer gap-1 p-4 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-4">
                  <span className="grid font-medium">
                    {factor.name}
                    {factor.kind === "asked" ? <span className="text-xs font-normal text-muted-foreground">We ask this one</span> : null}
                  </span>
                  <span className="grid gap-1">
                    <Bar factor={factor} collapsed={banned} axis={axis} />
                    <span className="text-sm text-muted-foreground">{reading}</span>
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
