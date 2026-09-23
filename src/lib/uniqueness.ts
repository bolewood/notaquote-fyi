/**
 * How much of a page is its own: the share of its five-word runs ("shingles")
 * that appear on no other page in the set, and how much any two pages
 * overlap (Jaccard similarity of their shingles). Used to keep the car pages
 * from reading like one template with the numbers swapped.
 */

export function shingles(text: string, size = 5): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[“”"()]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/[.,;:!?]+$/, ""))
    .filter(Boolean)
  const found = new Set<string>()
  for (let index = 0; index + size <= words.length; index += 1) found.add(words.slice(index, index + size).join(" "))
  return found
}

export function jaccard(left: Set<string>, right: Set<string>): number {
  let shared = 0
  for (const item of left) if (right.has(item)) shared += 1
  const union = left.size + right.size - shared
  return union === 0 ? 0 : shared / union
}

export type PageUniqueness = { id: string; unique: number; maxJaccard: number; closest: string }

export type UniquenessReport = {
  pages: PageUniqueness[]
  /** The median share of a page's shingles found on no other page. */
  medianUnique: number
  /** The largest overlap between any two pages. */
  maxJaccard: number
}

export function uniqueness(pages: readonly { id: string; text: string }[], size = 5): UniquenessReport {
  const sets = pages.map((page) => shingles(page.text, size))
  const counts = new Map<string, number>()
  for (const set of sets) for (const item of set) counts.set(item, (counts.get(item) ?? 0) + 1)
  const result = pages.map((page, index) => {
    const set = sets[index]
    let own = 0
    for (const item of set) if (counts.get(item) === 1) own += 1
    let maxJaccard = 0
    let closest = ""
    sets.forEach((other, otherIndex) => {
      if (otherIndex === index) return
      const value = jaccard(set, other)
      if (value > maxJaccard) {
        maxJaccard = value
        closest = pages[otherIndex].id
      }
    })
    return { id: page.id, unique: set.size === 0 ? 0 : own / set.size, maxJaccard, closest }
  })
  const sorted = result.map((item) => item.unique).sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const medianUnique = sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  return { pages: result, medianUnique, maxJaccard: Math.max(0, ...result.map((item) => item.maxJaccard)) }
}
