"use client"

import {
  carName,
  defaultTrim,
  FIRST_CARS,
  modelTrims,
  parseCarQuery,
  POPULAR_SUVS,
  searchModels,
  TRUCKS_AND_FUN,
  type ModelHit,
} from "@/lib/car-search"
import { catalogYears, type CatalogStatus, type VehicleCatalog, type VehiclePick } from "@/lib/catalog"
import { runVinLookup } from "@/lib/vin-lookup"
import { cn } from "cn"
import { ArrowLeft, Check, ChevronRight, Search, X } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"

const POPULAR = [...FIRST_CARS.slice(0, 6), ...POPULAR_SUVS.slice(0, 5), ...TRUCKS_AND_FUN.slice(0, 3)]

/**
 * Find a car: pick a model year, type a few letters ("model y", "civic"),
 * choose the model, then the version if there's more than one.
 */
export function CarPicker({
  open,
  onClose,
  catalog,
  catalogStatus,
  initialYear,
  title,
  actionLabel,
  onPick,
  keepOpen = false,
  isPicked,
  footer,
  allowVin = false,
}: {
  open: boolean
  onClose: () => void
  catalog: VehicleCatalog | null
  catalogStatus: CatalogStatus
  initialYear: number
  title: string
  actionLabel: string
  onPick: (pick: VehiclePick) => void
  /** Stay open after a pick, for adding several cars. */
  keepOpen?: boolean
  isPicked?: (pick: VehiclePick) => boolean
  footer?: React.ReactNode
  allowVin?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [year, setYear] = useState(initialYear)
  const [query, setQuery] = useState("")
  const [model, setModel] = useState<ModelHit | null>(null)
  const [vinText, setVinText] = useState("")
  const [vinMessage, setVinMessage] = useState<string | null>(null)
  const [vinPending, setVinPending] = useState(false)
  const headingId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      requestAnimationFrame(() => searchRef.current?.focus())
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const years = useMemo(() => (catalog ? catalogYears(catalog) : [initialYear]), [catalog, initialYear])
  // "2015 civic" searches 2015, whatever the year box says.
  const parsed = parseCarQuery(query)
  const searchYear = parsed.year !== null && years.includes(parsed.year) ? parsed.year : year
  const hits = useMemo(
    () => (catalog && parsed.text ? searchModels(catalog, searchYear, parsed.text, 30) : []),
    [catalog, searchYear, parsed.text],
  )
  const popular = useMemo(() => {
    if (!catalog) return []
    return POPULAR.flatMap((car) => {
      const trims = modelTrims(catalog, searchYear, car.make, car.model)
      return trims.length > 0 ? [{ year: searchYear, make: car.make, model: car.model, trims }] : []
    })
  }, [catalog, searchYear])

  function reset() {
    setQuery("")
    setModel(null)
    setVinText("")
    setVinMessage(null)
  }

  function close() {
    reset()
    onClose()
  }

  function choose(pick: VehiclePick) {
    onPick(pick)
    if (keepOpen) {
      setModel(null)
      searchRef.current?.focus()
      searchRef.current?.select()
    } else {
      close()
    }
  }

  function chooseModel(hit: ModelHit) {
    if (hit.trims.length === 1) {
      choose({ year: hit.year, make: hit.make, model: hit.model, trim: hit.trims[0].name })
      return
    }
    setModel(hit)
  }

  async function lookUpVin() {
    const submitted = vinText
    setVinPending(true)
    try {
      const result = await runVinLookup(submitted, { fetchImpl: fetch, catalog })
      setVinMessage(result.message)
      if (result.ok) {
        choose({ year: result.year, make: result.make, model: result.model, trim: result.trim })
      }
    } finally {
      setVinText("")
      setVinPending(false)
    }
  }

  const list = parsed.text ? hits : popular
  const suggested = model ? defaultTrim(model.trims) : null

  return (
    <dialog
      ref={ref}
      className="picker-dialog"
      aria-labelledby={headingId}
      onClose={close}
      onClick={(event) => {
        if (event.target === ref.current) close()
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          {model ? (
            <button type="button" className="icon-btn" onClick={() => setModel(null)} aria-label="Back to all models">
              <ArrowLeft className="size-4" />
            </button>
          ) : null}
          <h2 id={headingId} className="flex-1 text-base font-semibold">
            {model ? `Which ${model.make} ${model.model}?` : title}
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {model ? (
          <div className="grid flex-1 content-start gap-3 overflow-y-auto px-4 py-4">
            <p className="text-sm text-muted-foreground">
              Not sure which version? The first one is a good pick. It rarely changes the estimate much.
            </p>
            <ul className="grid gap-1.5">
              {[...model.trims]
                .sort((left, right) => (left.name === suggested?.name ? -1 : right.name === suggested?.name ? 1 : 0))
                .map((trim) => {
                  const pick = { year: model.year, make: model.make, model: model.model, trim: trim.name }
                  const picked = isPicked?.(pick) ?? false
                  return (
                    <li key={trim.name}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                        onClick={() => choose(pick)}
                        disabled={picked}
                      >
                        <span className="grid flex-1 gap-0.5">
                          <span className="font-medium">{trim.name}</span>
                          {trim.name === suggested?.name ? (
                            <span className="text-xs text-muted-foreground">A good default</span>
                          ) : null}
                        </span>
                        {picked ? (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Check className="size-4" /> In your list
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-primary">{actionLabel}</span>
                        )}
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[6.5rem_1fr] gap-2 px-4 pt-4">
              <div className="grid gap-1">
                <label htmlFor={`${headingId}-year`} className="field-label">
                  Model year
                </label>
                <select
                  id={`${headingId}-year`}
                  className="field-select"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  disabled={!catalog}
                >
                  {years.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <label htmlFor={`${headingId}-search`} className="field-label">
                  Make or model
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    id={`${headingId}-search`}
                    type="search"
                    className="field-input pl-9"
                    placeholder="Try “Model Y” or “2015 Civic”"
                    autoComplete="off"
                    spellCheck={false}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && hits[0]) {
                        event.preventDefault()
                        chooseModel(hits[0])
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
              {catalogStatus === "loading" ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading the list of cars…</p>
              ) : catalogStatus === "failed" ? (
                <p className="py-6 text-center text-sm">
                  The list of cars didn&apos;t load. Check your connection and reload the page.
                </p>
              ) : list.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing for {searchYear} matches “{parsed.text}”. Try another spelling or model year.
                </p>
              ) : (
                <>
                  <p className="eyebrow mb-2">{parsed.text ? `${list.length === 30 ? "Top matches" : "Matches"} for ${searchYear}` : `Popular ${searchYear} cars`}</p>
                  <ul className="grid gap-1">
                    {list.map((hit) => (
                      <li key={`${hit.make}|${hit.model}`}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted"
                          onClick={() => chooseModel(hit)}
                        >
                          <span className="flex-1">
                            <span className="font-medium">
                              {hit.make} {hit.model}
                            </span>
                            <span className="ml-2 text-sm text-muted-foreground">
                              {hit.trims.length === 1 ? "1 version" : `${hit.trims.length} versions`}
                            </span>
                          </span>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            {allowVin ? (
              <div className="grid gap-1.5 border-t border-border px-4 py-3">
                <label htmlFor={`${headingId}-vin`} className="field-label">
                  Or look it up by VIN (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    id={`${headingId}-vin`}
                    className="field-input"
                    value={vinText}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={20}
                    placeholder="17 letters and numbers"
                    aria-describedby={`${headingId}-vin-hint`}
                    onChange={(event) => setVinText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        void lookUpVin()
                      }
                    }}
                  />
                  <button type="button" className="btn" disabled={vinPending || !catalog} onClick={() => void lookUpVin()}>
                    {vinPending ? "Looking…" : "Look up"}
                  </button>
                </div>
                <p id={`${headingId}-vin-hint`} className="text-sm leading-snug text-muted-foreground">
                  It&apos;s on your registration or insurance card. Your browser sends it straight to NHTSA&apos;s free decoder, and we don&apos;t keep it.
                </p>
                {vinMessage ? (
                  <p role="status" className="text-sm leading-snug font-medium">
                    {vinMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
        {footer ? <div className={cn("border-t border-border px-4 py-3")}>{footer}</div> : null}
      </div>
    </dialog>
  )
}

export function carTitle(pick: VehiclePick): string {
  return carName(pick)
}
