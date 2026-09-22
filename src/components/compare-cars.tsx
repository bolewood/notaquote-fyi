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
  addSharedCars,
  carryFromWhatIf,
  clearCars,
  COMPARE_LIMIT,
  defaultCompareFor,
  removeCar,
  toggleStar,
  type CompareList,
} from "@/lib/compare-list"
import { DATA_UPDATED, DISCLAIMER, MODEL_VERSION } from "@/lib/copy"
import { recordCount, recordMountedCount } from "@/lib/counts"
import { typicalStart } from "@/lib/factor-engine"
import {
  distinctReasons,
  driverOnlyEstimate,
  parentFor,
  priceCars,
  priceCarsTeenAdded,
  reasonParts,
  startingPoint,
  startLine,
} from "@/lib/pricing"
import { situationSentence, shortVehicleLabel, withTeenFlag, type Scenario } from "@/lib/scenario"
import { encodeSharePath, SHARE_INVALID_NOTE, shareArrivalNotes } from "@/lib/share-link"
import { PageSkeleton } from "@/components/page-skeleton"
import { readShareArrival, useClearShareFromAddress, useMounted } from "@/lib/use-share-arrival"
import { DEFAULT_SITUATION } from "@/lib/situation"
import { useCatalog } from "@/lib/use-catalog"
import { useCompareList, useSituation } from "@/lib/use-stored"
import { cn } from "cn"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Download, Plus, Printer, Star, Trash2, Trophy, X } from "lucide-react"
import Link from "next/link"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"

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
  policy: "Whole policy",
  range: "How sure we are (narrowest range)",
  reason: "Why",
}

type Arrival = {
  /** A list someone shared, shown until the visitor decides what to do with it. */
  shared: CompareList | null
  /** Cars handed over from the What-if page, added to the visitor's own list. */
  carry: { driver: Scenario; teenOnParentPolicy: boolean; cars: CompareList["cars"] } | null
  notes: string[]
  present: boolean
}

function readArrival(): Arrival {
  const decoded = readShareArrival()
  if (decoded.status === "absent") return { shared: null, carry: null, notes: [], present: false }
  if (decoded.status === "invalid" || !decoded.cars) return { shared: null, carry: null, notes: [SHARE_INVALID_NOTE], present: true }
  if (decoded.via === "whatif") {
    return {
      shared: null,
      carry: { driver: decoded.scenario, teenOnParentPolicy: decoded.teenOnParentPolicy, cars: decoded.cars },
      notes: [],
      present: true,
    }
  }
  const shared: CompareList = {
    driver: decoded.scenario,
    teenOnParentPolicy: decoded.teenOnParentPolicy,
    useMyPremium: false,
    cars: decoded.cars,
  }
  return { shared, carry: null, notes: shareArrivalNotes(decoded), present: true }
}

/** Waits for the browser (saved choices, share link) before drawing, so nothing flashes. */
export function CompareCars() {
  const mounted = useMounted()
  if (!mounted) return <PageSkeleton label="Loading your list" />
  return <CompareCarsReady />
}

