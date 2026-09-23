"use client"

import { useEffect, useState } from "react"

type Lookup = (make: string, model: string) => string | null

let loaded: Lookup | null = null

/**
 * The car's own page (/cars/...), if it has one. The list of car pages loads
 * only when a link is first needed, so it isn't part of the page's first
 * download. Null until then, and for cars without a page.
 */
export function useCarPagePath(make: string, model: string, wanted = true): string | null {
  const [lookup, setLookup] = useState<Lookup | null>(() => loaded)
  useEffect(() => {
    if (!wanted || lookup) return
    let live = true
    void import("./car-page-links").then((module) => {
      loaded = module.carPagePath
      if (live) setLookup(() => module.carPagePath)
    })
    return () => {
      live = false
    }
  }, [wanted, lookup])
  return wanted && lookup ? lookup(make, model) : null
}
