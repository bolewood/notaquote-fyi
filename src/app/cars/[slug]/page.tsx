import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { VehicleFixLink } from "@/components/how-we-got-this"
import { TrustArticle } from "@/components/trust-article"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import {
  carDescription,
  carTitle,
  claimsPhrase,
  driverWords,
  kindText,
  leadText,
  priceEffectText,
  teenRankText,
  teenText,
} from "@/lib/car-content"
import { carFigures, carPages, CLAIMS_YEARS, type SimilarCar } from "@/lib/car-pages"
import { FACTOR_BUNDLE } from "@/lib/factor-engine"
import { estimateDollars, monthlyDollars, rangeDollars, rangeWords } from "@/lib/format"
import { vehicleMatchWords } from "@/lib/pricing"
import { UNRESOLVED_TRIM_NAME } from "@/lib/catalog"
import { DEFAULT_SCENARIO } from "@/lib/scenario"
import { encodeSharePath } from "@/lib/share-link"
import { pageMetadata } from "@/lib/site-meta"
import { statePath } from "@/lib/state-pages"
import { teenDriver } from "@/lib/teen-cars"

/** Only cars with a page; anything else is a 404. */
export const dynamicParams = false

export function generateStaticParams() {
  return carPages(SERVER_CATALOG).map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: PageProps<"/cars/[slug]">): Promise<Metadata> {
  const f = carFigures(SERVER_CATALOG, (await params).slug)
  if (!f) return {}
  return pageMetadata({ title: carTitle(f), description: carDescription(f), path: `/cars/${f.page.slug}` })
}

const HLDI = FACTOR_BUNDLE.sources.find((source) => source.id === FACTOR_BUNDLE.vehicle.sourceId)

