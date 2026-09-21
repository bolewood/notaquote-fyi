import { DisclaimerText } from "@/components/disclaimer-text"
import {
  formatCatalogDate,
  rangeConfidenceCopy,
  trimConfidenceCopy,
  type CatalogStatus,
  type TrimConfidence,
} from "@/lib/catalog"
import { CATALOG_RETRIEVED_ON, CATALOG_VERSION } from "@/lib/catalog-meta"
import {
  DATA_BUNDLE_VERSION,
  ENGINE_RANGE_HEADING,
  MANIFEST_VERSION,
  MODEL_VERSION,
  PUBLISHER,
  SAMPLE_RANGE_HEADING,
} from "@/lib/copy"
import { FACTOR_EFFECTIVE_DATE } from "@/lib/factor-engine"
import type { EngineResult } from "@/lib/factor-engine"
import { formatDollars, type SampleRange } from "@/lib/sample-range"
import type { SavedComparison } from "@/lib/comparison-tray"
import {
  AGE_BANDS,
  COVERAGE_PACKAGES,
  coverageAssumption,
  hasPhysicalDamage,
  INCIDENTS,
  MILEAGE_BANDS,
  regionLabel,
  scenarioIdentity,
  stateName,
  vehicleLabel,
  YEARS_LICENSED,
  type PersonaId,
  type Scenario,
} from "@/lib/scenario"
import {
  formatVerifiedDate,
  stateRule,
  STATE_RULES_CHECKED_ON,
  STATE_RULES_VERSION,
} from "@/lib/state-rules"

const PROFESSIONAL_PROMPT =
  "Licensed professional’s figure. Write that figure on the blank lines. This worksheet leaves them empty."

