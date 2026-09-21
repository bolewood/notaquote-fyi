"use client"

import { ComparisonList, ComparisonSheet, useComparisonTray } from "@/components/comparison-tray"
import { PersonaMark } from "@/components/persona-mark"
import { PrintWorksheet } from "@/components/print-worksheet"
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
  STATE_MINIMUM_COUNSEL_LABEL,
  STATE_MINIMUM_COUNSEL_NOTICE,
} from "@/lib/copy"
import { matchingPersona, rememberComparison, type SavedComparison } from "@/lib/comparison-tray"
import { factorSnapshot, runFactorEngine, type PremiumAnchor } from "@/lib/factor-engine"
import { buildSampleRange, parseAnnualPremium } from "@/lib/sample-range"
import {
  decodeShareSearch,
  encodeSharePath,
  SHARE_INVALID_NOTE,
  shareArrivalNotes,
  type ShareLinkOk,
} from "@/lib/share-link"
import {
  formatVerifiedDate,
  stateRule,
} from "@/lib/state-rules"
import { VehicleFieldset } from "@/components/vehicle-fieldset"
import {
  isCatalogStale,
  trimRecord,
  type TrimConfidence,
} from "@/lib/catalog"
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
  isRegion,
  isStateCode,
  isYearsLicensed,
  MILEAGE_BANDS,
  PERSONA_DETAILS,
  PRESETS,
  REGIONS,
  STATES,
  YEARS_LICENSED,
  hasPhysicalDamage,
  stateName,
  type PersonaId,
  type Scenario,
  type StateCode,
} from "@/lib/scenario"
import { useCatalog } from "@/lib/use-catalog"
import { runVinLookup, selectionAfterVin } from "@/lib/vin-lookup"
import { cn } from "cn"
import { useState } from "react"

const PERSONA_ORDER: PersonaId[] = ["molly", "jayden", "ava"]

function readInitial(search: string) {
  const decoded = decodeShareSearch(search)
  if (decoded.status === "ok") {
    return {
      persona: matchingPersona(decoded.scenario),
      scenario: decoded.scenario,
      premiumText: decoded.anchorAmount === null ? "" : String(decoded.anchorAmount),
      anchor:
        decoded.anchorAmount === null
          ? null
          : { amount: decoded.anchorAmount, snapshot: factorSnapshot(decoded.scenario) },
      arrival: decoded,
      arrivalInvalid: false,
    }
  }
  return {
    persona: "molly" as PersonaId | null,
    scenario: PRESETS.molly,
    premiumText: "",
    anchor: null as PremiumAnchor | null,
    arrival: null as ShareLinkOk | null,
    arrivalInvalid: decoded.status === "invalid",
  }
}

