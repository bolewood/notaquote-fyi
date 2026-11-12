/** The photo pipeline's rules that don't need the network: licenses, restrictions, years, image sizes and types. */
import assert from "node:assert/strict"
import test from "node:test"
import { licenseOk, restrictionsOk, thumbnailUrl } from "./candidates"
import { imagePart } from "./jev"
import { photoYear, suitability, type PhotoPick } from "./verify"

test("only licenses we can use with credit pass", () => {
  for (const ok of ["CC BY-SA 4.0", "CC BY 2.0", "CC BY-SA 3.0", "CC0", "Public domain"]) assert.equal(licenseOk(ok), true, ok)
  for (const bad of ["CC BY-NC-SA 2.0", "CC BY-ND 4.0", "CC BY-NC 4.0", "GFDL", "Fair use", "All rights reserved", ""]) assert.equal(licenseOk(bad), false, bad)
})

test("a trademark notice is fine; personality rights aren't", () => {
  assert.equal(restrictionsOk(""), true)
  assert.equal(restrictionsOk("trademarked"), true)
  assert.equal(restrictionsOk("personality"), false)
  assert.equal(restrictionsOk("trademarked personality"), false)
})

test("a photo's year comes from its filename, then its deepest subcategory", () => {
  assert.equal(photoYear({ title: "File:2019 Toyota Camry LE in white, front left.jpg", path: [] }), 2019)
  assert.equal(photoYear({ title: "File:'18 Toyota Camry.jpg", path: [] }), 2018)
  assert.equal(photoYear({ title: "File:DSC 0279.jpg", path: ["Toyota Camry (XV50)", "Toyota Camry (XV50, North America, 2014)"] }), 2014)
  assert.equal(photoYear({ title: "File:DSC 0279.jpg", path: ["Toyota Camry (XV50)"] }), null)
})

test("a tall photo's thumbnail is sized by its long side", () => {
  const thumb = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Car.jpg/1024px-Car.jpg"
  assert.equal(thumbnailUrl(thumb, 4000, 3000), thumb)
  assert.equal(thumbnailUrl(thumb, 3000, 4000), "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Car.jpg/768px-Car.jpg")
})

test("images are typed from their bytes, and only PNG and JPEG are sent", () => {
  assert.match((imagePart(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])) as { image_url: { url: string } }).image_url.url, /^data:image\/png;base64,/)
  assert.match((imagePart(Buffer.from([0xff, 0xd8, 0xff, 0xe0])) as { image_url: { url: string } }).image_url.url, /^data:image\/jpeg;base64,/)
  assert.throws(() => imagePart(Buffer.from("GIF89a")))
})

test("a near-year, US, front photo beats a foreign, far or rear one", () => {
  const base = { file: "File:2024 Car front.jpg", photoYear: 2024, foreign: 0.1, jev: { plate: 0.1, quality: 2 } } as unknown as PhotoPick
  const at = (changes: Partial<PhotoPick>) => suitability({ ...base, ...changes }, 2024)
  assert.ok(at({}) > at({ foreign: 0.8 }), "foreign ranks lower")
  assert.ok(at({}) > at({ photoYear: 2021 }), "three years off ranks lower")
  assert.ok(at({}) > at({ file: "File:2024 Car, rear left.jpg" }), "a rear view ranks lower")
  assert.ok(at({ photoYear: 2023 }) > at({ foreign: 0.8 }), "a US car a year off beats a foreign car of the year")
})

test("a gas or hybrid car page skips electric and plug-in versions, but not its own name", async () => {
  const { otherPowertrain } = await import("./verify")
  const photo = (title: string, path: string[] = []) => ({ title, path })
  assert.equal(otherPowertrain(photo("File:2022 Ford F-150 Lightning Lariat.jpg"), "combustion", "Ford F-150"), true)
  assert.equal(otherPowertrain(photo("File:2022 Ford F-150 XLT.jpg"), "combustion", "Ford F-150"), false)
  assert.equal(otherPowertrain(photo("File:Prius.jpg", ["Toyota Prius (XW50) Plug-in Hybrid"]), "hybrid", "Toyota Prius"), true)
  assert.equal(otherPowertrain(photo("File:2023 Toyota Prius Prime SE.jpg"), "plug-in-hybrid", "Toyota Prius Prime"), false)
  assert.equal(otherPowertrain(photo("File:Kona Electric.jpg"), "electric", "Hyundai Kona Electric"), false)
  assert.equal(otherPowertrain(photo("File:2023 Kia EV6 GT.jpg"), "combustion", "Kia Sportage"), false, "EV6 isn't the word EV")
  assert.equal(otherPowertrain(photo("File:2024 Chevrolet Blazer EV RS.jpg"), "combustion", "Chevrolet Blazer"), true)
  assert.equal(otherPowertrain(photo("File:BMW iX5 (G65) front.jpg"), "combustion", "BMW X5"), true)
  assert.equal(otherPowertrain(photo("File:2025 BMW X5 xDrive40i.jpg"), "combustion", "BMW X5"), false)
})
