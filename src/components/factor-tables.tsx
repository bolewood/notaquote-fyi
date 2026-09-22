import { publishedFactorGroups } from "@/lib/factor-engine"

export function FactorTables() {
  const groups = publishedFactorGroups()
  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <div key={group.family} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="py-2 text-left">
              <span className="font-semibold">{group.family}</span>
              <span className="block pt-1 text-sm font-normal text-muted-foreground">{group.note}</span>
            </caption>
            {group.rows.length > 0 ? (
              <>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="py-1.5 pr-3 font-medium">
                      When
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-medium">
                      Effect
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-medium">
                      Range
                    </th>
                    <th scope="col" className="py-1.5 font-medium">
                      Where it comes from
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={`${group.family}-${row.key}`} className="border-b border-border align-top">
                      <th scope="row" className="py-1.5 pr-3 font-normal">
                        {row.key}
                      </th>
                      <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{row.change}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground tabular-nums">{row.range}</td>
                      <td className="py-1.5">{row.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : null}
          </table>
        </div>
      ))}
    </div>
  )
}
