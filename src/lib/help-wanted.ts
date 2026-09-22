/**
 * The five numbers that most need a public source, in plain words, with
 * where to look. Shown on the Help page and How it works, and listed in
 * CONTRIBUTING.md. Each one is our best guess today; a state's published
 * rate guide could turn it into a sourced number for everyone.
 */
import { suggestFixUrl } from "./suggest-fix"

export type HelpWanted = {
  id: string
  /** What the number is, in a visitor's words. */
  title: string
  /** Where it's likely to be found. */
  hint: string
  /** The factor name for the prefilled issue. */
  factor: string
}

export const HELP_WANTED: readonly HelpWanted[] = [
  {
    id: "deductible",
    title: "How a $500 or $2,000 deductible changes the price",
    hint: "Look for sample prices at two deductibles for the same driver and car in your state's rate guide.",
    factor: "Deductible adjustment",
  },
  {
    id: "car-age",
    title: "How much less an older car costs to insure",
    hint: "Look for the same car at two model years, with collision and comprehensive, in your state's rate guide.",
    factor: "Car's age",
  },
  {
    id: "good-student",
    title: "What a good-student discount is worth",
    hint: "Look for a young driver priced with and without a good-student discount.",
    factor: "Good-student discount",
  },
  {
    id: "teen-added",
    title: "What adding a teen costs outside California",
    hint: "Look for a family priced before and after adding a 16- or 17-year-old to the parents' policy.",
    factor: "Adding a teen to a parent's policy",
  },
  {
    id: "two-accidents",
    title: "What two or more at-fault accidents add",
    hint: "Look for a driver priced with no at-fault accidents and with two, side by side.",
    factor: "Two or more at-fault accidents",
  },
]

/** A prefilled "A number looks wrong" issue for one of these. */
export function helpWantedUrl(item: HelpWanted): string {
  return suggestFixUrl({
    kind: "factor",
    title: item.factor,
    fields: { factor: item.factor, shown: "Our best guess, no public source yet" },
  })
}
