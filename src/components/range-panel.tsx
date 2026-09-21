import { DisclaimerText } from "@/components/disclaimer-text"
import { UncertaintyBar } from "@/components/uncertainty-bar"
import { BUNDLE_VERSION, MODEL_VERSION, SAMPLE_RANGE_HEADING } from "@/lib/copy"
import { scenarioIdentity, type PersonaId, type Scenario } from "@/lib/scenario"
import { formatDollars, type SampleRange } from "@/lib/sample-range"

export function RangePanel({
  scenario,
  persona,
  range,
}: {
  scenario: Scenario
  persona: PersonaId | null
  range: SampleRange
}) {
  return (
    <section aria-labelledby="sample-range-heading" className="grid gap-3">
      <div className="border-primary grid gap-1 border-l-2 pl-3">
        <p className="text-primary text-xs font-medium tracking-widest uppercase">
          Sample display
        </p>
        <h1 id="sample-range-heading" className="text-xl font-semibold tracking-tight">
          {SAMPLE_RANGE_HEADING}
        </h1>
      </div>
      <p className="text-sm leading-snug">{scenarioIdentity(scenario, persona)}</p>
      <div aria-live="polite" aria-atomic="true" className="grid gap-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid flex-1 gap-2">
            <p className="text-xs font-medium tracking-wide uppercase">Annual</p>
            <div className="grid grid-cols-3 items-end gap-2">
              <Figure
                amount={range.low}
                label="Sample low"
                testId="sample-low"
                align="left"
                size="text-xl sm:text-2xl"
              />
              <Figure
                amount={range.likely}
                label="Sample likely"
                testId="sample-likely"
                align="center"
                size="text-4xl sm:text-5xl"
              />
              <Figure
                amount={range.high}
                label="Sample high"
                testId="sample-high"
                align="right"
                size="text-xl sm:text-2xl"
              />
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium tracking-wide uppercase">
              Monthly planning midpoint
            </p>
            <p
              data-testid="sample-monthly"
              className="font-mono text-3xl tracking-tight tabular-nums sm:text-4xl"
            >
              {formatDollars(range.monthly)}
            </p>
            <p className="text-muted-foreground text-xs">Sample likely divided by 12</p>
          </div>
        </div>
        <UncertaintyBar low={range.low} likely={range.likely} high={range.high} />
        <p data-testid="confidence">
          <span className="font-medium">Confidence. </span>
          Low. Sample display. Baseline not cleared. The vehicle catalog is not
          loaded.
        </p>
        {range.anchored ? (
          <p data-testid="anchor-note" className="text-sm leading-snug">
            Re-anchored to the annual amount entered for this scenario. The sample
            baseline is not in use.
          </p>
        ) : (
          <p className="text-sm leading-snug">
            Illustrative sample weights produced these figures. They are not a
            premium.
          </p>
        )}
      </div>
      <DisclaimerText />
      <p className="text-muted-foreground text-xs">
        Model {MODEL_VERSION}. Data bundle {BUNDLE_VERSION}. One driver and one
        vehicle.
      </p>
    </section>
  )
}

function Figure({
  amount,
  label,
  testId,
  align,
  size,
}: {
  amount: number
  label: string
  testId: string
  align: "left" | "center" | "right"
  size: string
}) {
  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"

  return (
    <div className={`min-w-0 ${alignClass}`}>
      <p
        data-testid={testId}
        className={`font-mono tracking-tight tabular-nums ${size}`}
      >
        {formatDollars(amount)}
      </p>
      <p className="text-xs">{label}</p>
    </div>
  )
}
