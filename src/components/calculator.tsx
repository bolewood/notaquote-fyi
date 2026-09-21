"use client"

import { PersonaMark } from "@/components/persona-mark"
import { RangePanel } from "@/components/range-panel"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  buildSampleRange,
  parseAnnualPremium,
  sampleWeight,
  type Anchor,
} from "@/lib/sample-range"
import {
  AGE_BANDS,
  COVERAGE_PACKAGES,
  coverageAssumption,
  DEDUCTIBLES,
  INCIDENTS,
  isAgeBand,
  isCoverageId,
  isDeductible,
  isIncidents,
  isMileageBand,
  isModelYear,
  isRegion,
  isStateCode,
  isVehicleId,
  isYearsLicensed,
  MILEAGE_BANDS,
  MODEL_YEARS,
  PERSONA_DETAILS,
  PRESETS,
  REGIONS,
  STATES,
  VEHICLES,
  YEARS_LICENSED,
  hasPhysicalDamage,
  type PersonaId,
  type Scenario,
} from "@/lib/scenario"
import { cn } from "cn"
import { useState } from "react"

const PERSONA_ORDER: PersonaId[] = ["molly", "jayden", "ava"]

export function Calculator() {
  const [persona, setPersona] = useState<PersonaId | null>("molly")
  const [scenario, setScenario] = useState<Scenario>(PRESETS.molly)
  const [premiumText, setPremiumText] = useState("")
  const [premiumError, setPremiumError] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  const range = buildSampleRange(scenario, anchor)
  const weight = sampleWeight(scenario)

  function applyPersona(next: PersonaId) {
    setPersona(next)
    setScenario(PRESETS[next])
    setPremiumText("")
    setPremiumError(null)
    setAnchor(null)
  }

  function patch(partial: Partial<Scenario>) {
    const changed = (Object.keys(partial) as (keyof Scenario)[]).some(
      (key) => scenario[key] !== partial[key],
    )
    if (!changed) return
    setPersona(null)
    setScenario((current) => ({ ...current, ...partial }))
  }

  function onPremiumChange(value: string) {
    setPremiumText(value)
    if (value.trim() === "") {
      setAnchor(null)
      setPremiumError(null)
      return
    }
    const parsed = parseAnnualPremium(value)
    if (parsed === null) {
      setAnchor(null)
      setPremiumError(
        "Enter an annual amount from 1 to 100,000, or clear the field to use the sample baseline.",
      )
      return
    }
    setPremiumError(null)
    setAnchor({ amount: parsed, weight })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-start lg:gap-8">
      <div className="grid gap-4">
        <RangePanel scenario={scenario} persona={persona} range={range} />
        <div
          role="group"
          aria-label="Scenario presets"
          className="grid gap-2 sm:grid-cols-3"
        >
          {PERSONA_ORDER.map((id) => {
            const active = persona === id
            return (
              <Button
                key={id}
                type="button"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => applyPersona(id)}
                className="h-auto items-start justify-start gap-2 px-3 py-2 text-left whitespace-normal"
              >
                <PersonaMark />
                <span className="grid gap-0.5">
                  <span className="font-medium">{PERSONA_DETAILS[id].name}</span>
                  <span
                    className={cn(
                      "text-xs font-normal",
                      active ? "text-primary-foreground/85" : "text-muted-foreground",
                    )}
                  >
                    {PERSONA_DETAILS[id].summary}
                  </span>
                </span>
              </Button>
            )
          })}
        </div>
      </div>

      <form
        className="grid gap-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Driver</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledSelect
              id="age-band"
              label="Age band"
              value={scenario.age}
              options={AGE_BANDS.map((band) => ({
                value: band.id,
                label: band.label,
              }))}
              onChange={(value) => {
                if (isAgeBand(value)) patch({ age: value })
              }}
            />
            <LabeledSelect
              id="years-licensed"
              label="Years licensed"
              value={scenario.yearsLicensed}
              options={YEARS_LICENSED.map((band) => ({
                value: band.id,
                label: band.label,
              }))}
              onChange={(value) => {
                if (isYearsLicensed(value)) patch({ yearsLicensed: value })
              }}
            />
            <LabeledSelect
              id="incidents"
              label="Incidents"
              value={scenario.incidents}
              options={INCIDENTS.map((band) => ({
                value: band.id,
                label: band.label,
              }))}
              onChange={(value) => {
                if (isIncidents(value)) patch({ incidents: value })
              }}
            />
            <LabeledSelect
              id="mileage"
              label="Annual mileage"
              value={scenario.mileage}
              options={MILEAGE_BANDS.map((band) => ({
                value: band.id,
                label: band.label,
              }))}
              onChange={(value) => {
                if (isMileageBand(value)) patch({ mileage: value })
              }}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <FlagToggle
              id="flag-teen"
              label="Teen driver"
              checked={scenario.teen}
              onChange={(teen) => patch({ teen })}
            />
            <FlagToggle
              id="flag-good-student"
              label="Good student"
              checked={scenario.goodStudent}
              onChange={(goodStudent) => patch({ goodStudent })}
            />
            <FlagToggle
              id="flag-driver-training"
              label="Driver training"
              checked={scenario.driverTraining}
              onChange={(driverTraining) => patch({ driverTraining })}
            />
            <FlagToggle
              id="flag-household"
              label="Household policy"
              checked={scenario.householdPolicy}
              onChange={(householdPolicy) => patch({ householdPolicy })}
            />
            <FlagToggle
              id="flag-loan-lease"
              label="Loan or lease"
              checked={scenario.loanLease}
              onChange={(loanLease) => patch({ loanLease })}
            />
          </div>
          <div className="grid gap-1.5 border-t border-border pt-3">
            <Label htmlFor="current-premium" className="text-muted-foreground font-normal">
              Current annual premium, optional
            </Label>
            <Input
              id="current-premium"
              name="current-annual-premium"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              value={premiumText}
              aria-describedby="current-premium-hint"
              aria-invalid={premiumError ? true : undefined}
              placeholder="Empty uses the sample baseline"
              onChange={(event) => onPremiumChange(event.target.value)}
            />
            <p
              id="current-premium-hint"
              className={cn(
                "text-xs leading-snug",
                premiumError ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {premiumError ??
                "Empty uses the sample baseline. An amount re-anchors this scenario and stays on this page only."}
            </p>
          </div>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Location</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledSelect
              id="state"
              label="State"
              value={scenario.state}
              options={STATES.map((state) => ({
                value: state.code,
                label: state.name,
              }))}
              onChange={(value) => {
                if (isStateCode(value)) patch({ state: value })
              }}
            />
            <LabeledSelect
              id="region"
              label="Region class"
              value={scenario.region}
              options={REGIONS.map((region) => ({
                value: region.id,
                label: region.label,
              }))}
              onChange={(value) => {
                if (isRegion(value)) patch({ region: value })
              }}
            />
          </div>
          <p className="text-xs leading-snug">
            No credit control. The sample credit factor stays locked at 1.00.
            {scenario.state === "CA"
              ? " For this California scenario, credit rules are unreviewed, so this tool does not model credit as a rating sensitivity."
              : null}
          </p>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Coverage</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledSelect
              id="coverage"
              label="Coverage package"
              value={scenario.coverage}
              options={COVERAGE_PACKAGES.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onChange={(value) => {
                if (isCoverageId(value)) patch({ coverage: value })
              }}
            />
            <LabeledSelect
              id="deductible"
              label="Deductible assumption"
              value={String(scenario.deductible)}
              options={DEDUCTIBLES.map((amount) => ({
                value: String(amount),
                label: `$${amount.toLocaleString("en-US")}`,
              }))}
              onChange={(value) => {
                const amount = Number(value)
                if (isDeductible(amount)) patch({ deductible: amount })
              }}
            />
          </div>
          <p id="coverage-assumption" className="text-sm leading-snug">
            {coverageAssumption(scenario.coverage)}
          </p>
          {hasPhysicalDamage(scenario.coverage) ? (
            <p className="text-muted-foreground text-xs leading-snug">
              The deductible assumption applies to comprehensive and collision.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs leading-snug">
              The deductible is not applied. This package has no comprehensive or
              collision.
            </p>
          )}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Vehicle</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledSelect
              id="model-year"
              label="Model year stand-in"
              value={String(scenario.year)}
              options={MODEL_YEARS.map((year) => ({
                value: String(year),
                label: String(year),
              }))}
              onChange={(value) => {
                const year = Number(value)
                if (isModelYear(year)) patch({ year })
              }}
            />
            <LabeledSelect
              id="vehicle"
              label="Vehicle stand-in"
              value={scenario.vehicle}
              options={VEHICLES.map((vehicle) => ({
                value: vehicle.id,
                label: vehicle.label,
              }))}
              onChange={(value) => {
                if (isVehicleId(value)) patch({ vehicle: value })
              }}
            />
          </div>
          <p className="text-xs leading-snug">
            The NHTSA catalog is not loaded. These three stand-ins are the only
            vehicles in this version. Honda Civic and Hyundai Ioniq 5 N are not
            included. Trim confidence is not available.
          </p>
        </fieldset>
      </form>
    </div>
  )
}

function LabeledSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function FlagToggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        name={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  )
}