function CompareCarsReady() {
  const [initial] = useState(readArrival)
  useClearShareFromAddress(initial.present)
  const stored = useCompareList()
  const situationStore = useSituation()
  const catalogLoad = useCatalog()
  const catalog = catalogLoad.catalog

  const [linked, setLinked] = useState<CompareList | null>(initial.shared)
  const [carried] = useState(() =>
    initial.carry
      ? carryFromWhatIf(stored.value ?? defaultCompareFor(situationStore.value), initial.carry.driver, initial.carry.teenOnParentPolicy, initial.carry.cars)
      : null,
  )
  const write = stored.write
  useEffect(() => {
    // The What-if page handed over its cars: they're the visitor's own, so keep them.
    if (carried) write(carried)
  }, [carried, write])
  const own = stored.value ?? carried ?? defaultCompareFor(situationStore.value)
  const list = linked ?? own
  const situation = situationStore.value ?? DEFAULT_SITUATION
  const driver = list.driver
  const askToMerge = linked !== null && (stored.value?.cars.length ?? 0) > 0
  const [driverOpen, setDriverOpen] = useState(false)

  const [notes, setNotes] = useState(initial.notes)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [maxText, setMaxText] = useState("")
  const [starredOnly, setStarredOnly] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [quickYear, setQuickYear] = useState(2022)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const messageTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    recordMountedCount("compare_session")
    const onPrint = () => {
      recordCount("print")
    }
    window.addEventListener("beforeprint", onPrint)
    return () => window.removeEventListener("beforeprint", onPrint)
  }, [])

  /** A short note that clears itself, so it doesn't linger after it's read. */
  function say(text: string) {
    setMessage(text)
    window.clearTimeout(messageTimer.current)
    messageTimer.current = window.setTimeout(() => setMessage(null), 5000)
  }

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
    if (result.skipped === "full") say(`That's ${COMPARE_LIMIT} cars, the most a list can hold. Remove one to add another.`)
    else if (result.skipped === "duplicate" && result.added === 0) say("That car is already in your list.")
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
    const reasons = distinctReasons(priced.map((item, index) => reasonParts(item.estimate, list.cars[index].year, driver)))
    return buildRows(priced, list.cars, reasons)
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
        versions: `Updated ${DATA_UPDATED} (math version ${MODEL_VERSION})`,
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
        <section className="max-w-3xl pt-8 sm:pt-12">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-[2.6rem]">
            Which car costs the least to insure?
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
            Add up to {COMPARE_LIMIT} cars and we&apos;ll price each one for the same driver. Sort them, star the favorites,
            and narrow the list down together.
          </p>
        </section>

        {notes.length > 0 ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-primary/[0.06] px-4 py-3" data-testid="share-notice">
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
        {askToMerge && linked ? (
          <div className="mt-3 grid gap-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm" data-testid="merge-choice">
            <p>
              Someone shared a list of {linked.cars.length} {linked.cars.length === 1 ? "car" : "cars"} with you. You already
              have a list of {stored.value?.cars.length}. What would you like to do?
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={() => save(linked)}>
                Replace my list with these
              </button>
              <button type="button" className="btn" onClick={() => stored.value && save(addSharedCars(stored.value, linked))}>
                Add these cars to my list
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setLinked(null)}>
                Keep my list
              </button>
            </div>
          </div>
        ) : null}
        {stored.error ? <p className="mt-4 text-sm">{stored.error}</p> : null}
      </div>

      <div className="mt-6 grid items-start gap-5 lg:mt-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,9fr)] lg:gap-6 print:mt-0 print:block">
        {/* Driver */}
        <section aria-labelledby="driver-heading" className="card no-print p-5 sm:p-6 lg:sticky lg:top-4">
          <div className="flex items-start justify-between gap-3">
            <h2 id="driver-heading" className="text-lg font-semibold">
              Who&apos;s driving?
            </h2>
            <button
              type="button"
              className="btn btn-quiet -my-1 lg:hidden"
              aria-expanded={driverOpen}
              aria-controls="driver-form"
              onClick={() => setDriverOpen((open) => !open)}
            >
              {driverOpen ? "Done" : "Edit"}
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground lg:hidden" data-testid="driver-summary">
            {situationSentence(driver, list.teenOnParentPolicy, false)}
          </p>
          <p className="mt-1 hidden text-sm text-muted-foreground lg:block">Every car in your list is priced for this driver.</p>
          <div id="driver-form" className={cn("mt-4 gap-3 lg:grid", driverOpen ? "grid" : "hidden")}>
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
            <details className="disclosure">
              <summary>
                More about the driver
                <ChevronDown className="size-4" aria-hidden="true" />
              </summary>
              <div className="grid gap-3 pb-3">
                <DeductibleField scenario={driver} onChange={patchDriver} idPrefix="driver" />
                <RecordField scenario={driver} onChange={patchDriver} idPrefix="driver" />
                <MileageField scenario={driver} onChange={patchDriver} idPrefix="driver" />
                <YearsField scenario={driver} onChange={patchDriver} idPrefix="driver" />
                <DiscountFields scenario={driver} onChange={patchDriver} idPrefix="driver" />
              </div>
            </details>
            <div className="rounded-2xl bg-muted/70 p-4 text-sm leading-snug">
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
                  We price each car as the one on your policy, with your teen added as a driver. The big number is what
                  adding them costs each year.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Cars */}
        <section aria-labelledby="cars-heading" className="card min-w-0 overflow-hidden">
          <div className="print-only print-sheet pb-3">
            <p style={{ fontSize: "9pt", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              NotAQuote.FYI · {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p style={{ fontSize: "20pt", fontWeight: 650, margin: "4pt 0 4pt" }}>Which car costs the least to insure?</p>
            <p>
              {situationSentence(driver, list.teenOnParentPolicy, false)}{" "}
              {added ? "The big number is what adding your teen costs a year with each car." : "Yearly estimates for each car."}
            </p>
          </div>
          <div className="no-print grid gap-4 border-b border-border px-5 pt-5 pb-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="cars-heading" className="text-xl font-semibold tracking-tight">
                Your cars{" "}
                <span className="text-base font-normal text-muted-foreground" data-testid="car-count">
                  {list.cars.length} of {COMPARE_LIMIT}
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
                <label htmlFor="quick-year" className="text-muted-foreground">
                  Model year
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
                      <p className="text-sm font-semibold">{group.label}</p>
                      {group.id === "first" && remaining.length > 1 ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
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
                              title={inList ? "In your list. Tap to remove." : undefined}
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
              <p className="pop-in rounded-xl bg-sun-soft px-3 py-2 text-sm" role="status">
                {message}
              </p>
            ) : null}
          </div>

          {rows.length > 0 ? (
            <>
              <div className="no-print flex flex-wrap items-end gap-x-5 gap-y-3 border-b border-border px-5 py-3 sm:px-6">
                <div className="grid gap-1">
                  <label htmlFor="max-yearly" className="field-label">
                    {added ? "Only show extra under" : "Only show under"}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      id="max-yearly"
                      className="field-input min-h-10 w-40 pr-16 pl-7"
                      inputMode="numeric"
                      placeholder={added ? "1,000" : "3,000"}
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
                    <tr className="border-b border-border text-sm text-muted-foreground">
                      <th scope="col" className="w-10 py-2.5 pl-4">
                        <span className="sr-only">Starred</span>
                      </th>
                      <SortHeader label="Car" sortKey="car" sort={sort} onSort={setSort} className="min-w-44" />
                      <SortHeader label={added ? "Extra for your teen" : "A year"} sortKey="yearly" sort={sort} onSort={setSort} align="right" />
                      <SortHeader label="A month" sortKey="monthly" sort={sort} onSort={setSort} align="right" className="hidden md:table-cell print:table-cell" />
                      <SortHeader
                        label={added ? "Whole policy a year" : "Where quotes would land"}
                        sortKey={added ? "policy" : "range"}
                        sort={sort}
                        onSort={setSort}
                        className="min-w-44"
                      />
                      <SortHeader
                        label="Why"
                        sortKey="reason"
                        sort={sort}
                        onSort={setSort}
                        className="hidden xl:table-cell print:table-cell"
                      />
                      <th scope="col" className="no-print w-12 py-2.5 pr-4">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => (
                      <Fragment key={row.key}>
                        <tr
                          className={cn("border-b border-border/70 align-middle transition-colors hover:bg-muted/40", row.starred && "bg-star/10 hover:bg-star/15")}
                          data-testid="compare-row"
                        >
                          <td className="py-3 pl-3">
                            <StarButton row={row} onToggle={() => save(toggleStar(list, row.key))} />
                          </td>
                          <td className="py-3 pr-3">
                            <button
                              type="button"
                              className="grid text-left"
                              aria-expanded={openRow === row.key}
                              onClick={() => setOpenRow(openRow === row.key ? null : row.key)}
                            >
                              <span className="font-medium hover:underline">{row.name}</span>
                              <span className="text-xs text-muted-foreground">{row.trim}</span>
                              <span className="mt-0.5 text-xs text-muted-foreground xl:hidden print:hidden">{sentenceCase(row.reason)}</span>
                            </button>
                          </td>
                          <td className="money py-3 pr-3 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              {headlineAmount(row) === lowest ? (
                                <span className="tag bg-down-soft text-down">
                                  <Trophy className="size-3.5" aria-hidden="true" /> Lowest
                                </span>
                              ) : null}
                              <span className="text-lg font-semibold">{mainAmount(row)}</span>
                            </span>
                          </td>
                          <td className="money hidden py-3 pr-4 text-right text-muted-foreground md:table-cell print:table-cell">
                            {monthAmount(row)}
                          </td>
                          <td className="py-3 pr-4">
                            {scale ? (
                              <RangeBar low={row.low} likely={row.likely} high={row.high} min={scale.min} max={scale.max} />
                            ) : null}
                            <span className="money mt-1.5 block text-sm text-muted-foreground">
                              {added ? `${formatDollars(row.likely)} (${formatDollars(row.low)}–${formatDollars(row.high)})` : `${formatDollars(row.low)}–${formatDollars(row.high)}`}
                            </span>
                          </td>
                          <td className="hidden max-w-60 min-w-44 py-3 pr-3 text-sm leading-snug text-muted-foreground xl:table-cell print:table-cell">
                            {sentenceCase(row.reason)}
                          </td>
                          <td className="no-print py-3 pr-4 text-right">
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
                  <li key={row.key} className={cn("border-b border-border/70 px-4 py-4", row.starred && "bg-star/10")}>
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
                        <p className="text-xl leading-tight font-semibold">{mainAmount(row)}</p>
                        <p className="text-sm text-muted-foreground">{added ? "extra a year" : "a year"}</p>
                      </div>
                      <button type="button" className="icon-btn -mr-2" aria-label={`Remove ${row.name}`} onClick={() => save(removeCar(list, row.key))}>
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 pl-11">
                      {scale ? <RangeBar low={row.low} likely={row.likely} high={row.high} min={scale.min} max={scale.max} /> : null}
                      {headlineAmount(row) === lowest ? (
                        <p className="mt-2">
                          <span className="tag bg-down-soft text-down">
                            <Trophy className="size-3.5" aria-hidden="true" /> Lowest
                          </span>
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {added ? `Whole policy about ${formatDollars(row.likely)}, ` : `About ${formatDollars(row.monthly)} a month, `}
                        {rangeWords(row.low, row.high)}. {sentenceCase(row.reason)}.
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
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">No cars match your filters. Try a higher amount, or show them all.</p>
              ) : null}

              <div className="grid gap-3 px-5 py-5 text-sm leading-relaxed sm:px-6">
                <p className="text-muted-foreground">
                  <span className="no-print">Tap a car to see how we got its number. </span>
                  {start ? startLine(start) : null}
                </p>
                {driverNote ? (
                  <details className="disclosure no-print">
                    <summary>
                      Why the ranges are wide
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </summary>
                    <p className="pb-2 text-muted-foreground">
                      {driverNote}{" "}
                      <Link href="/methodology" className="link">
                        Here&apos;s how it all works
                      </Link>
                    </p>
                  </details>
                ) : null}
                {driverNote ? <p className="print-only">{driverNote}</p> : null}
                <div className="print-only">
                  <p>Data updated {DATA_UPDATED}. Every source: notaquote.fyi/sources</p>
                  <DisclaimerText className="mt-1 text-black" />
                </div>
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
            <div className="grid justify-items-center gap-2 px-6 py-14 text-center" data-testid="compare-empty">
              <span className="grid size-10 place-items-center rounded-full bg-sun-soft text-sun-ink" aria-hidden="true">
                <Plus className="size-5" />
              </span>
              <p className="text-lg font-semibold">No cars yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Tap a popular car above, or use Add a car to find any model. Every car is priced for the same driver, so
                it&apos;s a fair comparison.
              </p>
            </div>
          )}
        </section>
      </div>

      <DisclaimerText className="no-print mt-10 max-w-3xl" />

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

/** Shorter words for the table's "Why" column, so a long list stays easy to scan. */
const SHORT_REASONS: Record<string, string> = {
  "more at-fault crash claims": "more at-fault claims",
  "fewer at-fault crash claims": "fewer at-fault claims",
  "higher repair costs": "pricier repairs",
  "lower repair costs": "cheaper repairs",
  "about average claims": "about average",
  "newer car, costs more to replace": "newer, costs more to replace",
  "older car, cheaper to replace": "older, cheaper to replace",
}

/** "more at-fault crash claims, higher repair costs" to "More at-fault claims, pricier repairs". */
function sentenceCase(text: string): string {
  const short = text
    .split(", ")
    .map((part) => SHORT_REASONS[part] ?? part)
    .join(", ")
  return short.charAt(0).toUpperCase() + short.slice(1)
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
      className={cn("icon-btn star-btn", row.starred ? "text-star hover:text-star" : "")}
      aria-pressed={row.starred}
      aria-label={row.starred ? `Unstar ${row.name}` : `Star ${row.name}`}
      onClick={onToggle}
    >
      <Star className={cn("size-5", row.starred && "fill-current")} />
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

