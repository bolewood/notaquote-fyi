/**
 * The photo library's mapping, checked offline from the committed files: every
 * model year a car page shows belongs to a generation, every such generation
 * has somewhere to find its photos, and every hand entry says where its years
 * come from.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { libraryCars } from "./cars"
import type { CarGenerations } from "./generations"
import type { SeriesEntry } from "./series"

const series = JSON.parse(readFileSync("data/photos/series.json", "utf8")) as Record<string, SeriesEntry>
const generations = JSON.parse(readFileSync("data/photos/generations.json", "utf8")) as Record<string, CarGenerations>
const cars = libraryCars()

test("every car page has a series entry and generations", () => {
  for (const car of cars) {
    assert.ok(series[car.slug], `${car.slug}: run npm run photos:add -- ${car.slug}`)
    assert.ok(generations[car.slug]?.generations.length, `${car.slug}: no generations (see docs/DATA-REFRESH.md, "Photo library")`)
  }
})

test("every model year a car page shows maps to a generation, with a Commons category", () => {
  for (const car of cars) {
    const gens = generations[car.slug]?.generations ?? []
    const notSold = new Set(series[car.slug]?.notSold?.years ?? [])
    for (const year of car.shownYears) {
      if (notSold.has(year)) continue
      const claim = gens.filter((g) => g.from <= year && year <= (g.to ?? 9999))
      assert.ok(claim.length >= 1, `${car.slug}: no generation for ${year}`)
      // Two only at a boundary: a split year, sold as both.
      if (claim.length === 2) assert.ok(claim[0].to === year && claim[1].from === year, `${car.slug}: ${year} claimed by two generations`)
      assert.ok(claim.length <= 2, `${car.slug}: ${year} claimed by ${claim.length} generations`)
      for (const g of claim) assert.ok(g.commons, `${car.slug}: ${g.label} has no Commons category`)
    }
  }
})

test("hand-entered generations say where their years come from", () => {
  for (const [slug, entry] of Object.entries(series)) {
    for (const g of entry.generations ?? []) {
      assert.ok(g.source || g.article, `${slug}: ${g.label} needs a source or article`)
      assert.ok(g.to === null || g.to >= g.from, `${slug}: ${g.label} ends before it starts`)
    }
    if (entry.notSold) assert.ok(entry.notSold.note && entry.notSold.years.length, `${slug}: notSold needs years and a reason`)
  }
})
