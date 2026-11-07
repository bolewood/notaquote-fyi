import assert from "node:assert/strict"
import test from "node:test"
import { infoboxField, infoboxes, parseYears } from "./wiki"

test("model years come out of list templates and pick the North American entry", () => {
  const box = infoboxes(`{{Infobox automobile
| name = Toyota RAV4 (XA30)
| model_years = {{unbulleted list
|2006–2012 (North America)
|2005–2013 (Japan)
}}
| production = 2005–2016
}}`)[0]
  assert.equal(infoboxField(box, "model_years"), "2006–2012 (North America); 2005–2013 (Japan)")
  assert.deepEqual(parseYears(infoboxField(box, "model_years")), { from: 2006, to: 2012, note: "North America" })
  assert.deepEqual(parseYears("2025 – present"), { from: 2025, to: null, note: null })
  assert.deepEqual(parseYears("2020"), { from: 2020, to: 2020, note: null })
  assert.equal(parseYears("unknown"), null)
})

test("a field with a link and a nested template stays whole", () => {
  const box = infoboxes(`{{Infobox automobile
| manufacturer = [[Toyota|Toyota Motor]]
| model_years = 2018–2024<ref>{{cite web|url=x}}</ref>
| layout = FF
}}`)[0]
  assert.equal(infoboxField(box, "model_years"), "2018–2024")
  assert.equal(infoboxField(box, "manufacturer"), "Toyota Motor")
})
