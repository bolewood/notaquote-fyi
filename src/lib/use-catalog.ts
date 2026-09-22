"use client"

import { useEffect, useState } from "react"
import { isVehicleCatalog, type CatalogStatus, type VehicleCatalog } from "./catalog"

export type CatalogLoad = {
  status: CatalogStatus
  catalog: VehicleCatalog | null
}

const CATALOG_URL = "/catalog/vehicle-catalog.json"

/**
 * One request for the list of cars per visit, shared by every page and
 * component that needs it (and by React's development double-mount). A
 * failed request is forgotten, so the next page can try again.
 */
let pending: Promise<VehicleCatalog> | null = null
let loaded: VehicleCatalog | null = null

function loadCatalog(): Promise<VehicleCatalog> {
  if (!pending) {
    pending = fetch(CATALOG_URL)
      .then((response) => {
        if (!response.ok) throw new Error("catalog")
        return response.json() as Promise<unknown>
      })
      .then((body) => {
        if (!isVehicleCatalog(body)) throw new Error("catalog")
        loaded = body
        return body
      })
      .catch((error: unknown) => {
        pending = null
        throw error
      })
  }
  return pending
}

// Start as soon as this code arrives in the browser, before the page has
// finished drawing, so the list is usually ready by the time it's needed.
if (typeof window !== "undefined") void loadCatalog().catch(() => undefined)

export function useCatalog(): CatalogLoad {
  const [state, setState] = useState<CatalogLoad>(() =>
    loaded ? { status: "ready", catalog: loaded } : { status: "loading", catalog: null },
  )

  useEffect(() => {
    if (loaded) return
    let cancelled = false
    loadCatalog().then(
      (catalog) => {
        if (!cancelled) setState({ status: "ready", catalog })
      },
      () => {
        if (!cancelled) setState({ status: "failed", catalog: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
