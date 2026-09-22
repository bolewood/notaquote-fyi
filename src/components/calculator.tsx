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
import { DeltaBadge, formatDollars, RangeBar, rangeWords } from "@/components/money"
import { ShareBox } from "@/components/share-box"
import { carName, modelTrims, resolveCar, WHAT_IF_CARS } from "@/lib/car-search"
import { vehicleFacts } from "@/lib/catalog-class"
import { catalogYears, trimRecord, type VehiclePick } from "@/lib/catalog"
import { DATA_BUNDLE_VERSION, MODEL_VERSION, PREMIUM_HINT } from "@/lib/copy"
import { recordCount, recordMountedCount } from "@/lib/counts"
import type { Estimate, StartKind } from "@/lib/factor-engine"
import {
  changeChip,
  changedKeys,
  priceNow,
  priceWhatIf,
  sameVehicle,
  startingPoint,
  startLine,
  vehicleMatchWords,
  type ChangeKey,
  type ChangePart,
  type WhatIfMode,
} from "@/lib/pricing"
import {
  situationSentence,
  STARTERS,
  shortVehicleLabel,
  withTeenFlag,
  type Scenario,
  type Starter,
  type StarterTab,
} from "@/lib/scenario"
import { encodeSharePath, SHARE_INVALID_NOTE, shareArrivalNotes } from "@/lib/share-link"
import { PageSkeleton } from "@/components/page-skeleton"
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
import { ArrowRight, Car, ChevronDown, MapPin, Printer, RotateCcw, Shield, Sparkles, UserPlus, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"

type Tab = StarterTab | "more"

const TABS: { id: Tab; label: string; icon: typeof Car }[] = [
  { id: "car", label: "Car", icon: Car },
  { id: "driver", label: "Driver", icon: UserPlus },
  { id: "move", label: "Moving", icon: MapPin },
  { id: "coverage", label: "Coverage", icon: Shield },
  { id: "more", label: "Miles and record", icon: Sparkles },
]

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

/** Only the inputs that differ from now, so a what-if follows later changes to "now". */
function diffFrom(now: Scenario, next: Scenario): Partial<Scenario> {
  const changes: Partial<Scenario> = {}
  if (!sameVehicle(now, next)) Object.assign(changes, { year: next.year, make: next.make, model: next.model, trim: next.trim })
  for (const key of changedKeys(now, next)) {
    if (key !== "vehicle") Object.assign(changes, { [key]: next[key] })
  }
  return changes
}

/** Waits for the browser (saved choices, share link) before drawing, so nothing flashes. */
export function Calculator() {
  const mounted = useMounted()
  if (!mounted) return <PageSkeleton label="Loading your situation" />
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
  const [tab, setTab] = useState<Tab>("car")
  const [notes, setNotes] = useState(initial.notes)
  const [picker, setPicker] = useState<null | "now" | "next">(null)
  const [premiumDraft, setPremiumDraft] = useState<string | null>(null)
  const [period, setPeriod] = useState<PremiumPeriod>("year")
  const premiumText = premiumDraft ?? (situation.premium === null ? "" : String(situation.premium))
  const premium = premiumStatus(premiumText, period)
  const premiumInvalid = premium.kind === "invalid"
  const whatIfRef = useRef<HTMLElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  /** After a quick pick, bring the answer into view if it's off screen (it often is on a phone). */
  function showResult() {
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }))
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
    if (status.kind !== "invalid" && status.annual !== situation.premium) {
      recordCount("adjustment")
      saveSituation({ ...situation, premium: status.annual }, true)
    }
  }

  const nowCar: VehiclePick = { year: now.year, make: now.make, model: now.model, trim: now.trim }
  const nextCar: VehiclePick = { year: next.year, make: next.make, model: next.model, trim: next.trim }

  return (
    <>
      <div className="no-print">
        <section className="max-w-3xl pt-6 sm:pt-8">
          <p className="eyebrow text-sun-ink">Car insurance, in plain numbers</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            What would happen to your car insurance if…
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            …you bought a different car, added a teen driver, or moved? Change one thing and see roughly what it does to the
            price. No sign-up, and nothing you type leaves your device.
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

        {linked ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-sun bg-sun-soft px-4 py-3 text-sm">
            <p className="flex-1">
              You&apos;re looking at someone else&apos;s situation. If you change anything, it becomes yours
              {linked.premium !== null ? ", without what they pay" : ""}.
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
        <div className="mt-5 grid items-start gap-5 lg:mt-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6">
          {/* What if */}
          <section
            ref={whatIfRef}
            id="what-if"
            aria-labelledby="what-if-heading"
            className="card scroll-mt-4 overflow-hidden"
          >
            <div className="border-b border-border bg-sun-soft px-5 pt-5 pb-4 sm:px-6">
              <h2 id="what-if-heading" className="text-xl font-semibold tracking-tight">
                What if…
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Change one thing, and we&apos;ll show the difference from your situation now.
              </p>
              <p className="mt-2 text-sm lg:hidden">
                <span className="text-muted-foreground">Now: </span>
                {situationSentence(now, false)}{" "}
                <a href="#now" className="link whitespace-nowrap">
                  Change
                </a>
              </p>
            </div>

            <div role="tablist" aria-label="What to change" className="scroll-row border-b border-border px-3 py-2 sm:flex-wrap sm:px-4">
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

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="px-5 py-5 sm:px-6">
              {tab === "car" ? (
                <div className="grid gap-4">
                  <p className="text-sm font-medium">Try another car:</p>
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
                            showResult()
                          }}
                        >
                          {car.year} {car.make} {car.model}
                        </button>
                      )
                    })}
                    <button type="button" className="chip border-dashed" onClick={() => setPicker("next")}>
                      Search every car…
                    </button>
                  </div>
                </div>
              ) : null}
              {tab === "driver" ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={next.age === "16-18" && now.age !== "16-18"}
                      onClick={() => patchNext({ age: "16-18", yearsLicensed: "under-1" })}
                    >
                      Add a new 16-year-old driver
                    </button>
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={next.age === "19-21" && now.age !== "19-21"}
                      onClick={() => patchNext({ age: "19-21", yearsLicensed: "1-3" })}
                    >
                      A 19–21-year-old driver
                    </button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <AgeField scenario={next} onChange={patchNext} idPrefix="next" label="What if the driver were" />
                    <YearsField scenario={next} onChange={patchNext} idPrefix="next" />
                    {next.age === "16-18" && now.age !== "16-18" ? (
                      <div className="grid gap-1.5 sm:col-span-2">
                        <PolicyField value={situation.teenOnParentPolicy} onChange={setPolicy} idPrefix="next" />
                        <p className="text-xs leading-snug text-muted-foreground">
                          {situation.teenOnParentPolicy
                            ? "We price your whole policy after adding them, on the car in your situation now."
                            : "We price the teen alone, on their own policy."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <DiscountFields scenario={next} onChange={patchNext} idPrefix="next" />
                </div>
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

            <div ref={resultRef} className="scroll-mb-4 border-t border-border bg-background/60 px-5 py-5 sm:px-6" aria-live="polite">
              {result && premiumInvalid ? (
                <p className="py-2 text-center text-sm text-muted-foreground" data-testid="what-if-waiting">
                  Finish typing what you pay now (or clear it), and the difference shows here.
                </p>
              ) : result ? (
                <WhatIfResult
                  mode={result.mode}
                  parts={result.parts}
                  headline={result.headline}
                  delta={result.deltaRounded}
                  current={result.current}
                  next={result.next}
                  startKind={startKind}
                  startNote={startNote}
                  chips={changed.map((key) => ({ key, label: changeChip(key, next) }))}
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
                <div className="grid gap-1 py-2 text-center" data-testid="what-if-empty">
                  <p className="text-base font-medium">Pick a car or change anything above.</p>
                  <p className="text-sm text-muted-foreground">We&apos;ll show what it does to your yearly price, right here.</p>
                </div>
              )}
            </div>
          </section>

          {/* Now */}
          <section id="now" aria-labelledby="now-heading" className="card scroll-mt-4 p-5 sm:p-6">
            <h2 id="now-heading" className="text-xl font-semibold tracking-tight">
              Your situation now
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{situationSentence(now, false)}</p>

            {nowEstimate ? (
              <NowFigure estimate={nowEstimate} startKind={startKind} startNote={startNote} waiting={premiumInvalid} />
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
              </div>

              <div className="grid gap-1.5 rounded-xl bg-muted/70 p-3.5">
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
                      placeholder="1,800"
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
                <p id="premium-hint" className={cn("text-xs leading-snug", premiumInvalid ? "text-destructive" : "text-muted-foreground")}>
                  {premiumInvalid ? "Enter a dollar amount, like 1,800. Or leave it empty." : PREMIUM_HINT}
                  {premium.annual !== null && period !== "year" ? ` That's ${formatDollars(premium.annual)} a year.` : ""}
                </p>
                {premium.kind === "maybe-monthly" ? (
                  <p className="flex flex-wrap items-center gap-x-2 text-xs leading-snug" data-testid="premium-monthly-hint">
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

              <details className="group rounded-xl border border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-sm font-medium">
                  More about the driver and coverage
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="grid gap-3 border-t border-border px-3.5 py-3.5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DeductibleField scenario={now} onChange={patchNow} idPrefix="now" />
                    <RecordField scenario={now} onChange={patchNow} idPrefix="now" />
                    <MileageField scenario={now} onChange={patchNow} idPrefix="now" />
                    <YearsField scenario={now} onChange={patchNow} idPrefix="now" />
                  </div>
                  <DiscountFields scenario={now} onChange={patchNow} idPrefix="now" />
                  <p className="text-xs leading-snug text-muted-foreground">
                    We don&apos;t ask about credit. Many insurers use it, so your real quote could move up or down because of it.
                  </p>
                </div>
              </details>

              {nowEstimate ? (
                <details className="group rounded-xl border border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-sm font-medium">
                    Here&apos;s how we got this
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="border-t border-border px-3.5 py-3.5">
                    <HowWeGotThis estimate={nowEstimate} startKind={startKind} />
                  </div>
                </details>
              ) : null}
            </div>
          </section>
        </div>

        <section aria-labelledby="starters-heading" className="mt-10">
          <h2 id="starters-heading" className="text-lg font-semibold">
            Or start with a common question
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STARTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="card grid content-start gap-1 p-4 text-left transition-colors hover:border-primary"
                onClick={() => tryStarter(item)}
                data-testid={`starter-${item.id}`}
              >
                <span className="font-semibold">{item.title}</span>
                <span className="text-sm leading-snug text-muted-foreground">{item.story}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-foreground px-5 py-6 text-background sm:flex-row sm:items-center sm:px-7">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Shopping for a first car?</h2>
            <p className="mt-1 text-sm text-background/75">
              Put up to 15 cars side by side for the same driver. Sort them, star the favorites, and narrow it down together.
            </p>
          </div>
          <Link href="/compare" className="btn border-background bg-background text-foreground hover:bg-background/90">
            Compare cars <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>

        <section className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-[1fr_auto] sm:items-start">
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
        <DisclaimerText className="mt-6 max-w-3xl" />
      </div>

      <PrintSummary
        situation={situation}
        nowEstimate={nowEstimate}
        result={result ? { headline: result.headline, next: result.next } : null}
        nextName={changed.length > 0 ? situationSentence(next, situation.teenOnParentPolicy) : null}
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
            showResult()
          }
        }}
      />
    </>
  )
}

function NowFigure({
  estimate,
  startKind,
  startNote,
  waiting,
}: {
  estimate: Estimate
  startKind: StartKind
  startNote?: string
  /** The premium field has text we can't read yet: dim the old figures. */
  waiting: boolean
}) {
  const ownNumber = startKind === "yours" && estimate.steps.length === 0
  return (
    <div
      className={cn("mt-4 rounded-xl bg-primary/[0.06] px-4 py-4 transition-opacity", waiting && "opacity-35")}
      data-testid="now-figure"
      aria-hidden={waiting || undefined}
    >
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="money text-4xl font-semibold tracking-tight" data-testid="now-yearly">
          {formatDollars(estimate.likely)}
        </span>
        <span className="text-base text-muted-foreground">a year</span>
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {ownNumber
          ? `What you pay now (about ${formatDollars(estimate.monthly)} a month).`
          : `About ${formatDollars(estimate.monthly)} a month, ${rangeWords(estimate.low, estimate.high)} a year.`}
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
      {startKind === "typical" && startNote ? (
        <p className="mt-3 text-xs leading-snug text-muted-foreground" data-testid="start-note">
          {startNote}
        </p>
      ) : null}
    </div>
  )
}

function WhatIfResult({
  mode,
  parts,
  compareHref,
  headline,
  delta,
  current,
  next,
  startKind,
  startNote,
  chips,
  onUndo,
  onReset,
  onKeep,
  vehicleChanged,
  nextCarName,
  versionPicker,
}: {
  mode: WhatIfMode
  parts: ChangePart[]
  compareHref: string
  headline: string
  delta: number
  current: Estimate
  next: Estimate
  startKind: StartKind
  startNote?: string
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
  return (
    <div className="pop-in grid gap-4" key={headline}>
      <div className="grid gap-2">
        <p className="eyebrow">The difference</p>
        <p className="text-2xl leading-snug font-semibold tracking-tight text-balance" data-testid="what-if-headline">
          {headline}
        </p>
        {mode === "teen-own" ? null : (
          <div>
            <DeltaBadge amount={delta} />
          </div>
        )}
      </div>

      {parts.length > 0 ? (
        <div className="grid gap-1.5" data-testid="what-if-parts">
          <p className="text-sm font-medium">What makes the difference</p>
          <ul className="grid gap-1 text-sm">
            {parts.map((part) => (
              <li key={part.label} className="flex items-baseline justify-between gap-4 border-b border-dashed border-border pb-1">
                <span>{part.label}</span>
                <span className={cn("money font-medium whitespace-nowrap", part.amount > 0 ? "text-up" : part.amount < 0 ? "text-down" : "text-muted-foreground")}>
                  {signedTen(part.amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Each piece is rounded to the nearest $10, so they may not add up exactly.</p>
        </div>
      ) : null}

      <dl className="grid gap-3">
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-muted-foreground">{mode === "teen-own" ? "Your policy" : "Now"}</dt>
            <dd className="money text-sm">
              <span className="text-base font-semibold">{formatDollars(current.likely)}</span> a year
              {ownNumber ? null : <span className="text-muted-foreground"> · {rangeWords(current.low, current.high)}</span>}
            </dd>
          </div>
          {ownNumber ? null : <RangeBar low={current.low} likely={current.likely} high={current.high} min={min} max={max} tone="muted" />}
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm font-medium">{mode === "teen-own" ? "Their own policy" : mode === "teen-added" ? "With your teen" : "What if"}</dt>
            <dd className="money text-sm" data-testid="what-if-yearly">
              <span className="text-lg font-semibold">{formatDollars(next.likely)}</span> a year
              <span className="text-muted-foreground"> · {rangeWords(next.low, next.high)}</span>
            </dd>
          </div>
          <RangeBar low={next.low} likely={next.likely} high={next.high} min={min} max={max} tone="sun" />
          <p className="text-xs text-muted-foreground">About {formatDollars(next.monthly)} a month.</p>
        </div>
      </dl>
      {versionPicker}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Changed:</span>
        {chips.map((chip) => (
          <span key={chip.key} className="inline-flex items-center gap-1 rounded-full bg-sun-soft py-1 pr-1 pl-3 text-sm">
            {chip.label}
            <button type="button" className="icon-btn size-7" aria-label={`Undo ${chip.label}`} onClick={() => onUndo(chip.key)}>
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden="true" /> Start over
        </button>
        <button type="button" className="btn btn-quiet" onClick={onKeep}>
          Make this my situation now
        </button>
        {vehicleChanged ? (
          // A full page load, so the Compare page reads the cars from the address before anything else.
          <a href={compareHref} className="btn btn-quiet">
            Compare more cars <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-sm font-medium">
          {mode === "teen-own" ? "Here's how we got their price" : "More about the new number"}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-border px-3.5 py-3.5">
          <HowWeGotThis estimate={next} startKind={startKind} startNote={startNote} />
        </div>
      </details>
      {vehicleChanged ? (
        <p className="-mt-1 text-sm">
          <VehicleFixLink carName={nextCarName} shown={vehicleMatchWords(next.vehicle)} />
        </p>
      ) : null}
    </div>
  )
}

/** "+$120" or "−$90", rounded to the nearest $10 like every sentence on the page. */
function signedTen(amount: number): string {
  const rounded = Math.round(amount / 10) * 10
  if (rounded === 0) return "about the same"
  return `${rounded > 0 ? "+" : "−"}${formatDollars(Math.abs(rounded))}`
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

function PrintSummary({
  situation,
  nowEstimate,
  result,
  nextName,
}: {
  situation: Situation
  nowEstimate: Estimate | null
  result: { headline: string; next: Estimate } | null
  nextName: string | null
}) {
  return (
    <div className="print-only">
      <h1 style={{ fontSize: "18pt", fontWeight: 600 }}>NotAQuote.FYI: what-if summary</h1>
      <p>Printed {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.</p>
      <h2 style={{ fontSize: "13pt", fontWeight: 600, marginTop: "12pt" }}>Your situation now</h2>
      <p>{situationSentence(situation.scenario, false)}</p>
      {nowEstimate ? (
        <>
          <p>
            About {formatDollars(nowEstimate.likely)} a year ({rangeWords(nowEstimate.low, nowEstimate.high)}).
          </p>
          <p>{nowEstimate.summary}</p>
        </>
      ) : null}
      {result && nextName ? (
        <>
          <h2 style={{ fontSize: "13pt", fontWeight: 600, marginTop: "12pt" }}>What if</h2>
          <p>{nextName}</p>
          <p style={{ fontWeight: 600 }}>{result.headline}</p>
          <p>
            About {formatDollars(result.next.likely)} a year ({rangeWords(result.next.low, result.next.high)}).
          </p>
          <p>{result.next.summary}</p>
          <p>{result.next.rangeNote}</p>
        </>
      ) : null}
      <p style={{ marginTop: "12pt" }}>
        Model {MODEL_VERSION}, data {DATA_BUNDLE_VERSION}. Sources and method: notaquote.fyi/methodology
      </p>
      <DisclaimerText className="mt-3 text-black" />
    </div>
  )
}
