import { STATES } from "@/lib/scenario"
import {
  flagCell,
  formatLiabilityDollars,
  formatVerifiedDate,
  liabilityCell,
  liabilityShorthand,
  noFaultCell,
  noFaultDefaultText,
  STATE_RULES,
  upcomingChanges,
  type StateRule,
} from "@/lib/state-rules"
import { suggestFixUrl } from "@/lib/suggest-fix"
import { ChevronDown } from "lucide-react"

const NAMES = new Map<string, string>(STATES.map((state) => [state.code, state.name]))

function stateName(code: string): string {
  return NAMES.get(code) ?? code
}

const HEADINGS = [
  "State",
  "Liability: per person / per crash / property",
  "Personal injury protection (PIP)",
  "Medical payments",
  "No-fault",
  "Uninsured motorist",
  "Underinsured motorist",
  "The law",
]

/** "$25,000" as "$25k", for a compact table. */
function short(amount: number | null): string {
  if (amount === null) return "none"
  return amount % 1000 === 0 ? `$${amount / 1000}k` : formatLiabilityDollars(amount)
}

function liabilityWords(rule: StateRule): string {
  if (rule.sourceUrl === null) return "Not checked yet"
  if (rule.biPerPerson === null && rule.biPerAccident === null && rule.pd === null) {
    return liabilityCell(rule, rule.combinedSingleLimit)
  }
  return `${short(rule.biPerPerson)} / ${short(rule.biPerAccident)} / ${short(rule.pd)}`
}

/** The table's shorter words for a requirement; the notes below spell it out. */
function flagWords(value: Parameters<typeof flagCell>[0]): string {
  return flagCell(value).replace("Included unless you decline", "Included unless declined")
}

function fixLink(rule: StateRule): string {
  return suggestFixUrl({
    kind: "state-rule",
    title: `${stateName(rule.state)} minimum coverage`,
    fields: {
      state: stateName(rule.state),
      rule: "Minimum liability limits or required coverages",
      shown: liabilityShorthand(rule) ?? "Not all limits shown",
    },
  })
}

export function StateRulesTable() {
  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="py-2 text-left text-sm text-muted-foreground">
            The least insurance each state asks you to carry. &ldquo;Included unless declined&rdquo; means it comes with
            your policy unless you turn it down. Tap a state for its notes and the date we checked it.
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {HEADINGS.map((heading) => (
                <th key={heading} scope="col" className="py-2 pr-3 align-bottom font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STATE_RULES.map((rule) => (
              <tr
                key={rule.state}
                id={`state-rule-${rule.state}`}
                className="border-b border-border/60 align-top"
              >
                <th scope="row" className="py-2 pr-3 font-medium">
                  <a href={`#state-note-${rule.state}`}>
                    {stateName(rule.state)}
                  </a>
                </th>
                <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{liabilityWords(rule)}</td>
                <td className="py-2 pr-3">{flagWords(rule.pipRequired)}</td>
                <td className="py-2 pr-3">{flagWords(rule.medPayRequired)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{noFaultCell(rule.noFault)}</td>
                <td className="py-2 pr-3">{flagWords(rule.umRequired)}</td>
                <td className="py-2 pr-3">{flagWords(rule.uimRequired)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {rule.sourceUrl ? (
                    <a
                      href={rule.sourceUrl}
                      rel="noreferrer"
                      title={rule.checkedOn ? `Checked ${formatVerifiedDate(rule.checkedOn)}` : undefined}
                    >
                      Source
                    </a>
                  ) : (
                    "Not checked yet"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid max-w-2xl gap-2">
        <h3 className="text-lg font-semibold">Notes by state</h3>
        <p>
          A short summary for each state, anything good to know, and anything we couldn&rsquo;t confirm, with every page we
          used.
        </p>
        <div className="mt-2 border-b border-border">
          {STATE_RULES.map((rule) => (
            <StateNote key={rule.state} rule={rule} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StateNote({ rule }: { rule: StateRule }) {
  return (
    <details id={`state-note-${rule.state}`} className="disclosure scroll-mt-4">
      <summary>
        {stateName(rule.state)}
        <ChevronDown className="size-4" aria-hidden="true" />
      </summary>
      <StateNoteBody rule={rule} />
    </details>
  )
}

/** One state's summary, what's good to know, what we couldn't confirm, and every page we used. */
/** The notes are written by the state-rules work; the site says "per crash" everywhere. */
function plain(text: string): string {
  return text.replace(/per accident/g, "per crash")
}

export function StateNoteBody({ rule }: { rule: StateRule }) {
  const upcoming = upcomingChanges(rule)
  const defaultText = noFaultDefaultText(rule)
  return (
      <div className="grid gap-2 pb-4">
      {rule.note ? <p>{plain(rule.note)}</p> : null}
      {defaultText ? <p>No-fault is your choice here. {defaultText}</p> : null}
      {upcoming.map((change) => (
        <p key={change.from}>
          <span className="font-medium">Coming {formatVerifiedDate(change.from)}:</span>{" "}
          {plain(change.summary)}{" "}
          <a href={change.sourceUrl} rel="noreferrer">
            Source
          </a>
        </p>
      ))}
      {rule.goodToKnow ? (
        <p>
          <span className="font-medium">Good to know:</span> {plain(rule.goodToKnow)}
        </p>
      ) : null}
      {rule.uncertain ? (
        <p>
          <span className="font-medium">What we couldn&rsquo;t confirm:</span> {plain(rule.uncertain)}
        </p>
      ) : null}
        <dl className="grid gap-2 rounded-2xl bg-muted/60 p-4 text-sm">
          {rule.combinedSingleLimit !== null ? (
            <div>
              <dt className="font-medium">Combined limit you can use instead</dt>
              <dd>{formatLiabilityDollars(rule.combinedSingleLimit)}</dd>
            </div>
          ) : null}
          {rule.pipAmount ? (
            <div>
              <dt className="font-medium">Personal injury protection</dt>
              <dd>{plain(rule.pipAmount)}</dd>
            </div>
          ) : null}
          {rule.umLimits ? (
            <div>
              <dt className="font-medium">Uninsured and underinsured motorist</dt>
              <dd>{plain(rule.umLimits)}</dd>
            </div>
          ) : null}
          {/* The effective-date notes cite laws in shorthand ("P.A. 102-982, eff. 7-1-23"); they stay in the data and
              its sources, and changes coming into force are shown above in plain words. */}
          <div>
            <dt className="font-medium">Checked</dt>
            <dd>{rule.checkedOn ? formatVerifiedDate(rule.checkedOn) : "Not checked yet"}</dd>
          </div>
          <div>
            <dt className="font-medium">Sources</dt>
            <dd>
              <ul className="list-disc space-y-1 pl-5">
                {rule.sources.map((source, index) => (
                  <li key={`${source.url}-${index}`}>
                    <a
                      href={source.url}
                      className="break-words"
                      rel="noreferrer"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
        <p className="text-sm">
          <a href={fixLink(rule)} rel="noreferrer">
            Spot something wrong? Tell us
          </a>
        </p>
      </div>
  )
}
