import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import {
  apiIndex,
  CACHE_CONTROL,
  COMPARE_PARAMS,
  EXAMPLES,
  handleCars,
  handleCompare,
  handleIndex,
  handleNotFound,
  handleWhatIf,
  personalInText,
  readQuery,
  SITE_ORIGIN,
  WHATIF_PARAMS,
  type ApiResult,
} from "./agent-api"
import { SERVER_CATALOG as catalog } from "./agent-catalog"
import { carId, carIndex, carLabel, expandPreset, isUnresolved, resolveCarInput, yearSpans } from "./agent-cars"
import { guideExamples, llmsFullText, llmsText } from "./agent-docs"
import { vehicleFacts } from "./catalog-class"
import { buildRows, compareAnswer, gapsToCheapest } from "./compare-table"
import { DISCLAIMER } from "./copy"
import { typicalStart } from "./factor-engine"
import { rangeEnds, shownMonthly, shownYearly } from "./format"
import { distinctReasons, parentFor, priceCars, priceCarsTeenAdded, priceWhatIf, reasonParts } from "./pricing"
import { DEFAULT_SCENARIO, type Scenario } from "./scenario"
import { decodeShareSearch } from "./share-link"
import { DEFAULT_SITUATION } from "./situation"
import { GET as carsRoute } from "../app/api/v1/cars/route"
import { GET as compareRoute } from "../app/api/v1/compare/route"

const q = (text: string) => new URLSearchParams(text)

type Body = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function ok(result: ApiResult): Body {
  assert.equal(result.status, 200, JSON.stringify(result.body))
  return result.body as Body
}

function failed(result: ApiResult, status: number, code: string): Body {
  assert.equal(result.status, status, JSON.stringify(result.body))
  const error = (result.body as Body).error
  assert.equal(error.code, code)
  assert.ok(typeof error.hint === "string" && error.hint.length > 10, "every error says how to fix it")
  return error
}

/** Send an API path (with its query) to the right handler. */
function call(path: string): ApiResult {
  const parsed = new URL(path, SITE_ORIGIN)
  switch (parsed.pathname) {
    case "/api/v1":
      return handleIndex(parsed.searchParams)
    case "/api/v1/cars":
      return handleCars(catalog, parsed.searchParams)
    case "/api/v1/compare":
      return handleCompare(catalog, parsed.searchParams)
    case "/api/v1/whatif":
      return handleWhatIf(catalog, parsed.searchParams)
    default:
      return handleNotFound(parsed.pathname)
  }
}

// ---------------------------------------------------------------------------
// Ids and car names

test("every catalog car has one id, and ids read back to the same car", () => {
  const index = carIndex(catalog)
  assert.ok(index.byId.size > 15_000)
  assert.equal(index.byId.size, index.idByKey.size)
  for (const [id, pick] of index.byId) {
    assert.match(id, /^\d{4}-[a-z0-9-]+$/)
    assert.equal(carId(catalog, pick), id)
  }
  assert.deepEqual(index.byId.get("2022-honda-civic-4dr"), { year: 2022, make: "Honda", model: "Civic", trim: "Civic 4Dr" })
  assert.deepEqual(index.byId.get("2022-toyota-corolla"), { year: 2022, make: "Toyota", model: "Corolla", trim: "Corolla" })
})

test("loose names resolve the way the site's search does", () => {
  const cases: [string, string, string][] = [
    ["2022 honda civic", "2022-honda-civic-4dr", "high"],
    ["2022 Honda Civic", "2022-honda-civic-4dr", "high"],
    ["2025 Tesla Model Y", "2025-tesla-model-y-long-range-awd", "high"],
    ["2022 model y", "2022-tesla-model-y-long-range-awd", "high"],
    ["2022 f150", "2022-ford-f-150-f150-pickup-2wd", "high"],
    ["2022 crv", "", "high"],
    ["2022-honda-civic-4dr", "2022-honda-civic-4dr", "exact"],
    ["2022|Honda|Civic|Civic 4Dr", "2022-honda-civic-4dr", "exact"],
  ]
  for (const [input, id, confidence] of cases) {
    const result = resolveCarInput(catalog, input)
    assert.ok(!isUnresolved(result), `${input} resolves`)
    if (id) assert.equal(result.id, id, input)
    assert.equal(result.confidence, confidence, input)
  }
  const crv = resolveCarInput(catalog, "2022 crv")
  assert.ok(!isUnresolved(crv))
  assert.equal(crv.pick.model, "CR-V")
})