export function Calculator({ initialSearch = "" }: { initialSearch?: string }) {
  const initial = readInitial(initialSearch)
  const [persona, setPersona] = useState<PersonaId | null>(initial.persona)
  const [scenario, setScenario] = useState<Scenario>(initial.scenario)
  const [premiumText, setPremiumText] = useState(initial.premiumText)
  const [premiumError, setPremiumError] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<PremiumAnchor | null>(initial.anchor)
  const [filter, setFilter] = useState("")
  const [vinText, setVinText] = useState("")
  const [vinMessage, setVinMessage] = useState<string | null>(null)
  const [vinPending, setVinPending] = useState(false)
  const [confidenceOverride, setConfidenceOverride] = useState<TrimConfidence | null>(null)
  const tray = useComparisonTray()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [shareIncludedAnchor, setShareIncludedAnchor] = useState(false)
  const arrival = initial.arrival
  const arrivalInvalid = initial.arrivalInvalid
  const catalogLoad = useCatalog()

  const sample = buildSampleRange(scenario, null)
  const catalogTrim = catalogLoad.catalog ? trimRecord(catalogLoad.catalog, scenario) : null
  const trimConfidence = confidenceOverride ?? catalogTrim?.confidence ?? null
  const stale = catalogLoad.catalog
    ? isCatalogStale(catalogLoad.catalog, new Date())
    : false
  const engine = runFactorEngine({
    scenario,
    anchor,
    trimConfidence,
    catalogStatus: catalogLoad.status,
    stale,
  })

  function clearShareDraft() {
    setShareUrl(null)
    setShareStatus(null)
    setShareIncludedAnchor(false)
  }

  function applyPersona(next: PersonaId) {
    setPersona(next)
    setScenario(PRESETS[next])
    setPremiumText("")
    setPremiumError(null)
    setAnchor(null)
    setFilter("")
    setVinText("")
    setVinMessage(null)
    setConfidenceOverride(null)
    clearShareDraft()
  }

  function patch(partial: Partial<Scenario>) {
    const changed = (Object.keys(partial) as (keyof Scenario)[]).some(
      (key) => scenario[key] !== partial[key],
    )
    if (!changed) return
    setPersona(null)
    setScenario((current) => ({ ...current, ...partial }))
    clearShareDraft()
  }

  async function decodeVin() {
    const submitted = vinText
    setVinPending(true)
    try {
      const result = await runVinLookup(submitted, {
        fetchImpl: fetch,
        catalog: catalogLoad.catalog,
        current: scenario,
      })
      if (result.ok) {
        setPersona(null)
        setScenario((current) => ({ ...current, ...selectionAfterVin(current, result) }))
        setConfidenceOverride(result.confidence)
      }
      setVinMessage(result.message)
    } finally {
      setVinText("")
      setVinPending(false)
    }
  }

  function onPremiumChange(value: string) {
    setPremiumText(value)
    clearShareDraft()
    if (value.trim() === "") {
      setAnchor(null)
      setPremiumError(null)
      return
    }
    const parsed = parseAnnualPremium(value)
    if (parsed === null) {
      setAnchor(null)
      setPremiumError(
        "Enter an annual amount from 1 to 100,000, or clear the field to return to the labeled sample.",
      )
      return
    }
    setPremiumError(null)
    setAnchor({ amount: parsed, snapshot: factorSnapshot(scenario) })
  }

  function saveCurrent() {
    tray.replace(
      rememberComparison(tray.items, {
        scenario,
        anchorAmount: anchor?.amount ?? null,
      }),
    )
  }

  function openSaved(item: SavedComparison) {
    setPersona(matchingPersona(item.scenario))
    setScenario(item.scenario)
    setFilter("")
    setVinText("")
    setVinMessage(null)
    setConfidenceOverride(null)
    setPremiumError(null)
    if (item.anchorAmount !== null) {
      setPremiumText(String(item.anchorAmount))
      setAnchor({
        amount: item.anchorAmount,
        snapshot: factorSnapshot(item.scenario),
      })
    } else {
      setPremiumText("")
      setAnchor(null)
    }
    clearShareDraft()
    setSheetOpen(false)
  }

  function removeSaved(id: string) {
    tray.replace(tray.items.filter((item) => item.id !== id))
  }

  function copyShareLink() {
    const path = encodeSharePath({
      scenario,
      anchorAmount: anchor?.amount ?? null,
      baselineCleared: engine.baselineCleared,
    })
    const url = new URL(path, window.location.origin).toString()
    const included = new URL(url).searchParams.has("anchor")
    setShareUrl(url)
    setShareIncludedAnchor(included)
    const clipboard = navigator.clipboard
    if (!clipboard?.writeText) {
      setShareStatus("The share link is shown below. Copy it from there. It was not sent.")
      return
    }
    void clipboard.writeText(url).then(
      () => {
        setShareStatus("Link copied. It carries the inputs and the model and data-bundle versions. It does not freeze a dollar result. It was not sent.")
      },
      () => {
        setShareStatus("The share link is shown below. Copy it from there. It was not sent.")
      },
    )
  }

  const notices = [
    ...(arrivalInvalid ? [SHARE_INVALID_NOTE] : []),
    ...(arrival ? shareArrivalNotes(arrival) : []),
  ]
  const listProps = {
    items: tray.items,
    ready: tray.ready,
    error: tray.error,
    onOpen: openSaved,
    onRemove: removeSaved,
  }

  return (
    <>
    <div className="no-print grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-start lg:gap-8">
      <div className="grid gap-4">
        <RangePanel
          scenario={scenario}
          persona={persona}
          sample={sample}
          engine={engine}
          catalogStatus={catalogLoad.status}
          trimConfidence={trimConfidence}
          stale={stale}
          anchorAmount={anchor?.amount ?? null}
          notices={notices}
        />
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
                className="preset-button h-auto items-start justify-start gap-2 px-3 py-2 text-left whitespace-normal"
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
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={saveCurrent} data-testid="save-scenario">
            Save this scenario
          </Button>
          <Button type="button" variant="outline" onClick={copyShareLink} data-testid="copy-share-link">
            Copy share link
          </Button>
          <Button type="button" variant="outline" onClick={() => window.print()} data-testid="print-worksheet-button">
            Print worksheet
          </Button>
          <Button
            type="button"
            variant="outline"
            className="lg:hidden"
            aria-haspopup="dialog"
            onClick={() => setSheetOpen(true)}
          >
            Saved comparisons ({tray.items.length})
          </Button>
        </div>
        {shareStatus ? (
          <p className="text-sm leading-snug" data-testid="share-status">
            {shareStatus}
          </p>
        ) : null}
        {shareUrl ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium" id="share-link-label">
              Share link
            </p>
            <p
              data-testid="share-url"
              aria-labelledby="share-link-label"
              className="font-mono text-xs leading-snug break-all"
            >
              {shareUrl}
            </p>
            {shareIncludedAnchor ? (
              <p className="text-xs leading-snug" data-testid="share-anchor-note">
                The annual amount in this link is the visitor&apos;s anchor for this
                scenario. It is not a cleared baseline.
              </p>
            ) : (
              <p className="text-muted-foreground text-xs leading-snug">
                No current premium is in this link.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <form
        className="grid gap-2"
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
              placeholder="Empty keeps the labeled sample"
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
                "Empty keeps the labeled sample. An amount is this scenario's anchor, not a cleared baseline. Saving a comparison keeps it in this browser. A share link can include it as that anchor. It is not sent to a server."}
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
            No credit control. The lawful sensitivity factor stays locked at 1.00.
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
              disabled={!hasPhysicalDamage(scenario.coverage)}
              describedBy="deductible-note"
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
            {coverageAssumption(scenario.coverage, scenario.state)}
          </p>
          {scenario.coverage === "state-minimum" ? (
            <StateMinimumSource state={scenario.state} />
          ) : null}
          {hasPhysicalDamage(scenario.coverage) ? (
            <p id="deductible-note" className="text-muted-foreground text-xs leading-snug">
              The deductible assumption applies to comprehensive and collision.
            </p>
          ) : (
            <p id="deductible-note" className="text-muted-foreground text-xs leading-snug">
              The deductible is not applied. This package has no comprehensive or
              collision.
            </p>
          )}
        </fieldset>

        <VehicleFieldset
          pick={scenario}
          catalogStatus={catalogLoad.status}
          catalog={catalogLoad.catalog}
          filter={filter}
          vinText={vinText}
          vinMessage={vinMessage}
          vinPending={vinPending}
          confidence={trimConfidence}
          onFilter={setFilter}
          onVinText={setVinText}
          onDecode={() => void decodeVin()}
          onPick={(pick) => {
            setConfidenceOverride(null)
            patch(pick)
          }}
        />
      </form>
      <div className="hidden lg:block lg:col-span-2" data-testid="comparison-tray">
        <ComparisonList {...listProps} headingId="comparison-heading" />
      </div>
    </div>
    <ComparisonSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
      <ComparisonList {...listProps} headingId="comparison-sheet-heading" />
    </ComparisonSheet>
    <PrintWorksheet
      scenario={scenario}
      persona={persona}
      sample={sample}
      engine={engine}
      anchorAmount={anchor?.amount ?? null}
      trimConfidence={trimConfidence}
      catalogStatus={catalogLoad.status}
      stale={stale}
      saved={tray.items}
      trayReady={tray.ready}
      notices={notices}
    />
    </>
  )
}

function LabeledSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  describedBy,
}: {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
  describedBy?: string
}) {
  return (
    <div className="grid gap-1.5" data-disabled={disabled ? "true" : undefined}>
      <Label htmlFor={id} className={disabled ? "text-muted-foreground font-normal" : undefined}>
        {label}
      </Label>
      <Select
        key={value}
        value={value}
        onValueChange={(next) => {
          if (!next || next === value) return
          onChange(next)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          disabled={disabled}
          aria-describedby={describedBy}
          className="w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70"
        >
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

function StateMinimumSource({ state }: { state: StateCode }) {
  const rule = stateRule(state)
  return (
    <div className="grid gap-2">
      {rule?.sourceUrl && rule.lastVerified ? (
        <p className="text-sm leading-snug">
          <a
            href={rule.sourceUrl}
            className="underline underline-offset-4"
            rel="noreferrer"
            data-testid="state-rule-source"
          >
            Opened page for {stateName(state)}
          </a>
          {", checked "}
          {formatVerifiedDate(rule.lastVerified)}
          {". "}
          <a
            href={`/sources#state-note-${state}`}
            className="underline underline-offset-4"
          >
            Row notes
          </a>
          .
        </p>
      ) : (
        <p className="text-sm leading-snug">
          <a href={`/sources#state-rule-${state}`} className="underline underline-offset-4">
            {stateName(state)} has no source URL in the table
          </a>
          .
        </p>
      )}
      <p className="text-sm leading-snug" data-testid="state-minimum-counsel">
        <span className="font-medium">{STATE_MINIMUM_COUNSEL_LABEL}</span>{" "}
        {STATE_MINIMUM_COUNSEL_NOTICE}
      </p>
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
