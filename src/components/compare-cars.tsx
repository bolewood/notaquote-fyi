"use client"

import { CarPicker } from "@/components/car-picker"
import { DisclaimerText } from "@/components/disclaimer-text"
import {
  AgeField,
  CoverageField,
  DeductibleField,
  DiscountFields,
  MileageField,
  PolicyField,
  RecordField,
  RegionField,
  StateField,
  YearsField,
} from "@/components/driver-fields"
import { VehicleFixLink } from "@/components/how-we-got-this"
import { formatDollars, RangeBar, rangeWords } from "@/components/money"
import { ShareBox } from "@/components/share-box"
import { carKey, FIRST_CARS, POPULAR_SUVS, resolveCar, TRUCKS_AND_FUN, type QuickCar } from "@/lib/car-search"
import { vehicleFacts } from "@/lib/catalog-class"
import { catalogYears, type VehiclePick } from "@/lib/catalog"
import {
  buildRows,
  csvFilename,
  DEFAULT_SORT,
  filterRows,
  headlineAmount,
  nextSort,
  parseMaxYearly,
  scaleFor,
  sortRows,
  toCsv,
  type CompareMode,
  type CompareRow,
  type SortKey,
  type SortState,
} from "@/lib/compare-table"
import {
  addCars,
  clearCars,
  COMPARE_LIMIT,
  DEFAULT_COMPARE,
  removeCar,
  toggleStar,
  type CompareList,
} from "@/lib/comparison-tray"
import { DATA_BUNDLE_VERSION, DISCLAIMER, MODEL_VERSION } from "@/lib/copy"
import { recordCount, recordMountedCount } from "@/lib/counts"
import { typicalStart } from "@/lib/factor-engine"
import { driverOnlyEstimate, parentFor, priceCars, priceCarsTeenAdded, reasonFor, startingPoint, startLine } from "@/lib/pricing"
import { situationSentence, shortVehicleLabel, withTeenFlag, type Scenario } from "@/lib/scenario"
import { decodeShareSearch, encodeSharePath, SHARE_INVALID_NOTE, shareArrivalNotes } from "@/lib/share-link"
import { DEFAULT_SITUATION } from "@/lib/situation"
import { useCatalog } from "@/lib/use-catalog"
import { useCompareList, useSituation } from "@/lib/use-stored"
import { cn } from "cn"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Download, Plus, Printer, Star, Trash2, X } from "lucide-react"
import Link from "next/link"
import { Fragment, useEffect, useMemo, useState } from "react"

const QUICK_GROUPS: { id: string; label: string; cars: readonly QuickCar[] }[] = [
  { id: "first", label: "Popular first cars", cars: FIRST_CARS },
  { id: "suv", label: "Popular SUVs", cars: POPULAR_SUVS },
  { id: "fun", label: "Trucks and fun ones", cars: TRUCKS_AND_FUN },
]

const SORT_LABELS: Record<SortKey, string> = {
  order: "The order you added them",
  car: "Car name",
  yearly: "Yearly estimate",
  monthly: "Monthly",
  range: "How sure we are (narrowest range)",
  reason: "Why",
}

function readInitial(search: string) {
  const decoded = decodeShareSearch(search)
  if (decoded.status === "ok" && decoded.cars) {
    const list: CompareList = {
      driver: decoded.scenario,
      teenOnParentPolicy: decoded.teenOnParentPolicy,
      useMyPremium: false,
      cars: decoded.cars,
    }
    return { list, notes: shareArrivalNotes(decoded) }
  }
  return {
    list: null as CompareList | null,
    notes: decoded.status === "absent" ? [] : [SHARE_INVALID_NOTE],
  }
}

