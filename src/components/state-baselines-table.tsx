import { STATES } from "@/lib/scenario"
import {
  allStateBaselines,
  countrywideBaseline,
  STATE_BASELINE_ATTRIBUTION,
  STATE_BASELINE_SOURCES,
  STATE_BASELINES_VERSION,
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
      <p>
        For each state, this is roughly what an average driver paid for one car
        with liability, collision, and comprehensive coverage in 2023. It&rsquo;s a
        starting point, not your price. A teen driver, a new car, or higher
        limits will cost more. The calculator doesn&rsquo;t use these numbers yet.
        Nationally, the figure was {dollars(national.annual)}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="py-2 text-left font-medium">
            Typical yearly premium by state ({STATE_BASELINES_VERSION}).{" "}
            {naic ? (
              <a href={naic.url} className="underline underline-offset-4" rel="noreferrer">
                {STATE_BASELINE_ATTRIBUTION}
              </a>
            ) : (
              STATE_BASELINE_ATTRIBUTION
            )}
            .
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-medium">
                State
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Full coverage, per year
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Liability only, per year
              </th>
            </tr>
          </thead>
          <tbody>
            {allStateBaselines().map((row) => (
              <tr key={row.state} id={`state-baseline-${row.state}`} className="border-b border-border">
                <th scope="row" className="py-2 pr-3 font-medium">
                  {NAMES.get(row.state) ?? row.state}
                </th>
                <td className="py-2 pr-3 whitespace-nowrap">{dollars(row.annual)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{dollars(row.liabilityOnly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
