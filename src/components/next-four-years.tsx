import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"
import { ChartFigure } from "@/components/charts/figure"
import { RangeRowsChart, type RangeRow } from "@/components/charts/range-rows"
import { estimateDollars, rangeDollars, rangeWords, signedDollars } from "@/lib/format"
import { fourYearWords, TEEN_YEARS_METHOD_PATH, versusTodayWords, yearName, type TeenFourYears } from "@/lib/teen-years"

const NO_LOWEST: ReadonlySet<string> = new Set()

/** A year's basis label, linked to the method, with where it comes from underneath. */
function Basis({ row }: { row: TeenFourYears["rows"][number] }) {
  return (
    <>
      <Link href={TEEN_YEARS_METHOD_PATH} className={cn("link", row.basis === "assumed" && "font-medium text-sun-ink")}>
        {row.basisWords}
      </Link>
      <span className="block text-xs font-normal text-muted-foreground">{row.how}</span>
    </>
  )
}

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
              <th scope="col" className="hidden py-2 font-medium sm:table-cell">
                Where it comes from
              </th>
            </tr>
          </thead>
          <tbody>
            {years.rows.map((row) => (
              <tr key={row.age} className="border-b border-border/60 align-top">
                <th scope="row" className="py-2 pr-3 font-normal">
                  <span className="whitespace-nowrap">{yearName(row)}</span>
                  {/* Phones: where it comes from sits under the year, since its column is hidden. */}
                  <span className="block pt-0.5 text-sm sm:hidden" data-testid="next-four-years-basis-narrow">
                    <Basis row={row} />
                  </span>
                </th>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                  {money(years.kind, row.likely)}
                  {/* Phones: the range under the figure, since its column is hidden. */}
                  <span className="block text-xs text-muted-foreground sm:hidden" data-testid="next-four-years-range-narrow">
                    {rangeDollars(row.low, row.high)}
                  </span>
                </td>
                <td className="hidden py-2 pr-3 whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                  {rangeDollars(row.low, row.high)}
                </td>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{versusTodayWords(row)}</td>
                <td className="hidden py-2 sm:table-cell">
                  <Basis row={row} />
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
                <span className="block text-xs font-normal text-muted-foreground sm:hidden" data-testid="next-four-years-range-narrow">
                  {rangeDollars(years.total.low, years.total.high)}
                </span>
              </td>
              <td className="hidden py-2 pr-3 whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                {rangeDollars(years.total.low, years.total.high)}
              </td>
              <td />
              <td className="hidden sm:table-cell" />
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

/**
 * The four years for the printed summary: a compact table (each year's
 * figure, range, and basis), the total, and the notes. No chart, no links.
 */
export function NextFourYearsPrint({ years }: { years: TeenFourYears }) {
  const words = fourYearWords(years.kind)
  const cell = { padding: "2pt 6pt 2pt 0", borderBottom: "0.5pt solid #bbb", textAlign: "left" as const, verticalAlign: "top" as const }
  const number = { ...cell, textAlign: "right" as const, whiteSpace: "nowrap" as const }
  return (
    <section data-testid="next-four-years-print">
      <h2 style={{ fontSize: "12pt", fontWeight: 650, marginTop: "12pt" }}>{words.title}</h2>
      <p>
        {words.lead} {words.what} {words.today}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", margin: "6pt 0", fontSize: "9.5pt" }}>
        <thead>
          <tr>
            <th scope="col" style={cell}>
              Year
            </th>
            <th scope="col" style={number}>
              {words.column}
            </th>
            <th scope="col" style={number}>
              Could be
            </th>
            <th scope="col" style={cell}>
              Where it comes from
            </th>
          </tr>
        </thead>
        <tbody>
          {years.rows.map((row) => (
            <tr key={row.age}>
              <th scope="row" style={{ ...cell, fontWeight: 400 }}>
                {yearName(row)}
              </th>
              <td style={number}>{money(years.kind, row.likely)}</td>
              <td style={number}>{rangeDollars(row.low, row.high)}</td>
              <td style={cell}>
                {row.basisWords}. {row.how}.
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row" style={{ ...cell, fontWeight: 650 }}>
              All four years
            </th>
            <td style={{ ...number, fontWeight: 650 }}>{money(years.kind, years.total.likely)}</td>
            <td style={number}>{rangeDollars(years.total.low, years.total.high)}</td>
            <td style={cell} />
          </tr>
        </tbody>
      </table>
      <p>
        {words.together} {words.why} {words.reset}
      </p>
    </section>
  )
}
