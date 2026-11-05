"use client"

import {
  COMPARE_EVENT,
  COMPARE_STORAGE_KEY,
  compareFromSnapshot,
  compareSnapshot,
  type CompareList,
} from "./compare-list"
import { useStoredValue } from "./local-store"
import {
  SITUATION_EVENT,
  SITUATION_STORAGE_KEY,
  situationFromSnapshot,
  situationSnapshot,
  type Situation,
} from "./situation"

/** "Your situation now", shared by every page, kept in this browser only. */
export function useSituation() {
  return useStoredValue<Situation>({
    key: SITUATION_STORAGE_KEY,
    event: SITUATION_EVENT,
    parse: situationFromSnapshot,
    serialize: situationSnapshot,
  })
}

/** The compare-cars list, kept in this browser only. */
export function useCompareList() {
  return useStoredValue<CompareList>({
    key: COMPARE_STORAGE_KEY,
    event: COMPARE_EVENT,
    parse: compareFromSnapshot,
    serialize: compareSnapshot,
  })
}

/** Whether the Compare page's chart is shown (shown unless the visitor hid it), kept in this browser only. */
export function useCompareChartShown(): { shown: boolean; setShown: (shown: boolean) => void } {
  const stored = useStoredValue<boolean>({
    key: "notaquote.compare-chart.v1",
    event: "notaquote:compare-chart",
    parse: (raw) => (raw === "hidden" ? false : raw === "shown" ? true : null),
    serialize: (shown) => (shown ? "shown" : "hidden"),
  })
  return { shown: stored.value ?? true, setShown: stored.write }
}
