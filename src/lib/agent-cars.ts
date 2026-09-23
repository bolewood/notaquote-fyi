/**
 * Cars for the agent API (/api/v1): stable ids, name resolution, and short
 * descriptions, all from the same catalog the site uses.
 *
 * An id is a slug of the model year, make, model, and version (trim), with
 * the model's name left out of the version when it repeats it, and nothing
 * for a version the catalog couldn't name:
 *   2022 / Honda / Civic / "Civic 4Dr"          ->  "2022-honda-civic-4dr"
 *   2022 / Toyota / Corolla / "Corolla"         ->  "2022-toyota-corolla"
 *   2022 / Honda / Civic Si / "Trim not resolved" -> "2022-honda-civic-si"
 * Ids are stable for a catalog version. In the rare case two versions give
 * the same slug, the later one (in catalog order) gets "-2", "-3", and so on.
 *
 * Names are matched strictly, because pricing the wrong car with a straight
 * face is worse than asking again: the model has to be named (not just a
 * make, a body style, or a word that happens to sit inside a model's name),
 * and any extra words have to name a version or look like a version code.
 * Anything else comes back unresolved, with suggestions.
 */
import {
  FIRST_CARS,
  parseCarQuery,
  POPULAR_SUVS,
  resolveCar,
  searchModels,
  STARTER_MIX,
  TRUCKS_AND_FUN,
  type ModelHit,
  type QuickCar,
} from "./car-search"
import { catalogYears, trimRecord, type CatalogTrim, type VehicleCatalog, type VehiclePick } from "./catalog"
import { VEHICLE_CLASS_LABELS, vehicleFacts, type VehicleFacts } from "./catalog-class"
import { compactName, normalizeName, UNRESOLVED_TRIM_NAME, type TrimConfidence } from "./catalog-match"
import { vehicleRelativity } from "./factor-engine"

/** Model year used for a car name that doesn't give one: the site's own default for a first car. */
export const DEFAULT_MODEL_YEAR = 2022

/** The most words we read in one car name. Real names are shorter. */
export const CAR_WORDS_MAX = 8

export function slugPart(value: string): string {
  return normalizeName(value).replace(/ /g, "-")
}

function baseSlug(pick: VehiclePick): string {
  const model = slugPart(pick.model)
  const trim = pick.trim === UNRESOLVED_TRIM_NAME ? "" : slugPart(pick.trim)
  const rest = trim === model ? "" : trim.startsWith(`${model}-`) ? trim.slice(model.length + 1) : trim
  return [String(pick.year), slugPart(pick.make), model, rest].filter(Boolean).join("-")
}

function pickKey(pick: VehiclePick): string {
  return `${pick.year}|${pick.make}|${pick.model}|${pick.trim}`
}

type CarIndex = { byId: Map<string, VehiclePick>; idByKey: Map<string, string> }

const INDEXES = new WeakMap<VehicleCatalog, CarIndex>()

/** Every car in the catalog by id, built once per catalog. */
export function carIndex(catalog: VehicleCatalog): CarIndex {
  const cached = INDEXES.get(catalog)
  if (cached) return cached
  const byId = new Map<string, VehiclePick>()
  const idByKey = new Map<string, string>()
  const years = Object.keys(catalog.vehicles).sort()
  for (const year of years) {
    const makes = catalog.vehicles[year]
    for (const make of Object.keys(makes).sort()) {
      for (const model of Object.keys(makes[make]).sort()) {
        // Named versions first, so a named version keeps the plain slug.
        const trims = [...makes[make][model]].sort(
          (left, right) => Number(left.name === UNRESOLVED_TRIM_NAME) - Number(right.name === UNRESOLVED_TRIM_NAME),
        )
        for (const trim of trims) {
          const pick = { year: Number(year), make, model, trim: trim.name }
          const base = baseSlug(pick)
          let id = base
          for (let suffix = 2; byId.has(id); suffix += 1) id = `${base}-${suffix}`
          byId.set(id, pick)
          idByKey.set(pickKey(pick), id)
        }
      }
    }
  }
  const index = { byId, idByKey }
  INDEXES.set(catalog, index)
  return index
}