export function PrintWorksheet({
  scenario,
  persona,
  sample,
  engine,
  anchorAmount,
  trimConfidence,
  catalogStatus,
  stale,
  saved,
  trayReady,
  notices,
}: {
  scenario: Scenario
  persona: PersonaId | null
  sample: SampleRange
  engine: EngineResult
  anchorAmount: number | null
  trimConfidence: TrimConfidence | null
  catalogStatus: CatalogStatus
  stale: boolean
  saved: SavedComparison[]
  trayReady: boolean
  notices: string[]
}) {
  const modeled = engine.dollars !== null
  const dollars = modeled && engine.dollars ? engine.dollars : null
  const low = dollars ? dollars.low : sample.low
  const likely = dollars ? dollars.likely : sample.likely
  const high = dollars ? dollars.high : sample.high
  const monthly = dollars ? dollars.monthly : sample.monthly
  const rule = stateRule(scenario.state)
  const coverageLabel =
    COVERAGE_PACKAGES.find((item) => item.id === scenario.coverage)?.label ?? scenario.coverage

  return (
    <article className="worksheet" data-testid="print-worksheet" aria-labelledby="worksheet-heading">
      <p className="text-base font-semibold tracking-tight">NotAQuote.FYI</p>
      <p className="text-sm font-medium">Not a quote</p>
      <h2 id="worksheet-heading" className="text-xl font-semibold tracking-tight">
        Planning worksheet
      </h2>
      <p className="text-sm leading-snug">
        One driver and one vehicle. This page prints the open scenario, the
        assumptions, and room for a licensed professional’s figure.
      </p>
      <DisclaimerText />
      {notices.map((note) => (
        <p key={note} className="text-sm leading-snug">
          {note}
        </p>
      ))}

      <section className="grid gap-2" aria-labelledby="worksheet-assumptions">
        <h3 id="worksheet-assumptions" className="text-base font-semibold">
          Assumptions
        </h3>
        <p>{scenarioIdentity(scenario, persona)}</p>
        <dl className="grid gap-2">
          <Fact term="Driver" detail={driverDetail(scenario)} />
          <Fact term="Location" detail={locationDetail(scenario)} />
          <Fact term="Vehicle" detail={vehicleDetail(scenario, trimConfidence, catalogStatus, stale)} />
        </dl>
      </section>

      <section className="grid gap-2" aria-labelledby="worksheet-coverage">
        <h3 id="worksheet-coverage" className="text-base font-semibold">
          Coverage limits
        </h3>
        <p>{coverageAssumption(scenario.coverage, scenario.state)}</p>
        <p>
          {hasPhysicalDamage(scenario.coverage)
            ? `Deductible assumption: $${scenario.deductible.toLocaleString("en-US")} for comprehensive and collision.`
            : "Deductible not applied. This package has no comprehensive or collision."}
        </p>
        <p>Package name on the controls: {coverageLabel}. These limits are an assumption, not a recommendation.</p>
      </section>

      <section className="grid gap-2" aria-labelledby="worksheet-range">
        <h3 id="worksheet-range" className="text-base font-semibold">
          {modeled ? ENGINE_RANGE_HEADING : SAMPLE_RANGE_HEADING}
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Fact term={modeled ? "Low" : "Sample low"} detail={formatDollars(low)} />
          <Fact term={modeled ? "Likely" : "Sample likely"} detail={formatDollars(likely)} />
          <Fact term={modeled ? "High" : "Sample high"} detail={formatDollars(high)} />
          <Fact term="Monthly planning midpoint" detail={formatDollars(monthly)} />
        </dl>
        <p>
          <span className="font-medium">Confidence. </span>
          {modeled
            ? engine.confidenceDetail
            : rangeConfidenceCopy({ catalogStatus, trimConfidence, stale })}
        </p>
        <p>{engine.explanation}</p>
        {anchorAmount !== null ? (
          <p data-testid="worksheet-anchor">
            Entered annual premium {formatDollars(anchorAmount)}. This amount is the
            visitor&apos;s anchor for this scenario. It is not a cleared baseline.
          </p>
        ) : (
          <p>
            No current annual premium is entered. The dollars above are a labeled
            sample, not this engine&apos;s output.
          </p>
        )}
      </section>

      <section className="grid gap-2" aria-labelledby="worksheet-professional" data-testid="worksheet-professional">
        <h3 id="worksheet-professional" className="text-base font-semibold">
          Licensed professional’s figure
        </h3>
        <p>{PROFESSIONAL_PROMPT}</p>
        <p>Annual</p>
        <div className="write-line" />
        <p>Monthly</p>
        <div className="write-line" />
      </section>

      <section className="grid gap-2" aria-labelledby="worksheet-saved">
        <h3 id="worksheet-saved" className="text-base font-semibold">
          Saved on this browser
        </h3>
        {!trayReady ? (
          <p>Saved scenarios are still being read from this browser.</p>
        ) : saved.length === 0 ? (
          <p>No scenario is saved on this browser.</p>
        ) : (
          <ul className="grid gap-2">
            {saved.map((item) => (
              <li key={item.id}>
                {item.label}. {vehicleLabel(item.scenario)}. {stateName(item.scenario.state)},{" "}
                {regionLabel(item.scenario.region).toLowerCase()}.{" "}
                {COVERAGE_PACKAGES.find((entry) => entry.id === item.scenario.coverage)?.label}.{" "}
                {item.anchorAmount === null
                  ? "No current premium saved with this scenario."
                  : `Visitor anchor ${formatDollars(item.anchorAmount)}. Not a cleared baseline.`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2" aria-labelledby="worksheet-sources">
        <h3 id="worksheet-sources" className="text-base font-semibold">
          Sources and versions
        </h3>
        <dl className="grid gap-2">
          <Fact term="Model" detail={MODEL_VERSION} />
          <Fact term="Data bundle" detail={DATA_BUNDLE_VERSION} />
          <Fact term="Manifest" detail={MANIFEST_VERSION} />
          <Fact
            term="Catalog"
            detail={`${CATALOG_VERSION}, retrieved ${formatCatalogDate(CATALOG_RETRIEVED_ON)}.`}
          />
          <Fact
            term="Factor bundle"
            detail={`Effective ${formatCatalogDate(FACTOR_EFFECTIVE_DATE)}. Trend is not applied.`}
          />
          <Fact
            term="State rules"
            detail={`${STATE_RULES_VERSION}. Table checked ${formatCatalogDate(STATE_RULES_CHECKED_ON)}.`}
          />
          <Fact term="This state" detail={stateSourceDetail(scenario)} />
        </dl>
        {scenario.coverage === "state-minimum" && rule?.sourceUrl && rule.lastVerified ? (
          <p>
            State minimum source for {stateName(scenario.state)}: {rule.sourceUrl}. Last
            verified {formatVerifiedDate(rule.lastVerified)}.
          </p>
        ) : null}
        <p>
          NAIC auto-database rows in manifest {MANIFEST_VERSION} are not cleared and
          contribute no figures to this range.
        </p>
        <p>{PUBLISHER}</p>
      </section>
    </article>
  )
}

function Fact({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="font-medium">{term}</dt>
      <dd>{detail}</dd>
    </div>
  )
}

function driverDetail(scenario: Scenario): string {
  const age = AGE_BANDS.find((item) => item.id === scenario.age)?.label ?? scenario.age
  const years =
    YEARS_LICENSED.find((item) => item.id === scenario.yearsLicensed)?.label ??
    scenario.yearsLicensed
  const incidents = INCIDENTS.find((item) => item.id === scenario.incidents)?.label ?? scenario.incidents
  const mileage = MILEAGE_BANDS.find((item) => item.id === scenario.mileage)?.label ?? scenario.mileage
  const flags = [
    scenario.teen ? "teen driver" : null,
    scenario.goodStudent ? "good student" : null,
    scenario.driverTraining ? "driver training" : null,
    scenario.householdPolicy ? "household policy" : null,
    scenario.loanLease ? "loan or lease" : null,
  ].filter((item): item is string => item !== null)
  return `Age ${age}. Years licensed ${years}. Incidents ${incidents}. Annual mileage ${mileage}. ${
    flags.length > 0 ? flags.join(", ") : "No driver flags"
  }. One driver.`
}

function locationDetail(scenario: Scenario): string {
  const credit =
    scenario.state === "CA"
      ? "No credit control. The factor stays at 1.00. California credit rules are unreviewed."
      : "No credit control. The lawful sensitivity factor stays at 1.00."
  return `${stateName(scenario.state)}, ${regionLabel(scenario.region).toLowerCase()}. ${credit}`
}

function vehicleDetail(
  scenario: Scenario,
  trimConfidence: TrimConfidence | null,
  catalogStatus: CatalogStatus,
  stale: boolean,
): string {
  const trim =
    trimConfidence === null
      ? "Trim confidence is not available yet."
      : trimConfidenceCopy(trimConfidence, CATALOG_VERSION, CATALOG_RETRIEVED_ON)
  const catalog =
    catalogStatus === "loading"
      ? "The vehicle catalog is loading."
      : catalogStatus === "failed"
        ? "The vehicle catalog did not load."
        : stale
          ? "This snapshot is past its refresh date."
          : ""
  return [vehicleLabel(scenario), trim, catalog].filter(Boolean).join(" ")
}

function stateSourceDetail(scenario: Scenario): string {
  const rule = stateRule(scenario.state)
  if (!rule || rule.sourceUrl === null || rule.lastVerified === null) {
    return `${stateName(scenario.state)} has no source URL in the state-rules table.`
  }
  return `${stateName(scenario.state)} source last verified ${formatVerifiedDate(rule.lastVerified)}.`
}
