import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { TrustArticle } from "@/components/trust-article"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { carFigures, carPages, CLAIMS_YEARS, type CarFigures } from "@/lib/car-pages"
import { estimateDollars, signedDollars } from "@/lib/format"
import { pageMetadata } from "@/lib/site-meta"

export const metadata: Metadata = pageMetadata({
  title: "What popular cars cost to insure",
  description: `Estimates for ${carPages(SERVER_CATALOG).length} popular cars, SUVs, pickups, and EVs: a typical yearly price, what adding a teen costs, and why. Not a quote.`,
  path: "/cars",
})

/** The order groups appear in: cars, then SUVs, pickups, vans, then electric cars of any size. */
const GROUPS: { id: string; label: string; match: (f: CarFigures) => boolean }[] = [
  { id: "electric", label: "Electric cars and SUVs", match: (f) => f.page.facts.powertrain === "electric" },
  { id: "cars", label: "Cars", match: (f) => ["small-car", "midsize-car", "large-car", "two-seater"].includes(f.page.facts.classId ?? "") },
  { id: "small-suvs", label: "Small SUVs", match: (f) => f.page.facts.classId === "small-suv" },
  { id: "large-suvs", label: "Larger SUVs", match: (f) => ["large-suv", "suv"].includes(f.page.facts.classId ?? "") },
  { id: "pickups", label: "Pickups", match: (f) => ["small-pickup", "large-pickup"].includes(f.page.facts.classId ?? "") },
  { id: "minivans", label: "Minivans", match: (f) => f.page.facts.classId === "minivan" },
  { id: "other", label: "Other", match: () => true },
]
const ORDER = ["cars", "small-suvs", "large-suvs", "pickups", "minivans", "electric", "other"]

function groups(): { id: string; label: string; cars: CarFigures[] }[] {
  const found = new Map<string, CarFigures[]>()
  for (const page of carPages(SERVER_CATALOG)) {
    const figures = carFigures(SERVER_CATALOG, page.slug)
    if (!figures) continue
    const group = GROUPS.find((item) => item.match(figures))!
    found.set(group.id, [...(found.get(group.id) ?? []), figures])
  }
  return ORDER.flatMap((id) => {
    const cars = found.get(id)
    const group = GROUPS.find((item) => item.id === id)!
    return cars ? [{ id, label: group.label, cars: cars.sort((left, right) => left.adult.likely - right.adult.likely) }] : []
  })
}

export default function CarsIndexPage() {
  const all = groups()
  // Without per-model claims data there are no car pages, so there's nothing to list.
  if (all.length === 0) notFound()
  const count = all.reduce((total, group) => total + group.cars.length, 0)
  const years = [...new Set(all.flatMap((group) => group.cars.map((f) => f.page.pick.year)))]
  return (
    <TrustArticle
      title="What popular cars cost to insure"
      lead={`${count} popular cars, SUVs, pickups, and electric cars, each with its own page: a typical yearly price, what adding a 16-year-old costs, and why, from insurance claims data.`}
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
        price. The cars are {years.length === 1 ? `${years[0]} models` : `mostly ${CLAIMS_YEARS.last} models`}, the newest
        our claims data covers; each page also shows older years. We only make a page when the Highway Loss Data Institute
        has claims results for that exact model. <Link href="/compare">Compare any cars</Link>, including ones not listed
        here.
      </p>
      <nav aria-label="Kinds of car" className="flex flex-wrap gap-2 text-sm">
        {all.map((group) => (
          <a key={group.id} href={`#${group.id}`} className="chip plain">
            {group.label}
          </a>
        ))}
      </nav>
      {all.map((group) => (
        <section key={group.id} aria-labelledby={group.id}>
          <h2 id={group.id}>{group.label}</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="py-2 text-left text-sm text-muted-foreground">
                {group.label}, cheapest to insure first. The yearly price is for a 45-year-old; the last column is what adding
                a 16-year-old costs.
              </caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Car
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    About a year
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Adding a teen
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.cars.map((f) => (
                  <tr key={f.page.slug} className="border-b border-border/60">
                    <th scope="row" className="pr-3 font-normal">
                      <Link href={`/cars/${f.page.slug}`} className="inline-flex min-h-11 items-center py-1">
                        {f.page.name}
                      </Link>
                    </th>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{estimateDollars(f.adult.likely)}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{signedDollars(f.teen.increase)}</td>
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
