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
import { PageSkeleton } from "@/components/page-skeleton"
import { ShareBox } from "@/components/share-box"
import { carKey, FIRST_CARS, POPULAR_SUVS, resolveCar, STARTER_MIX, TRUCKS_AND_FUN, type QuickCar } from "@/lib/car-search"
import { vehicleFacts } from "@/lib/catalog-class"
import { catalogYears, type VehiclePick } from "@/lib/catalog"
import {
  buildRows,
  compareAnswer,
  csvFilename,
  DEFAULT_SORT,
  filterRows,
  gapsToCheapest,
  nextSort,
  parseMaxYearly,
  reasonWords,
  shownAmount,
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
  carryNote,
  clearCars,
  COMPARE_LIMIT,
  defaultCompareFor,
  removeCar,
  toggleStar,
  type CompareList,
} from "@/lib/compare-list"
import { DATA_UPDATED, DISCLAIMER } from "@/lib/copy"
import { recordCount, recordMountedCount } from "@/lib/counts"
import { typicalStart } from "@/lib/factor-engine"
import { dollars, estimateDollars, monthlyDollars, rangeWords, signedDollars } from "@/lib/format"
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
import { AGE_BANDS, situationSentence, shortVehicleLabel, stateName, withTeenFlag, type Scenario } from "@/lib/scenario"
import { encodeSharePath, SHARE_INVALID_NOTE, shareArrivalNotes } from "@/lib/share-link"
import { readShareArrival, useClearShareFromAddress, useMounted } from "@/lib/use-share-arrival"
import { DEFAULT_SITUATION } from "@/lib/situation"
import { useCatalog } from "@/lib/use-catalog"
import { useCompareList, useSituation } from "@/lib/use-stored"
import { cn } from "cn"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Download, Plus, Printer, Send, Star, Trash2, Trophy, X } from "lucide-react"
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
  yearly: "Price",
  monthly: "Price",
  policy: "Whole policy",
  range: "Narrowest range",
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

/** "2022 Honda Civic" and "Civic 4Dr": show the version only when it adds something. */
function versionWords(row: CompareRow): string | null {
  return row.trim && row.trim !== row.car.model ? row.trim : null
}

