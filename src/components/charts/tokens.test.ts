import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

/** The site's color tokens, read from the stylesheet itself. */
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8")
function token(name: string): [number, number, number] {
  const match = new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(css)
  assert.ok(match, `--${name} is an oklch() color`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** OKLCH to relative luminance (via OKLab and linear sRGB). */
function luminance([L, C, h]: [number, number, number]): number {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  const r = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const g = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const bl = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

function contrast(left: string, right: string): number {
  const [a, b] = [luminance(token(left)), luminance(token(right))].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

test("chart text meets 4.5:1", () => {
  const pairs: [string, string][] = [
    ["hldi-better-strong-ink", "hldi-better-strong"],
    ["hldi-better-ink", "hldi-better"],
    ["hldi-average-ink", "hldi-average"],
    ["hldi-worse-ink", "hldi-worse"],
    ["hldi-worse-strong-ink", "hldi-worse-strong"],
    ["hldi-insufficient-ink", "card"],
    ["chart-axis", "card"],
    ["chart-axis", "background"],
    ["foreground", "card"],
  ]
  for (const [ink, fill] of pairs) {
    const ratio = contrast(ink, fill)
    assert.ok(ratio >= 4.5, `${ink} on ${fill}: ${ratio.toFixed(2)}:1`)
  }
})

test("chart marks meet 3:1 against the card and the page", () => {
  for (const mark of ["chart-up", "chart-down", "chart-neutral", "chart-assumed", "hldi-better-strong", "hldi-worse-strong"]) {
    for (const surface of ["card", "background"]) {
      const ratio = contrast(mark, surface)
      assert.ok(ratio >= 3, `${mark} on ${surface}: ${ratio.toFixed(2)}:1`)
    }
  }
})
