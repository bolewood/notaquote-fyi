"use client"

import { CheckField, Segmented, SelectField } from "@/components/fields"
import {
  AGE_BANDS,
  COVERAGE_PACKAGES,
  coverageAssumption,
  DEDUCTIBLES,
  hasPhysicalDamage,
  INCIDENTS,
  isAgeBand,
  isCoverageId,
  isDeductible,
  isIncidents,
  isMileageBand,
  isRegion,
  isStateCode,
  isYearsLicensed,
  MILEAGE_BANDS,
  REGIONS,
  STATES,
  YEARS_LICENSED,
  type Scenario,
} from "@/lib/scenario"

type Props = {
  scenario: Scenario
  onChange: (partial: Partial<Scenario>) => void
  /** Keeps ids unique when two forms share a page. */
  idPrefix: string
}

const UNDER_26 = ["16-18", "19-21", "22-25"]
const UNDER_22 = ["16-18", "19-21"]

export function AgeField({ scenario, onChange, idPrefix, label = "Driver's age" }: Props & { label?: string }) {
  return (
    <SelectField
      id={`${idPrefix}-age`}
      label={label}
      value={scenario.age}
      options={AGE_BANDS.map((band) => ({ value: band.id, label: band.label }))}
      onChange={(value) => {
        if (!isAgeBand(value)) return
        // A brand-new teen driver is usually newly licensed too.
        onChange(value === "16-18" && scenario.age !== "16-18" ? { age: value, yearsLicensed: "under-1" } : { age: value })
      }}
    />
  )
}

export function PolicyField({
  value,
  onChange,
  idPrefix,
}: {
  value: boolean
  onChange: (teenOnParentPolicy: boolean) => void
  idPrefix: string
}) {
  return (
    <Segmented
      name={`${idPrefix}-policy`}
      legend="Whose policy?"
      value={value ? "added" : "own"}
      options={[
        { value: "added", label: "Added to my policy" },
        { value: "own", label: "Their own policy" },
      ]}
      onChange={(next) => onChange(next === "added")}
    />
  )
}

export function StateField({ scenario, onChange, idPrefix }: Props) {
  return (
    <SelectField
      id={`${idPrefix}-state`}
      label="State"
      value={scenario.state}
      options={STATES.map((state) => ({ value: state.code, label: state.name }))}
      onChange={(value) => {
        if (isStateCode(value)) onChange({ state: value })
      }}
    />
  )
}

export function RegionField({ scenario, onChange, idPrefix }: Props) {
  return (
    <SelectField
      id={`${idPrefix}-region`}
      label="Where the car is kept"
      value={scenario.region}
      options={REGIONS.map((region) => ({ value: region.id, label: region.label }))}
      onChange={(value) => {
        if (isRegion(value)) onChange({ region: value })
      }}
    />
  )
}

export function CoverageField({ scenario, onChange, idPrefix, showNote = true }: Props & { showNote?: boolean }) {
  return (
    <SelectField
      id={`${idPrefix}-coverage`}
      label="Coverage"
      value={scenario.coverage}
      options={COVERAGE_PACKAGES.map((item) => ({ value: item.id, label: item.label }))}
      onChange={(value) => {
        if (isCoverageId(value)) onChange({ coverage: value })
      }}
      hint={showNote ? coverageAssumption(scenario.coverage, scenario.state) : undefined}
    />
  )
}

export function DeductibleField({ scenario, onChange, idPrefix }: Props) {
  const applies = hasPhysicalDamage(scenario.coverage)
  return (
    <SelectField
      id={`${idPrefix}-deductible`}
      label="Deductible"
      value={String(scenario.deductible)}
      disabled={!applies}
      options={DEDUCTIBLES.map((amount) => ({ value: String(amount), label: `$${amount.toLocaleString("en-US")}` }))}
      onChange={(value) => {
        const amount = Number(value)
        if (isDeductible(amount)) onChange({ deductible: amount })
      }}
      hint={
        applies
          ? "The part of a repair bill you pay yourself before insurance pays the rest."
          : "Only matters with full coverage, the kind that fixes your own car."
      }
    />
  )
}

export function RecordField({ scenario, onChange, idPrefix }: Props) {
  return (
    <SelectField
      id={`${idPrefix}-record`}
      label="Driving record"
      value={scenario.incidents}
      options={INCIDENTS.map((item) => ({ value: item.id, label: item.label }))}
      onChange={(value) => {
        if (isIncidents(value)) onChange({ incidents: value })
      }}
    />
  )
}

export function MileageField({ scenario, onChange, idPrefix }: Props) {
  return (
    <SelectField
      id={`${idPrefix}-mileage`}
      label="Miles driven"
      value={scenario.mileage}
      options={MILEAGE_BANDS.map((item) => ({ value: item.id, label: item.label }))}
      onChange={(value) => {
        if (isMileageBand(value)) onChange({ mileage: value })
      }}
    />
  )
}

export function YearsField({ scenario, onChange, idPrefix }: Props) {
  const young = UNDER_26.includes(scenario.age)
  return (
    <SelectField
      id={`${idPrefix}-years`}
      label="Years licensed"
      value={scenario.yearsLicensed}
      options={YEARS_LICENSED.map((item) => ({ value: item.id, label: item.label }))}
      onChange={(value) => {
        if (isYearsLicensed(value)) onChange({ yearsLicensed: value })
      }}
      hint={young ? "For drivers under 26, age already covers this." : undefined}
    />
  )
}

export function DiscountFields({ scenario, onChange, idPrefix }: Props) {
  const student = UNDER_26.includes(scenario.age)
  const training = UNDER_22.includes(scenario.age)
  return (
    <div className="grid gap-0.5 sm:grid-cols-2">
      <CheckField
        id={`${idPrefix}-student`}
        label="Good student"
        note={student ? "Usually a B average or better." : "Only for drivers under 26."}
        checked={scenario.goodStudent}
        disabled={!student}
        onChange={(goodStudent) => onChange({ goodStudent })}
      />
      <CheckField
        id={`${idPrefix}-training`}
        label="Took driver training"
        note={training ? "A driver's ed course." : "Only for drivers under 22."}
        checked={scenario.driverTraining}
        disabled={!training}
        onChange={(driverTraining) => onChange({ driverTraining })}
      />
      <CheckField
        id={`${idPrefix}-bundle`}
        label="Bundled with home or renters"
        note="Same company for both."
        checked={scenario.householdPolicy}
        onChange={(householdPolicy) => onChange({ householdPolicy })}
      />
      <CheckField
        id={`${idPrefix}-loan`}
        label="Car has a loan or lease"
        note="Lenders usually ask for full coverage."
        checked={scenario.loanLease}
        disabled={!hasPhysicalDamage(scenario.coverage)}
        onChange={(loanLease) => onChange({ loanLease })}
      />
    </div>
  )
}
