/**
 * The vehicle catalog for the server (the /api/v1 routes). The browser loads
 * the same file from /catalog/vehicle-catalog.json; the server imports it once,
 * when a route first needs it, and every request after that reads it from
 * memory.
 */
import catalogFile from "../../public/catalog/vehicle-catalog.json"
import { isVehicleCatalog, type VehicleCatalog } from "./catalog"

function load(): VehicleCatalog {
  const value: unknown = catalogFile
  if (!isVehicleCatalog(value)) throw new Error("public/catalog/vehicle-catalog.json is not a vehicle catalog")
  return value
}

export const SERVER_CATALOG: VehicleCatalog = load()
