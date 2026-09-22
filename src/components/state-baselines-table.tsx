import { STATES } from "@/lib/scenario"
import {
  allStateBaselines,
  countrywideBaseline,
  STATE_BASELINE_ATTRIBUTION,
  STATE_BASELINE_SOURCES,
} from "@/lib/state-baselines"

const NAMES = new Map<string, string>(STATES.map((state) => [state.code, state.name]))

function dollars(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

export function StateBaselinesTable() {
  const naic = STATE_BASELINE_SOURCES.find((source) => source.id === "naic-auto-db-2022-2023")
  const national = countrywideBaseline()
  return (
    <div className="grid gap-3">
      <p className="max-w-2xl">
        What an average driver in each state paid in 2023 for one car with full coverage (liability, collision, and
        comprehensive), and for liability alone. It&apos;s a starting point, not your price: a teen driver, a newer car, or
        higher limits cost more. When you don&apos;t tell us what you pay, the What-if page starts from your state&apos;s
        full-coverage figure, brought up to today. Nationally, it was {dollars(national.annual)}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full max-w-2xl border-collapse text-left text-sm">
          <caption className="py-2 text-left text-sm text-muted-foreground">
            Average yearly cost by state, 2023.{" "}
            {naic ? (
              <a href={naic.url} rel="noreferrer">
                {STATE_BASELINE_ATTRIBUTION}
              </a>
            ) : (
              STATE_BASELINE_ATTRIBUTION
            )}
            .
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                State
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Full coverage, a year
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Liability only, a year
              </th>
            </tr>
          </thead>
          <tbody>
            {allStateBaselines().map((row) => (
              <tr key={row.state} id={`state-baseline-${row.state}`} className="border-b border-border/60">
                <th scope="row" className="py-1.5 pr-3 font-normal">
                  {NAMES.get(row.state) ?? row.state}
                </th>
                <td className="py-1.5 pr-3 text-right whitespace-nowrap tabular-nums">{dollars(row.annual)}</td>
                <td className="py-1.5 pr-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">{dollars(row.liabilityOnly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
