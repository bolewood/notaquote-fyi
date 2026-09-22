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
import { HowWeGotThis, VehicleFixLink } from "@/components/how-we-got-this"
import { RangeBar } from "@/components/money"
import { HomeSkeleton, STARTER_ICONS, TABS, type Tab } from "@/components/page-skeleton"
import { ShareBox } from "@/components/share-box"
import { carName, modelTrims, resolveCar, WHAT_IF_CARS } from "@/lib/car-search"
import { vehicleFacts } from "@/lib/catalog-class"
import { catalogYears, trimRecord, type VehiclePick } from "@/lib/catalog"
import { DATA_UPDATED, PREMIUM_HINT } from "@/lib/copy"
import { recordCount, recordMountedCount } from "@/lib/counts"
import type { Estimate, StartKind } from "@/lib/factor-engine"
import { differenceWords, dollars, estimateDollars, rangeWords, signedDollars } from "@/lib/format"
import {
  changeChip,
  changedKeys,
  priceNow,
  priceWhatIf,
  sameVehicle,
  startingPoint,
  startLine,
  startShort,
  vehicleMatchWords,
  type ChangeKey,
  type ChangePart,
  type WhatIfMode,
} from "@/lib/pricing"
import {
  coverageAssumption,
  hasPhysicalDamage,
  situationSentence,
  STARTERS,
  shortVehicleLabel,
  stateName,
  withTeenFlag,
  type Scenario,
  type StateCode,
  type Starter,
} from "@/lib/scenario"
import { encodeSharePath, SHARE_INVALID_NOTE, shareArrivalNotes } from "@/lib/share-link"
import { readShareArrival, useClearShareFromAddress, useMounted } from "@/lib/use-share-arrival"
import {
  adoptSharedSituation,
  DEFAULT_SITUATION,
  PREMIUM_PERIODS,
  premiumStatus,
  type PremiumPeriod,
  type Situation,
} from "@/lib/situation"
import { useCatalog } from "@/lib/use-catalog"
import { useSituation } from "@/lib/use-stored"
import { cn } from "cn"
import { ArrowRight, ArrowUp, Car, ChevronDown, HandHeart, Printer, RotateCcw, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"

const UNDER_26 = ["16-18", "19-21", "22-25"]
const UNDER_22 = ["16-18", "19-21"]

/** One line under the tabs, so every tab starts the same way. */
const TAB_INTRO: Record<Tab, string> = {
  car: "Tap a car to see what it would cost to insure instead.",
  driver: "See what a new or younger driver would do to the bill.",
  move: "Pick a state to see what the same car and driver would cost there.",
  coverage: "See what more or less coverage would do to the price.",
  more: "See what your miles and driving record do to the price.",
}

/** What the result area suggests before anything has changed, per tab. */
const TAB_EMPTY: Record<Tab, { title: string; body: string }> = {
  car: {
    title: "Pick a car to see the difference",
    body: "Try the Tesla Model Y. You'll see what it does to your yearly bill, and why.",
  },
  driver: {
    title: "Add a driver to see the difference",
    body: "Tap “Add a new 16-year-old driver” to see what a teen adds to the bill.",
  },
  move: {
    title: "Pick a state to see the difference",
    body: "The same car and driver can cost very different amounts from one state to the next.",
  },
  coverage: {
    title: "Change your coverage to see the difference",
    body: "Try a $2,000 deductible: you'd pay more of a repair bill yourself, and less each year.",
  },
  more: {
    title: "Change your miles or record to see the difference",
    body: "Try one at-fault accident to see how much it adds.",
  },
}

type Preset = { label: string; change: Partial<Scenario> }

/** Three nearby or common states, never the one you're in. */
const MOVE_CANDIDATES: StateCode[] = ["TX", "FL", "CA", "CO", "NY", "AZ"]

function presetsFor(tab: Tab, now: Scenario): Preset[] {
  switch (tab) {
    case "car":
      return []
    case "driver":
      return [
        { label: "Add a new 16-year-old driver", change: { age: "16-18", yearsLicensed: "under-1" } },
        { label: "A 19–21-year-old, on their own policy", change: { age: "19-21", yearsLicensed: "1-3" } },
        { label: "A 22–25-year-old driver", change: { age: "22-25", yearsLicensed: "4-9" } },
      ]
    case "move":
      return MOVE_CANDIDATES.filter((code) => code !== now.state)
        .slice(0, 3)
        .map((code) => ({ label: `Moving to ${stateName(code)}`, change: { state: code } }))
    case "coverage":
      return [
        {
          label: "$2,000 deductible",
          change: { deductible: 2000, coverage: hasPhysicalDamage(now.coverage) ? now.coverage : "full" },
        },
        { label: "Liability only", change: { coverage: "standard" } },
        { label: "Full coverage, higher limits", change: { coverage: "high" } },
        { label: "Bundled with home or renters", change: { householdPolicy: true } },
      ]
    case "more":
      return [
        { label: "One at-fault accident", change: { incidents: "one" } },
        { label: "Under 7,500 miles a year", change: { mileage: "under-7500" } },
        { label: "Over 15,000 miles a year", change: { mileage: "over-15000" } },
      ]
  }
}

function readInitial() {
  const decoded = readShareArrival()
  if (decoded.status === "ok") {
    const situation: Situation = {
      scenario: decoded.scenario,
      teenOnParentPolicy: decoded.teenOnParentPolicy,
      premium: decoded.anchorAmount,
    }
    return {
      situation,
      next: decoded.next,
      notes: shareArrivalNotes(decoded),
      present: true,
    }
  }
  return {
    situation: null as Situation | null,
    next: null as Scenario | null,
    notes: decoded.status === "invalid" ? [SHARE_INVALID_NOTE] : [],
    present: decoded.status === "invalid",
  }
}

/** Left and right arrows, Home, and End move between tabs (the ARIA tablist pattern). */
function tabKey(event: React.KeyboardEvent<HTMLButtonElement>, current: Tab, choose: (tab: Tab) => void) {
  const ids = TABS.map((item) => item.id)
  const index = ids.indexOf(current)
  const target =
    event.key === "ArrowRight"
      ? ids[(index + 1) % ids.length]
      : event.key === "ArrowLeft"
        ? ids[(index - 1 + ids.length) % ids.length]
        : event.key === "Home"
          ? ids[0]
          : event.key === "End"
            ? ids[ids.length - 1]
            : null
  if (!target) return
  event.preventDefault()
  choose(target)
  document.getElementById(`tab-${target}`)?.focus()
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** Only the inputs that differ from now, so a what-if follows later changes to "now". */
function diffFrom(now: Scenario, next: Scenario): Partial<Scenario> {
  const changes: Partial<Scenario> = {}
  if (!sameVehicle(now, next)) Object.assign(changes, { year: next.year, make: next.make, model: next.model, trim: next.trim })
  for (const key of changedKeys(now, next)) {
    if (key !== "vehicle") Object.assign(changes, { [key]: next[key] })
  }
  return changes
}

/**
 * The changes worth showing: ones that can move the price for this driver
 * and coverage. (Years licensed doesn't count under 26, a deductible needs
 * own-car coverage, and so on.)
 */
function visibleChanges(keys: readonly ChangeKey[], next: Scenario): ChangeKey[] {
  return keys.filter((key) => {
    if (key === "yearsLicensed") return !UNDER_26.includes(next.age)
    if (key === "goodStudent") return UNDER_26.includes(next.age)
    if (key === "driverTraining") return UNDER_22.includes(next.age)
    if (key === "deductible" || key === "loanLease") return hasPhysicalDamage(next.coverage)
    return true
  })
}

/** "a 2025 Tesla Model Y", "a new 16-year-old", or the chip's own words. */
function changePhrase(key: ChangeKey, now: Scenario, next: Scenario): string {
  if (key === "vehicle") return shortVehicleLabel(next)
  if (key === "age" && next.age === "16-18" && now.age !== "16-18") return "a new 16-year-old"
  return lowerFirst(changeChip(key, next))
}

function presetPressed(preset: Preset, now: Scenario, next: Scenario): boolean {
  const entries = Object.entries(preset.change) as [keyof Scenario, Scenario[keyof Scenario]][]
  return entries.every(([key, value]) => next[key] === value) && entries.some(([key, value]) => now[key] !== value)
}

/** Waits for the browser (saved choices, share link) before drawing numbers, so nothing flashes. */
export function Calculator() {
  const mounted = useMounted()
  if (!mounted) return <HomeSkeleton />
  return <CalculatorReady />
}

function CalculatorReady() {
  const [initial] = useState(readInitial)
  useClearShareFromAddress(initial.present)
  const stored = useSituation()
  const catalogLoad = useCatalog()
  const catalog = catalogLoad.catalog

  // A shared link shows the sender's situation until the visitor changes something.
  const [linked, setLinked] = useState<Situation | null>(initial.situation)
  const situation = linked ?? stored.value ?? DEFAULT_SITUATION
  const now = situation.scenario
  const [changes, setChanges] = useState<Partial<Scenario>>(() =>
    initial.situation && initial.next ? diffFrom(initial.situation.scenario, initial.next) : {},
  )
  const next = useMemo(() => withTeenFlag({ ...now, ...changes }), [now, changes])
  const changed = changedKeys(now, next)
  const shown = visibleChanges(changed, next)
  const [tab, setTab] = useState<Tab>("car")
  const [notes, setNotes] = useState(initial.notes)
  const [picker, setPicker] = useState<null | "now" | "next">(null)
  const [premiumDraft, setPremiumDraft] = useState<string | null>(null)
  const [period, setPeriod] = useState<PremiumPeriod>("year")
  const premiumText = premiumDraft ?? (situation.premium === null ? "" : String(situation.premium))
  const premium = premiumStatus(premiumText, period)
  const premiumInvalid = premium.kind === "invalid" || premium.kind === "too-high"
  const whatIfRef = useRef<HTMLElement>(null)
  const resultHeadingRef = useRef<HTMLHeadingElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  /**
   * After a quick pick, make sure the answer is in view. If it already is,
   * leave everything (and your focus) where it is. If not, move focus to the
   * answer's heading, which brings it into view.
   */
  function revealResult() {
    window.setTimeout(() => {
      const target = resultHeadingRef.current ?? resultRef.current
      if (!target) return
      const box = target.getBoundingClientRect()
      if (box.top >= 0 && box.bottom <= window.innerHeight) return
      target.focus({ preventScroll: true })
      target.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 60)
  }

  useEffect(() => {
    recordMountedCount("calculator_session")
    const onPrint = () => {
      recordCount("print")
    }
    window.addEventListener("beforeprint", onPrint)
    return () => window.removeEventListener("beforeprint", onPrint)
  }, [])

  const nowFacts = useMemo(() => vehicleFacts(catalog, now), [catalog, now])
  const nextFacts = useMemo(() => vehicleFacts(catalog, next), [catalog, next])
  const nowConfidence = catalog ? (trimRecord(catalog, now)?.confidence ?? null) : null
  const nextConfidence = catalog ? (trimRecord(catalog, next)?.confidence ?? null) : null
  const nowEstimate = priceNow(situation, nowFacts, nowConfidence)
  const result = changed.length > 0 ? priceWhatIf(situation, nowFacts, next, nextFacts, nextConfidence) : null
  const startKind: StartKind = situation.premium !== null ? "yours" : "typical"
  const start = startingPoint(situation, nowFacts)
  const startNote = start ? startLine(start) : undefined
  const state = stateName(now.state)

  /**
   * Save the situation in this browser. A shared situation becomes the
   * visitor's own once they change something, but never with the sender's
   * premium: that's kept only if the visitor typed it themselves.
   */
  function saveSituation(nextSituation: Situation, premiumTyped = false) {
    const own = linked && !premiumTyped ? adoptSharedSituation(nextSituation, stored.value) : nextSituation
    stored.write({ ...own, scenario: withTeenFlag(own.scenario) })
    if (linked && !premiumTyped) setPremiumDraft(null)
    setLinked(null)
  }

  function patchNow(partial: Partial<Scenario>) {
    recordCount("adjustment")
    saveSituation({ ...situation, scenario: { ...now, ...partial } })
  }

  function setPolicy(teenOnParentPolicy: boolean) {
    recordCount("adjustment")
    saveSituation({ ...situation, teenOnParentPolicy })
  }

  function patchNext(partial: Partial<Scenario>) {
    recordCount("what_if")
    setChanges(diffFrom(now, withTeenFlag({ ...next, ...partial })))
  }

  function undo(key: ChangeKey) {
    const restore: Partial<Scenario> =
      key === "vehicle" ? { year: now.year, make: now.make, model: now.model, trim: now.trim } : { [key]: now[key] }
    setChanges(diffFrom(now, withTeenFlag({ ...next, ...restore })))
  }

  function keepWhatIf() {
    recordCount("adjustment")
    saveSituation({ ...situation, scenario: next })
    setChanges({})
  }

  function tryStarter(item: Starter) {
    recordCount("starter_click")
    if (item.teenOnParentPolicy !== undefined && item.teenOnParentPolicy !== situation.teenOnParentPolicy) {
      saveSituation({ ...situation, teenOnParentPolicy: item.teenOnParentPolicy })
    }
    setChanges(diffFrom(now, withTeenFlag({ ...now, ...item.change(now) })))
    setTab(item.tab)
    whatIfRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function onPremium(text: string, nextPeriod: PremiumPeriod = period) {
    setPremiumDraft(text)
    const status = premiumStatus(text, nextPeriod)
    if (status.kind !== "invalid" && status.kind !== "too-high" && status.annual !== situation.premium) {
      recordCount("adjustment")
      saveSituation({ ...situation, premium: status.annual }, true)
    }
  }

  const nowCar: VehiclePick = { year: now.year, make: now.make, model: now.model, trim: now.trim }
  const nextCar: VehiclePick = { year: next.year, make: next.make, model: next.model, trim: next.trim }
  const presets = presetsFor(tab, now)
  const premiumMessage =
    premium.kind === "too-high"
      ? "That's more than we can work with. Check the number, or leave it empty."
      : premium.kind === "invalid"
        ? "Enter a dollar amount, like 1,800. Or leave it empty."
        : premium.kind === "low-monthly"
          ? "That looks low even for a month. Double-check it?"
          : PREMIUM_HINT
  const changesLabel = shown.length > 1 ? `Your changes: ${shown.map((key) => changePhrase(key, now, next)).join(" + ")}` : null

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
        {stored.error ? <p className="mt-4 text-sm">{stored.error}</p> : null}

        {linked ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm">
            <p className="flex-1">
              You&apos;re looking at someone else&apos;s situation. Change anything and it becomes yours
              {linked.premium !== null ? " (without what they pay)" : ""}.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setLinked(null)
                setChanges({})
                setNotes([])
              }}
            >
              Go back to mine
            </button>
          </div>
        ) : null}

        <div className="mt-8 grid items-start gap-5 lg:mt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6">
          {/* What if */}
          <section
            ref={whatIfRef}
            id="what-if"
            aria-labelledby="what-if-heading"
            className="card scroll-mt-4 overflow-hidden lg:col-start-1 lg:row-start-1"
          >
            <div className="bg-sun-soft px-5 pt-5 pb-3 sm:px-6">
              <h2 id="what-if-heading" className="text-xl font-semibold tracking-tight">
                What if…
              </h2>
              <p className="mt-1 text-sm text-muted-foreground lg:hidden">
                Compared with now: {lowerFirst(situationSentence(now, false))}{" "}
                <a href="#now" className="link tap-target inline-flex items-center whitespace-nowrap">
                  Change
                </a>
              </p>
              <p className="mt-1 hidden text-sm text-muted-foreground lg:block">
                Change one thing, or a few. We&apos;ll show the difference from your situation now.
              </p>
            </div>

            <div className="tab-scroller border-b border-border bg-sun-soft">
              <div role="tablist" aria-label="What to change" className="scroll-row px-3 pb-3 sm:px-5">
                {TABS.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      id={`tab-${item.id}`}
                      aria-selected={tab === item.id}
                      aria-controls={`panel-${item.id}`}
                      tabIndex={tab === item.id ? 0 : -1}
                      className="tab"
                      onClick={() => setTab(item.id)}
                      onKeyDown={(event) => tabKey(event, tab, setTab)}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="grid gap-4 px-5 py-5 sm:px-6">
              <p className="text-sm text-muted-foreground">{TAB_INTRO[tab]}</p>
              {tab === "car" ? (
                <div className="flex flex-wrap gap-2" data-testid="what-if-cars">
                  {WHAT_IF_CARS.map((car) => {
                    const pick = catalog ? resolveCar(catalog, car.year, car) : car.trim ? { ...car, trim: car.trim } : null
                    const pressed = pick !== null && sameVehicle(pick, nextCar) && !sameVehicle(pick, nowCar)
                    return (
                      <button
                        key={`${car.make}-${car.model}`}
                        type="button"
                        className="chip"
                        aria-pressed={pressed}
                        disabled={pick === null}
                        onClick={() => {
                          if (!pick) return
                          patchNext(pick)
                          revealResult()
                        }}
                      >
                        {car.year} {car.make} {car.model}
                      </button>
                    )
                  })}
                  <button type="button" className="chip border-dashed text-primary" onClick={() => setPicker("next")}>
                    Search every car…
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2" data-testid={`what-if-presets-${tab}`}>
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="chip"
                      aria-pressed={presetPressed(preset, now, next)}
                      onClick={() => {
                        patchNext(preset.change)
                        revealResult()
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
              {tab === "driver" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <AgeField scenario={next} onChange={patchNext} idPrefix="next" />
                    {UNDER_26.includes(next.age) ? null : <YearsField scenario={next} onChange={patchNext} idPrefix="next" />}
                    {next.age === "16-18" && now.age !== "16-18" ? (
                      <div className="grid gap-1.5 sm:col-span-2">
                        <PolicyField value={situation.teenOnParentPolicy} onChange={setPolicy} idPrefix="next" />
                        <p className="text-sm leading-snug text-muted-foreground">
                          {situation.teenOnParentPolicy
                            ? `We price your whole policy after adding them, with the ${shortVehicleLabel(next)}.`
                            : "We price the teen alone, on their own policy."}
                        </p>
                      </div>
                    ) : null}
                    {next.age === "19-21" && now.age !== "19-21" ? (
                      <p className="text-sm leading-snug text-muted-foreground sm:col-span-2">
                        We price a 19–21-year-old on their own policy. Staying on a parent&apos;s policy usually costs less.
                      </p>
                    ) : null}
                  </div>
                  <DiscountFields scenario={next} onChange={patchNext} idPrefix="next" />
                </>
              ) : null}
              {tab === "move" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <StateField scenario={next} onChange={patchNext} idPrefix="next" />
                  <RegionField scenario={next} onChange={patchNext} idPrefix="next" />
                </div>
              ) : null}
              {tab === "coverage" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <CoverageField scenario={next} onChange={patchNext} idPrefix="next" />
                  <DeductibleField scenario={next} onChange={patchNext} idPrefix="next" />
                </div>
              ) : null}
              {tab === "more" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <RecordField scenario={next} onChange={patchNext} idPrefix="next" />
                  <MileageField scenario={next} onChange={patchNext} idPrefix="next" />
                </div>
              ) : null}
            </div>

            <p className="sr-only" aria-live="polite" data-testid="what-if-announce">
              {result && !premiumInvalid ? result.headline : ""}
            </p>
            <div ref={resultRef} className="scroll-mb-4 border-t border-border px-5 py-6 sm:px-6">
              {result && premiumInvalid ? (
                <p className="py-4 text-center text-sm text-muted-foreground" data-testid="what-if-waiting">
                  {premium.kind === "too-high"
                    ? "What you pay now looks like more than we can work with. Check the number, or leave it empty, and the difference shows here."
                    : "Finish typing what you pay now (or clear it), and the difference shows here."}
                </p>
              ) : result ? (
                <WhatIfResult
                  headingRef={resultHeadingRef}
                  mode={result.mode}
                  parts={result.parts}
                  headline={result.headline}
                  changesLabel={changesLabel}
                  delta={result.delta}
                  current={result.current}
                  next={result.next}
                  startKind={startKind}
                  startNote={startNote}
                  sender={linked !== null && linked.premium !== null}
                  plural={shown.length > 1}
                  state={stateName(next.state)}
                  chips={shown.map((key) => ({ key, label: changeChip(key, next) }))}
                  onUndo={undo}
                  onReset={() => setChanges({})}
                  onKeep={keepWhatIf}
                  vehicleChanged={changed.includes("vehicle")}
                  nextCarName={carName(nextCar)}
                  compareHref={encodeSharePath({
                    page: "/compare",
                    scenario: next,
                    teenOnParentPolicy: situation.teenOnParentPolicy,
                    cars: [nowCar, nextCar].map((car) => ({ ...car, starred: false })),
                    via: "whatif",
                  })}
                  versionPicker={
                    changed.includes("vehicle") ? (
                      <VersionPicker idPrefix="next-car" pick={nextCar} catalog={catalog} onChange={(pick) => patchNext(pick)} compact />
                    ) : null
                  }
                />
              ) : (
                <div className="grid justify-items-center gap-2 py-6 text-center" data-testid="what-if-empty">
                  <span className="grid size-10 place-items-center rounded-full bg-sun-soft text-sun-ink" aria-hidden="true">
                    <ArrowUp className="size-5" />
                  </span>
                  <p className="text-lg font-semibold">{TAB_EMPTY[tab].title}</p>
                  <p className="max-w-sm text-sm text-muted-foreground">{TAB_EMPTY[tab].body}</p>
                </div>
              )}
            </div>
          </section>

          {/* Now */}
          <section id="now" aria-labelledby="now-heading" className="card scroll-mt-4 p-5 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <h2 id="now-heading" className="text-xl font-semibold tracking-tight">
              Your situation now
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{situationSentence(now, false)}</p>

            {nowEstimate ? (
              <NowFigure
                estimate={nowEstimate}
                startKind={startKind}
                startShortLine={start ? startShort(start, state) : undefined}
                shared={linked !== null && linked.premium !== null}
                waiting={premiumInvalid}
              />
            ) : null}

            <div className="mt-5 grid gap-4">
              <div className="grid gap-1.5">
                <span className="field-label" id="now-car-label">
                  Car
                </span>
                <button
                  type="button"
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-input bg-card px-3.5 py-2 text-left hover:border-primary"
                  aria-labelledby="now-car-label now-car-name"
                  onClick={() => setPicker("now")}
                >
                  <Car className="size-5 text-muted-foreground" aria-hidden="true" />
                  <span id="now-car-name" className="flex-1 font-medium">
                    {shortVehicleLabel(now)}
                  </span>
                  <span className="text-sm font-medium text-primary">Change</span>
                </button>
                <VersionPicker idPrefix="now-car" pick={nowCar} catalog={catalog} onChange={(pick) => patchNow(pick)} compact />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <AgeField scenario={now} onChange={patchNow} idPrefix="now" />
                <StateField scenario={now} onChange={patchNow} idPrefix="now" />
                <RegionField scenario={now} onChange={patchNow} idPrefix="now" />
                <CoverageField scenario={now} onChange={patchNow} idPrefix="now" showNote={false} />
                <p className="col-span-2 -mt-1 text-sm leading-snug text-muted-foreground">
                  {coverageAssumption(now.coverage, now.state)}
                </p>
              </div>

              <div className="grid gap-1.5 rounded-2xl bg-muted/70 p-4">
                <label htmlFor="premium" className="text-sm font-semibold">
                  What do you pay now?{" "}
                  <span className="font-normal text-muted-foreground">(Optional.)</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      id="premium"
                      className="field-input pl-7"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="e.g. 1,800"
                      value={premiumText}
                      aria-invalid={premiumInvalid || undefined}
                      aria-errormessage={premiumInvalid ? "premium-hint" : undefined}
                      aria-describedby="premium-hint"
                      onChange={(event) => onPremium(event.target.value)}
                    />
                  </div>
                  <select
                    aria-label="How often"
                    className="field-select w-auto"
                    value={period}
                    onChange={(event) => {
                      const value = event.target.value as PremiumPeriod
                      setPeriod(value)
                      onPremium(premiumText, value)
                    }}
                  >
                    {PREMIUM_PERIODS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p
                  id="premium-hint"
                  className={cn(
                    "text-sm leading-snug",
                    premiumInvalid ? "text-destructive" : premium.kind === "low-monthly" ? "text-sun-ink" : "text-muted-foreground",
                  )}
                >
                  {premiumMessage}
                  {premium.annual !== null && period !== "year" ? ` That's ${dollars(premium.annual)} a year.` : ""}
                </p>
                {premium.kind === "maybe-monthly" ? (
                  <p className="flex flex-wrap items-center gap-x-2 text-sm leading-snug" data-testid="premium-monthly-hint">
                    That&apos;s low for a year. Is it what you pay each month?
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        setPeriod("month")
                        onPremium(premiumText, "month")
                      }}
                    >
                      Yes, it&apos;s monthly
                    </button>
                  </p>
                ) : null}
              </div>

              <div className="-mb-1">
                <details className="disclosure">
                  <summary>
                    More about the driver and coverage
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </summary>
                  <div className="grid gap-3 pb-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DeductibleField scenario={now} onChange={patchNow} idPrefix="now" />
                      <RecordField scenario={now} onChange={patchNow} idPrefix="now" />
                      <MileageField scenario={now} onChange={patchNow} idPrefix="now" />
                      <YearsField scenario={now} onChange={patchNow} idPrefix="now" />
                    </div>
                    <DiscountFields scenario={now} onChange={patchNow} idPrefix="now" />
                    <p className="text-sm leading-snug text-muted-foreground">
                      We don&apos;t ask about credit. Many insurers use it, so your real quote could move up or down because
                      of it.
                    </p>
                  </div>
                </details>

                {nowEstimate && !result ? (
                  <details className="disclosure">
                    <summary>
                      Here&apos;s how we got this
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </summary>
                    <div className="pb-2">
                      <HowWeGotThis
                        estimate={nowEstimate}
                        startKind={startKind}
                        startNote={startNote}
                        state={state}
                        sender={linked !== null && linked.premium !== null}
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
          </section>

          <section aria-labelledby="starters-heading" className="mt-6 lg:col-start-1 lg:row-start-2 lg:mt-2">
            <h2 id="starters-heading" className="text-xl font-semibold tracking-tight">
              Or start with a question other families ask
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {STARTERS.map((item) => {
                const Icon = STARTER_ICONS[item.id]
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="card group grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1 p-4 text-left transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/50"
                    onClick={() => tryStarter(item)}
                    data-testid={`starter-${item.id}`}
                  >
                    <span className="row-span-2 grid size-9 place-items-center rounded-full bg-sun-soft text-sun-ink" aria-hidden="true">
                      <Icon className="size-[1.1rem]" />
                    </span>
                    <span className="font-semibold">{item.title}</span>
                    <span className="text-sm leading-snug text-muted-foreground">{item.story}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <section className="mt-10 flex flex-col items-start gap-4 rounded-3xl bg-foreground px-6 py-7 text-background sm:flex-row sm:items-center sm:px-8">
          <div className="flex-1">
            <h2 className="text-xl font-semibold tracking-tight">Shopping for a first car?</h2>
            <p className="mt-1 max-w-xl text-base text-background/80">
              Put up to 15 cars side by side for the same driver. Sort them, star the favorites, and narrow it down
              together. Then take the spreadsheet with you.
            </p>
          </div>
          <Link href="/compare" className="btn border-background bg-background text-foreground hover:bg-background/90">
            Compare cars <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
          <ShareBox
            what="this what-if"
            premiumAvailable={situation.premium !== null && linked === null}
            buildPath={(includePremium) =>
              encodeSharePath({
                page: "/",
                scenario: now,
                teenOnParentPolicy: situation.teenOnParentPolicy,
                premium: situation.premium,
                includePremium,
                next: changed.length > 0 ? next : null,
              })
            }
          />
          <button type="button" className="btn justify-self-start" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" /> Print this
          </button>
        </section>

        <section className="mt-12 grid gap-2 border-t border-border pt-8 sm:grid-cols-[auto_1fr] sm:gap-4">
          <span className="grid size-9 place-items-center rounded-full bg-sun-soft text-sun-ink" aria-hidden="true">
            <HandHeart className="size-[1.1rem]" />
          </span>
          <div className="grid max-w-3xl gap-3">
            <p className="text-base leading-relaxed">
              <span className="font-semibold">Built in the open, from public data.</span>{" "}
              <span className="text-muted-foreground">
                If a number looks off, or you know your state&apos;s rate guide, you can help make this better for the next
                family.
              </span>{" "}
              <Link href="/corrections" className="link whitespace-nowrap">
                Here&apos;s how
              </Link>
            </p>
            <DisclaimerText />
          </div>
        </section>
      </div>

      <PrintSummary
        situation={situation}
        nowEstimate={nowEstimate}
        ownNumber={startKind === "yours" && (nowEstimate?.steps.length ?? 0) === 0}
        result={result ? { headline: result.headline, next: result.next, parts: result.parts } : null}
        changes={shown.map((key) => changeChip(key, next))}
      />

      <CarPicker
        key={picker ?? "closed"}
        open={picker !== null}
        onClose={() => setPicker(null)}
        catalog={catalog}
        catalogStatus={catalogLoad.status}
        initialYear={picker === "next" ? (changed.includes("vehicle") ? next.year : 2025) : now.year}
        title={picker === "now" ? "Which car do you drive now?" : "Which car are you thinking about?"}
        actionLabel={picker === "now" ? "Use this car" : "Try this car"}
        allowVin={picker === "now"}
        onPick={(pick) => {
          if (picker === "now") patchNow(pick)
          else {
            patchNext(pick)
            setTab("car")
            revealResult()
          }
        }}
      />
    </>
  )
}

function NowFigure({
  estimate,
  startKind,
  startShortLine,
  shared,
  waiting,
}: {
  estimate: Estimate
  startKind: StartKind
  startShortLine?: string
  /** The premium came from a shared link: it's the sender's, not the visitor's. */
  shared: boolean
  /** The premium field has text we can't read yet: dim the old figures. */
  waiting: boolean
}) {
  const ownNumber = startKind === "yours" && estimate.steps.length === 0
  return (
    <div className={cn("mt-5 transition-opacity", waiting && "opacity-35")} data-testid="now-figure" aria-hidden={waiting || undefined}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="money text-[2.6rem] leading-none font-semibold tracking-tight" data-testid="now-yearly">
          {ownNumber ? dollars(estimate.likely) : estimateDollars(estimate.likely)}
        </span>
        <span className="text-base text-muted-foreground">a year</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {ownNumber
          ? `${shared ? "What the sender pays now" : "What you pay now"}.`
          : `Real quotes: ${rangeWords(estimate.low, estimate.high)} a year.`}
      </p>
      {ownNumber ? null : (
        <RangeBar
          className="mt-3"
          low={estimate.low}
          likely={estimate.likely}
          high={estimate.high}
          min={Math.round(estimate.low * 0.9)}
          max={Math.round(estimate.high * 1.05)}
        />
      )}
      {startKind === "typical" && startShortLine ? (
        <p className="mt-3 text-sm leading-snug text-muted-foreground" data-testid="start-note">
          {startShortLine}
        </p>
      ) : null}
    </div>
  )
}

function WhatIfResult({
  headingRef,
  mode,
  parts,
  compareHref,
  headline,
  changesLabel,
  delta,
  current,
  next,
  startKind,
  startNote,
  sender,
  plural,
  state,
  chips,
  onUndo,
  onReset,
  onKeep,
  vehicleChanged,
  nextCarName,
  versionPicker,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  mode: WhatIfMode
  parts: ChangePart[]
  compareHref: string
  headline: string
  /** "Your changes: 2025 Tesla Model Y + a new 16-year-old", when there's more than one. */
  changesLabel: string | null
  delta: number
  current: Estimate
  next: Estimate
  startKind: StartKind
  startNote?: string
  /** The starting premium came from a shared link: it's what the sender pays. */
  sender: boolean
  /** More than one thing changed. */
  plural: boolean
  state: string
  chips: { key: ChangeKey; label: string }[]
  onUndo: (key: ChangeKey) => void
  onReset: () => void
  onKeep: () => void
  vehicleChanged: boolean
  nextCarName: string
  versionPicker: React.ReactNode
}) {
  const min = Math.round(Math.min(current.low, next.low) * 0.92)
  const max = Math.round(Math.max(current.high, next.high) * 1.04)
  const ownNumber = startKind === "yours" && current.steps.length === 0
  const nowWords = ownNumber ? dollars(current.likely) : estimateDollars(current.likely)
  // A move to a state we have no price for has no amount: show the engine's sentence whole.
  const hasAmount = headline.includes(": about")
  const label = changesLabel ?? (hasAmount ? headline.slice(0, headline.indexOf(": about")) : null)
  const rounded = Math.round(delta / 10) * 10
  const direction = mode === "teen-own" ? "neutral" : rounded > 0 ? "up" : rounded < 0 ? "down" : "same"
  const tone = direction === "up" ? "text-up" : direction === "down" ? "text-down" : "text-foreground"
  // A piece that rounds to $0 doesn't explain anything.
  const shownParts = parts.filter((part) => Math.round(part.amount / 10) !== 0)
  return (
    <div className="pop-in grid gap-6" key={headline}>
      <div className="grid gap-1">
        {label ? <p className="text-base font-medium text-muted-foreground">{label}</p> : null}
        <h3 ref={headingRef} tabIndex={-1} className="outline-none" data-testid="what-if-headline" aria-label={headline}>
          {!hasAmount ? (
            <span className="block text-2xl leading-snug font-semibold tracking-tight text-balance">{headline}</span>
          ) : mode === "teen-own" ? (
            <span className="flex flex-wrap items-baseline gap-x-2 text-4xl leading-tight font-semibold tracking-tight sm:text-[2.75rem]">
              <span className="text-lg font-medium text-muted-foreground">about</span>
              <span className="money">{estimateDollars(next.likely)}</span>
              <span className="text-lg font-medium text-muted-foreground">a year</span>
            </span>
          ) : direction === "same" ? (
            <span className="block text-4xl leading-tight font-semibold tracking-tight">About the same</span>
          ) : (
            <span className={cn("flex flex-wrap items-baseline gap-x-2 text-4xl leading-tight font-semibold tracking-tight sm:text-[2.75rem]", tone)}>
              <span className="text-lg font-medium text-muted-foreground">about</span>
              <span className="money">{dollars(Math.abs(rounded))}</span>
              <span>{direction === "up" ? "more" : "less"}</span>
              <span className="text-lg font-medium text-muted-foreground">a year</span>
            </span>
          )}
        </h3>
        {hasAmount ? (
          <p className="text-sm text-muted-foreground">
            {mode === "teen-own"
              ? `For their own policy, on top of your ${nowWords}.`
              : mode === "teen-added"
                ? `On a policy that costs ${ownNumber ? "" : "about "}${nowWords} now.`
                : direction === "same"
                  ? "Within $10 either way."
                  : differenceWords(delta, "month") === "about the same"
                    ? "About the same each month."
                    : `About ${differenceWords(delta, "month")}.`}
          </p>
        ) : null}
      </div>

      {shownParts.length > 1 || (shownParts.length === 1 && vehicleChanged) ? (
        <div className="grid gap-2" data-testid="what-if-parts">
          <p className="text-sm font-semibold">What makes the difference</p>
          <ul className="grid text-sm">
            {shownParts.map((part) => (
              <li key={part.label} className="flex items-baseline justify-between gap-4 border-b border-border/70 py-1.5 last:border-b-0">
                <span>{part.label}</span>
                <span
                  className={cn(
                    "money font-semibold whitespace-nowrap",
                    part.amount > 0 ? "text-up" : part.amount < 0 ? "text-down" : "text-muted-foreground",
                  )}
                >
                  {signedDollars(part.amount)}
                </span>
              </li>
            ))}
          </ul>
          {shownParts.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              Each piece is rounded to the nearest $10 a year, so they may not add up exactly.
            </p>
          ) : null}
        </div>
      ) : null}

      <dl className="grid gap-4 rounded-2xl bg-muted/60 p-4">
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <dt className="text-sm text-muted-foreground">{mode === "teen-own" ? "Your policy" : "Now"}</dt>
            <dd className="money text-sm text-muted-foreground">
              <span className="text-base font-semibold text-foreground">{nowWords}</span> a year
              {ownNumber ? null : <span> · {rangeWords(current.low, current.high)}</span>}
            </dd>
          </div>
          {ownNumber ? null : <RangeBar low={current.low} likely={current.likely} high={current.high} min={min} max={max} tone="muted" />}
        </div>
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <dt className="text-sm font-semibold">
              {mode === "teen-own" ? "Their own policy" : mode === "teen-added" ? "With your teen" : plural ? "With these changes" : "With this change"}
            </dt>
            <dd className="money text-sm text-muted-foreground" data-testid="what-if-yearly">
              <span className="text-lg font-semibold text-foreground">{estimateDollars(next.likely)}</span> a year ·{" "}
              {rangeWords(next.low, next.high)}
            </dd>
          </div>
          <RangeBar low={next.low} likely={next.likely} high={next.high} min={min} max={max} tone="sun" />
        </div>
        <p className="text-sm text-muted-foreground">The dot is our best guess. The bar shows where most real quotes would land.</p>
      </dl>
      {versionPicker}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">You changed:</span>
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1 rounded-full bg-sun-soft py-1 pr-1 pl-3 text-sm font-medium">
              {chip.label}
              <button type="button" className="icon-btn size-7" aria-label={`Undo ${chip.label}`} onClick={() => onUndo(chip.key)}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {vehicleChanged ? (
          // A full page load, so the Compare page reads the cars from the address before anything else.
          <a href={compareHref} className="btn btn-primary">
            Compare more cars <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        ) : null}
        <button type="button" className="btn" onClick={onKeep}>
          Keep this as my situation
        </button>
        <button type="button" className="btn btn-quiet" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden="true" /> Start over
        </button>
      </div>

      <details className="disclosure -mb-2">
        <summary>
          {mode === "teen-own" ? "Here's how we got their price" : "Here's how we got this"}
          <ChevronDown className="size-4" aria-hidden="true" />
        </summary>
        <div className="grid gap-3 pb-4">
          <HowWeGotThis estimate={next} startKind={startKind} startNote={startNote} state={state} sender={sender} />
          {vehicleChanged ? (
            <p>
              <VehicleFixLink carName={nextCarName} shown={vehicleMatchWords(next.vehicle)} />
            </p>
          ) : null}
        </div>
      </details>
    </div>
  )
}

/** Version (trim) and model year for a picked car, as small selects. */
function VersionPicker({
  idPrefix,
  pick,
  catalog,
  onChange,
  compact = false,
}: {
  idPrefix: string
  pick: VehiclePick
  catalog: ReturnType<typeof useCatalog>["catalog"]
  onChange: (pick: VehiclePick) => void
  compact?: boolean
}) {
  if (!catalog) return null
  const trims = modelTrims(catalog, pick.year, pick.make, pick.model)
  const years = catalogYears(catalog).filter((year) => modelTrims(catalog, year, pick.make, pick.model).length > 0)
  const trimNames = trims.some((trim) => trim.name === pick.trim) ? trims.map((trim) => trim.name) : [pick.trim, ...trims.map((trim) => trim.name)]
  return (
    <div className={cn("grid grid-cols-[6rem_1fr] gap-2", compact ? "" : "rounded-xl bg-muted/70 p-3")}>
      <div className="grid gap-1">
        <label htmlFor={`${idPrefix}-year`} className="text-xs font-medium text-muted-foreground">
          Model year
        </label>
        <select
          id={`${idPrefix}-year`}
          className="field-select min-h-9 py-1 text-sm"
          value={pick.year}
          onChange={(event) => {
            const year = Number(event.target.value)
            const resolved = resolveCar(catalog, year, { make: pick.make, model: pick.model, trim: pick.trim })
            if (resolved) onChange(resolved)
          }}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <div className="grid min-w-0 gap-1">
        <label htmlFor={`${idPrefix}-trim`} className="text-xs font-medium text-muted-foreground">
          Version
        </label>
        <select
          id={`${idPrefix}-trim`}
          className="field-select min-h-9 py-1 text-sm"
          value={pick.trim}
          onChange={(event) => onChange({ ...pick, trim: event.target.value })}
        >
          {trimNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/** The printed page: your situation, then only what changed. */
function PrintSummary({
  situation,
  nowEstimate,
  ownNumber,
  result,
  changes,
}: {
  situation: Situation
  nowEstimate: Estimate | null
  /** The figure is what they typed: print it as is, with no range. */
  ownNumber: boolean
  result: { headline: string; next: Estimate; parts: ChangePart[] } | null
  changes: string[]
}) {
  const printed = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  return (
    <div className="print-only print-sheet">
      <p style={{ fontSize: "9pt", letterSpacing: "0.08em", textTransform: "uppercase" }}>NotAQuote.FYI · {printed}</p>
      <h1 style={{ fontSize: "20pt", fontWeight: 650, margin: "4pt 0 12pt" }}>
        {result ? result.headline : "Your car insurance, roughly"}
      </h1>
      <h2 style={{ fontSize: "12pt", fontWeight: 650, marginTop: "12pt" }}>Your situation now</h2>
      <p>{situationSentence(situation.scenario, false)}</p>
      {nowEstimate ? (
        ownNumber ? (
          <p>
            <strong>{dollars(nowEstimate.likely)} a year</strong>, what you pay now.
          </p>
        ) : (
          <p>
            <strong>About {estimateDollars(nowEstimate.likely)} a year</strong> ({rangeWords(nowEstimate.low, nowEstimate.high)}).
          </p>
        )
      ) : null}
      {result && changes.length > 0 ? (
        <>
          <h2 style={{ fontSize: "12pt", fontWeight: 650, marginTop: "12pt" }}>What if: {changes.join(", ")}</h2>
          <p>
            <strong>About {estimateDollars(result.next.likely)} a year</strong> ({rangeWords(result.next.low, result.next.high)}).
          </p>
          {result.parts.some((part) => Math.round(part.amount / 10) !== 0) ? (
            <ul style={{ margin: "6pt 0 0 14pt", listStyle: "disc" }}>
              {result.parts
                .filter((part) => Math.round(part.amount / 10) !== 0)
                .map((part) => (
                  <li key={part.label}>
                    {part.label}: {signedDollars(part.amount)}
                  </li>
                ))}
            </ul>
          ) : null}
          <p style={{ marginTop: "8pt", fontWeight: 600 }}>Why the range is this wide</p>
          <ul style={{ margin: "2pt 0 0 14pt", listStyle: "disc" }}>
            {result.next.rangePoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p style={{ marginTop: "14pt", borderTop: "0.75pt solid #999", paddingTop: "8pt" }}>
        Data updated {DATA_UPDATED}. Every source, and how the math works: notaquote.fyi/methodology
      </p>
      <DisclaimerText className="mt-2 text-black" />
    </div>
  )
}

