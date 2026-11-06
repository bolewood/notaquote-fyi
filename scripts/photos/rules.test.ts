/** The photo pipeline's rules that don't need the network: licenses, restrictions, years, image sizes and types. */
import assert from "node:assert/strict"
import test from "node:test"
import { licenseOk, restrictionsOk, thumbnailUrl } from "./candidates"
import { imagePart } from "./jev"
import { photoYear } from "./verify"

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