export function carId(catalog: VehicleCatalog, pick: VehiclePick): string {
  const id = carIndex(catalog).idByKey.get(pickKey(pick))
  if (!id) throw new Error(`Not in the catalog: ${pickKey(pick)}`)
  return id
}

export type ClaimsData = "model" | "class-average" | "unknown"

export type CarSummary = {
  id: string
  /** "2022 Honda Civic" */
  name: string
  year: number
  make: string
  model: string
  /** The version, as the government sources print it ("" when they don't name one). */
  trim: string
  /** The kind of car, from the EPA size class: "Small SUV", "Midsize car", and so on. */
  vehicleClass: string | null
  powertrain: VehicleFacts["powertrain"]
  /** "model": HLDI insurance-claims results for this model. "class-average": the average for its kind of car. "unknown": an average car. */
  claimsData: ClaimsData
}

export function claimsDataOf(level: string): ClaimsData {
  return level === "model" ? "model" : level === "class" ? "class-average" : "unknown"
}

function shownTrim(trim: string): string {
  return trim === UNRESOLVED_TRIM_NAME ? "" : trim
}

export function describeCar(catalog: VehicleCatalog, pick: VehiclePick): CarSummary {
  const facts = vehicleFacts(catalog, pick)
  return {
    id: carId(catalog, pick),
    name: `${pick.year} ${pick.make} ${pick.model}`,
    year: pick.year,
    make: pick.make,
    model: pick.model,
    trim: shownTrim(pick.trim),
    vehicleClass: facts.classId ? VEHICLE_CLASS_LABELS[facts.classId] : null,
    powertrain: facts.powertrain,
    claimsData: claimsDataOf(vehicleRelativity(facts).level),
  }
}

/**
 * Words in a version (or model) name that mark a special edition, a hybrid,
 * or a performance version: "GT3", "Golf R", "X5 M", "M50i", "330e".
 */
const SPECIAL_WORDS =
  /\b(hybrid|hev|phev|plug in|electric|ev|4xe|prime|performance|dark horse|rubicon|trd|wilderness|lightning|zr2|raptor|tremor|gt|gt2|gt3|gt4|gts|rs|r|m|srt|amg|nismo|shelby|trx|jcw|john cooper works|type r|competition|turbo|targa|sdrive\d*[a-z]*|convertible|cabriolet|cabrio|roadster|spyder|coupe|cal rt|extended|woodland|platinum|ffv|m\d+[a-z]*|[a-z]*\d+e)\b/g

/** The special words in a name, for comparing with what someone typed. */
function specialWords(name: string): string[] {
  return [...normalizeName(name).matchAll(SPECIAL_WORDS)].map((match) => match[0])
}

function isSpecial(name: string): boolean {
  return specialWords(name).length > 0
}

/**
 * The version we pick when a name doesn't say which: a plain, mainstream
 * one (not a hybrid, a sporty version, a convertible, or a special edition,
 * unless that's all there is), strong catalog matches first, shortest name
 * first. The site's own default (defaultTrim in car-search.ts) only steers
 * away from hybrids and a few special editions, so for a few models, like the
 * Mustang Mach-E, it can pick a GT; the API prefers the base version.
 */
export function mainstreamTrim(trims: readonly CatalogTrim[]): CatalogTrim | null {
  if (trims.length === 0) return null
  const score = (trim: CatalogTrim) =>
    (trim.confidence === "high" ? 0 : trim.confidence === "limited" ? 2 : 4) +
    (isSpecial(trim.name) ? 1 : 0)
  return [...trims].sort((left, right) => score(left) - score(right) || left.name.length - right.name.length || left.name.localeCompare(right.name))[0]
}

const QUICK_LISTS: readonly QuickCar[] = [...FIRST_CARS, ...POPULAR_SUVS, ...TRUCKS_AND_FUN]

