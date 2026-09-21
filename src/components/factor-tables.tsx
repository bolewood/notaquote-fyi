import { publishedFactorGroups } from "@/lib/factor-engine"

export function FactorTables() {
  const groups = publishedFactorGroups()
  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <div key={group.family} className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="py-2 text-left">
              <span className="font-medium">{group.family}</span>
              <span className="text-muted-foreground block pt-1 text-sm font-normal">
                {group.note}
              </span>
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-1 pr-3 font-medium">
                  Key
                </th>
                <th scope="col" className="py-1 pr-3 font-medium">
                  Factor
                </th>
                <th scope="col" className="py-1 font-medium">
                  Confidence
                </th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={`${group.family}-${row.key}`} className="border-b border-border">
                  <th scope="row" className="py-1 pr-3 font-normal">
                    {row.key}
                  </th>
                  <td className="py-1 pr-3 font-mono">{row.value}</td>
                  <td className="py-1">{row.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
