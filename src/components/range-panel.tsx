import { DisclaimerText } from "@/components/disclaimer-text"
import { UncertaintyBar } from "@/components/uncertainty-bar"
import { rangeConfidenceCopy, type CatalogStatus, type TrimConfidence } from "@/lib/catalog"
import { CATALOG_VERSION } from "@/lib/catalog-meta"
import {
  DATA_BUNDLE_VERSION,
  ENGINE_RANGE_HEADING,
  MANIFEST_VERSION,
  MODEL_VERSION,
  SAMPLE_RANGE_HEADING,
} from "@/lib/copy"
import type { EngineResult } from "@/lib/factor-engine"
import { STATE_RULES_VERSION } from "@/lib/state-rules"
import { scenarioIdentity, type PersonaId, type Scenario } from "@/lib/scenario"
import { formatDollars, type SampleRange } from "@/lib/sample-range"

export function RangePanel({
  scenario,
  persona,
  sample,
  engine,
  catalogStatus,
  trimConfidence,
  stale,
}: {
  scenario: Scenario
  persona: PersonaId | null
  sample: SampleRange
  engine: EngineResult
  catalogStatus: CatalogStatus
  trimConfidence: TrimConfidence | null
  stale: boolean
}) {
  const dollars = engine.dollars
  const modeled = dollars !== null

  return (
    <section
      aria-labelledby="range-heading"
      className="bg-range-likely/8 grid gap-3 rounded-lg px-3 py-3 sm:px-4"
      data-testid="range-mode"
      data-range-mode={modeled ? "engine" : "sample"}
    >
      <div className="border-range-likely grid gap-1 border-l-4 pl-3">
        <p className="text-range-likely text-xs font-medium tracking-widest uppercase">
          {modeled ? "Factor engine" : "Sample display"}
        </p>
        <h1 id="range-heading" className="text-xl font-semibold tracking-tight">
          {modeled ? ENGINE_RANGE_HEADING : SAMPLE_RANGE_HEADING}
        </h1>
      </div>
      <p className="text-sm leading-snug">{scenarioIdentity(scenario, persona)}</p>
      <div aria-live="polite" aria-atomic="true" className="grid gap-3">
        {modeled && dollars ? (
          <EngineFigures dollars={dollars} />
        ) : (
          <SampleFigures range={sample} />
        )}
        <UncertaintyBar
          low={modeled && dollars ? dollars.low : sample.low}
          likely={modeled && dollars ? dollars.likely : sample.likely}
          high={modeled && dollars ? dollars.high : sample.high}
          sample={!modeled}
        />
        <div className="border-range-likely/30 grid gap-1 border-t pt-3">
          <p className="text-range-likely text-xs font-medium tracking-wide uppercase">
            Monthly planning midpoint
          </p>
          <p
            data-testid={modeled ? "engine-monthly" : "sample-monthly"}
            className="text-range-likely font-mono text-3xl tracking-tight tabular-nums sm:text-4xl"
          >
            {formatDollars(modeled && dollars ? dollars.monthly : sample.monthly)}
          </p>
          <p className="text-muted-foreground text-xs">
            {monthlyNote(modeled, modeled && dollars ? dollars.displayFloor : sample.displayFloor, modeled && dollars ? dollars.likely : sample.likely, modeled && dollars ? dollars.monthly : sample.monthly)}
          </p>
        </div>
        <p data-testid="confidence">
          <span className="font-medium">Confidence. </span>
          {modeled
            ? engine.confidenceDetail
            : rangeConfidenceCopy({ catalogStatus, trimConfidence, stale })}
        </p>
        <p data-testid="factor-explanation" className="text-sm leading-snug">
          {engine.explanation}
        </p>
        {modeled && dollars?.displayFloor ? (
          <p data-testid="display-floor" className="text-sm leading-snug">
            Display floor. This range was held above zero. The floor is not a premium.
          </p>
        ) : null}
        {!modeled && sample.displayFloor ? (
          <p data-testid="display-floor" className="text-sm leading-snug">
            Sample display floor. This range was held above zero. The floor is not a premium.
          </p>
        ) : null}
      </div>
      <DisclaimerText />
      <p className="text-muted-foreground text-xs" data-testid="versions">
        Model {MODEL_VERSION}. Data bundle {DATA_BUNDLE_VERSION}. Manifest {MANIFEST_VERSION}.
        Catalog {CATALOG_VERSION}. State rules {STATE_RULES_VERSION}. One driver and one vehicle.
      </p>
    </section>
  )
}

function monthlyNote(
  modeled: boolean,
  displayFloor: boolean,
  likely: number,
  monthly: number,
): string {
  const divided = monthly === Math.round(likely / 12)
  if (!divided || displayFloor) {
    return modeled
      ? "Display floor held this midpoint above zero. Not a premium."
      : "Sample display floor held this midpoint above zero. Not a premium."
  }
  return modeled ? "Likely figure divided by 12" : "Sample likely divided by 12"
}

function SampleFigures({ range }: { range: SampleRange }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium tracking-wide uppercase">Annual</p>
      <div className="grid grid-cols-3 items-end gap-3">
        <Figure amount={range.low} label="Sample low" testId="sample-low" tone="low" size="text-xl sm:text-2xl" />
        <Figure amount={range.likely} label="Sample likely" testId="sample-likely" tone="likely" size="text-4xl sm:text-5xl" />
        <Figure amount={range.high} label="Sample high" testId="sample-high" tone="high" size="text-xl sm:text-2xl" />
      </div>
    </div>
  )
}

function EngineFigures({
  dollars,
}: {
  dollars: { low: number; likely: number; high: number }
}) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium tracking-wide uppercase">Annual</p>
      <div className="grid grid-cols-3 items-end gap-3">
        <Figure amount={dollars.low} label="Low" testId="engine-low" tone="low" size="text-xl sm:text-2xl" />
        <Figure amount={dollars.likely} label="Likely" testId="engine-likely" tone="likely" size="text-4xl sm:text-5xl" />
        <Figure amount={dollars.high} label="High" testId="engine-high" tone="high" size="text-xl sm:text-2xl" />
      </div>
    </div>
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