/** The version the site's one-tap lists pick for a model, or else a mainstream one. */
export function preferredTrim(catalog: VehicleCatalog, year: number, make: string, model: string): string | null {
  const quick = QUICK_LISTS.find((car) => car.make === make && car.model === model)
  if (quick) {
    const pick = resolveCar(catalog, year, quick)
    if (pick) return pick.trim
  }
  return mainstreamTrim(catalog.vehicles[String(year)]?.[make]?.[model] ?? [])?.name ?? null
}

/** Years in the catalog that list this make and model, newest first. */
export function yearsWithModel(catalog: VehicleCatalog, make: string, model: string): number[] {
  return catalogYears(catalog).filter((year) => (catalog.vehicles[String(year)]?.[make]?.[model]?.length ?? 0) > 0)
}

// ---------------------------------------------------------------------------
// Resolving what an agent typed

export type Confidence = "exact" | "high" | "medium"

export type ResolvedCar = {
  /** What was sent, when every word of it was used; otherwise what we understood. */
  input: string
  pick: VehiclePick
  id: string
  /** "2022 Honda Civic (Civic 4Dr)": what we priced. */
  resolvedAs: string
  /** exact: an id. high: one clear match. medium: we had to choose (see `note`). */
  confidence: Confidence
  /** The catalog's own confidence in the version name (the site uses it to widen a what-if's range). */
  trimConfidence: TrimConfidence | null
  yearAssumed: boolean
  note: string | null
  /** Other close matches, when we had to choose. */
  alternatives: string[]
}

/** A name we couldn't match. It never repeats what was sent, in case it held something personal. */
export type Unresolved = { message: string; understood: string | null; suggestions: string[] }

/** Common short names for makes and models, applied to the normalized words. */
const ALIASES: [RegExp, string][] = [
  [/\bchevy\b/g, "chevrolet"],
  [/\bvw\b/g, "volkswagen"],
  [/\b(mercedes benz|mercedes|merc|benz)\b/g, "mercedes benz"],
  [/\b(beemer|bimmer)\b/g, "bmw"],
  [/\bcaddy\b/g, "cadillac"],
  [/\balfa( romeo)?\b/g, "alfa romeo"],
  [/\blambo\b/g, "lamborghini"],
  [/\blandrover\b/g, "land rover"],
  [/\bmclaren( automotive)?\b/g, "mclaren automotive"],
  [/\b(mx 5 )?miata\b/g, "mx 5"],
  [/\bmx5\b/g, "mx 5"],
  [/\b3 series\b/g, "330i"],
  [/\b5 series\b/g, "530i"],
  [/\b2 series\b/g, "230i"],
  [/\b4 series\b/g, "430i"],
  [/(?<!mustang )\bmach e\b/g, "mustang mach e"],
  [/\bvette\b/g, "corvette"],
  [/\bgr 86\b/g, "gr86"],
  [/\btesla (y|3|s|x)\b/g, "tesla model $1"],
]

function applyAliases(text: string): string {
  return ALIASES.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text)
}

/** Words that can sit in a car name without changing which car it is. */
const FILLER = new Set(["new", "used", "base", "the", "a", "an", "standard", "trim", "version", "my"])

/**
 * Version words the catalog doesn't print but people use ("LX", "XLE",
 * "Touring"). A name with one of these gets the usual version, with a note.
 * Anything else left over (a name, a sentence, a number) is refused.
 */
