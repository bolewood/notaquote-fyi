import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { VehicleCatalog } from "./catalog"
import { runVinLookup, selectionAfterVin } from "./vin-lookup"

const VIN = "1FTEW1EP5PFA12345"

const catalog = {
  version: "catalog-2026-09-21",
  retrievedOn: "2026-09-21",
  refreshAfter: "2027-03-20",
  yearMin: 2006,
  yearMax: 2027,
  terms: "Retrieved 21 September 2026 from NHTSA vPIC and FuelEconomy.gov for this test fixture only.",
  sources: [
    {
      name: "NHTSA vPIC",
      url: "https://vpic.nhtsa.dot.gov/api/",
      retrievedOn: "2026-09-21",
      note: "fixture",
    },
    {
      name: "FuelEconomy.gov",
      url: "https://www.fueleconomy.gov/feg/epadata/vehicles.csv",
      retrievedOn: "2026-09-21",
      note: "fixture",
    },
  ],
  vehicles: {
    "2023": {
      Ford: {
        "F-150": [
          { name: "F150 Pickup 4WD", confidence: "high" },
          { name: "F150 RAPTOR 4WD", confidence: "high" },
        ],
      },
    },
  },
} as VehicleCatalog

const current = {
  year: 2023,
  make: "Toyota",
  model: "RAV4",
  trim: "RAV4",
}

function installSpies() {
  const hits: string[] = []
  const watch = (channel: string, value: string) => {
    if (value.includes(VIN)) hits.push(`${channel}:${value}`)
  }
  const storage = () => ({
    getItem: () => null,
    setItem: (key: string, value: string) => watch("storage", `${key}=${value}`),
    removeItem: (key: string) => watch("storage", key),
    clear: () => watch("storage", "clear"),
    key: () => null,
    length: 0,
  })
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage() })
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage() })
  let cookie = ""
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return cookie
      },
      set cookie(value: string) {
        cookie = value
        watch("cookie", value)
      },
    },
  })
  const host = globalThis as typeof globalThis & {
    gtag?: (...args: unknown[]) => void
    plausible?: (...args: unknown[]) => void
  }
  host.gtag = (...args: unknown[]) => watch("analytics", JSON.stringify(args))
  host.plausible = (...args: unknown[]) => watch("analytics", JSON.stringify(args))
  const methods = ["log", "info", "debug", "warn", "error"] as const
  const originals = methods.map((method) => console[method])
  for (const method of methods) {
    console[method] = (...args: unknown[]) => {
      watch("log", args.map((arg) => String(arg)).join(" "))
    }
  }
  return {
    hits,
    restore() {
      methods.forEach((method, index) => {
        console[method] = originals[index]
      })
    },
  }
}

test("VIN lookup does not write the VIN to storage, cookies, analytics, or logs", async () => {
  const spies = installSpies()
  const calls: string[] = []
  try {
    const result = await runVinLookup(VIN, {
      catalog,
      fetchImpl: async (input) => {
        const url = String(input)
        calls.push(url)
        return new Response(
          JSON.stringify({
            Results: [
              {
                ErrorCode: "0",
                Make: "FORD",
                Model: "F-150",
                ModelYear: "2023",
                Trim: "Raptor",
                Series: "",
                VehicleType: "TRUCK",
                VIN,
              },
            ],
          }),
        )
      },
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.trim, "F150 RAPTOR 4WD")
      assert.equal(result.make, "Ford")
    }
    assert.equal(JSON.stringify(result).includes(VIN), false)
    assert.equal(calls.length, 1)
    assert.match(calls[0] ?? "", /^https:\/\/vpic\.nhtsa\.dot\.gov\/api\/vehicles\/DecodeVinValues\//)
    assert.equal(spies.hits.length, 0)
  } finally {
    spies.restore()
  }
})

test("a failed decode leaves the picker unchanged and still discards the VIN", async () => {
  const spies = installSpies()
  try {
    const result = await runVinLookup(VIN, {
      catalog,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            Results: [
              {
                ErrorCode: "1",
                Make: "FORD",
                Model: "F-150",
                ModelYear: "2023",
                VIN,
              },
            ],
          }),
        ),
    })
    assert.equal(result.ok, false)
    assert.deepEqual(selectionAfterVin(current, result), current)
    assert.equal(JSON.stringify(result).includes(VIN), false)
    assert.equal(spies.hits.length, 0)

    const thrown = await runVinLookup(VIN, {
      catalog,
      fetchImpl: async () => {
        throw new Error(`network ${VIN}`)
      },
    })
    assert.equal(thrown.ok, false)
    assert.equal(JSON.stringify(thrown).includes(VIN), false)
    assert.equal(spies.hits.length, 0)
  } finally {
    spies.restore()
  }
})

test("vehicle and VIN modules do not reference storage or analytics sinks", () => {
  const files = [
    "src/lib/vin-lookup.ts",
    "src/components/calculator.tsx",
    "src/components/vehicle-fieldset.tsx",
  ]
  const forbidden = [
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "gtag",
    "plausible",
    "analytics",
    "console.",
  ]
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${file} contains ${token}`)
    }
  }
})
