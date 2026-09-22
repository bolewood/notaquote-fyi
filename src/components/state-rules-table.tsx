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
  STATE_RULES_VERSION,
  upcomingChanges,
  type StateRule,
} from "@/lib/state-rules"
import { suggestFixUrl } from "@/lib/suggest-fix"

const NAMES = new Map<string, string>(STATES.map((state) => [state.code, state.name]))

function stateName(code: string): string {
  return NAMES.get(code) ?? code
}

const HEADINGS = [
  "State",
  "Injuries, per person",
  "Injuries, per accident",
  "Property damage",
  "Personal injury protection (PIP)",
  "Medical payments",
  "No-fault",
  "Uninsured motorist",
  "Underinsured motorist",
  "Source",
  "Checked",
]

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
        <table className="w-full border-collapse text-left">
          <caption className="py-2 text-left font-medium">
            The least insurance each state asks you to carry ({STATE_RULES_VERSION}).
            Each row links to the law or government page it comes from.
          </caption>
          <thead>
            <tr className="border-b border-border">
              {HEADINGS.map((heading) => (
                <th key={heading} scope="col" className="py-2 pr-3 font-medium">
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
                className="border-b border-border align-top"
              >
                <th scope="row" className="py-3 pr-3 font-medium">
                  <a href={`#state-note-${rule.state}`} className="underline underline-offset-4">
                    {stateName(rule.state)}
                  </a>
                </th>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {liabilityCell(rule, rule.biPerPerson)}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {liabilityCell(rule, rule.biPerAccident)}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">{liabilityCell(rule, rule.pd)}</td>
                <td className="py-3 pr-3">{flagCell(rule.pipRequired)}</td>
                <td className="py-3 pr-3">{flagCell(rule.medPayRequired)}</td>
                <td className="py-3 pr-3 whitespace-nowrap">{noFaultCell(rule.noFault)}</td>
                <td className="py-3 pr-3">{flagCell(rule.umRequired)}</td>
                <td className="py-3 pr-3">{flagCell(rule.uimRequired)}</td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {rule.sourceUrl ? (
                    <a href={rule.sourceUrl} className="underline underline-offset-4" rel="noreferrer">
                      Source
                    </a>
                  ) : (
                    "Not checked yet"
                  )}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {rule.checkedOn ? formatVerifiedDate(rule.checkedOn) : "Not checked yet"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4">
        <h3 className="font-medium">Notes by state</h3>
        <p>
          Each state has a short summary. Open &ldquo;Details and sources&rdquo; to
          see effective dates, anything we couldn&rsquo;t confirm, and every page we
          used.
        </p>
        {STATE_RULES.map((rule) => (
          <StateNote key={rule.state} rule={rule} />
        ))}
      </div>
    </div>
  )
}

function StateNote({ rule }: { rule: StateRule }) {
  const upcoming = upcomingChanges(rule)
  const defaultText = noFaultDefaultText(rule)
  return (
    <section
      aria-labelledby={`state-note-${rule.state}`}
      className="grid gap-2 border-b border-border pb-4"
    >
      <h4 id={`state-note-${rule.state}`} className="font-medium">
        {stateName(rule.state)}
      </h4>
      {rule.note ? <p>{rule.note}</p> : null}
      {defaultText ? <p>No-fault is your choice here. {defaultText}</p> : null}
      {upcoming.map((change) => (
        <p key={change.from}>
          <span className="font-medium">Coming {formatVerifiedDate(change.from)}:</span>{" "}
          {change.summary}{" "}
          <a href={change.sourceUrl} className="underline underline-offset-4" rel="noreferrer">
            Source
          </a>
        </p>
      ))}
      {rule.uncertain ? (
        <p>
          <span className="font-medium">What we couldn&rsquo;t confirm:</span> {rule.uncertain}
        </p>
      ) : null}
      <details>
        <summary className="cursor-pointer underline underline-offset-4">Details and sources</summary>
        <dl className="mt-2 grid gap-2">
          {rule.combinedSingleLimit !== null ? (
            <div>
              <dt className="font-medium">Combined limit you can use instead</dt>
              <dd>{formatLiabilityDollars(rule.combinedSingleLimit)}</dd>
            </div>
          ) : null}
          {rule.pipAmount ? (
            <div>
              <dt className="font-medium">Personal injury protection</dt>
              <dd>{rule.pipAmount}</dd>
            </div>
          ) : null}
          {rule.umLimits ? (
            <div>
              <dt className="font-medium">Uninsured and underinsured motorist</dt>
              <dd>{rule.umLimits}</dd>
            </div>
          ) : null}
          {rule.effective ? (
            <div>
              <dt className="font-medium">Effective dates and changes</dt>
              <dd>{rule.effective}</dd>
            </div>
          ) : null}
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
                      className="underline underline-offset-4 break-words"
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
      </details>
      <p className="text-sm">
        <a href={fixLink(rule)} className="underline underline-offset-4" rel="noreferrer">
          Spot something wrong? Tell us
        </a>
      </p>
    </section>
  )
}