const VERSION_WORDS = new Set([
  "sport", "touring", "limited", "premium", "platinum", "luxury", "select", "preferred", "signature", "special", "edition",
  "lariat", "laredo", "sahara", "rubicon", "overland", "trailhawk", "denali", "wilderness", "willys", "altitude", "latitude",
  "turbo", "hybrid", "plug", "in", "electric", "performance", "long", "range", "awd", "fwd", "rwd", "4wd", "2wd", "4x4", "4x2",
  "sedan", "hatchback", "hatch", "coupe", "convertible", "wagon", "door", "2dr", "4dr", "5dr", "manual", "automatic", "cvt",
  "pro", "off", "road", "trail", "crew", "cab", "supercrew", "supercab", "quad", "double", "bed", "short", "box", "offroad",
  "sr", "sr5", "le", "xle", "xse", "se", "sel", "sle", "slt", "lt", "ls", "ltz", "lx", "ex", "exl", "l", "s", "sv", "sl", "gt",
  "rs", "ss", "st", "si", "rt", "gl", "gls", "glx", "xl", "xlt", "limited", "titanium", "adventure", "base", "plus",
  "unlimited", "line", "1500", "2500", "3500",
])

function looksLikeVersion(word: string): boolean {
  return VERSION_WORDS.has(word) || /^[a-z]{1,3}\d?$/.test(word) || /^\d\.\d[a-z]?$/.test(word)
}

type ModelRow = { make: string; model: string; makeCompact: string; makeWords: string[]; modelCompact: string }

const MODEL_ROWS = new WeakMap<VehicleCatalog, Map<number, ModelRow[]>>()

function modelRows(catalog: VehicleCatalog, year: number): ModelRow[] {
  let byYear = MODEL_ROWS.get(catalog)
  if (!byYear) {
    byYear = new Map()
    MODEL_ROWS.set(catalog, byYear)
  }
  let rows = byYear.get(year)
  if (!rows) {
    rows = Object.entries(catalog.vehicles[String(year)] ?? {}).flatMap(([make, models]) =>
      Object.keys(models).map((model) => ({
        make,
        model,
        makeCompact: compactName(make),
        makeWords: normalizeName(make).split(" "),
        modelCompact: compactName(model),
      })),
    )
    byYear.set(year, rows)
  }
  return rows
}

/** The make the words start with, if any (the longest one wins: "land rover" over "land"). */
function leadingMake(catalog: VehicleCatalog, year: number, words: string[]): { make: string; length: number } | null {
  let best: { make: string; length: number } | null = null
  const seen = new Set<string>()
  for (const row of modelRows(catalog, year)) {
    if (seen.has(row.make)) continue
    seen.add(row.make)
    const length = row.makeWords.length
    if (length <= words.length && row.makeWords.every((word, index) => words[index] === word) && (!best || length > best.length)) {
      best = { make: row.make, length }
    }
  }
  return best
}

type ModelMatch = { rows: ModelRow[]; exact: boolean; used: number }

/**
 * Bounded memo of model lookups by (catalog version, year, make, words), so
 * a long list of names, or the same name in many years, stays cheap.
 */
const MATCH_MEMO = new Map<string, ModelMatch | null>()
const MATCH_MEMO_MAX = 20_000

/**
 * The model named by the longest leading run of `words` (after the make, if
 * one was given). Exact names win; a model whose name starts with what was
 * typed counts only when the make was given ("mini cooper").
 */
function matchModel(catalog: VehicleCatalog, year: number, make: string | null, words: string[]): ModelMatch | null {
  const key = `${catalog.version}|${year}|${make ?? ""}|${words.join(" ")}`
  if (MATCH_MEMO.has(key)) return MATCH_MEMO.get(key) ?? null
  const rows = modelRows(catalog, year).filter((row) => make === null || row.make === make)
  let result: ModelMatch | null = null
  for (let count = words.length; count >= 1 && !result; count -= 1) {
    const typed = words.slice(0, count).join("")
    if (typed.length < (make ? 1 : 2)) continue
    const exact = rows.filter((row) => row.modelCompact === typed)
    if (exact.length > 0) {
      result = { rows: exact, exact: true, used: count }
      break
    }
    if (make && typed.length >= 2) {
      const starts = rows
        .filter((row) => row.modelCompact.startsWith(typed))
        .sort((left, right) => Number(isSpecial(left.model)) - Number(isSpecial(right.model)) || left.modelCompact.length - right.modelCompact.length)
      if (starts.length > 0) result = { rows: starts, exact: false, used: count }
    }
  }
  if (MATCH_MEMO.size >= MATCH_MEMO_MAX) MATCH_MEMO.clear()
  MATCH_MEMO.set(key, result)
  return result
}

