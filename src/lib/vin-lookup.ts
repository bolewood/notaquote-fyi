import {
  compactName,
  includesQuery,
  type TrimConfidence,
} from "./catalog-match"
import {
  coercePick,
  trimRecord,
  type VehicleCatalog,
  type VehiclePick,
} from "./catalog"

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/
const NHTSA_DECODE = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/"

const OUTSIDE_SNAPSHOT =
  /\b(motorcycle|bus|trailer|incomplete|low speed|off road|motorhome)\b/i

export type VinLookupResult =
  | {
      ok: true
      year: number
      make: string
      model: string
      trim: string
      confidence: TrimConfidence
      message: string
    }
  | {
      ok: false
      message: string
    }

export function normalizeVin(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function selectionAfterVin(
  current: VehiclePick,
  result: VinLookupResult,
): VehiclePick {
  if (!result.ok) return current
  return {
    year: result.year,
    make: result.make,
    model: result.model,
    trim: result.trim,
  }
}

type DecodeRow = {
  make: string
  model: string
  year: number
  trimHint: string
  vehicleType: string
}

function textField(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === "string" ? value.trim() : ""
}

function readDecode(payload: unknown): DecodeRow | null {
  if (!payload || typeof payload !== "object") return null
  const results = (payload as { Results?: unknown }).Results
  if (!Array.isArray(results) || !results[0] || typeof results[0] !== "object") {
    return null
  }
  const row = results[0] as Record<string, unknown>
  const errorCode = textField(row, "ErrorCode").trim()
  if (errorCode !== "0") return null
  const make = textField(row, "Make")
  const model = textField(row, "Model")
  const year = Number(textField(row, "ModelYear"))
  if (!make || !model || !Number.isInteger(year)) return null
  const trim = textField(row, "Trim")
  const series = textField(row, "Series")
  const combined = [trim, series].filter(Boolean).join(" ")
  const trimHint =
    combined.length > 0 && combined.length <= 80 && !VIN_PATTERN.test(normalizeVin(combined))
      ? combined
      : ""
  return {
    make,
    model,
    year,
    trimHint,
    vehicleType: textField(row, "VehicleType"),
  }
}

function findMake(catalog: VehicleCatalog, year: number, make: string): string | null {
  const bucket = catalog.vehicles[String(year)]
  if (!bucket) return null
  const compact = compactName(make)
  return Object.keys(bucket).find((item) => compactName(item) === compact) ?? null
}

function findModel(
  catalog: VehicleCatalog,
  year: number,
  make: string,
  model: string,
): string | null {
  const models = catalog.vehicles[String(year)]?.[make]
  if (!models) return null
  const compact = compactName(model)
  const exact = Object.keys(models).find((item) => compactName(item) === compact)
  if (exact) return exact
  const names = Object.keys(models).sort(
    (left, right) => compactName(right).length - compactName(left).length,
  )
  return (
    names.find((item) => {
      const candidate = compactName(item)
      return compact.startsWith(candidate) || candidate.startsWith(compact)
    }) ?? null
  )
}

export async function runVinLookup(
  rawVin: string,
  input: {
    fetchImpl: typeof fetch
    catalog: VehicleCatalog | null
  },
): Promise<VinLookupResult> {
  const vin = normalizeVin(rawVin)
  if (!VIN_PATTERN.test(vin)) {
    return {
      ok: false,
      message: "Enter a 17-character VIN, or leave this blank. Nothing was sent.",
    }
  }
  if (!input.catalog) {
    return {
      ok: false,
      message:
        "The vehicle catalog is not loaded, so the VIN was not applied. The VIN was discarded.",
    }
  }

  let payload: unknown
  try {
    const response = await input.fetchImpl(`${NHTSA_DECODE}${vin}?format=json`)
    if (!response.ok) {
      return {
        ok: false,
        message: "That VIN did not decode. The year, make, model, and trim controls are unchanged.",
      }
    }
    payload = await response.json()
  } catch {
    return {
      ok: false,
      message: "That VIN did not decode. The year, make, model, and trim controls are unchanged.",
    }
  }

  const decoded = readDecode(payload)
  if (!decoded || OUTSIDE_SNAPSHOT.test(decoded.vehicleType)) {
    return {
      ok: false,
      message: decoded
        ? "NHTSA decoded a vehicle this snapshot does not include. The controls are unchanged."
        : "That VIN did not decode. The year, make, model, and trim controls are unchanged.",
    }
  }

  const make = findMake(input.catalog, decoded.year, decoded.make)
  const model = make ? findModel(input.catalog, decoded.year, make, decoded.model) : null
  if (!make || !model) {
    return {
      ok: false,
      message:
        "NHTSA decoded a vehicle this snapshot does not include. The controls are unchanged.",
    }
  }

  const pick = coercePick(input.catalog, {
    year: decoded.year,
    make,
    model,
    trim: "",
  })
  const trims = input.catalog.vehicles[String(pick.year)]?.[pick.make]?.[pick.model] ?? []
  const hinted = decoded.trimHint
    ? trims.find(
        (trim) =>
          includesQuery(trim.name, decoded.trimHint) ||
          includesQuery(decoded.trimHint, trim.name),
      )
    : undefined
  const chosen = hinted ?? trims[0]
  if (!chosen) {
    return {
      ok: false,
      message:
        "NHTSA decoded a vehicle this snapshot does not include. The controls are unchanged.",
    }
  }

  const record = trimRecord(input.catalog, { ...pick, trim: chosen.name })
  const native = record?.confidence ?? chosen.confidence
  const confidence: TrimConfidence = hinted ? native : native === "high" ? "limited" : native
  const message = hinted
    ? "Filled from NHTSA. The VIN was discarded."
    : decoded.trimHint
      ? `NHTSA named “${decoded.trimHint}”. That trim is not in the snapshot, so confidence on the selected row is limited. The VIN was discarded.`
      : "Filled from NHTSA. No trim name came back, so confidence on the selected row is limited. The VIN was discarded."

  return {
    ok: true,
    year: pick.year,
    make: pick.make,
    model: pick.model,
    trim: chosen.name,
    confidence,
    message,
  }
}
