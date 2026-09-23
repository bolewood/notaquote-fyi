import type { Metadata } from "next"
import Link from "next/link"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { TrustArticle } from "@/components/trust-article"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { carFigures, carPages, CLAIMS_YEARS, type CarFigures } from "@/lib/car-pages"
import { estimateDollars, signedDollars } from "@/lib/format"
import { pageMetadata } from "@/lib/site-meta"

export const metadata: Metadata = pageMetadata({
  title: "What popular cars cost to insure",
  description:
    `Planning estimates for ${carPages(SERVER_CATALOG).length} popular cars, SUVs, trucks, and electric cars: a typical yearly price, what adding a 16-year-old costs, and why, from insurance claims data. Not a quote.`,
  path: "/cars",
})

function anchor(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

function groups(): { label: string; cars: CarFigures[] }[] {
  const byClass = new Map<string, CarFigures[]>()
  for (const page of carPages(SERVER_CATALOG)) {
    const figures = carFigures(SERVER_CATALOG, page.slug)
    if (!figures) continue
    const label = page.classLabel ?? "Other"
    byClass.set(label, [...(byClass.get(label) ?? []), figures])
  }
  return [...byClass.entries()]
    .map(([label, cars]) => ({ label, cars: cars.sort((left, right) => left.adult.likely - right.adult.likely) }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

export default function CarsIndexPage() {
  const all = groups()
  const count = all.reduce((total, group) => total + group.cars.length, 0)
  const years = [...new Set(all.flatMap((group) => group.cars.map((f) => f.page.pick.year)))]
  return (
    <TrustArticle
      title="What popular cars cost to insure"
      lead={`${count} popular cars, SUVs, trucks, and electric cars, each with its own page: a typical yearly price, what adding a 16-year-old costs, and why, from insurance claims data.`}
      breadcrumbs={
        <Breadcrumbs
          crumbs={[
            { name: "Home", path: "/" },
            { name: "Cars", path: "/cars" },
          ]}
        />
      }
    >
      <p>
        Every figure is for the same driver: a 45-year-old with a clean record and full coverage, at the national typical
        price. The cars are {years.length === 1 ? `${years[0]} models` : `mostly ${CLAIMS_YEARS.last} models`}, the newest our claims data covers. We only make a page when the
        Highway Loss Data Institute has claims results for that exact model.{" "}
        <Link href="/compare">Compare any cars</Link>, including ones not listed here.
      </p>
      {all.map((group) => (
        <section key={group.label} aria-labelledby={`class-${anchor(group.label)}`}>
          <h2 id={`class-${anchor(group.label)}`}>{group.label}s</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Car
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    About a year
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Adding a 16-year-old
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.cars.map((f) => (
                  <tr key={f.page.slug} className="border-b border-border/60">
                    <th scope="row" className="py-2 pr-3 font-normal">
                      <Link href={`/cars/${f.page.slug}`}>{f.page.name}</Link>
                    </th>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{estimateDollars(f.adult.likely)}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{signedDollars(f.teen.increase)} a year</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </TrustArticle>
  )
}
