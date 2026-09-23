/**
 * State page addresses (/states/<slug>), kept light so the browser-side
 * pieces (the state picker on /sources) can link to them. The slug is the
 * state's name, lowercase, with dashes: "ohio", "new-york",
 * "district-of-columbia". It never changes.
 */
import { normalizeName } from "./catalog-match"
import { STATES, stateName, type StateCode } from "./scenario"

export function stateSlug(code: StateCode): string {
  return normalizeName(stateName(code)).replace(/ /g, "-")
}

export const STATE_SLUGS: readonly { code: StateCode; slug: string }[] = STATES.map((state) => ({
  code: state.code,
  slug: stateSlug(state.code),
}))

export function stateBySlug(slug: string): StateCode | null {
  return STATE_SLUGS.find((item) => item.slug === slug)?.code ?? null
}

export function statePath(code: StateCode): string {
  return `/states/${stateSlug(code)}`
}