function trimsMatching(trims: readonly CatalogTrim[], words: string[]): CatalogTrim[] {
  if (words.length === 0) return []
  return trims.filter((trim) => {
    const name = normalizeName(trim.name)
    const parts = name.split(" ")
    const squeezed = name.replace(/ /g, "")
    return words.every((word) => parts.includes(word) || (word.length >= 3 && squeezed.includes(word)))
  })
}

function nameOf(pick: VehiclePick): string {
  const base = `${pick.year} ${pick.make} ${pick.model}`
  const trim = shownTrim(pick.trim)
  return trim && trim !== pick.model ? `${base} (${trim})` : base
}

function resolved(
  catalog: VehicleCatalog,
  input: string,
  pick: VehiclePick,
  confidence: Confidence,
  extra: { yearAssumed?: boolean; note?: string | null; alternatives?: string[] } = {},
): ResolvedCar {
  return {
    input,
    pick,
    id: carId(catalog, pick),
    resolvedAs: nameOf(pick),
    confidence,
    trimConfidence: trimRecord(catalog, pick)?.confidence ?? null,
    yearAssumed: extra.yearAssumed ?? false,
    note: extra.note ?? null,
    alternatives: extra.alternatives ?? [],
  }
}

function idFor(catalog: VehicleCatalog, year: number, make: string, model: string): string[] {
  const trim = preferredTrim(catalog, year, make, model)
  return trim ? [carId(catalog, { year, make, model, trim })] : []
}

/** A few likely cars for words we couldn't match, from the site's own search (for the `suggestions` list). */
function suggestionsFor(catalog: VehicleCatalog, year: number, make: string | null, words: string[]): string[] {
  if (make) {
    const popular = QUICK_LISTS.filter((car) => car.make === make).flatMap((car) => idFor(catalog, year, car.make, car.model))
    const others = modelRows(catalog, year)
      .filter((row) => row.make === make)
      .slice(0, 5)
      .flatMap((row) => idFor(catalog, year, row.make, row.model))
    return [...new Set([...popular, ...others])].slice(0, 5)
  }
  const text = words.slice(0, 3).join(" ")
  if (text.length < 3) return []
  return searchModels(catalog, year, text, 5).flatMap((hit) => idFor(catalog, year, hit.make, hit.model))
}

type Attempt =
  | { kind: "ok"; make: string; match: ModelMatch; rest: string[] }
  | { kind: "make-only"; make: string }
  | { kind: "none"; make: string | null }

function attempt(catalog: VehicleCatalog, year: number, words: string[]): Attempt {
  const lead = leadingMake(catalog, year, words)
  const modelWords = lead ? words.slice(lead.length) : words
  if (lead && modelWords.length === 0) return { kind: "make-only", make: lead.make }
  const match = matchModel(catalog, year, lead?.make ?? null, modelWords)
  if (!match) return { kind: "none", make: lead?.make ?? null }
  return { kind: "ok", make: match.rows[0].make, match, rest: modelWords.slice(match.used) }
}

/**
 * Turn an id or a name ("2024 Tesla Model Y", "2022 f150", "2022 civic 5dr")
 * into a car in the catalog. A name without a model year uses `defaultYear`,
 * or the nearest year that lists the car.
 */
