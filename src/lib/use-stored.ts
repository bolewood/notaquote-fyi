"use client"

import {
  COMPARE_EVENT,
  COMPARE_STORAGE_KEY,
  compareFromSnapshot,
  compareSnapshot,
  type CompareList,
} from "./comparison-tray"
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
