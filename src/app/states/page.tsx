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
        Nationally, full coverage averaged {dollars(national.annual)} a year in 2023. Prices have gone up since, and every
        state page brings its figure up to today.
      </p>
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
