import assert from "node:assert/strict"
import test from "node:test"
import { photoCount, photoCredits, photoName } from "./photo-credits"

const credit = (title: string) => ({ title, author: "A", license: "CC0", licenseUrl: null, source: "https://commons.wikimedia.org/x", changes: "Resized, converted to WebP, and cropped for display" })
const entry = (src: string, title: string) => ({ src, width: 1200, height: 800, generation: "g", generationYears: "2018–2024", photoYear: null, credit: credit(title) })

test("a photo shown for several years is credited once, with every year", () => {
  const cars = photoCredits({
    "b-car": { "2022": entry("/x.webp", "File:X.jpg"), "2018": entry("/x.webp", "File:X.jpg"), "2013": null },
    "a-car": { "2024": entry("/y.webp", "File:Y.jpg") },
    "c-car": { "2013": null },
  }, {})
  assert.deepEqual(cars.map((car) => car.slug), ["a-car", "b-car"])
  assert.deepEqual(cars[1].photos.map((photo) => photo.years), [[2018, 2022]])
  assert.equal(photoCount(cars), 2)
})

test("a photo's name drops the File: prefix and the extension", () => {
  assert.equal(photoName("File:2019 Toyota Camry LE in white, front left.jpg"), "2019 Toyota Camry LE in white, front left")
  assert.equal(photoName("File:'18 Toyota Camry.JPG"), "'18 Toyota Camry")
})

test("every photo the site has carries a full credit", () => {
  const cars = photoCredits()
  assert.ok(cars.length > 100)
  for (const car of cars)
    for (const photo of car.photos) {
      const { credit } = photo
      assert.ok(credit.author.trim(), `${photo.src}: no author`)
      assert.match(credit.source, /^https:\/\/commons\.wikimedia\.org\//, `${photo.src}: source isn't a Commons page`)
      assert.match(credit.license, /^(CC0|Public domain|CC BY(-SA)? \d\.\d)/, `${photo.src}: license "${credit.license}"`)
      if (/^CC BY/.test(credit.license)) assert.ok(credit.licenseUrl, `${photo.src}: a CC BY license needs its link`)
    }
})

test("a photo shown only for a generation is credited with that generation's years", () => {
  const generationOnly = { ...entry("/g.webp", "File:G.jpg"), generationYears: "2008–2012" }
  const cars = photoCredits({ "a-car": { "2024": entry("/y.webp", "File:Y.jpg") } }, { "a-car": { "a-car/second": generationOnly } })
  assert.deepEqual(
    cars[0].photos.map((photo) => [photo.src, photo.years, photo.generationYears]),
    [
      ["/y.webp", [2024], undefined],
      ["/g.webp", [], "2008–2012"],
    ],
  )
})
