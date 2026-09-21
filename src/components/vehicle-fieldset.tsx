"use client"

import { Button } from "@/components/ui/button"
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
  catalogFilterIsEmpty,
  catalogMakes,
  catalogModels,
  catalogTrims,
  catalogYears,
  formatCatalogDate,
  isCatalogStale,
  trimConfidenceCopy,
  trimRecord,
  type CatalogStatus,
  type TrimConfidence,
  type VehicleCatalog,
  type VehiclePick,
} from "@/lib/catalog"
import { cn } from "cn"

export function VehicleFieldset({
  pick,
  catalogStatus,
  catalog,
  filter,
  vinText,
  vinMessage,
  vinPending,
  confidence,
  onFilter,
  onVinText,
  onDecode,
  onPick,
}: {
  pick: VehiclePick
  catalogStatus: CatalogStatus
  catalog: VehicleCatalog | null
  filter: string
  vinText: string
  vinMessage: string | null
  vinPending: boolean
  confidence: TrimConfidence | null
  onFilter: (value: string) => void
  onVinText: (value: string) => void
  onDecode: () => void
  onPick: (pick: VehiclePick) => void
}) {
  const ready = catalogStatus === "ready" && catalog !== null
  const years = ready ? catalogYears(catalog) : [pick.year]
  const makes = ready ? catalogMakes(catalog, pick.year, filter) : [pick.make]
  const models = ready ? catalogModels(catalog, pick.year, pick.make, filter) : [pick.model]
  const trimOptions = ready
    ? catalogTrims(catalog, pick.year, pick.make, pick.model, filter)
    : [{ name: pick.trim, confidence: confidence ?? "unresolved" }]
  const visibleMakes = withCurrent(makes, pick.make)
  const visibleModels = withCurrent(models, pick.model)
  const visibleTrims = withCurrent(
    trimOptions.map((trim) => trim.name),
    pick.trim,
  )
  const empty = ready && catalogFilterIsEmpty(catalog, pick.year, filter)
  const stale = ready && isCatalogStale(catalog, new Date())
  const record = ready ? trimRecord(catalog, pick) : null
  const shownConfidence = confidence ?? record?.confidence ?? null

  let status = "Loading the vehicle catalog snapshot."
  if (catalogStatus === "failed") {
    status =
      "The vehicle catalog did not load. Year, make, model, and trim stay on the vehicle already shown."
  } else if (empty) {
    status = "Nothing in this snapshot matches that filter."
  } else if (ready && catalog && shownConfidence) {
    status = trimConfidenceCopy(shownConfidence, catalog.version, catalog.retrievedOn)
    if (stale) status = `${status} This snapshot is past its refresh date.`
  } else if (ready && catalog) {
    status = trimConfidenceCopy("unresolved", catalog.version, catalog.retrievedOn)
  }

  function chooseMake(make: string) {
    if (!catalog) return
    const nextModels = catalogModels(catalog, pick.year, make, filter)
    const model = nextModels[0] ?? pick.model
    const nextTrims = catalogTrims(catalog, pick.year, make, model, filter)
    onPick({
      year: pick.year,
      make,
      model,
      trim: nextTrims[0]?.name ?? pick.trim,
    })
  }

  function chooseModel(model: string) {
    if (!catalog) return
    const nextTrims = catalogTrims(catalog, pick.year, pick.make, model, filter)
    onPick({
      ...pick,
      model,
      trim: nextTrims[0]?.name ?? pick.trim,
    })
  }

  function chooseYear(year: number) {
    if (!catalog) return
    const nextMakes = catalogMakes(catalog, year, filter)
    const make = nextMakes.includes(pick.make) ? pick.make : (nextMakes[0] ?? pick.make)
    const nextModels = catalogModels(catalog, year, make, filter)
    const model = nextModels.includes(pick.model) ? pick.model : (nextModels[0] ?? pick.model)
    const nextTrims = catalogTrims(catalog, year, make, model, filter)
    const trim = nextTrims.some((item) => item.name === pick.trim)
      ? pick.trim
      : (nextTrims[0]?.name ?? pick.trim)
    onPick({ year, make, model, trim })
  }

  return (
    <fieldset className="grid gap-1.5">
      <legend className="text-sm font-medium">Vehicle</legend>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <LabeledSelect
          id="model-year"
          label="Model year"
          value={String(pick.year)}
          disabled={!ready}
          options={years.map((year) => ({ value: String(year), label: String(year) }))}
          onChange={(value) => chooseYear(Number(value))}
        />
        <LabeledSelect
          id="make"
          label="Make"
          value={pick.make}
          disabled={!ready}
          options={visibleMakes.map((make) => ({ value: make, label: make }))}
          onChange={chooseMake}
        />
        <LabeledSelect
          id="model"
          label="Model"
          value={pick.model}
          disabled={!ready}
          options={visibleModels.map((model) => ({ value: model, label: model }))}
          onChange={chooseModel}
        />
        <LabeledSelect
          id="trim"
          label="Trim"
          value={pick.trim}
          disabled={!ready}
          describedBy="trim-note"
          options={visibleTrims.map((trim) => ({ value: trim, label: trim }))}
          onChange={(trim) => onPick({ ...pick, trim })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] sm:items-end">
        <div className="grid gap-1">
          <Label htmlFor="catalog-filter" className="text-xs">
            Filter this model year
          </Label>
          <Input
            id="catalog-filter"
            name="catalog-filter"
            value={filter}
            disabled={!ready}
            autoComplete="off"
            spellCheck={false}
            placeholder="Civic, Ioniq"
            aria-describedby="trim-note"
            className="h-8"
            onChange={(event) => onFilter(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="vin" className="text-muted-foreground text-xs font-normal">
            VIN, optional
          </Label>
          <Input
            id="vin"
            name="vin"
            value={vinText}
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={20}
            aria-describedby="vin-hint"
            placeholder="17 characters"
            className="h-8"
            onChange={(event) => onVinText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                onDecode()
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={vinPending}
          className="h-8"
          onClick={onDecode}
        >
          {vinPending ? "Decoding" : "Decode"}
        </Button>
      </div>
      <p id="vin-hint" className="text-muted-foreground text-xs leading-snug">
        A VIN is sent to NHTSA from this browser, then discarded.
        {catalog ? ` Retrieved ${formatCatalogDate(catalog.retrievedOn)}.` : ""}
      </p>
      <p
        id="trim-note"
        role="status"
        className={cn("text-xs leading-snug", empty ? "text-foreground" : undefined)}
      >
        {status}
      </p>
      {vinMessage ? (
        <p id="vin-message" role="status" className="text-xs leading-snug">
          {vinMessage}
        </p>
      ) : null}
    </fieldset>
  )
}

function withCurrent(options: string[], current: string): string[] {
  if (!current || options.includes(current)) return options
  return [current, ...options]
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
  const safe = options.some((option) => option.value === value)
    ? options
    : [{ value, label: value }, ...options]

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
          className="w-full min-w-0 overflow-hidden disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72">
          {safe.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
