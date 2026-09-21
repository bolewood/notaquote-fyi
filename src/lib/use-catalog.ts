"use client"

import { useEffect, useState } from "react"
import { isVehicleCatalog, type CatalogStatus, type VehicleCatalog } from "./catalog"

export type CatalogLoad = {
  status: CatalogStatus
  catalog: VehicleCatalog | null
}

export function useCatalog(): CatalogLoad {
  const [state, setState] = useState<CatalogLoad>({ status: "loading", catalog: null })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch("/catalog/vehicle-catalog.json")
        if (!response.ok) throw new Error("catalog")
        const body: unknown = await response.json()
        if (!isVehicleCatalog(body)) throw new Error("catalog")
        if (!cancelled) setState({ status: "ready", catalog: body })
      } catch {
        if (!cancelled) setState({ status: "failed", catalog: null })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