test("a name without a year uses 2022 and says so", () => {
  const result = resolveCarInput(catalog, "honda civic")
  assert.ok(!isUnresolved(result))
  assert.equal(result.pick.year, 2022)
  assert.equal(result.yearAssumed, true)
  assert.equal(result.confidence, "medium")
  assert.match(result.note ?? "", /No model year given/)
})

test("version words pick the matching version", () => {
  const result = resolveCarInput(catalog, "2022 honda civic 5dr")
  assert.ok(!isUnresolved(result))
  assert.equal(result.pick.trim, "Civic 5Dr")
})

test("a car we don't have comes back with a helpful message", () => {
  const nothing = resolveCarInput(catalog, "2022 Flibbertigibbet Zoom")
  assert.ok(isUnresolved(nothing))
  assert.match(nothing.message, /No car in our catalog/)
  const tooOld = resolveCarInput(catalog, "1995 Honda Civic")
  assert.ok(isUnresolved(tooOld))
  assert.match(tooOld.message, /model years/)
})

test("presets are the site's quick-add lists", () => {
  const first = expandPreset(catalog, "popular:first-cars", 2022)
  assert.ok(first)
  assert.equal(first.length, 15)
  assert.equal(first[0], "2022-honda-civic-4dr")
  assert.equal(expandPreset(catalog, "honda civic", 2022), null)
})

test("year spans read plainly", () => {
  assert.equal(yearSpans([2027, 2026, 2025, 2020]), "2020, 2025–2027")
  assert.equal(yearSpans([2006]), "2006")
})

// ---------------------------------------------------------------------------
// Parameters and privacy

test("unknown parameters are turned away with the list of valid ones", () => {
  const error = failed(handleCompare(catalog, q("cars=2022-honda-civic-4dr&colour=red")), 400, "unknown_parameter")
  assert.deepEqual(error.validParameters, COMPARE_PARAMS.map((spec) => spec.name))
  failed(handleIndex(q("x=1")), 400, "unknown_parameter")
})

test("nothing personal gets in: premiums, VINs, ZIP codes, names, and the like", () => {
  for (const query of [
    "cars=2022-honda-civic-4dr&premium=1800",
    "cars=2022-honda-civic-4dr&anchor=1800",
    "cars=2022-honda-civic-4dr&vin=1HGCM82633A004352",
    "cars=2022-honda-civic-4dr&zip=60601",
    "cars=2022-honda-civic-4dr&ZIP_CODE=60601",
    "cars=2022-honda-civic-4dr&name=Sam",
    "cars=2022-honda-civic-4dr&email=a@b.co",
    "cars=2022-honda-civic-4dr&phone=3125551212",
    "cars=2022-honda-civic-4dr&credit=700",
    "cars=1HGCM82633A004352",
    "cars=2022 honda civic 60601",
    "cars=2022 honda civic, sam@example.com",
    "cars=$1800 honda civic",
  ]) {
    failed(handleCompare(catalog, q(query)), 400, "private_input_rejected")
  }
  failed(handleWhatIf(catalog, q("to=1HGCM82633A004352")), 400, "private_input_rejected")
  failed(handleCars(catalog, q("q=1HGCM82633A004352")), 400, "private_input_rejected")
  failed(handleWhatIf(catalog, q("toState=CO&premium=1500")), 400, "private_input_rejected")
})

test("bad values name the allowed ones", () => {
  const error = failed(handleCompare(catalog, q("cars=2022-honda-civic-4dr&coverage=gold")), 400, "invalid_value")
  assert.deepEqual(error.allowedValues, ["state-minimum", "standard", "full", "high"])
  failed(handleCompare(catalog, q("cars=2022-honda-civic-4dr&state=ZZ")), 400, "invalid_value")
  failed(handleCompare(catalog, q("cars=2022-honda-civic-4dr&deductible=750")), 400, "invalid_value")
  failed(handleCompare(catalog, q("cars=2022-honda-civic-4dr&age=12")), 400, "invalid_value")
  failed(handleCompare(catalog, q("cars=2022-honda-civic-4dr&age=40-64&policy=added")), 400, "invalid_value")
  failed(handleCars(catalog, q("q=civic&limit=500")), 400, "invalid_value")
  failed(handleCars(catalog, q("q=civic&year=1990")), 400, "invalid_value")
})