export function resolveCarInput(
  catalog: VehicleCatalog,
  raw: string,
  defaultYear: number = DEFAULT_MODEL_YEAR,
): ResolvedCar | Unresolved {
  const input = raw.trim()
  const index = carIndex(catalog)
  const byId = index.byId.get(input.toLowerCase())
  if (byId) return resolved(catalog, input, byId, "exact")

  // The site's share-link form: "2022|Honda|Civic|Civic 4Dr".
  if (input.includes("|")) {
    const [year, make, model, trim] = input.split("|").map((part) => part.trim())
    const pick = { year: Number(year), make: make ?? "", model: model ?? "", trim: trim ?? "" }
    if (index.idByKey.has(pickKey(pick))) return resolved(catalog, input, pick, "exact")
    return resolveCarInput(catalog, [year, make, model, trim].filter(Boolean).join(" "), defaultYear)
  }

  // Slugs that aren't ids (say, a made-up one) are read as words.
  const parsed = parseCarQuery(input.replace(/[-_/]+/g, " "))
  const allWords = applyAliases(normalizeName(parsed.text)).split(" ").filter(Boolean)
  if (allWords.length > CAR_WORDS_MAX) {
    return { message: `That's more than ${CAR_WORDS_MAX} words. Send just the model year, make, and model, like "2022 Honda Civic".`, understood: null, suggestions: [] }
  }
  const words = allWords.filter((word) => !FILLER.has(word))
  if (words.length === 0) {
    return { message: "Add a make and model, like \"2022 Honda Civic\".", understood: parsed.year ? String(parsed.year) : null, suggestions: [] }
  }
  const years = catalogYears(catalog)
  const yearAssumed = parsed.year === null
  let year = parsed.year ?? defaultYear
  if (!years.includes(year)) {
    return { message: `We have model years ${years.at(-1)}–${years[0]}, not ${year}.`, understood: null, suggestions: [] }
  }

  let found = attempt(catalog, year, words)
  if (found.kind === "none" && yearAssumed) {
    // No year given and the default year doesn't have it: use the nearest year that does.
    const nearest = [...years].sort((left, right) => Math.abs(left - defaultYear) - Math.abs(right - defaultYear) || right - left)
    for (const candidate of nearest) {
      const next = attempt(catalog, candidate, words)
      if (next.kind === "ok") {
        found = next
        year = candidate
        break
      }
    }
  }
  if (found.kind === "make-only") {
    return {
      message: `That's only a make. Add the model, like "${year} ${found.make} ${QUICK_LISTS.find((car) => car.make === found.make)?.model ?? "…"}".`,
      understood: `${year} ${found.make}`,
      suggestions: suggestionsFor(catalog, year, found.make, []),
    }
  }
  if (found.kind === "none") {
    const make = found.make
    const elsewhere = years.filter((candidate) => candidate !== year && attempt(catalog, candidate, words).kind === "ok")
    const other = elsewhere.length > 0 ? attempt(catalog, elsewhere[0], words) : null
    return {
      message:
        elsewhere.length > 0
          ? `We found that model for ${elsewhere.slice(0, 6).join(", ")}${elsewhere.length > 6 ? ", and more" : ""}, but not for ${year}.`
          : make
            ? `We couldn't find that ${make} model. Check the model's name, or search with /api/v1/cars?q=${encodeURIComponent(normalizeName(make))}.`
            : "No car in our catalog matches that name. Start with the make, like \"2022 Honda Civic\", or search with /api/v1/cars?q=...",
      understood: make ? `${year} ${make}` : null,
      suggestions:
        other && other.kind === "ok"
          ? idFor(catalog, elsewhere[0], other.make, other.match.rows[0].model)
          : suggestionsFor(catalog, year, make, words),
    }
  }

  const { match, rest } = found
  const row = match.rows[0]
  const trims = catalog.vehicles[String(year)]?.[row.make]?.[row.model] ?? []
  const understood = `${year} ${row.make} ${row.model}`
  let trimName: string | null = null
  let versionNote: string | null = null
  let allUsed = true
  if (rest.length > 0) {
    const matching = trimsMatching(trims, rest)
    if (matching.length > 0) {
      // "Camry LE" is the Camry LE, not the Camry Hybrid LE: only take a special version when its words were typed.
      const typed = new Set(rest)
      const plain = matching.filter((trim) => specialWords(trim.name).every((word) => typed.has(word) || word.split(" ").every((part) => typed.has(part))))
      trimName = mainstreamTrim(plain.length > 0 ? plain : matching)?.name ?? null
    } else if (rest.length <= 3 && rest.every(looksLikeVersion)) {
      versionNote = `We don't list versions by that name for the ${understood}, so we used the usual one.`
      allUsed = false
    } else {
      return {
        message: `We found the ${understood}, but the other words in that name aren't a version we know. Send just the model year, make, and model.`,
        understood,
        suggestions: idFor(catalog, year, row.make, row.model),
      }
    }
  }
  trimName ??= preferredTrim(catalog, year, row.make, row.model)
  if (!trimName) return { message: `No versions are listed for the ${understood}.`, understood, suggestions: [] }

  const clear = match.rows.length === 1
  const notes: string[] = []
  if (yearAssumed) notes.push(`No model year given, so we used ${year}.`)
  if (!clear) notes.push(`That name fits more than one model; we picked the ${row.make} ${row.model}.`)
  else if (!match.exact) notes.push(`We read that as the ${row.make} ${row.model}.`)
  if (versionNote) notes.push(versionNote)
  const confidence: Confidence = clear && match.exact && !yearAssumed && !versionNote ? "high" : "medium"
  const pick = { year, make: row.make, model: row.model, trim: trimName }
  return resolved(catalog, allUsed ? input : understood, pick, confidence, {
    yearAssumed,
    note: notes.length > 0 ? notes.join(" ") : null,
    alternatives: clear ? [] : match.rows.slice(1, 5).flatMap((other) => idFor(catalog, year, other.make, other.model)),
  })
}

