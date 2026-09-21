import assert from "node:assert/strict"
import test from "node:test"
import { DATA_BUNDLE_VERSION, MODEL_VERSION } from "./copy"
import { JAYDEN, MOLLY } from "./scenario"
import {
  decodeShareSearch,
  encodeSharePath,
  FROZEN_RESULT_KEYS,
  shareArrivalNotes,
} from "./share-link"

test("a share link round-trips Molly and Jayden without a dollar result", () => {
  for (const scenario of [MOLLY, JAYDEN]) {
    const path = encodeSharePath({
      scenario,
      anchorAmount: null,
      baselineCleared: false,
    })
    const params = new URLSearchParams(path.slice(2))
    assert.equal(params.get("share"), "1")
    assert.equal(params.get("mv"), MODEL_VERSION)
    assert.equal(params.get("bv"), DATA_BUNDLE_VERSION)
    assert.equal(params.has("anchor"), false)
    for (const key of FROZEN_RESULT_KEYS) {
      assert.equal(params.has(key), false)
    }

    const decoded = decodeShareSearch(path)
    assert.equal(decoded.status, "ok")
    if (decoded.status !== "ok") return
    assert.deepEqual(decoded.scenario, scenario)
    assert.equal(decoded.anchorAmount, null)
    assert.equal(decoded.modelMismatch, false)
    assert.equal(decoded.bundleMismatch, false)
    assert.equal(decoded.ignoredFrozenDollars, false)
  }
})

test("the share link includes an anchor only while the baseline is not cleared", () => {
  const open = encodeSharePath({
    scenario: MOLLY,
    anchorAmount: 1800,
    baselineCleared: false,
  })
  const openParams = new URLSearchParams(open.slice(2))
  assert.equal(openParams.get("anchor"), "1800")
  for (const key of FROZEN_RESULT_KEYS) {
    assert.equal(openParams.has(key), false)
  }

  const blocked = encodeSharePath({
    scenario: MOLLY,
    anchorAmount: 1800,
    baselineCleared: true,
  })
  assert.equal(new URLSearchParams(blocked.slice(2)).has("anchor"), false)

  const decoded = decodeShareSearch(open)
  assert.equal(decoded.status, "ok")
  if (decoded.status !== "ok") return
  assert.equal(decoded.anchorAmount, 1800)
  assert.match(shareArrivalNotes(decoded).join(" "), /visitor's anchor/)
  assert.match(shareArrivalNotes(decoded).join(" "), /not a cleared baseline/)
})

test("an older model in the link is named instead of treated as current", () => {
  const path = encodeSharePath({
    scenario: JAYDEN,
    anchorAmount: null,
    baselineCleared: false,
    modelVersion: "0.1.0-sample",
    bundleVersion: "factors-2020-01-01",
  })
  const withDollars = `${path}&low=10&likely=20&high=30&monthly=2`
  const decoded = decodeShareSearch(withDollars)
  assert.equal(decoded.status, "ok")
  if (decoded.status !== "ok") return
  assert.equal(decoded.modelMismatch, true)
  assert.equal(decoded.bundleMismatch, true)
  assert.equal(decoded.ignoredFrozenDollars, true)
  assert.deepEqual(decoded.scenario, JAYDEN)
  assert.equal("dollars" in decoded, false)

  const notes = shareArrivalNotes(decoded).join(" ")
  assert.match(notes, /model 0\.1\.0-sample/)
  assert.match(notes, new RegExp(`model ${MODEL_VERSION.replace(".", "\\.")}`))
  assert.match(notes, /recomputed/)
  assert.match(notes, /not a saved result/)
  assert.match(notes, /factors-2020-01-01/)
  assert.match(notes, /ignored them and recomputed/)
  assert.doesNotMatch(notes, /\$10/)
  assert.doesNotMatch(notes, /\$20/)
})

test("a share link without the marker is absent, and a broken one is invalid", () => {
  assert.equal(decodeShareSearch("").status, "absent")
  assert.equal(decodeShareSearch("?age=40-64").status, "absent")
  assert.equal(decodeShareSearch("?share=1&mv=0.2.0").status, "invalid")
})
