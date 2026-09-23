import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { VehicleFixLink } from "@/components/how-we-got-this"
import { TrustArticle } from "@/components/trust-article"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { carContent, noindexCarSlugs } from "@/lib/car-content"
import { carFigures, carPages } from "@/lib/car-pages"
import { FACTOR_BUNDLE } from "@/lib/factor-engine"
import { vehicleMatchWords } from "@/lib/pricing"
import { DEFAULT_SCENARIO } from "@/lib/scenario"
import { encodeSharePath } from "@/lib/share-link"
import { pageMetadata } from "@/lib/site-meta"
import { teenDriver } from "@/lib/teen-cars"

/** Only cars with a page; anything else is a 404. */
export const dynamicParams = false

export function generateStaticParams() {
  return carPages(SERVER_CATALOG).map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: PageProps<"/cars/[slug]">): Promise<Metadata> {
  const f = carFigures(SERVER_CATALOG, (await params).slug)
  if (!f) return {}
  const content = carContent(f)
  return pageMetadata({
    title: content.title,
    description: content.description,
    path: `/cars/${f.page.slug}`,
    image: null,
    noindex: noindexCarSlugs(SERVER_CATALOG).has(f.page.slug),
  })
}

const HLDI = FACTOR_BUNDLE.sources.find((source) => source.id === FACTOR_BUNDLE.vehicle.sourceId)

function SimilarList({ cars }: { cars: readonly { slug: string | null; name: string; price: string }[] }) {
  return (
    <ul className="divide-y divide-border/70 border-y border-border/70">
      {cars.map((car) =>
        car.slug ? (
          <li key={car.slug}>
            <Link href={`/cars/${car.slug}`} className="plain flex min-h-11 flex-wrap items-center justify-between gap-x-4 py-2 hover:text-primary">
              <span className="link">{car.name}</span>
              <span className="money text-sm text-muted-foreground">{car.price}</span>
            </Link>
          </li>
        ) : (
          <li key="this-car" aria-current="page" className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 py-2 font-semibold">
            <span>{car.name}</span>
            <span className="money text-sm">{car.price}</span>
          </li>
        ),
      )}
    </ul>
  )
}

export default async function CarPage({ params }: PageProps<"/cars/[slug]">) {
  const f = carFigures(SERVER_CATALOG, (await params).slug)
  if (!f) notFound()
  const { page } = f
  const c = carContent(f)
  const whatIfHref = encodeSharePath({
    page: "/",
    scenario: DEFAULT_SCENARIO,
    teenOnParentPolicy: false,
    next: { ...DEFAULT_SCENARIO, ...page.pick },
    via: "add",
  })
  const compareHref = encodeSharePath({
    page: "/compare",
    scenario: teenDriver(DEFAULT_SCENARIO.state),
    teenOnParentPolicy: true,
    cars: [{ ...page.pick, starred: false }],
    via: "add",
  })

  return (
    <TrustArticle
      title={c.title}
      lead={c.lead}
      breadcrumbs={
        <Breadcrumbs
          crumbs={[
            { name: "Home", path: "/" },
            { name: "Cars", path: "/cars" },
            { name: page.shortName, path: `/cars/${page.slug}` },
          ]}
        />
      }
    >
      <div className="grid gap-1 rounded-2xl bg-card p-5 ring-1 ring-border" data-testid="car-estimate">
        <p className="text-sm font-medium text-muted-foreground">{c.estimateLabel}</p>
        <p>
          <span className="money text-3xl font-semibold">{c.estimate}</span>{" "}
          <span className="text-muted-foreground">{c.monthly}</span>
        </p>
        <p className="money text-sm text-muted-foreground">{c.range}</p>
        <p className="text-sm text-muted-foreground">{c.averageLine}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {c.about} <Link href="/states">{c.stateLine}</Link> <Link href="/methodology#car-pages">How we got these</Link>.
      </p>

      <h2 id="years">{c.yearsHeading}</h2>
      {c.years.length > 1 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="py-2 text-left text-sm text-muted-foreground">
              {c.fixed.yearsCaption}
            </caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Model year
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Full coverage
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Liability only
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Adding a teen
                </th>
                <th scope="col" className="hidden py-2 pr-3 text-right font-medium sm:table-cell">
                  Teen on their own policy
                </th>
              </tr>
            </thead>
            <tbody>
              {c.years.map((row) => (
                <tr key={row.year} className="border-b border-border/60">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    {row.year} <span className="text-muted-foreground">({row.age})</span>
                  </th>
                  <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{row.adult}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{row.liability}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{row.teen}</td>
                  <td className="hidden py-2 pr-3 text-right whitespace-nowrap tabular-nums sm:table-cell">{row.teenOwn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">{c.yearsNote}</p>
      {c.trims ? (
        <>
          <p>{c.trims.text}</p>
          {c.trims.rows.length > 1 ? (
            <ul className="bullets text-sm">
              {c.trims.rows.map((row) => (
                <li key={row.trim}>
                  {row.trim}: <span className="money">{row.price}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      <p>{c.otherDrivers}</p>

      <h2 id="teen">{c.teenHeading}</h2>
      <p>{c.teen}</p>
      <p>{c.teenRank}</p>
      <p className="text-sm text-muted-foreground">
        {c.fixed.teenNote}{" "}
        <Link href="/guides/cheapest-cars-to-insure-for-teens">Cheapest cars to insure for a teen</Link>.
      </p>

      <h2 id="why">{c.whyHeading}</h2>
      <p>{c.fixed.claimsIntro}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl bg-card p-5 text-sm ring-1 ring-border" data-testid="car-claims">
        {c.claims.map((row) => (
          <div key={row.label} className="contents">
            <dt className="font-medium">{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p>{c.effect}</p>
      <p>{c.kind}</p>
      {c.notes.length > 0 ? (
        <ul className="bullets">
          {c.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {HLDI ? (
          <a href={HLDI.url} rel="noreferrer">
            {c.source}
          </a>
        ) : (
          c.source
        )}
      </p>

      {c.similar.length > 1 ? (
        <>
          <h2 id="similar">{c.similarHeading}</h2>
          {c.groupRank ? <p>{c.groupRank}</p> : null}
          <SimilarList cars={c.similar} />
        </>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <a href={whatIfHref} className="btn btn-primary plain">
          What if you bought this car? <ArrowRight className="size-4" aria-hidden="true" />
        </a>
        <a href={compareHref} className="btn plain">
          Add it to a comparison
        </a>
      </div>
      <p className="text-sm text-muted-foreground">
        Both start from your own situation if you&apos;ve set one. For crash safety, see{" "}
        <a href="https://www.iihs.org/ratings" rel="noreferrer">
          IIHS
        </a>{" "}
        and{" "}
        <a href="https://www.nhtsa.gov/ratings" rel="noreferrer">
          NHTSA
        </a>{" "}
        ratings.
      </p>
      <p>
        <VehicleFixLink carName={page.name} shown={vehicleMatchWords(page.relativity)} />
      </p>
    </TrustArticle>
  )
}
