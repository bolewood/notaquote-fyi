import type { Metadata } from "next"
import Link from "next/link"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { TrustArticle } from "@/components/trust-article"
import { dollars } from "@/lib/format"
import { STATES } from "@/lib/scenario"
import { pageMetadata } from "@/lib/site-meta"
import { countrywideBaseline, STATE_BASELINE_SOURCES, stateBaseline } from "@/lib/state-baselines"
import { statePath } from "@/lib/state-pages"
import { minimumWords } from "@/lib/state-content"
import { stateRule } from "@/lib/state-rules"

const DESCRIPTION =
  "What drivers pay for car insurance in each state and DC, and the least coverage each state's law asks for. Pick a state for teen drivers and moves."

export const metadata: Metadata = pageMetadata({
  title: "Car insurance by state: typical prices and minimums",
  description: DESCRIPTION,
  path: "/states",
})

const NAIC = STATE_BASELINE_SOURCES.find((source) => source.id === "naic-auto-db-2022-2023")

export default function StatesIndexPage() {
  const national = countrywideBaseline()
  const byPrice = [...STATES]
    .map((s) => ({ ...s, baseline: stateBaseline(s.code)! }))
    .sort((a, b) => a.baseline.annual - b.baseline.annual)
  const lowest5 = byPrice.slice(0, 5)
  const highest5 = [...byPrice.slice(-5)].reverse()
  return (
    <TrustArticle
      title="Car insurance by state"
      lead="What drivers in each state paid on average for full coverage in 2023, and the least insurance each state's law asks you to carry. Pick a state to see what a new teen driver adds there and how it compares with its neighbors."
      breadcrumbs={
        <Breadcrumbs
          crumbs={[
            { name: "Home", path: "/" },
            { name: "States", path: "/states" },
          ]}
        />
      }
    >
      <p>
        Nationally, full coverage averaged {dollars(national.annual)} a year in 2023 ({dollars(national.liabilityOnly)} for
        liability-only coverage and {dollars(national.averageExpenditure)} in average expenditure per insured car). Prices
        have gone up since, and every state page brings its figure up to today, alongside <Link href="/cars">popular car estimates</Link>{" "}
        and our guides on <Link href="/guides/adding-a-teen-driver">adding a teen driver</Link> and{" "}
        <Link href="/guides/cheapest-cars-to-insure-for-teens">the cheapest cars for teens</Link>.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-card p-4 text-sm ring-1 ring-border">
          <h2 className="text-base font-semibold">Lowest 2023 full-coverage averages</h2>
          <ul className="mt-2 space-y-1">
            {lowest5.map((s) => (
              <li key={s.code} className="flex justify-between gap-2">
                <Link href={statePath(s.code)}>{s.name}</Link>
                <span className="money tabular-nums">{dollars(s.baseline.annual)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-card p-4 text-sm ring-1 ring-border">
          <h2 className="text-base font-semibold">Highest 2023 full-coverage averages</h2>
          <ul className="mt-2 space-y-1">
            {highest5.map((s) => (
              <li key={s.code} className="flex justify-between gap-2">
                <Link href={statePath(s.code)}>{s.name}</Link>
                <span className="money tabular-nums">{dollars(s.baseline.annual)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <h2 id="all-states">All 50 states and DC</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="py-2 text-left text-sm text-muted-foreground">
            Typical yearly price for full coverage, 2023,{" "}
            {NAIC ? (
              <a href={NAIC.url} rel="noreferrer">
                from NAIC
              </a>
            ) : (
              "from NAIC"
            )}
            . Minimum liability is per person / per crash / property damage, in thousands of dollars, where the law sets one.
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                State
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Typical price, 2023
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Minimum liability
              </th>
            </tr>
          </thead>
          <tbody>
            {STATES.map((state) => {
              const baseline = stateBaseline(state.code)
              const rule = stateRule(state.code)
              const minimum = minimumWords(rule ?? null, "cell")
              return (
                <tr key={state.code} className="border-b border-border/60">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    <Link href={statePath(state.code)}>{state.name}</Link>
                  </th>
                  <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{baseline ? dollars(baseline.annual) : "·"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{minimum}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        The typical price is what an average driver paid for one car, not your price. A minimum is the least the law
        allows, not a recommendation. Each state&apos;s page links to its statute or insurance department and the date we
        checked it. <Link href="/sources">Every source</Link>.
      </p>
    </TrustArticle>
  )
}
