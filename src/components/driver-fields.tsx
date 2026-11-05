"use client"

import { CheckField, Segmented, SelectField } from "@/components/fields"
import {
  ageChange,
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
  /** On the "try a change" card: the current value, in words, shown as "Now: …". */
  now?: string
}

const UNDER_26 = ["16-18", "19-21", "22-25"]
const UNDER_22 = ["16-18", "19-21"]

export function AgeField({ scenario, onChange, idPrefix, now, label = "Driver's age" }: Props & { label?: string }) {
  return (
    <SelectField
      now={now}
      id={`${idPrefix}-age`}
      label={label}
      value={scenario.age}
      options={AGE_BANDS.map((band) => ({ value: band.id, label: band.label }))}
      onChange={(value) => {
        if (!isAgeBand(value)) return
        // A brand-new teen driver is usually newly licensed too.
        onChange(ageChange(scenario, value))
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
        { value: "added", label: "Add the teen to our family policy" },
        { value: "own", label: "Teen gets their own policy" },
      ]}
      onChange={(next) => onChange(next === "added")}
    />
  )
}

export function StateField({ scenario, onChange, idPrefix, now }: Props) {
  return (
    <SelectField
      now={now}
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

export function RegionField({ scenario, onChange, idPrefix, now, label = "Where the car is kept" }: Props & { label?: string }) {
  return (
    <SelectField
      now={now}
      id={`${idPrefix}-region`}
      label={label}
      value={scenario.region}
      options={REGIONS.map((region) => ({ value: region.id, label: region.label }))}
      onChange={(value) => {
        if (isRegion(value)) onChange({ region: value })
      }}
    />
  )
}

export function CoverageField({
  scenario,
  onChange,
  idPrefix,
  now,
  showNote = true,
  short = false,
}: Props & { showNote?: boolean; /** Short option text for a narrow column, with the helper below saying what it covers. */ short?: boolean }) {
  return (
    <SelectField
      now={now}
      id={`${idPrefix}-coverage`}
      label="Coverage"
      value={scenario.coverage}
      options={COVERAGE_PACKAGES.map((item) => ({ value: item.id, label: short ? item.label : item.option }))}
      onChange={(value) => {
        if (isCoverageId(value)) onChange({ coverage: value })
      }}
      hint={showNote ? coverageAssumption(scenario.coverage, scenario.state) : undefined}
    />
  )
}

export function DeductibleField({ scenario, onChange, idPrefix, now }: Props) {
  const applies = hasPhysicalDamage(scenario.coverage)
  return (
    <SelectField
      now={now}
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

export function RecordField({ scenario, onChange, idPrefix, now }: Props) {
  return (
    <SelectField
      now={now}
      id={`${idPrefix}-record`}
      label="Driving record (last 3 years)"
      value={scenario.incidents}
      options={INCIDENTS.map((item) => ({ value: item.id, label: item.label }))}
      onChange={(value) => {
        if (isIncidents(value)) onChange({ incidents: value })
      }}
    />
  )
}

export function MileageField({ scenario, onChange, idPrefix, now }: Props) {
  return (
    <SelectField
      now={now}
      id={`${idPrefix}-mileage`}
      label="Miles a year"
      value={scenario.mileage}
      options={MILEAGE_BANDS.map((item) => ({ value: item.id, label: item.option }))}
      onChange={(value) => {
        if (isMileageBand(value)) onChange({ mileage: value })
      }}
    />
  )
}

export function YearsField({ scenario, onChange, idPrefix, now }: Props) {
  const young = UNDER_26.includes(scenario.age)
  return (
    <SelectField
      now={now}
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

/** Discounts for a young driver: shown only when the age qualifies, not greyed out. */
export function DriverDiscountFields({ scenario, onChange, idPrefix }: Props) {
  const student = UNDER_26.includes(scenario.age)
  const training = UNDER_22.includes(scenario.age)
  if (!student && !training) return null
  return (
    <div className="grid gap-0.5 sm:grid-cols-2">
      {student ? (
        <CheckField
          id={`${idPrefix}-student`}
          label="Good student"
          note="Usually a B average or better, under 26."
          checked={scenario.goodStudent}
          onChange={(goodStudent) => onChange({ goodStudent })}
        />
      ) : null}
      {training ? (
        <CheckField
          id={`${idPrefix}-training`}
          label="Took driver training"
          note="A driver's ed course."
          checked={scenario.driverTraining}
          onChange={(driverTraining) => onChange({ driverTraining })}
        />
      ) : null}
    </div>
  )
}

/** Discounts that belong to the policy, not the driver. */
export function PolicyDiscountFields({ scenario, onChange, idPrefix }: Props) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-2">
      <CheckField
        id={`${idPrefix}-bundle`}
        label="Bundled with home or renters"
        note="Same company for both."
        checked={scenario.householdPolicy}
        onChange={(householdPolicy) => onChange({ householdPolicy })}
      />
      {hasPhysicalDamage(scenario.coverage) ? (
        <CheckField
          id={`${idPrefix}-loan`}
          label="Car has a loan or lease"
          note="Lenders usually ask for full coverage."
          checked={scenario.loanLease}
          onChange={(loanLease) => onChange({ loanLease })}
        />
      ) : null}
    </div>
  )
}

/** Every discount, for the starting-point card. */
export function DiscountFields(props: Props) {
  return (
    <div className="grid gap-0.5">
      <DriverDiscountFields {...props} />
      <PolicyDiscountFields {...props} />
    </div>
  )
}
