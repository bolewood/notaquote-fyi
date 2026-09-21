import { DisclaimerText } from "@/components/disclaimer-text"
import { UncertaintyBar } from "@/components/uncertainty-bar"
import {
  rangeConfidenceCopy,
  type CatalogStatus,
  type TrimConfidence,
} from "@/lib/catalog"
import { BUNDLE_VERSION, MODEL_VERSION, SAMPLE_RANGE_HEADING } from "@/lib/copy"
import { scenarioIdentity, type PersonaId, type Scenario } from "@/lib/scenario"
import { formatDollars, type SampleRange } from "@/lib/sample-range"

export function RangePanel({
  scenario,
  persona,
  range,
  catalogStatus,
  trimConfidence,
  stale,
}: {
  scenario: Scenario
  persona: PersonaId | null
  range: SampleRange
  catalogStatus: CatalogStatus
  trimConfidence: TrimConfidence | null
  stale: boolean
}) {
  return (
    <section aria-labelledby="sample-range-heading" className="bg-range-likely/8 grid gap-3 rounded-lg px-3 py-3 sm:px-4">
      <div className="border-range-likely grid gap-1 border-l-4 pl-3">
        <p className="text-range-likely text-xs font-medium tracking-widest uppercase">
          Sample display
        </p>
        <h1 id="sample-range-heading" className="text-xl font-semibold tracking-tight">
          {SAMPLE_RANGE_HEADING}
        </h1>
      </div>
      <p className="text-sm leading-snug">{scenarioIdentity(scenario, persona)}</p>
      <div aria-live="polite" aria-atomic="true" className="grid gap-3">
        <div className="grid gap-2">
          <p className="text-xs font-medium tracking-wide uppercase">Annual</p>
          <div className="grid grid-cols-3 items-end gap-3">
            <Figure
              amount={range.low}
              label="Sample low"
              testId="sample-low"
              tone="low"
              size="text-xl sm:text-2xl"
            />
            <Figure
              amount={range.likely}
              label="Sample likely"
              testId="sample-likely"
              tone="likely"
              size="text-4xl sm:text-5xl"
            />
            <Figure
              amount={range.high}
              label="Sample high"
              testId="sample-high"
              tone="high"
              size="text-xl sm:text-2xl"
            />
          </div>
        </div>
        <UncertaintyBar low={range.low} likely={range.likely} high={range.high} />
        <div className="border-range-likely/30 grid gap-1 border-t pt-3">
          <p className="text-range-likely text-xs font-medium tracking-wide uppercase">
            Monthly planning midpoint
          </p>
          <p
            data-testid="sample-monthly"
            className="text-range-likely font-mono text-3xl tracking-tight tabular-nums sm:text-4xl"
          >
            {formatDollars(range.monthly)}
          </p>
          <p className="text-muted-foreground text-xs">
            {range.monthly === Math.round(range.likely / 12)
              ? "Sample likely divided by 12"
              : "Sample display floor held this midpoint above zero. Not a premium."}
          </p>
        </div>
        <p data-testid="confidence">
          <span className="font-medium">Confidence. </span>
          {rangeConfidenceCopy({ catalogStatus, trimConfidence, stale })}
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
        {range.displayFloor ? (
          <p data-testid="display-floor" className="text-sm leading-snug">
            Sample display floor. This range was held above zero. The floor is not
            a premium.
          </p>
        ) : null}
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
  tone,
  size,
}: {
  amount: number
  label: string
  testId: string
  tone: "low" | "likely" | "high"
  size: string
}) {
  const toneClass =
    tone === "likely" ? "text-range-likely" : tone === "high" ? "text-range-high" : "text-range-low"
  const alignClass = tone === "likely" ? "text-center" : tone === "high" ? "text-right" : "text-left"

  return (
    <div className={`min-w-0 ${alignClass} ${toneClass}`}>
      <p
        data-testid={testId}
        className={`font-mono tracking-tight tabular-nums whitespace-nowrap ${size}`}
      >
        {formatDollars(amount)}
      </p>
      <p className="text-xs">{label}</p>
    </div>
  )
}