test("repeated, missing, and oversized input", () => {
  failed(handleCompare(catalog, q("cars=2022-honda-civic-4dr&state=IL&state=TX")), 400, "duplicate_parameter")
  failed(handleCompare(catalog, q("state=IL")), 400, "missing_parameter")
  failed(handleWhatIf(catalog, q("state=IL")), 400, "missing_parameter")
  const sixteen = Array.from({ length: 16 }, () => "2022-honda-civic-4dr").join(",")
  failed(handleCompare(catalog, q(`cars=${sixteen}`)), 400, "too_many_cars")
  failed(handleCompare(catalog, q(`cars=${"x".repeat(200)}`)), 400, "invalid_value")
  failed(handleCompare(catalog, q(`cars=${"a,".repeat(2000)}`)), 414, "request_too_long")
  const missing = failed(handleCompare(catalog, q("cars=2022-honda-civic-4dr,2022 Flibbertigibbet")), 400, "car_not_found")
  assert.equal(missing.unresolved.length, 1)
})

test("friendly spellings of values are read", () => {
  const body = ok(handleCompare(catalog, q("CARS=2022-honda-civic-4dr&State=illinois&age=16&Coverage=liability&region=city")))
  assert.equal(body.driver.state, "IL")
  assert.equal(body.driver.age, "16-18")
  assert.equal(body.driver.coverage, "standard")
  assert.equal(body.driver.region, "urban")
  const older = ok(handleCompare(catalog, q("cars=2022-honda-civic-4dr&age=65&years=10")))
  assert.equal(older.driver.age, "65+")
  assert.equal(older.driver.years, "10+")
  const reader = readQuery(q("to_state=CO"), WHATIF_PARAMS)
  assert.equal(reader.get("toState"), "CO")
})

// ---------------------------------------------------------------------------
// The numbers match the site's

const TEEN_CARS = ["2022-honda-civic-4dr", "2022-toyota-rav4", "2022-tesla-model-y-long-range-awd", "2022-ford-mustang", "2022-subaru-crosstrek-awd"]

test("compare, teen added: the same numbers as the Compare page", () => {
  const body = ok(handleCompare(catalog, q(`state=IL&age=16-18&policy=added&cars=${TEEN_CARS.join(",")}`)))
  const picks = TEEN_CARS.map((id) => carIndex(catalog).byId.get(id)!)
  const driver: Scenario = { ...DEFAULT_SCENARIO, age: "16-18", yearsLicensed: "under-1", teen: true }
  const parent = parentFor(driver, DEFAULT_SITUATION)
  const start = typicalStart(parent, { teenOnParentPolicy: true })
  assert.ok(start)
  const teen = priceCarsTeenAdded(start, parent, picks.map((pick) => vehicleFacts(catalog, pick)))
  const priced = teen.map((item) => ({ estimate: item.after, extra: item.increase }))
  const reasons = distinctReasons(priced.map((item, index) => reasonParts(item.estimate, picks[index].year, driver)))
  const rows = buildRows(priced, picks.map((pick) => ({ ...pick, starred: false })), reasons)
  const { gaps } = gapsToCheapest(rows)

  assert.equal(body.mode, "added")
  assert.equal(body.results.length, TEEN_CARS.length)
  assert.equal(body.summary, compareAnswer(rows, "added", "For a 16–18-year-old in Illinois, added to your policy"))
  for (const result of body.results) {
    const index = TEEN_CARS.indexOf(result.id)
    const row = rows[index]
    assert.equal(result.teenAdds.yearly, shownYearly(teen[index].increase))
    assert.equal(result.teenAdds.monthly, Math.max(5, shownMonthly(teen[index].increase)))
    assert.equal(result.wholePolicy.yearly, shownYearly(row.likely))
    assert.equal(result.wholePolicy.monthly, shownMonthly(row.likely))
    assert.deepEqual(result.wholePolicy.range, rangeEnds(row.low, row.high))
    assert.equal(result.gapToCheapest.yearly, gaps.get(row.key))
    assert.equal(result.why, reasons[index])
  }
  // Cheapest first, by what adding the teen costs.
  const amounts = body.results.map((result: Body) => teen[TEEN_CARS.indexOf(result.id)].increase)
  assert.deepEqual(amounts, [...amounts].sort((left, right) => left - right))
  assert.equal(body.results[0].rank, 1)
  assert.equal(body.results[0].gapToCheapest.yearly, 0)
})

