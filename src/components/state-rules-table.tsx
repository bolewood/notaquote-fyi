import { STATES } from "@/lib/scenario"
import {
  flagCell,
  formatVerifiedDate,
  liabilityCell,
  sourcedStateRules,
  STATE_RULES,
  STATE_RULES_VERSION,
} from "@/lib/state-rules"

const NAMES = new Map<string, string>(STATES.map((state) => [state.code, state.name]))

export function StateRulesTable() {
  const sourced = sourcedStateRules()

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="py-2 text-left font-medium">
            State rules {STATE_RULES_VERSION}. Source research, not a legal
            conclusion. The reviewer field is unsigned.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-medium">
                State
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                BI per person
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                BI per accident
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Property damage
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                PIP
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                No-fault
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                UM
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                UIM
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Credit
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Factor
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Source
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Checked
              </th>
              <th scope="col" className="py-2 font-medium">
                Reviewer
              </th>
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
                  {NAMES.get(rule.state) ?? rule.state}
                </th>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {liabilityCell(rule, rule.biPerPerson)}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {liabilityCell(rule, rule.biPerAccident)}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {liabilityCell(rule, rule.pd)}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">{flagCell(rule.pipRequired)}</td>
                <td className="py-3 pr-3 whitespace-nowrap">{flagCell(rule.noFault)}</td>
                <td className="py-3 pr-3 whitespace-nowrap">{flagCell(rule.umRequired)}</td>
                <td className="py-3 pr-3 whitespace-nowrap">{flagCell(rule.uimRequired)}</td>
                <td className="py-3 pr-3">{rule.creditBucket}</td>
                <td className="py-3 pr-3 font-mono">{rule.creditFactor.toFixed(2)}</td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {rule.sourceUrl ? (
                    <a
                      href={rule.sourceUrl}
                      className="underline underline-offset-4"
                      rel="noreferrer"
                    >
                      Opened page
                    </a>
                  ) : (
                    "No source URL"
                  )}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {rule.lastVerified ? formatVerifiedDate(rule.lastVerified) : "Not checked"}
                </td>
                <td className="py-3">Unsigned</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4">
        <h3 className="font-medium">Launch-quality notes</h3>
        {sourced.map((rule) => (
          <section key={rule.state} aria-labelledby={`state-note-${rule.state}`} className="grid gap-2">
            <h4 id={`state-note-${rule.state}`} className="font-medium">
              {NAMES.get(rule.state) ?? rule.state}
            </h4>
            <p>{rule.note}</p>
            <ul className="list-disc space-y-1 pl-5">
              {rule.pagesOpened.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    className="underline underline-offset-4 break-all"
                    rel="noreferrer"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
