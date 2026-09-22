import { publishedFactorGroups } from "@/lib/factor-engine"
import { cn } from "cn"

export function FactorTables() {
  const groups = publishedFactorGroups()
  return (
    <div className="grid gap-8">
      {groups.map((group) => (
        <div key={group.family} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="pb-2 text-left">
              <span className="text-base font-semibold">{group.family}</span>
              <span className="block pt-0.5 text-sm leading-relaxed font-normal text-muted-foreground">{group.note}</span>
            </caption>
            {group.rows.length > 0 ? (
              <>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      When
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Change
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Could be
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Where it comes from
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={`${group.family}-${row.key}`} className="border-b border-border/60 align-top">
                      <th scope="row" className="py-2 pr-3 font-normal">
                        {row.key}
                      </th>
                      <td className="py-2 pr-3 text-right font-medium whitespace-nowrap tabular-nums">{row.change}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground tabular-nums">{row.range}</td>
                      <td className={cn("py-2", row.basis === "assumed" && "font-medium text-sun-ink")}>{row.confidence}</td>
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