function SimilarList({ cars, label }: { cars: readonly SimilarCar[]; label: string }) {
  if (cars.length === 0) return null
  return (
    <div className="grid gap-2">
      <h3>{label}</h3>
      <ul className="divide-y divide-border/70 border-y border-border/70">
        {cars.map((car) => (
          <li key={car.slug} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
            <Link href={`/cars/${car.slug}`}>{car.name}</Link>
            <span className="money text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">about {estimateDollars(car.likely)}</span> a year
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function CarPage({ params }: PageProps<"/cars/[slug]">) {
  const f = carFigures(SERVER_CATALOG, (await params).slug)
  if (!f) notFound()
  const { page } = f
  const year = page.pick.year
  const kind = page.classLabel ? `${page.classLabel.charAt(0).toLowerCase()}${page.classLabel.slice(1)}s` : "cars of its kind"
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
  const rangePoints = f.adult.rangePoints

  return (
    <TrustArticle
      title={carTitle(f)}
      lead={leadText(f)}
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
        <p className="text-sm font-medium text-muted-foreground">
          {year} {page.shortName}, a typical 45-year-old, nationally
        </p>
        <p>
          <span className="money text-3xl font-semibold">about {estimateDollars(f.adult.likely)}</span>{" "}
          <span className="text-muted-foreground">a year (about {monthlyDollars(f.adult.likely)} a month)</span>
        </p>
        <p className="money text-sm text-muted-foreground">{rangeWords(f.adult.low, f.adult.high)}</p>
        <p className="text-sm text-muted-foreground">
          An average {year} car: about {estimateDollars(f.averageCar.likely)} a year.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {driverWords()} We priced the {year} {page.pick.trim === UNRESOLVED_TRIM_NAME ? page.model : page.pick.trim},
        the newest model year our insurance claims data covers ({CLAIMS_YEARS.first}–{CLAIMS_YEARS.last}).{" "}
        {f.start.attribution}
      </p>

      <h2 id="by-state">In a few states</h2>
      <p>The car works the same way everywhere. What moves is each state&apos;s typical price.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="py-2 text-left text-sm text-muted-foreground">
            The same driver and coverage, with each state&apos;s typical price.
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                State
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                About a year
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Range
              </th>
            </tr>
          </thead>
          <tbody>
            {f.states.map((row) => (
              <tr key={row.state} className="border-b border-border/60">
                <th scope="row" className="py-2 pr-3 font-normal">
                  <Link href={statePath(row.state)}>{row.name}</Link>
                </th>
                <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap tabular-nums">{estimateDollars(row.estimate.likely)}</td>
                <td className="py-2 pr-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                  {rangeDollars(row.estimate.low, row.estimate.high)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        <Link href="/states">Find your state</Link> for its typical price, or try this car with your own numbers below.
      </p>

      <h2 id="teen">Adding a 16-year-old with this car</h2>
      <p>{teenText(f)}</p>
      <p>{teenRankText(f)}</p>
      <p className="text-sm text-muted-foreground">
        That&apos;s the whole household&apos;s policy going up, not a price for the teen&apos;s own car, and our figure for
        adding a teen is wide, since it comes from one state&apos;s published prices.{" "}
        <Link href="/guides/cheapest-cars-to-insure-for-teens">Cars that cost the least to insure for a teen</Link>.
      </p>

      <h2 id="why">Why it costs what it does</h2>
      <p>
        The Highway Loss Data Institute compares each model&apos;s insurance claims with the average car&apos;s. For the{" "}
        {page.shortName}:
      </p>
      <dl className="grid gap-x-6 gap-y-2 rounded-2xl bg-card p-5 text-sm ring-1 ring-border sm:grid-cols-[auto_1fr]" data-testid="car-claims">
        <dt className="font-medium">Repairs after a crash (collision)</dt>
        <dd>{claimsPhrase(f.claims.repairs)}</dd>
        <dt className="font-medium">Theft, weather, and glass (comprehensive)</dt>
        <dd>{claimsPhrase(f.claims.theftAndWeather)}</dd>
        <dt className="font-medium">Damage its drivers do to other cars</dt>
        <dd>{claimsPhrase(f.claims.damageToOthers)}</dd>
        <dt className="font-medium">Injuries its drivers cause</dt>
        <dd>{claimsPhrase(f.claims.injuriesToOthers)}</dd>
      </dl>
      <p>{priceEffectText(f)}</p>
      <p>{kindText(f)}</p>
      <p className="text-sm text-muted-foreground">
        Claims results:{" "}
        {HLDI ? (
          <a href={HLDI.url} rel="noreferrer">
            {HLDI.publisher}, {HLDI.title}
          </a>
        ) : (
          "Highway Loss Data Institute"
        )}
        . We matched this car to &ldquo;{f.claims.series.join("; ")}&rdquo;. <Link href="/methodology">How we use them</Link>.
      </p>

      {f.similar.cheaper.length + f.similar.pricier.length > 0 ? (
        <>
          <h2 id="similar">Similar {kind}</h2>
          <p>The same driver and coverage, {year} models, nationally.</p>
          <SimilarList cars={f.similar.cheaper} label="The closest that cost less" />
          <SimilarList cars={f.similar.pricier} label="The closest that cost more" />
          <p className="text-sm">
            <Link href="/cars">Every car we have a page for</Link>
          </p>
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
        The What-if page tries the {year} {page.shortName} on your own situation (or a typical one, if you haven&apos;t set
        yours). Compare adds it to your list, priced for the same driver as the rest.
      </p>

      <h2 id="good-to-know">Good to know</h2>
      <ul className="bullets">
        {rangePoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
        <li>
          Insurance cost is one thing to weigh. For crash safety, see the{" "}
          <a href="https://www.iihs.org/ratings" rel="noreferrer">
            IIHS ratings
          </a>{" "}
          and{" "}
          <a href="https://www.nhtsa.gov/ratings" rel="noreferrer">
            NHTSA&apos;s 5-star ratings
          </a>
          .
        </li>
        <li>
          Older model years usually cost less to insure, and trims differ. The What-if page lets you pick the exact year
          and version. The typical price starts from a car about 8 to 12 years old, so a new car costs more to replace.
        </li>
      </ul>
      <p>
        <VehicleFixLink carName={`${year} ${page.shortName}`} shown={vehicleMatchWords(page.relativity)} />
      </p>
    </TrustArticle>
  )
}