test("compare, own policy: the same numbers as the Compare page", () => {
  const body = ok(handleCompare(catalog, q(`state=TX&age=26-39&coverage=high&deductible=500&region=urban&cars=${TEEN_CARS.join(",")}`)))
  const picks = TEEN_CARS.map((id) => carIndex(catalog).byId.get(id)!)
  const driver: Scenario = { ...DEFAULT_SCENARIO, age: "26-39", yearsLicensed: "10+", state: "TX", coverage: "high", deductible: 500, region: "urban" }
  const start = typicalStart(driver)
  assert.ok(start)
  const priced = priceCars(start, driver, picks.map((pick) => vehicleFacts(catalog, pick)))
  assert.equal(body.mode, "own")
  for (const result of body.results) {
    const estimate = priced[TEEN_CARS.indexOf(result.id)].estimate
    assert.equal(result.yearly, shownYearly(estimate.likely))
    assert.equal(result.monthly, shownMonthly(estimate.likely))
    assert.deepEqual(result.range, rangeEnds(estimate.low, estimate.high))
    assert.equal(result.teenAdds, undefined)
  }
})

test("compare echoes the driver, the start, and the things to show once", () => {
  const body = ok(handleCompare(catalog, q("cars=popular:first-cars")))
  assert.equal(body.driver.state, "IL")
  assert.equal(body.driver.age, "16-18")
  assert.equal(body.driver.policy, "added")
  assert.ok(body.driver.defaultsUsed.includes("state"))
  assert.equal(body.results.length, 15)
  assert.equal(body.disclaimer, DISCLAIMER)
  assert.equal(body.startingPoint.kind, "typical")
  assert.match(body.startingPoint.attribution, /National Association of Insurance Commissioners/)
  assert.ok(body.notes.some((note: string) => /whole household's policy/.test(note)))
  assert.ok(body.sources.some((source: Body) => /iihs\.org/.test(source.url)))
  assert.ok(body.sources.some((source: Body) => /naic\.org/.test(source.url)))
  assert.ok(body.howToRead.length >= 3)
  assert.ok(body.versions.model && body.versions.factors && body.versions.catalog)
})

test("the site link opens the same comparison, with no dollar amounts in it", () => {
  const body = ok(handleCompare(catalog, q(`state=OH&age=16-18&policy=own&cars=${TEEN_CARS.join(",")}`)))
  assert.ok(body.siteUrl.startsWith(`${SITE_ORIGIN}/compare#share=1`))
  const decoded = decodeShareSearch(new URL(body.siteUrl).hash)
  assert.equal(decoded.status, "ok")
  if (decoded.status !== "ok") return
  assert.equal(decoded.scenario.state, "OH")
  assert.equal(decoded.teenOnParentPolicy, false)
  assert.equal(decoded.anchorAmount, null)
  assert.deepEqual(
    decoded.cars?.map((car) => carId(catalog, car)),
    TEEN_CARS,
  )
  assert.doesNotMatch(body.siteUrl, /anchor=|likely=|premium=/)
})

test("duplicates are dropped and said so", () => {
  const body = ok(handleCompare(catalog, q("cars=2022-honda-civic-4dr,2022 honda civic")))
  assert.equal(body.results.length, 1)
  assert.ok(body.notes.some((note: string) => /repeats/.test(note)))
})

test("what-if: the same numbers as the What-if page", () => {
  const body = ok(handleWhatIf(catalog, q("state=IL&age=40-64&car=2020-toyota-camry&to=2025 Tesla Model Y")))
  const nowPick = { year: 2020, make: "Toyota", model: "Camry", trim: "Camry" }
  const nextPick = carIndex(catalog).byId.get("2025-tesla-model-y-long-range-awd")!
  const now: Scenario = { ...DEFAULT_SCENARIO, ...nowPick }
  const next: Scenario = { ...now, ...nextPick }
  const result = priceWhatIf(
    { scenario: now, teenOnParentPolicy: false, premium: null },
    vehicleFacts(catalog, now),
    next,
    vehicleFacts(catalog, next),
    "high",
  )
  assert.ok(result)
  assert.equal(body.headline, result.headline)
  assert.equal(body.mode, "change")
  assert.equal(body.difference.yearly, result.deltaRounded)
  assert.equal(body.now.yearly, shownYearly(result.current.likely))
  assert.equal(body.next.yearly, shownYearly(result.next.likely))
  assert.deepEqual(body.next.range, rangeEnds(result.next.low, result.next.high))
  assert.equal(body.difference.parts.length, 2)
  assert.match(body.headline, /Switching to a 2025 Tesla Model Y/)
})

test("what-if: adding a teen, on the parent's policy or their own", () => {
  const added = ok(handleWhatIf(catalog, q("car=2020-toyota-camry&toAge=16-18")))
  assert.equal(added.mode, "teen-added")
  assert.equal(added.next.policy, "added")
  assert.match(added.headline, /Adding your teen to your policy/)
  const own = ok(handleWhatIf(catalog, q("car=2020-toyota-camry&toAge=16-18&policy=own")))
  assert.equal(own.mode, "teen-own")
  assert.equal(own.difference, null)
  assert.ok(own.next.yearly > added.difference.yearly)
})

test("what-if: moving states and raising the deductible", () => {
  const moving = ok(handleWhatIf(catalog, q("state=IL&toState=CO")))
  assert.match(moving.headline, /Moving to Colorado/)
  const deductible = ok(handleWhatIf(catalog, q("toDeductible=2000")))
  assert.ok(deductible.difference.yearly < 0)
  assert.equal(deductible.now.car.id, "2020-toyota-camry")
})

// ---------------------------------------------------------------------------
// Cars, the index, the guides, and the routes

test("car search finds models and popular lists", () => {
  const civic = ok(handleCars(catalog, q("q=2022 honda civic")))
  assert.equal(civic.matches[0].id, "2022-honda-civic-4dr")
  assert.ok(civic.matches[0].otherTrims.length >= 1)
  const modelY = ok(handleCars(catalog, q("q=model y&year=2024")))
  assert.equal(modelY.matches[0].model, "Model Y")
  const f150 = ok(handleCars(catalog, q("q=f150")))
  assert.equal(f150.matches[0].model, "F-150")
  const popular = ok(handleCars(catalog, q("")))
  assert.equal(popular.popular.firstCars.preset, "popular:first-cars")
  assert.equal(popular.popular.firstCars.cars.length, 15)
  assert.ok(popular.popular.suvs.cars.length > 5)
  assert.ok(popular.popular.trucksAndFun.cars.length > 3)
  const later = ok(handleCars(catalog, q("q=cybertruck")))
  assert.ok(later.matches.length > 0)
  assert.match(later.note, /Nothing matches in 2022/)
})

test("the index lists every endpoint with parameters and examples", () => {
  const body = ok(handleIndex(q("")))
  assert.deepEqual(body, apiIndex())
  assert.deepEqual(
    body.endpoints.map((endpoint: Body) => endpoint.path),
    ["/api/v1/cars", "/api/v1/compare", "/api/v1/whatif"],
  )
  for (const endpoint of body.endpoints) {
    assert.ok(endpoint.parameters.length > 0)
    assert.ok(endpoint.examples.length > 0)
    for (const example of endpoint.examples) ok(call(example))
  }
  assert.equal(body.guide, `${SITE_ORIGIN}/llms.txt`)
  assert.match(body.privacy, /VIN/)
  assert.equal(body.disclaimer, DISCLAIMER)
})

test("every API link in llms.txt and llms-full.txt works", () => {
  for (const text of [llmsText(), llmsFullText()]) {
    const links = [...text.matchAll(/https:\/\/notaquote\.fyi(\/api\/v1[^\s)`"]*)/g)].map((match) => match[1])
    assert.ok(links.length >= 12)
    for (const path of links) {
      if (path.includes("...")) continue
      ok(call(path))
    }
  }
  for (const path of guideExamples()) {
    ok(call(path))
    // A car written like an id in an example must be a real id, not a name we happen to resolve.
    const params = new URL(path, SITE_ORIGIN).searchParams
    for (const token of [...(params.get("cars") ?? "").split(","), params.get("car") ?? ""]) {
      if (/^\d{4}-[a-z0-9-]+$/.test(token)) assert.ok(carIndex(catalog).byId.has(token), `${token} is an id`)
    }
  }
  for (const path of [...EXAMPLES.cars, ...EXAMPLES.compare, ...EXAMPLES.whatif]) ok(call(path))
})

test("llms.txt says what matters", () => {
  const text = llmsText()
  for (const phrase of ["not a quote", "range", "IIHS", "NHTSA", "VIN", "CC BY 4.0", "MIT", "NAIC", "HLDI", "/api/v1", "Cache-Control"]) {
    assert.ok(text.includes(phrase), phrase)
  }
  const full = llmsFullText()
  assert.match(full, /## Every adjustment/)
  assert.match(full, /\| Illinois \| IL \|/)
})

test("unknown API paths answer in JSON", () => {
  const error = failed(handleNotFound("/api/v1/quotes"), 404, "not_found")
  assert.match(error.hint, /\/api\/v1/)
})

test("the routes send JSON that can be cached and read from any site", async () => {
  const response = carsRoute(new NextRequest("https://notaquote.fyi/api/v1/cars?q=civic"))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), CACHE_CONTROL)
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*")
  assert.match(response.headers.get("Content-Type") ?? "", /application\/json/)
  const body = (await response.json()) as Body
  assert.ok(body.matches.length > 0)
  const bad = compareRoute(new NextRequest("https://notaquote.fyi/api/v1/compare?cars=2022-honda-civic-4dr&premium=1"))
  assert.equal(bad.status, 400)
  assert.equal(((await bad.json()) as Body).error.code, "private_input_rejected")
})

// ---------------------------------------------------------------------------
// Review fixes: strict names, aliases, versions, speed, privacy, links

function resolves(input: string) {
  const result = resolveCarInput(catalog, input)
  assert.ok(!isUnresolved(result), `${input} should resolve: ${JSON.stringify(result)}`)
  return result
}

test("vague or wrong names come back unresolved, never as some other car", () => {
  for (const input of ["2022 Subaru SUV", "2022 Honda", "car", "a", "2022 truck", "2022 hybrid", "2022 sedan", "क�", "2022 Toyota Flibbert", "suv"]) {
    const result = resolveCarInput(catalog, input)
    assert.ok(isUnresolved(result), `${input} should not resolve, got ${JSON.stringify(result)}`)
  }
  const honda = resolveCarInput(catalog, "2022 Honda")
  assert.ok(isUnresolved(honda))
  assert.match(honda.message, /only a make/)
  assert.ok(honda.suggestions.length > 0 && honda.suggestions.every((id) => id.startsWith("2022-honda-")))
  const suv = failed(handleCompare(catalog, q("cars=2022 Honda Civic,2022 Subaru SUV")), 400, "car_not_found")
  assert.equal(suv.unresolved[0].position, 2)
  assert.ok(suv.unresolved[0].suggestions.length > 0)
})

test("makes and models people shorten are understood", () => {
  assert.equal(resolves("2022 Mercedes C-Class").pick.model, "C-Class")
  assert.equal(resolves("2022 Mercedes C-Class").pick.trim, "C300")
  assert.equal(resolves("2022 mercedes-benz c class").pick.model, "C-Class")
  assert.equal(resolves("2022 BMW 3 Series").pick.model, "330i")
  assert.equal(resolves("2022 chevy equinox").pick.make, "Chevrolet")
  assert.equal(resolves("2022 VW Jetta").pick.make, "Volkswagen")
  const miata = resolves("2022 Mazda MX-5 Miata")
  assert.equal(miata.pick.model, "MX-5")
  assert.equal(miata.confidence, "high")
  assert.equal(resolves("2022 miata").pick.model, "MX-5")
  assert.equal(resolves("2022 Ford Mach-E").pick.model, "Mustang Mach-E")
})

test("without a version, we pick a plain, mainstream one", () => {
  assert.equal(resolves("2022 Mini Cooper").pick.trim, "Cooper Hardtop 2 door")
  const machE = resolves("2022 Ford Mustang Mach-E").pick.trim
  assert.doesNotMatch(machE, /GT|CAL RT|Extended/)
  assert.equal(resolves("2022 Toyota RAV4 Hybrid").pick.trim, "RAV4 Hybrid AWD")
  assert.match(resolves("2022 Ford F-150 Lightning").pick.trim, /Lightning/)
  // A version word we don't list gets the usual version, with a note.
  const lx = resolves("2022 Honda Civic LX")
  assert.equal(lx.confidence, "medium")
  assert.match(lx.note ?? "", /usual one/)
})

test("versions the catalog couldn't name get clean ids", () => {
  const si = resolves("2022 Honda Civic Si")
  assert.equal(si.id, "2022-honda-civic-si")
  assert.equal(si.resolvedAs, "2022 Honda Civic Si")
  for (const id of carIndex(catalog).byId.keys()) assert.doesNotMatch(id, /trim-not-resolved/)
})

test("labels name the version when it sets the car apart", () => {
  const hybrid = carIndex(catalog).byId.get(resolves("2025 Toyota RAV4 Hybrid").id)!
  assert.equal(carLabel(hybrid), "2025 Toyota RAV4 Hybrid AWD")
  assert.equal(carLabel({ year: 2022, make: "Honda", model: "Civic", trim: "Civic 4Dr" }), "2022 Honda Civic")
  const body = ok(handleCompare(catalog, q("state=CA&age=40-64&cars=2019 Honda Accord,2025 Tesla Model Y,2025 Toyota RAV4 Hybrid")))
  assert.ok(body.results.some((result: Body) => result.label === "2025 Toyota RAV4 Hybrid AWD"))
  const whatIf = ok(handleWhatIf(catalog, q("state=CA&age=40-64&car=2019 Honda Accord&to=2025 Toyota RAV4 Hybrid")))
  assert.match(whatIf.headline, /Switching to a 2025 Toyota RAV4 Hybrid AWD/)
  const forester = ok(handleCompare(catalog, q("cars=2022 Subaru Forester,2022 Subaru Forester Wilderness")))
  for (const result of forester.results) {
    assert.ok(result.gapToCheapest.words === "The cheapest here" || /the 2022 Subaru Forester/.test(result.gapToCheapest.words))
  }
})

test("long names are cut short, so a big list stays fast", () => {
  const long = Array.from({ length: 39 }, (_, index) => `zz${index}`).join(" ")
  const started = performance.now()
  const result = handleCompare(catalog, q(`cars=${Array.from({ length: 15 }, () => long).join(",")}`))
  const took = performance.now() - started
  assert.equal(result.status, 400)
  assert.ok(took < 1000, `took ${took.toFixed(0)} ms`)
  const words = Array.from({ length: 8 }, (_, index) => `word${index}`).join(" ")
  const unmatched = performance.now()
  handleCompare(catalog, q(`cars=${Array.from({ length: 15 }, (_, index) => `${words} x${index}`.slice(0, 110)).join(",")}`))
  assert.ok(performance.now() - unmatched < 1500)
})

test("free text, money, and spaced-out VINs and ZIP codes are turned away", () => {
  for (const cars of ["civic I pay 1800", "2022 civic 1800 a year", "2022 civic 150/month", "1HGCM 82633A004352", "1HG-CM826-33A004352", "2022 civic 606 14", "2022 civic 1800 dollars"]) {
    failed(handleCompare(catalog, q(`cars=${encodeURIComponent(cars)}`)), 400, "private_input_rejected")
  }
  const named = handleCompare(catalog, q("cars=2022 honda civic John Smith"))
  const error = failed(named, 400, "car_not_found")
  assert.doesNotMatch(JSON.stringify(named.body), /John|Smith/i)
  assert.match(error.message, /car 1/)
})

test("no real car name or id looks personal", () => {
  for (const [id, pick] of carIndex(catalog).byId) {
    assert.equal(personalInText(id), null, id)
    assert.equal(personalInText(`${pick.year} ${pick.make} ${pick.model} ${pick.trim}`), null, `${pick.year} ${pick.make} ${pick.model} ${pick.trim}`)
  }
})

test("related links are ready to fetch, and all work", () => {
  const compare = ok(handleCompare(catalog, q("state=TX&age=16-18&cars=popular:suvs")))
  const whatIf = ok(handleWhatIf(catalog, q("state=IL&age=40-64&car=2021 Subaru Outback&toState=FL")))
  assert.ok(compare.related.length >= 4)
  assert.ok(compare.related.some((link: Body) => /policy=own/.test(link.url)))
  assert.ok(!compare.related.some((link: Body) => /cars=popular:suvs/.test(link.url)))
  assert.ok(whatIf.related.length >= 3)
  for (const link of [...compare.related, ...whatIf.related]) {
    assert.ok(link.url.startsWith(`${SITE_ORIGIN}/api/v1/`))
    ok(call(link.url))
  }
  assert.match(compare.siteUrlNote, /40–64/)
})

test("toRegion takes the same words as region, and the index says it takes nothing", () => {
  assert.equal(ok(handleWhatIf(catalog, q("toRegion=suburbs&region=city"))).next.region, "suburban")
  assert.equal(ok(handleWhatIf(catalog, q("toRegion=town"))).next.region, "rural")
  const error = failed(handleIndex(q("x=1")), 400, "unknown_parameter")
  assert.equal(error.hint, "This endpoint takes no parameters.")
})

test("llms-full.txt has ready links for every state", () => {
  const full = llmsFullText()
  const ready = full.slice(full.indexOf("# Ready-to-fetch links"))
  const links = [...ready.matchAll(/https:\/\/notaquote\.fyi(\/api\/v1\/compare\?[^\s]+)/g)].map((match) => match[1])
  assert.equal(links.length, 51 * 6)
  for (const path of links.filter((_, index) => index % 17 === 0)) ok(call(path))
  assert.match(ready, /### Texas \(TX\)/)
})

// ---------------------------------------------------------------------------
// Second review

test("related links keep years licensed when it isn't the default", () => {
  const compare = ok(handleCompare(catalog, q("state=OH&age=30&years=1-3&cars=2022-honda-civic-4dr")))
  assert.ok(compare.related.length > 0)
  for (const link of compare.related) {
    assert.match(link.url, /years=1-3/)
    assert.equal(ok(call(link.url)).driver.years, "1-3")
  }
  const whatIf = ok(handleWhatIf(catalog, q("age=30&years=4-9&toDeductible=500")))
  for (const link of whatIf.related) assert.match(link.url, /years=4-9/)
  const plain = ok(handleCompare(catalog, q("state=OH&age=30&cars=2022-honda-civic-4dr")))
  for (const link of plain.related) assert.doesNotMatch(link.url, /years=/)
})

test("presets read as words", () => {
  const body = ok(handleCompare(catalog, q("cars=popular:first-cars")))
  const descriptions = body.related.map((link: Body) => link.description).join(" ")
  assert.match(descriptions, /list of SUVs/)
  assert.match(descriptions, /trucks and fun ones/)
  assert.match(llmsFullText(), /- SUVs, teen added/)
})

test("performance and hybrid versions aren't picked unless asked for", () => {
  assert.equal(resolves("2022 VW Golf").pick.model, "Golf GTI")
  assert.equal(resolves("2022 Porsche 911").pick.trim, "911 Carrera")
  assert.equal(resolves("2022 BMW X5").pick.trim, "X5 xDrive40i")
  assert.equal(resolves("2022 Toyota Camry LE").pick.trim, "Camry LE/SE")
  assert.equal(resolves("2022 Toyota Camry Hybrid LE").pick.trim, "Camry Hybrid LE")
  assert.equal(resolves("2022 Tesla Y").pick.model, "Model Y")
  assert.equal(resolves("2022 Jeep Wrangler Unlimited").pick.model, "Wrangler")
  assert.equal(resolves("2022 Ram 1500").pick.model, "1500")
})
