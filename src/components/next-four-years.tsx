import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"
import { ChartFigure } from "@/components/charts/figure"
import { RangeRowsChart, type RangeRow } from "@/components/charts/range-rows"
import { estimateDollars, rangeDollars, rangeWords, signedDollars } from "@/lib/format"
import { fourYearWords, TEEN_YEARS_METHOD_PATH, versusTodayWords, yearName, type TeenFourYears } from "@/lib/teen-years"

const NO_LOWEST: ReadonlySet<string> = new Set()

function money(kind: TeenFourYears["kind"], amount: number): string {
  return kind === "added" ? signedDollars(amount) : `about ${estimateDollars(amount)}`
}

/** The chart, the table (the accessible version), and the notes. */
function FourYearsBody({ years }: { years: TeenFourYears }) {
  const words = fourYearWords(years.kind)
  const rows: RangeRow[] = years.rows.map((row) => ({
    key: row.age,
    name: yearName(row),
    starred: false,
    value: row.likely,
    low: row.low,
    high: row.high,
  }))
  return (
    <div className="grid gap-4" data-testid="next-four-years-body">
      <p className="font-medium">{words.lead}</p>
      <p className="text-sm text-muted-foreground">
        {words.what} {words.today}
      </p>
      <ChartFigure caption={`${words.axis}, with each year's range.`} testId="next-four-years-chart">
        <RangeRowsChart
          rows={rows}
          lowestKeys={NO_LOWEST}
          lowestLabel=""
          extra={false}
          signed={years.kind === "added"}
          axisLabel={words.axis}
        />
      </ChartFigure>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm" data-testid="next-four-years-table">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                Year
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                {words.column}
              </th>
              <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">
                Could be
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                {words.compared}
              </th>
              <th scope="col" className="py-2 font-medium">
                Where it comes from
              </th>
            </tr>
          </thead>
          <tbody>
            {years.rows.map((row) => (
              <tr key={row.age} className="border-b border-border/60 align-top">
                <th scope="row" className="py-2 pr-3 font-normal whitespace-nowrap">
                  {yearName(row)}
                </th>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{money(years.kind, row.likely)}</td>
                <td className="hidden py-2 pr-3 whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                  {rangeDollars(row.low, row.high)}
                </td>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{versusTodayWords(row)}</td>
                <td className="py-2">
                  <Link href={TEEN_YEARS_METHOD_PATH} className={cn("link", row.basis === "assumed" && "font-medium text-sun-ink")}>
                    {row.basisWords}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{row.how}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-2 pr-3 font-semibold whitespace-nowrap">
                All four years
              </th>
              <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap tabular-nums" data-testid="next-four-years-total">
                {money(years.kind, years.total.likely)}
              </td>
              <td className="hidden py-2 pr-3 whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                {rangeDollars(years.total.low, years.total.high)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-sm">
        All four years: {years.kind === "added" ? `about ${estimateDollars(years.total.likely)} more in all` : `about ${estimateDollars(years.total.likely)}`} (
        {rangeWords(years.total.low, years.total.high)}). {words.together}
      </p>
      <p className="text-sm">
        {words.why} <strong>{words.reset}</strong>
      </p>
      <p className="text-sm">
        <Link href={TEEN_YEARS_METHOD_PATH} className="link">
          {words.method}
        </Link>
      </p>
    </div>
  )
}

/**
 * The next four years of a new teen driver. Collapsed under a result in the
 * calculator, open on the guide. No state of its own, nothing stored, nothing
 * sent; a server page can render it.
 */
export function NextFourYears({ years, open = false, className }: { years: TeenFourYears; open?: boolean; className?: string }) {
  const words = fourYearWords(years.kind)
  return (
    <details className={cn("disclosure", className)} open={open} data-testid="next-four-years">
      <summary>
        {words.title}
        <ChevronDown className="size-4" aria-hidden="true" />
      </summary>
      <div className="pb-4">
        <FourYearsBody years={years} />
      </div>
    </details>
  )
}
