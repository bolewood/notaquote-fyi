import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { BLENDER_CAPTION, BLENDER_INGREDIENTS, BlenderDrawing, OpenBlender } from "./open-blender"

test("the blender's four labels link to sections that exist", () => {
  const methodology = readFileSync("src/app/methodology/page.tsx", "utf8")
  assert.deepEqual(
    BLENDER_INGREDIENTS.map((item) => item.title),
    ["Typical state price", "Your car", "Your driver and coverage", "Our own estimates"],
  )
  for (const item of BLENDER_INGREDIENTS) {
    const [path, hash] = item.href.split("#")
    assert.equal(path, "/methodology")
    assert.ok(methodology.includes(`id="${hash}"`), `${item.href} exists`)
  }
  assert.equal(BLENDER_INGREDIENTS.filter((item) => item.ours).length, 1, "only our own estimates are drawn as ours")
})

test("the drawing is small, text-only (no logos or images), and labeled", () => {
  const svg = renderToStaticMarkup(createElement(BlenderDrawing))
  assert.ok(svg.length < 15_000, `${svg.length} bytes`)
  assert.doesNotMatch(svg, /<image|<img|xlink:href|href=/)
  assert.match(svg, /role="img"/)
  assert.match(svg, /<title>/)
  const full = renderToStaticMarkup(createElement(OpenBlender, { variant: "full" }))
  assert.ok(full.includes(BLENDER_CAPTION.replace(/'/g, "&#x27;")))
  for (const item of BLENDER_INGREDIENTS) assert.ok(full.includes(`href="${item.href}"`), item.title)
})