export function CompareCars({ initialSearch = "" }: { initialSearch?: string }) {
  const [initial] = useState(() => readInitial(initialSearch))
  const stored = useCompareList()
  const situationStore = useSituation()
  const catalogLoad = useCatalog()
  const catalog = catalogLoad.catalog

  const [linked, setLinked] = useState<CompareList | null>(initial.list)
  const list = linked ?? stored.value ?? DEFAULT_COMPARE
  const situation = situationStore.value ?? DEFAULT_SITUATION
  const driver = list.driver

  const [notes, setNotes] = useState(initial.notes)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [maxText, setMaxText] = useState("")
  const [starredOnly, setStarredOnly] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [quickYear, setQuickYear] = useState(2022)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    recordMountedCount("compare_session")
    const onPrint = () => {
      recordCount("print")
    }
    window.addEventListener("beforeprint", onPrint)
    return () => window.removeEventListener("beforeprint", onPrint)
  }, [])

  function save(next: CompareList) {
    stored.write({ ...next, driver: withTeenFlag(next.driver) })
    setLinked(null)
  }

  function patchDriver(partial: Partial<Scenario>) {
    recordCount("adjustment")
    save({ ...list, driver: { ...driver, ...partial } })
  }

  function add(picks: VehiclePick[]) {
    const result = addCars(list, picks)
    if (result.added > 0) {
      for (let index = 0; index < result.added; index += 1) recordCount("compare_add")
      save(result.list)
    }
    if (result.skipped === "full") setMessage(`That's ${COMPARE_LIMIT} cars, the most a list can hold. Remove one to add another.`)
    else if (result.skipped === "duplicate" && result.added === 0) setMessage("That car is already in your list.")
    else if (result.added > 1) setMessage(`Added ${result.added} cars.`)
    else setMessage(null)
  }

  // Prices, all from the engine.
  // A teen added to a parent's policy is priced one car at a time as the
  // extra on the household's policy; everyone else is priced on their own.
  const mode: CompareMode = driver.age === "16-18" && list.teenOnParentPolicy ? "added" : "own"
  const parent = useMemo(() => parentFor(driver, situation), [driver, situation])
  // What they pay now only makes sense as the start when it's an adult's policy.
  const canUsePremium = situation.premium !== null && (mode === "own" || situation.scenario.age !== "16-18")
  const usePremium = list.useMyPremium && canUsePremium
  const start = useMemo(() => {
    if (usePremium) return startingPoint(situation, vehicleFacts(catalog, situation.scenario))
    return mode === "added" ? typicalStart(parent, { teenOnParentPolicy: true }) : typicalStart(driver)
  }, [usePremium, situation, catalog, driver, parent, mode])
  const rows = useMemo<CompareRow[]>(() => {
    if (!start || list.cars.length === 0) return []
    const facts = list.cars.map((car) => vehicleFacts(catalog, car))
    const priced =
      mode === "added"
        ? priceCarsTeenAdded(start, parent, facts).map((item) => ({ estimate: item.after, extra: item.increase }))
        : priceCars(start, driver, facts).map((item) => ({ estimate: item.estimate, extra: null }))
    return buildRows(priced, list.cars, (estimate, car) => reasonFor(estimate, car.year, driver))
  }, [start, list, catalog, driver, parent, mode])
  const driverNote = start ? driverOnlyEstimate(start, driver, mode === "added" ? parent : null).rangeNote : null

  const maxYearly = parseMaxYearly(maxText)
  const visible = sortRows(filterRows(rows, { maxYearly, starredOnly }), sort)
  const scale = scaleFor(rows)
  const lowest = rows.length > 1 ? Math.min(...rows.map(headlineAmount)) : null
  const starredCount = list.cars.filter((car) => car.starred).length
  const hidden = rows.length - visible.length

  function download() {
    recordCount("csv_download")
    const csv = toCsv(
      visible,
      {
        driver: situationSentence(driver, list.teenOnParentPolicy, false),
        start: start ? startLine(start) : "",
        disclaimer: DISCLAIMER,
        versions: `Model ${MODEL_VERSION}, data ${DATA_BUNDLE_VERSION}`,
      },
      mode,
    )
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = csvFilename()
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const added = mode === "added"
  const mainAmount = (row: CompareRow) => (row.extra !== null ? `+${formatDollars(row.extra)}` : formatDollars(row.likely))
  const monthAmount = (row: CompareRow) =>
    row.extra !== null ? `+${formatDollars(Math.round(row.extra / 12))}` : formatDollars(row.monthly)
  const years = catalog ? catalogYears(catalog) : [quickYear]
  const full = list.cars.length >= COMPARE_LIMIT

  return (
    <>
      <div className="no-print">
        <section className="max-w-3xl pt-6 sm:pt-8">
          <p className="eyebrow text-sun-ink">Compare cars</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Which car costs the least to insure?
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            Add up to {COMPARE_LIMIT} cars. We&apos;ll price each one for the same driver, so you can sort them, star the
            favorites, and narrow it down together.
          </p>
        </section>

        {notes.length > 0 ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3" data-testid="share-notice">
            <div className="grid flex-1 gap-1 text-sm">
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setNotes([])}>
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        {stored.error ? <p className="mt-4 text-sm">{stored.error}</p> : null}
      </div>

      <div className="mt-6 grid items-start gap-5 lg:mt-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,9fr)] lg:gap-6 print:mt-0 print:block">
        {/* Driver */}
        <section aria-labelledby="driver-heading" className="card no-print p-5 lg:sticky lg:top-4">
          <h2 id="driver-heading" className="text-lg font-semibold">
            Who&apos;s driving?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Every car in the list is priced for this driver.</p>
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
              <AgeField scenario={driver} onChange={patchDriver} idPrefix="driver" />
              <StateField scenario={driver} onChange={patchDriver} idPrefix="driver" />
            </div>
            {driver.age === "16-18" ? (
              <PolicyField
                value={list.teenOnParentPolicy}
                onChange={(teenOnParentPolicy) => {
                  recordCount("adjustment")
                  save({ ...list, teenOnParentPolicy })
                }}
                idPrefix="driver"
              />
            ) : null}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
              <RegionField scenario={driver} onChange={patchDriver} idPrefix="driver" />
              <CoverageField scenario={driver} onChange={patchDriver} idPrefix="driver" showNote={false} />
            </div>
            <details className="group rounded-xl border border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-sm font-medium">
                More about the driver
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid gap-3 border-t border-border px-3.5 py-3.5">
                <DeductibleField scenario={driver} onChange={patchDriver} idPrefix="driver" />
                <RecordField scenario={driver} onChange={patchDriver} idPrefix="driver" />
                <MileageField scenario={driver} onChange={patchDriver} idPrefix="driver" />
                <YearsField scenario={driver} onChange={patchDriver} idPrefix="driver" />
                <DiscountFields scenario={driver} onChange={patchDriver} idPrefix="driver" />
              </div>
            </details>
            <div className="rounded-xl bg-muted/70 p-3.5 text-sm leading-snug">
              {canUsePremium ? (
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                    checked={list.useMyPremium}
                    onChange={(event) => save({ ...list, useMyPremium: event.target.checked })}
                  />
                  <span>
                    {mode === "added"
                      ? `Start from the ${formatDollars(situation.premium ?? 0)} a year your whole policy costs now, with your ${shortVehicleLabel(situation.scenario)}.`
                      : `Start from the ${formatDollars(situation.premium ?? 0)} a year you pay now for your ${shortVehicleLabel(situation.scenario)}.`}{" "}
                    It stays on your device.
                  </span>
                </label>
              ) : (
                <p>
                  We start from a typical price for the driver&apos;s state.{" "}
                  <Link href="/#now" className="link">
                    {mode === "added" ? "Tell us what your whole policy costs now" : "Tell us what you pay now"}
                  </Link>{" "}
                  and we&apos;ll start from your real number instead.
                </p>
              )}
              {mode === "added" ? (
                <p className="mt-2 text-muted-foreground">
                  Each car is priced as the car on your policy, with your teen added as a driver. The main number is what
                  adding them costs.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Cars */}
        <section aria-labelledby="cars-heading" className="card min-w-0 overflow-hidden">
          <div className="print-only px-5 pt-5">
            <p style={{ fontSize: "16pt", fontWeight: 600 }}>NotAQuote.FYI: comparing cars</p>
            <p>
              {situationSentence(driver, list.teenOnParentPolicy, false)} Printed{" "}
              {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
            </p>
          </div>
          <div className="no-print grid gap-4 border-b border-border px-5 pt-5 pb-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="cars-heading" className="text-lg font-semibold">
                Your cars{" "}
                <span className="text-base font-normal text-muted-foreground" data-testid="car-count">
                  ({list.cars.length} of {COMPARE_LIMIT})
                </span>
              </h2>
              <button type="button" className="btn btn-primary" onClick={() => setPickerOpen(true)} disabled={full}>
                <Plus className="size-4" aria-hidden="true" /> Add a car
              </button>
            </div>
            <details key={list.cars.length === 0 ? "empty" : "some"} open={list.cars.length === 0} className="group grid gap-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                <ChevronDown className="size-4 -rotate-90 transition-transform group-open:rotate-0" aria-hidden="true" />
                {list.cars.length === 0 ? "Popular cars, one tap each" : "Add popular cars"}
              </summary>
              <div className="mt-3 grid gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">Quick add</span>
                <label htmlFor="quick-year" className="text-muted-foreground">
                  model year
                </label>
                <select
                  id="quick-year"
                  className="field-select min-h-8 w-auto py-0.5 text-sm"
                  value={quickYear}
                  onChange={(event) => setQuickYear(Number(event.target.value))}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              {QUICK_GROUPS.map((group) => {
                const picks = catalog
                  ? group.cars.flatMap((car) => {
                      const pick = resolveCar(catalog, quickYear, car)
                      return pick ? [pick] : []
                    })
                  : []
                const listed = new Set(list.cars.map((car) => carKey(car)))
                const remaining = picks.filter((pick) => !listed.has(carKey(pick)))
                return (
                  <div key={group.id} className="grid gap-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">{group.label}</p>
                      {group.id === "first" && remaining.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
                          onClick={() => add(remaining)}
                          disabled={full}
                          data-testid="add-all-first-cars"
                        >
                          Add all {Math.min(remaining.length, COMPARE_LIMIT - list.cars.length)}
                        </button>
                      ) : null}
                    </div>
                    <div className="scroll-row -mx-1 px-1 pb-1 sm:flex-wrap">
                      {picks.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {catalog ? `None listed for ${quickYear}.` : "Loading the list of cars…"}
                        </span>
                      ) : (
                        picks.map((pick) => {
                          const inList = listed.has(carKey(pick))
                          return (
                            <button
                              key={carKey(pick)}
                              type="button"
                              className="chip shrink-0"
                              aria-pressed={inList}
                              disabled={!inList && full}
                              onClick={() => (inList ? save(removeCar(list, carKey(pick))) : add([pick]))}
                              title={inList ? "In your list. Click to remove." : undefined}
                            >
                              {inList ? <CheckMark /> : <Plus className="size-3.5" aria-hidden="true" />}
                              {pick.make} {pick.model}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
            </details>
            {message ? (
              <p className="text-sm" role="status">
                {message}
              </p>
            ) : null}
          </div>

          {rows.length > 0 ? (
            <>
              <div className="no-print flex flex-wrap items-end gap-x-5 gap-y-3 border-b border-border px-5 py-3 sm:px-6">
                <div className="grid gap-1">
                  <label htmlFor="max-yearly" className="field-label">
                    Only show under
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      id="max-yearly"
                      className="field-input min-h-10 w-40 pr-16 pl-7"
                      inputMode="numeric"
                      placeholder="3,000"
                      value={maxText}
                      onChange={(event) => setMaxText(event.target.value)}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                      a year
                    </span>
                  </div>
                </div>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={starredOnly}
                    onChange={(event) => setStarredOnly(event.target.checked)}
                  />
                  Only starred ({starredCount})
                </label>
                <div className="grid gap-1 sm:hidden">
                  <label htmlFor="sort-mobile" className="field-label">
                    Sort by
                  </label>
                  <select
                    id="sort-mobile"
                    className="field-select min-h-10"
                    value={`${sort.key}:${sort.direction}`}
                    onChange={(event) => {
                      const [key, direction] = event.target.value.split(":") as [SortKey, "asc" | "desc"]
                      setSort({ key, direction })
                    }}
                  >
                    <option value="yearly:asc">Lowest price first</option>
                    <option value="yearly:desc">Highest price first</option>
                    <option value="car:asc">Car name, A to Z</option>
                    <option value="range:asc">Narrowest range first</option>
                    <option value="order:asc">The order you added them</option>
                  </select>
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button type="button" className="btn" onClick={download} data-testid="download-csv">
                    <Download className="size-4" aria-hidden="true" /> Spreadsheet (CSV)
                  </button>
                  <button type="button" className="btn" onClick={() => window.print()}>
                    <Printer className="size-4" aria-hidden="true" /> Print
                  </button>
                </div>
              </div>

              {hidden > 0 ? (
                <p className="no-print border-b border-border bg-sun-soft px-5 py-2 text-sm sm:px-6" role="status">
                  Showing {visible.length} of {rows.length}. {hidden} hidden by your filters.{" "}
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      setMaxText("")
                      setStarredOnly(false)
                    }}
                  >
                    Show all
                  </button>
                </p>
              ) : null}

              {/* Wide screens: a real table. */}
              <div className="hidden overflow-x-auto sm:block print:block">
                <table className="compare-table w-full border-collapse text-left text-sm" data-testid="compare-table">
                  <caption className="sr-only">
                    Estimated yearly insurance cost for each car, for the same driver. Column headers sort the table.
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="w-10 py-2.5 pl-4">
                        <span className="sr-only">Starred</span>
                      </th>
                      <SortHeader label="Car" sortKey="car" sort={sort} onSort={setSort} className="min-w-44" />
                      <SortHeader label={added ? "Extra for your teen" : "Yearly"} sortKey="yearly" sort={sort} onSort={setSort} align="right" />
                      <SortHeader label={added ? "A month" : "Monthly"} sortKey="monthly" sort={sort} onSort={setSort} align="right" className="hidden md:table-cell print:table-cell" />
                      <SortHeader label={added ? "Whole policy, a year" : "Range"} sortKey="range" sort={sort} onSort={setSort} className="min-w-44" />
                      <SortHeader label="Why" sortKey="reason" sort={sort} onSort={setSort} className="hidden lg:table-cell print:table-cell" />
                      <th scope="col" className="no-print w-12 py-2.5 pr-4">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => (
                      <Fragment key={row.key}>
                        <tr
                          className={cn("border-b border-border align-middle", row.starred && "bg-star/10")}
                          data-testid="compare-row"
                        >
                          <td className="py-2.5 pl-4">
                            <StarButton row={row} onToggle={() => save(toggleStar(list, row.key))} />
                          </td>
                          <td className="py-2.5 pr-3">
                            <button
                              type="button"
                              className="grid text-left"
                              aria-expanded={openRow === row.key}
                              onClick={() => setOpenRow(openRow === row.key ? null : row.key)}
                            >
                              <span className="font-medium hover:underline">{row.name}</span>
                              <span className="text-xs text-muted-foreground">{row.trim}</span>
                            </button>
                          </td>
                          <td className="money py-2.5 pr-3 text-right whitespace-nowrap">
                            <span className="text-base font-semibold">{mainAmount(row)}</span>
                            {headlineAmount(row) === lowest ? (
                              <span className="ml-1.5 rounded-full bg-down-soft px-1.5 py-0.5 text-[0.7rem] font-semibold text-down">
                                Lowest
                              </span>
                            ) : null}
                          </td>
                          <td className="money hidden py-2.5 pr-3 text-right text-muted-foreground md:table-cell print:table-cell">
                            {monthAmount(row)}
                          </td>
                          <td className="py-2.5 pr-3">
                            {scale ? (
                              <RangeBar low={row.low} likely={row.likely} high={row.high} min={scale.min} max={scale.max} />
                            ) : null}
                            <span className="money mt-1 block text-xs text-muted-foreground">
                              {added ? `About ${formatDollars(row.likely)} (${formatDollars(row.low)}–${formatDollars(row.high)})` : `${formatDollars(row.low)}–${formatDollars(row.high)}`}
                            </span>
                          </td>
                          <td className="hidden max-w-64 min-w-48 py-2.5 pr-3 text-sm leading-snug lg:table-cell print:table-cell">{row.reason}</td>
                          <td className="no-print py-2.5 pr-4 text-right">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Remove ${row.name}`}
                              onClick={() => save(removeCar(list, row.key))}
                            >
                              <X className="size-4" />
                            </button>
                          </td>
                        </tr>
                        {openRow === row.key ? (
                          <tr className="no-print border-b border-border bg-muted/50">
                            <td />
                            <td colSpan={6} className="py-3 pr-4">
                              <RowDetails row={row} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phones: one card per car. */}
              <ul className="grid gap-0 sm:hidden print:hidden" data-testid="compare-cards">
                {visible.map((row) => (
                  <li key={row.key} className={cn("border-b border-border px-4 py-3.5", row.starred && "bg-star/10")}>
                    <div className="flex items-start gap-2">
                      <StarButton row={row} onToggle={() => save(toggleStar(list, row.key))} />
                      <button
                        type="button"
                        className="grid min-w-0 flex-1 text-left"
                        aria-expanded={openRow === row.key}
                        onClick={() => setOpenRow(openRow === row.key ? null : row.key)}
                      >
                        <span className="font-medium">{row.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{row.trim}</span>
                      </button>
                      <div className="money text-right">
                        <p className="text-lg leading-tight font-semibold">{mainAmount(row)}</p>
                        <p className="text-xs text-muted-foreground">{added ? "extra a year" : `${formatDollars(row.monthly)} a month`}</p>
                      </div>
                      <button type="button" className="icon-btn -mr-2" aria-label={`Remove ${row.name}`} onClick={() => save(removeCar(list, row.key))}>
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 pl-11">
                      {scale ? <RangeBar low={row.low} likely={row.likely} high={row.high} min={scale.min} max={scale.max} /> : null}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {headlineAmount(row) === lowest ? <span className="mr-1 font-semibold text-down">Lowest.</span> : null}
                        {added ? `Whole policy about ${formatDollars(row.likely)}, ` : ""}
                        {rangeWords(row.low, row.high)} · {row.reason}
                      </p>
                      {openRow === row.key ? (
                        <div className="mt-3">
                          <RowDetails row={row} />
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              {visible.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No cars match your filters.</p>
              ) : null}

              <div className="grid gap-3 px-5 py-4 text-sm sm:px-6">
                {driverNote ? <p className="text-muted-foreground">{driverNote}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {start ? startLine(start) : null}{" "}
                  <span className="no-print">Click a car to see how we got its number.</span>{" "}
                  <Link href="/methodology" className="link no-print">
                    Here&apos;s how it all works
                  </Link>
                </p>
                <div className="no-print flex flex-wrap items-start justify-between gap-3 border-t border-border pt-4">
                  <ShareBox
                    what="this list of cars"
                    premiumAvailable={false}
                    buildPath={() =>
                      encodeSharePath({
                        page: "/compare",
                        scenario: driver,
                        teenOnParentPolicy: list.teenOnParentPolicy,
                        cars: list.cars,
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-quiet text-muted-foreground"
                    onClick={() => {
                      save(clearCars(list, starredCount > 0))
                      setOpenRow(null)
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {starredCount > 0 ? "Clear all but starred" : "Clear the list"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid justify-items-center gap-2 px-6 py-12 text-center" data-testid="compare-empty">
              <p className="text-lg font-semibold">No cars yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Tap a car above to add it, or search for any car. Every one is priced for the same driver, so it&apos;s a fair
                comparison.
              </p>
            </div>
          )}
        </section>
      </div>

      <DisclaimerText className="mt-8 max-w-3xl" />

      <CarPicker
        key={pickerOpen ? "open" : "closed"}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        catalog={catalog}
        catalogStatus={catalogLoad.status}
        initialYear={quickYear}
        title="Add a car to your list"
        actionLabel="Add"
        keepOpen
        isPicked={(pick) => list.cars.some((car) => carKey(car) === carKey(pick))}
        onPick={(pick) => add([pick])}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {list.cars.length} of {COMPARE_LIMIT} cars{message ? `. ${message}` : ""}
            </span>
            <button type="button" className="btn btn-primary" onClick={() => setPickerOpen(false)}>
              Done
            </button>
          </div>
        }
      />
    </>
  )
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarButton({ row, onToggle }: { row: CompareRow; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={cn("icon-btn", row.starred ? "text-star hover:text-star" : "")}
      aria-pressed={row.starred}
      aria-label={row.starred ? `Unstar ${row.name}` : `Star ${row.name}`}
      onClick={onToggle}
    >
      <Star className={cn("size-[1.15rem]", row.starred && "fill-current")} />
    </button>
  )
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string
  sortKey: SortKey
  sort: SortState
  onSort: (sort: SortState) => void
  align?: "left" | "right"
  className?: string
}) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      className={cn("py-1.5 pr-3 font-medium", align === "right" && "text-right", className)}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={cn(
          "inline-flex min-h-8 items-center gap-1 rounded-md px-1 whitespace-nowrap hover:text-foreground",
          active && "text-foreground",
          align === "right" && "flex-row-reverse",
        )}
        onClick={() => onSort(nextSort(sort, sortKey))}
        title={`Sort by ${SORT_LABELS[sortKey].toLowerCase()}`}
      >
        {label}
        <Icon className={cn("size-3.5 no-print", !active && "opacity-40")} aria-hidden="true" />
      </button>
    </th>
  )
}

function RowDetails({ row }: { row: CompareRow }) {
  return (
    <div className="grid gap-2 text-sm leading-relaxed">
      <p>{row.summary}</p>
      <p className="text-muted-foreground">{row.rangeNote}</p>
      <p>
        <VehicleFixLink carName={row.name} shown={row.vehicleShown} />
      </p>
    </div>
  )
}