/** Focus a car's name (the visible copy: table or card), or the list's heading. */
function focusCar(key: string | null) {
  window.setTimeout(() => {
    const targets = key ? Array.from(document.querySelectorAll<HTMLElement>(`[data-focus-key="${CSS.escape(key)}"]`)) : []
    const visible = targets.find((element) => element.offsetParent !== null)
    ;(visible ?? document.getElementById("cars-heading"))?.focus()
  }, 30)
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

  const [notes, setNotes] = useState(() =>
    carried && initial.carry ? [carryNote(carried, initial.carry.cars, (car) => shortVehicleLabel(car))] : initial.notes,
  )
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [maxText, setMaxText] = useState("")
  const [starredOnly, setStarredOnly] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [quickYear, setQuickYear] = useState(2022)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const messageTimer = useRef<number | undefined>(undefined)
  const [removed, setRemoved] = useState<{ name: string; before: CompareList; key: string } | null>(null)
  const removedTimer = useRef<number | undefined>(undefined)
  const [popKey, setPopKey] = useState<string | null>(null)
  /** Phones: the price filter opens from the bottom bar. */
  const [filterOpen, setFilterOpen] = useState(false)

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

  /** Remove a car, offer to undo it for a few seconds, and keep focus on the next car. */
  function remove(row: CompareRow, visibleRows: readonly CompareRow[]) {
    const index = visibleRows.findIndex((item) => item.key === row.key)
    const neighbor = visibleRows[index + 1] ?? visibleRows[index - 1] ?? null
    setRemoved({ name: row.name, before: list, key: row.key })
    window.clearTimeout(removedTimer.current)
    removedTimer.current = window.setTimeout(() => setRemoved(null), 8000)
    save(removeCar(list, row.key))
    if (openRow === row.key) setOpenRow(null)
    focusCar(neighbor?.key ?? null)
  }

  /** Phones: send the list with the share sheet, or copy the link where there isn't one. */
  function shareList() {
    recordCount("share_link_copy")
    const url = new URL(
      encodeSharePath({ page: "/compare", scenario: driver, teenOnParentPolicy: list.teenOnParentPolicy, cars: list.cars }),
      window.location.origin,
    ).toString()
    if (typeof navigator.share === "function") {
      void navigator.share({ title: "NotAQuote.FYI", text: "Here's our list of cars. It's a ballpark, not a quote.", url }).catch(() => undefined)
      return
    }
    void navigator.clipboard?.writeText(url).then(
      () => say("Link copied. It carries your choices, not our estimates."),
      () => say("Copy the link from the share box below."),
    )
  }

  function undoRemove() {
    if (!removed) return
    save(removed.before)
    focusCar(removed.key)
    setRemoved(null)
  }

  function star(row: CompareRow) {
    if (!row.starred) {
      setPopKey(row.key)
      window.setTimeout(() => setPopKey((key) => (key === row.key ? null : key)), 400)
    }
    save(toggleStar(list, row.key))
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
  const driverPoints = start ? driverOnlyEstimate(start, driver, mode === "added" ? parent : null).rangePoints : null

  const maxYearly = parseMaxYearly(maxText)
  const visible = sortRows(filterRows(rows, { maxYearly, starredOnly }), sort)
  const { gaps, cheapest } = gapsToCheapest(visible)
  const topAmount = Math.max(1, ...visible.map(shownAmount))
  const starredCount = list.cars.filter((car) => car.starred).length
  const hidden = rows.length - visible.length
  const added = mode === "added"
  const age = AGE_BANDS.find((band) => band.id === driver.age)?.label ?? driver.age
  const who = `For a ${age}-year-old in ${stateName(driver.state)}${added ? ", added to your policy" : ""}`
  const answer = compareAnswer(visible, mode, who)

  function download() {
    recordCount("csv_download")
    const csv = toCsv(
      visible,
      {
        driver: situationSentence(driver, list.teenOnParentPolicy, false),
        start: start ? startLine(start) : "",
        disclaimer: DISCLAIMER,
        versions: `Data updated ${DATA_UPDATED}`,
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

  const mainAmount = (row: CompareRow) => (row.extra !== null ? signedDollars(row.extra) : estimateDollars(row.likely))
  const monthAmount = (row: CompareRow) => (row.extra !== null ? `+${monthlyDollars(row.extra)}` : monthlyDollars(row.likely))
  const gapWords = (row: CompareRow) => {
    const gap = gaps.get(row.key) ?? 0
    if (!cheapest || row.key === cheapest.key) return null
    if (Math.round(gap / 10) === 0) return `Same as the ${cheapest.car.model}`
    return `${signedDollars(gap)} vs. ${cheapest.car.model}`
  }
  const years = catalog ? catalogYears(catalog) : [quickYear]
  const full = list.cars.length >= COMPARE_LIMIT
  const starterPicks = catalog
    ? STARTER_MIX.flatMap((car) => {
        const pick = resolveCar(catalog, quickYear, car)
        return pick ? [pick] : []
      })
    : []
  const listedKeys = new Set(list.cars.map((car) => carKey(car)))
  const starterRemaining = starterPicks.filter((pick) => !listedKeys.has(carKey(pick)))

  return (
    <>
      <div className="no-print">
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
              This list has {linked.cars.length} {linked.cars.length === 1 ? "car" : "cars"}, and you already have a list of{" "}
              {stored.value?.cars.length}. What would you like to do?
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

      <div className="mt-6 grid items-start gap-5 lg:mt-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,9fr)] lg:gap-6 xl:grid-cols-[20rem_minmax(0,1fr)] print:mt-0 print:block">
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
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
                      ? `Start from the ${dollars(situation.premium ?? 0)} a year your whole policy costs now, with your ${shortVehicleLabel(situation.scenario)}.`
                      : `Start from the ${dollars(situation.premium ?? 0)} a year you pay now for your ${shortVehicleLabel(situation.scenario)}.`}{" "}
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
        <section aria-labelledby="cars-heading" className="card min-w-0 overflow-clip print:overflow-visible">
          <div className="print-only print-sheet pb-3">
            <p style={{ fontSize: "9pt", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              NotAQuote.FYI · {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p style={{ fontSize: "20pt", fontWeight: 650, margin: "4pt 0 4pt" }}>Which car costs the least to insure?</p>
            <p>
              {situationSentence(driver, list.teenOnParentPolicy, false)}{" "}
              {added ? "The big number is what adding your teen costs a year with each car." : "Yearly estimates for each car."}
            </p>
            {answer ? <p style={{ fontWeight: 600, marginTop: "4pt" }}>{answer}</p> : null}
          </div>
          <div className="no-print grid gap-4 border-b border-border px-5 pt-5 pb-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="cars-heading" tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
                Your cars{" "}
                <span className="text-base font-normal text-muted-foreground" data-testid="car-count">
                  {list.cars.length} of {COMPARE_LIMIT}
                </span>
              </h2>
              {full ? (
                <p className="text-sm text-muted-foreground">
                  {COMPARE_LIMIT} of {COMPARE_LIMIT}: remove one to add another
                </p>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setPickerOpen(true)}>
                  <Plus className="size-4" aria-hidden="true" /> Add a car
                </button>
              )}
            </div>
            <details key={list.cars.length === 0 ? "empty" : "some"} open={list.cars.length === 0} className="group grid gap-3">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-medium">
                <ChevronDown className="size-4 -rotate-90 transition-transform group-open:rotate-0" aria-hidden="true" />
                {list.cars.length === 0 ? "Popular cars, one tap each" : "Add popular cars"}
              </summary>
              <div className="mt-3 grid gap-4">
                <div className="grid gap-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="quick-year" className="font-medium">
                      Model year
                    </label>
                    <select
                      id="quick-year"
                      className="field-select min-h-9 w-auto py-0.5 text-sm"
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
                  <p className="text-muted-foreground">
                    We start at 2022, about the age of a typical first car. Change it anytime.
                  </p>
                </div>
                {starterRemaining.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sun-soft p-3 text-sm">
                    <p className="flex-1">
                      Not sure where to start? Add a mix of everyday cars, a sporty one, an electric one, a Jeep, and a pickup.
                    </p>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => add(starterRemaining)}
                      disabled={full}
                      data-testid="add-all-first-cars"
                    >
                      <Plus className="size-4" aria-hidden="true" /> Add a starter list of{" "}
                      {Math.min(starterRemaining.length, COMPARE_LIMIT - list.cars.length)}
                    </button>
                  </div>
                ) : null}
                {QUICK_GROUPS.map((group) => {
                  const picks = catalog
                    ? group.cars.flatMap((car) => {
                        const pick = resolveCar(catalog, quickYear, car)
                        return pick ? [pick] : []
                      })
                    : []
                  return (
                    <div key={group.id} className="grid gap-1.5">
                      <p className="text-sm font-semibold">{group.label}</p>
                      <div className="scroll-row -mx-1 px-1 pb-1 sm:flex-wrap">
                        {picks.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            {catalog ? `None listed for ${quickYear}.` : "Loading the list of cars…"}
                          </span>
                        ) : (
                          picks.map((pick) => {
                            const inList = listedKeys.has(carKey(pick))
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
              <div
                className={cn(
                  "no-print flex-wrap items-end gap-x-5 gap-y-3 border-b border-border px-5 py-3 sm:flex sm:px-6",
                  filterOpen ? "flex" : "hidden",
                )}
              >
                <div className="grid gap-1">
                  <label htmlFor="max-yearly" className="field-label">
                    {added ? "Hide cars that add more than" : "Hide cars over"}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      id="max-yearly"
                      className="field-input min-h-10 w-44 pr-16 pl-7"
                      inputMode="numeric"
                      placeholder={added ? "e.g. 1,000" : "e.g. 3,000"}
                      value={maxText}
                      onChange={(event) => setMaxText(event.target.value)}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                      a year
                    </span>
                  </div>
                </div>
                <label className={cn("flex min-h-10 items-center gap-2 text-sm font-medium", starredCount === 0 ? "text-muted-foreground" : "cursor-pointer")}>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={starredOnly && starredCount > 0}
                    disabled={starredCount === 0}
                    onChange={(event) => setStarredOnly(event.target.checked)}
                  />
                  Only starred ({starredCount})
                </label>
                <div className="ml-auto hidden flex-wrap gap-2 sm:flex">
                  <button type="button" className="btn" onClick={download} data-testid="download-csv">
                    <Download className="size-4" aria-hidden="true" /> Download spreadsheet (CSV)
                  </button>
                  <button type="button" className="btn" onClick={() => window.print()}>
                    <Printer className="size-4" aria-hidden="true" /> Print this list
                  </button>
                </div>
              </div>

              {answer ? (
                <p className="no-print border-b border-border px-5 py-3 text-base font-medium sm:px-6" data-testid="compare-answer">
                  {answer}
                </p>
              ) : null}

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
              <div className="hidden sm:block print:block">
                <table className="compare-table w-full table-fixed border-collapse text-left text-sm" data-testid="compare-table">
                  <caption className="sr-only">
                    Estimated yearly insurance cost for each car, for the same driver. Column headers sort the table.
                  </caption>
                  <thead>
                    <tr className="text-sm text-muted-foreground">
                      <th scope="col" className="sticky top-0 z-10 w-14 border-b border-border bg-card py-2.5 pl-3">
                        <span className="sr-only">Starred</span>
                      </th>
                      <SortHeader label="Car" sortKey="car" sort={sort} onSort={setSort} className="print:w-[30%]" />
                      <SortHeader label={added ? "Extra a year" : "A year"} sortKey="yearly" sort={sort} onSort={setSort} align="right" className="w-36" />
                      <SortHeader
                        label={added ? "Extra a month" : "A month"}
                        sortKey="monthly"
                        sort={sort}
                        onSort={setSort}
                        align="right"
                        className="hidden w-28 pr-5 xl:table-cell"
                      />
                      <SortHeader
                        label={added ? "Whole policy" : "Where quotes would land"}
                        sortKey={added ? "policy" : "range"}
                        sort={sort}
                        onSort={setSort}
                        className="w-48 pl-4"
                      />
                      <th scope="col" className="sticky top-0 z-10 hidden w-36 border-b border-border bg-card py-2.5 pr-3 font-medium xl:table-cell print:hidden">
                        vs. the cheapest
                      </th>
                      <th scope="col" className="no-print sticky top-0 z-10 w-14 border-b border-border bg-card py-2.5 pr-4">
                        <span className="sr-only">Remove</span>
                      </th>
                      <th scope="col" className="hidden w-[24%] border-b border-border py-2.5 pl-3 font-medium print:table-cell">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => {
                      const lowest = cheapest !== null && visible.length > 1 && row.key === cheapest.key
                      const version = versionWords(row)
                      return (
                        <Fragment key={row.key}>
                          <tr
                            className={cn(
                              "border-b border-border/70 align-middle transition-colors hover:bg-muted/40",
                              row.starred && "bg-star/10 hover:bg-star/15",
                            )}
                            data-testid="compare-row"
                          >
                            <td className="py-3 pl-3">
                              <StarButton row={row} pop={popKey === row.key} onToggle={() => star(row)} />
                            </td>
                            <td className="py-3 pr-3">
                              <button
                                type="button"
                                className="grid w-full min-w-0 text-left"
                                aria-expanded={openRow === row.key}
                                data-focus-key={row.key}
                                onClick={() => setOpenRow(openRow === row.key ? null : row.key)}
                              >
                                <span className="line-clamp-2 font-medium hover:underline print:line-clamp-none">{row.name}</span>
                                {version ? <span className="truncate text-xs text-muted-foreground">{version}</span> : null}
                              </button>
                            </td>
                            <td className="money py-3 pr-3 text-right whitespace-nowrap">
                              <span className="block text-lg leading-tight font-semibold">{mainAmount(row)}</span>
                              <span className="block text-xs text-muted-foreground xl:hidden">{monthAmount(row)} a month</span>
                              <span className="print-exact mt-1.5 ml-auto block h-1.5 w-full max-w-24 rounded-full bg-muted" aria-hidden="true">
                                <span
                                  className="block h-full rounded-full bg-primary/70"
                                  style={{ width: `${Math.max(4, (shownAmount(row) / topAmount) * 100)}%` }}
                                />
                              </span>
                              {lowest ? (
                                <span className="tag mt-1.5 bg-down-soft text-down">
                                  <Trophy className="size-3.5" aria-hidden="true" /> Lowest
                                </span>
                              ) : null}
                            </td>
                            <td className="money hidden py-3 pr-5 text-right text-muted-foreground xl:table-cell print:hidden">
                              {monthAmount(row)}
                            </td>
                            <td className="money py-3 pr-4 pl-4 text-sm text-muted-foreground">
                              {added ? (
                                <>
                                  <span className="block text-foreground">About {estimateDollars(row.likely)}</span>
                                  <span className="block text-xs">{rangeWords(row.low, row.high)}</span>
                                </>
                              ) : (
                                rangeWords(row.low, row.high)
                              )}
                            </td>
                            <td className="hidden py-3 pr-3 text-sm text-muted-foreground xl:table-cell print:hidden">
                              {gapWords(row) ?? "The cheapest here"}
                            </td>
                            <td className="no-print py-3 pr-4 text-right">
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`Remove ${row.name}`}
                                onClick={() => remove(row, visible)}
                              >
                                <X className="size-4" />
                              </button>
                            </td>
                            <td className="hidden border-l border-border print:table-cell" />
                          </tr>
                          {openRow === row.key ? (
                            <tr className="no-print border-b border-border bg-muted/50">
                              <td />
                              <td colSpan={6} className="py-3 pr-4">
                                <RowDetails row={row} gap={gapWords(row)} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phones: two compact lines per car. */}
              <ul className="grid gap-0 sm:hidden print:hidden" data-testid="compare-cards">
                {visible.map((row) => {
                  const lowest = cheapest !== null && visible.length > 1 && row.key === cheapest.key
                  const version = versionWords(row)
                  return (
                    <li key={row.key} className={cn("border-b border-border/70 px-3 py-2", row.starred && "bg-star/10")}>
                      <div className="flex items-center gap-1">
                        <StarButton row={row} pop={popKey === row.key} onToggle={() => star(row)} />
                        <button
                          type="button"
                          className="grid min-h-11 min-w-0 flex-1 content-center text-left"
                          aria-expanded={openRow === row.key}
                          data-focus-key={row.key}
                          onClick={() => setOpenRow(openRow === row.key ? null : row.key)}
                        >
                          <span className="truncate font-medium">{row.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {lowest ? "Lowest · " : ""}
                            {added ? `whole policy about ${estimateDollars(row.likely)}` : `${monthAmount(row)} a month`}
                            {version ? ` · ${version}` : ""}
                          </span>
                        </button>
                        <div className="money pl-2 text-right">
                          <p className="text-lg leading-tight font-semibold">{mainAmount(row)}</p>
                          <p className="text-xs text-muted-foreground">{added ? "extra a year" : "a year"}</p>
                        </div>
                      </div>
                      {openRow === row.key ? (
                        <div className="mt-2 grid gap-3 pb-2 pl-11">
                          <RowDetails row={row} gap={gapWords(row)} />
                          <button type="button" className="btn justify-self-start" onClick={() => remove(row, visible)}>
                            <Trash2 className="size-4" aria-hidden="true" /> Remove from list
                          </button>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              {visible.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No cars match your filters. Try a higher amount, or show them all.
                </p>
              ) : null}

              <div className="grid gap-3 px-5 py-5 text-sm leading-relaxed sm:px-6">
                <p className="text-muted-foreground">
                  <span className="no-print">Tap a car to see why it costs what it does. </span>
                  {start ? startLine(start) : null} Yearly figures are rounded to the nearest $10, monthly to $5 (the yearly
                  figure ÷ 12), and ranges to $50.
                </p>
                {driverPoints ? (
                  <details className="disclosure no-print">
                    <summary>
                      Why the ranges are wide
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </summary>
                    <div className="grid gap-2 pb-2 text-muted-foreground">
                      <ul className="grid list-disc gap-1 pl-5">
                        {driverPoints.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                      <p>
                        <Link href="/methodology" className="link">
                          Here&apos;s how it all works
                        </Link>
                      </p>
                    </div>
                  </details>
                ) : null}
                {driverPoints ? (
                  <div className="print-only">
                    <p style={{ fontWeight: 600 }}>Why the ranges are wide</p>
                    <ul style={{ margin: "2pt 0 0 14pt", listStyle: "disc" }}>
                      {driverPoints.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="print-only">
                  <p>Data updated {DATA_UPDATED}. Every source, and how the math works: notaquote.fyi/methodology</p>
                  <DisclaimerText className="mt-1 text-black" />
                </div>
                <div className="no-print flex flex-wrap gap-2 sm:hidden">
                  <button type="button" className="btn" onClick={download}>
                    <Download className="size-4" aria-hidden="true" /> Download spreadsheet (CSV)
                  </button>
                  <button type="button" className="btn" onClick={() => window.print()}>
                    <Printer className="size-4" aria-hidden="true" /> Print this list
                  </button>
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
                      setRemoved({ name: starredCount > 0 ? "the unstarred cars" : "every car", before: list, key: "" })
                      window.clearTimeout(removedTimer.current)
                      removedTimer.current = window.setTimeout(() => setRemoved(null), 8000)
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
                Add the starter list above, tap a few popular cars, or use Add a car to find any model. Every car is priced
                for the same driver, so it&apos;s a fair comparison.
              </p>
            </div>
          )}
        </section>
      </div>

      <DisclaimerText className="no-print mt-10 max-w-3xl" />

      {rows.length > 0 ? (
        <div
          className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-3 py-2 backdrop-blur sm:hidden"
          data-testid="compare-bottom-bar"
        >
          <div className="flex items-center gap-2">
            <label htmlFor="sort-mobile" className="sr-only">
              Sort by
            </label>
            <select
              id="sort-mobile"
              className="field-select min-h-11 min-w-0 flex-1 text-sm"
              value={`${sort.key}:${sort.direction}`}
              onChange={(event) => {
                const [key, direction] = event.target.value.split(":") as [SortKey, "asc" | "desc"]
                setSort({ key, direction })
              }}
            >
              <option value="yearly:asc">Cheapest first</option>
              <option value="yearly:desc">Priciest first</option>
              <option value="car:asc">A to Z</option>
              <option value="range:asc">Narrowest range</option>
              <option value="order:asc">Order added</option>
            </select>
            <button
              type="button"
              className="btn min-h-11 px-3"
              aria-pressed={starredOnly && starredCount > 0}
              disabled={starredCount === 0}
              onClick={() => setStarredOnly((on) => !on)}
            >
              <Star className={cn("size-4", starredOnly && starredCount > 0 && "fill-current text-star")} aria-hidden="true" />
              Starred
            </button>
            <button
              type="button"
              className="btn min-h-11 px-3"
              aria-expanded={filterOpen}
              aria-controls="max-yearly"
              onClick={() => setFilterOpen((open) => !open)}
            >
              Filter
            </button>
            <button type="button" className="btn btn-primary min-h-11 px-3" onClick={shareList}>
              <Send className="size-4" aria-hidden="true" />
              <span className="sr-only">Share this list</span>
            </button>
          </div>
        </div>
      ) : null}

      {removed ? (
        <div
          className="no-print pop-in fixed inset-x-0 bottom-20 z-40 sm:bottom-4 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full bg-foreground py-2 pr-2 pl-5 text-sm text-background shadow-lg"
          role="status"
        >
          <span>Removed {removed.name}.</span>
          <button type="button" className="btn min-h-9 border-background bg-background py-1 text-foreground" onClick={undoRemove}>
            Undo
          </button>
        </div>
      ) : null}

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

function StarButton({ row, pop, onToggle }: { row: CompareRow; pop: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={cn("icon-btn star-btn", row.starred ? "text-star hover:text-star" : "", pop && "star-pop")}
      aria-pressed={row.starred}
      aria-label={`Star ${row.name}`}
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
      className={cn("sticky top-0 z-10 border-b border-border bg-card py-1.5 pr-3 font-medium", align === "right" && "text-right", className)}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={cn(
          "inline-flex min-h-9 items-center gap-1 rounded-md px-1 whitespace-nowrap hover:text-foreground",
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

function RowDetails({ row, gap }: { row: CompareRow; gap: string | null }) {
  return (
    <div className="grid gap-2 text-sm leading-relaxed">
      <p>
        <span className="font-semibold">Why: </span>
        {reasonWords(row.reason)}.{gap ? ` ${gap}.` : ""}
      </p>
      <p>{row.summary}</p>
      <div>
        <p className="font-semibold">Why the range is this wide</p>
        <ul className="mt-1 grid list-disc gap-1 pl-5 text-muted-foreground">
          {row.rangePoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      <p>
        <VehicleFixLink carName={row.name} shown={row.vehicleShown} />
      </p>
    </div>
  )
}