export function isUnresolved(value: ResolvedCar | Unresolved): value is Unresolved {
  return !("pick" in value)
}

// ---------------------------------------------------------------------------
// Search and popular lists

function typedExact(hit: ModelHit, typed: string): boolean {
  const want = compactName(typed)
  if (want.length < 2) return false
  const model = compactName(hit.model)
  const full = compactName(`${hit.make} ${hit.model}`)
  return model === want || full === want || (full.endsWith(want) && model.length <= want.length + 1)
}

/** True when the model's name starts with what was typed after the make: "mini cooper" and "Cooper Convertible". */
function typedStart(hit: ModelHit, typed: string): boolean {
  const make = compactName(hit.make)
  let want = compactName(typed)
  if (want.startsWith(make)) want = want.slice(make.length)
  return want.length > 0 && compactName(hit.model).startsWith(want)
}

/**
 * Models matching `text` in one year, for the search endpoint: exact names
 * first, then models whose name starts with what was typed, then the rest,
 * each in the site's search order.
 */
function modelHits(catalog: VehicleCatalog, year: number, text: string): ModelHit[] {
  const aliased = applyAliases(normalizeName(text))
  const hits = searchModels(catalog, year, aliased, 25)
  const tier = (hit: ModelHit) => (typedExact(hit, aliased) ? 0 : typedStart(hit, aliased) ? 1 : 2)
  return hits
    .map((hit, order) => ({ hit, order }))
    .sort((left, right) => tier(left.hit) - tier(right.hit) || left.order - right.order)
    .map((item) => item.hit)
}

/** [2027, 2026, 2025, 2020] as "2020, 2025–2027". */
export function yearSpans(years: readonly number[]): string {
  const sorted = [...years].sort((left, right) => left - right)
  const spans: string[] = []
  for (let index = 0; index < sorted.length; ) {
    let end = index
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1
    spans.push(end === index ? String(sorted[index]) : `${sorted[index]}–${sorted[end]}`)
    index = end + 1
  }
  return spans.join(", ")
}

export type SearchMatch = CarSummary & {
  /** The model years the catalog lists this make and model for, like "2006–2027" or "2016–2019, 2022–2027". */
  yearsAvailable: string
  /** The other versions of this model in this year. The main entry is the one we'd pick when a name doesn't say. */
  otherTrims: { id: string; trim: string; vehicleClass: string | null; powertrain: VehicleFacts["powertrain"] }[]
}

