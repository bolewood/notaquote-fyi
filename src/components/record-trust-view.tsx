"use client"

import { recordMountedCount } from "@/lib/counts"
import { useEffect } from "react"

export function RecordTrustView() {
  useEffect(() => {
    recordMountedCount("trust_page_view")
  }, [])
  return null
}
