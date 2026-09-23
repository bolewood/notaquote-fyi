/**
 * States that share a land border (plus DC with Maryland and Virginia).
 * States that only touch at a corner (Arizona and Colorado, New Mexico and
 * Utah) aren't neighbors here. Alaska and Hawaii border no state, so their
 * pages compare with one nearby state instead (Washington for Alaska,
 * California for Hawaii) and say so. The map is symmetric; the
 * test checks it.
 */
import type { StateCode } from "./scenario"

export const NEIGHBORS: Record<StateCode, readonly StateCode[]> = {
  AL: ["FL", "GA", "MS", "TN"],
  AK: [],
  AZ: ["CA", "NV", "NM", "UT"],
  AR: ["LA", "MS", "MO", "OK", "TN", "TX"],
  CA: ["AZ", "NV", "OR"],
  CO: ["KS", "NE", "NM", "OK", "UT", "WY"],
  CT: ["MA", "NY", "RI"],
  DE: ["MD", "NJ", "PA"],
  DC: ["MD", "VA"],
  FL: ["AL", "GA"],
  GA: ["AL", "FL", "NC", "SC", "TN"],
  HI: [],
  ID: ["MT", "NV", "OR", "UT", "WA", "WY"],
  IL: ["IN", "IA", "KY", "MO", "WI"],
  IN: ["IL", "KY", "MI", "OH"],
  IA: ["IL", "MN", "MO", "NE", "SD", "WI"],
  KS: ["CO", "MO", "NE", "OK"],
  KY: ["IL", "IN", "MO", "OH", "TN", "VA", "WV"],
  LA: ["AR", "MS", "TX"],
  ME: ["NH"],
  MD: ["DE", "DC", "PA", "VA", "WV"],
  MA: ["CT", "NH", "NY", "RI", "VT"],
  MI: ["IN", "OH", "WI"],
  MN: ["IA", "ND", "SD", "WI"],
  MS: ["AL", "AR", "LA", "TN"],
  MO: ["AR", "IL", "IA", "KS", "KY", "NE", "OK", "TN"],
  MT: ["ID", "ND", "SD", "WY"],
  NE: ["CO", "IA", "KS", "MO", "SD", "WY"],
  NV: ["AZ", "CA", "ID", "OR", "UT"],
  NH: ["ME", "MA", "VT"],
  NJ: ["DE", "NY", "PA"],
  NM: ["AZ", "CO", "OK", "TX"],
  NY: ["CT", "MA", "NJ", "PA", "VT"],
  NC: ["GA", "SC", "TN", "VA"],
  ND: ["MN", "MT", "SD"],
  OH: ["IN", "KY", "MI", "PA", "WV"],
  OK: ["AR", "CO", "KS", "MO", "NM", "TX"],
  OR: ["CA", "ID", "NV", "WA"],
  PA: ["DE", "MD", "NJ", "NY", "OH", "WV"],
  RI: ["CT", "MA"],
  SC: ["GA", "NC"],
  SD: ["IA", "MN", "MT", "NE", "ND", "WY"],
  TN: ["AL", "AR", "GA", "KY", "MS", "MO", "NC", "VA"],
  TX: ["AR", "LA", "NM", "OK"],
  UT: ["AZ", "CO", "ID", "NV", "WY"],
  VT: ["MA", "NH", "NY"],
  VA: ["DC", "KY", "MD", "NC", "TN", "WV"],
  WA: ["ID", "OR"],
  WV: ["KY", "MD", "OH", "PA", "VA"],
  WI: ["IL", "IA", "MI", "MN"],
  WY: ["CO", "ID", "MT", "NE", "SD", "UT"],
}

/** For the two states with no land neighbor: the state to compare with instead. */
export const NEAREST_INSTEAD: Partial<Record<StateCode, StateCode>> = {
  AK: "WA",
  HI: "CA",
}

/** The states a page compares with: its neighbors, or the one stand-in for Alaska and Hawaii. */
export function comparisonStates(state: StateCode): { states: StateCode[]; bordering: boolean } {
  const neighbors = NEIGHBORS[state]
  if (neighbors.length > 0) return { states: [...neighbors], bordering: true }
  const instead = NEAREST_INSTEAD[state]
  return { states: instead ? [instead] : [], bordering: false }
}