export function searchCars(catalog: VehicleCatalog, year: number, text: string, limit: number): SearchMatch[] {
  const hits = modelHits(catalog, year, text).slice(0, limit)
  return hits.flatMap((hit) => {
    const main = preferredTrim(catalog, year, hit.make, hit.model)
    if (!main) return []
    const summary = describeCar(catalog, { year, make: hit.make, model: hit.model, trim: main })
    const otherTrims = hit.trims
      .filter((trim) => trim.name !== main)
      .map((trim) => {
        const pick = { year, make: hit.make, model: hit.model, trim: trim.name }
        const facts = vehicleFacts(catalog, pick)
        return {
          id: carId(catalog, pick),
          trim: shownTrim(trim.name),
          vehicleClass: facts.classId ? VEHICLE_CLASS_LABELS[facts.classId] : null,
          powertrain: facts.powertrain,
        }
      })
    return [{ ...summary, yearsAvailable: yearSpans(yearsWithModel(catalog, hit.make, hit.model)), otherTrims }]
  })
}

export const POPULAR_GROUPS = [
  { id: "firstCars", preset: "popular:first-cars", words: "first cars", label: "Popular first cars", cars: FIRST_CARS },
  { id: "suvs", preset: "popular:suvs", words: "SUVs", label: "Popular SUVs", cars: POPULAR_SUVS },
  { id: "trucksAndFun", preset: "popular:trucks-and-fun", words: "trucks and fun ones", label: "Trucks and fun ones", cars: TRUCKS_AND_FUN },
  { id: "starterMix", preset: "popular:starter-mix", words: "a starter mix", label: "A starter mix: everyday cars, a sporty one, an electric one, a Jeep, and a pickup", cars: STARTER_MIX },
] as const

/** A preset in words: "popular:suvs" as "SUVs". */
export function presetWords(preset: string): string {
  return POPULAR_GROUPS.find((group) => group.preset === preset)?.words ?? preset
}

export const PRESET_NAMES: readonly string[] = POPULAR_GROUPS.map((group) => group.preset)

/** A preset like "popular:first-cars" as car ids for one model year, or null when it isn't a preset. */
export function expandPreset(catalog: VehicleCatalog, token: string, year: number): string[] | null {
  const group = POPULAR_GROUPS.find((item) => item.preset === token.trim().toLowerCase())
  if (!group) return null
  return group.cars.flatMap((car) => {
    const pick = resolveCar(catalog, year, car)
    return pick ? [carId(catalog, pick)] : []
  })
}

export function popularCars(
  catalog: VehicleCatalog,
  year: number,
): Record<string, { label: string; preset: string; cars: CarSummary[] }> {
  return Object.fromEntries(
    POPULAR_GROUPS.map((group) => [
      group.id,
      {
        label: group.label,
        preset: group.preset,
        cars: group.cars.flatMap((car) => {
          const pick = resolveCar(catalog, year, car)
          return pick ? [describeCar(catalog, pick)] : []
        }),
      },
    ]),
  )
}

/**
 * A short name for a car in sentences, with its version when that's what
 * sets it apart: "2022 Toyota RAV4 Hybrid AWD", "2022 Ford F-150 Lightning
 * 4WD". Plain versions ("RAV4", "Civic 4Dr") are left out unless another car
 * in the same list has the same name.
 */
export function carLabel(pick: VehiclePick, sameNameInList = false): string {
  const name = `${pick.year} ${pick.make} ${pick.model}`
  const trim = shownTrim(pick.trim)
  if (!trim) return name
  const special = isSpecial(trim)
  if (!special && !sameNameInList) return name
  const model = compactName(pick.model)
  const words = trim.split(/\s+/)
  let rest = trim
  for (let count = 1; count <= words.length; count += 1) {
    if (compactName(words.slice(0, count).join(" ")) === model) {
      rest = words.slice(count).join(" ")
      break
    }
  }
  return rest ? `${name} ${rest}` : name
}
