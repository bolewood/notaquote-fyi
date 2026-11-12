import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CarHeroPhoto, CarThumb, GenerationPhoto, PhotoCreditsNote } from "@/components/car-photo"
import { HldiChip, HldiLegend } from "@/components/charts/hldi-chip"
import { averageBandNote, OLDER_REPORTS } from "@/lib/hldi"
import { VehicleFixLink } from "@/components/how-we-got-this"
import { JsonLdScript } from "@/components/json-ld"
import { TrustArticle } from "@/components/trust-article"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { carContent, noindexCarSlugs } from "@/lib/car-content"
import { carFigures, carPageBySlug, carPages } from "@/lib/car-pages"
import { carGenerations, type CarGeneration } from "@/lib/car-generations"
import { carPhoto } from "@/lib/car-photos"
import { estimateDollars, longDate } from "@/lib/format"
import { vehicleMatchWords } from "@/lib/pricing"
import { DEFAULT_SCENARIO } from "@/lib/scenario"
import { encodeSharePath } from "@/lib/share-link"
import { CAR_PAGES_UPDATED, pageMetadata, webPageJsonLd } from "@/lib/site-meta"
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
    title: content.searchTitle,
    description: content.description,
    path: `/cars/${f.page.slug}`,
    image: null,
    noindex: noindexCarSlugs(SERVER_CATALOG).has(f.page.slug),
  })
}

/** The photo for a similar car's page year. */
function similarPhoto(slug: string) {
  const page = carPageBySlug(SERVER_CATALOG, slug)
  return page ? carPhoto(slug, page.pick.year) : null
}

/** "$1,390–$1,470", or "$1,930" when both ends round to the same figure. */
function spanDollars(span: { low: number; high: number }): string {
  const low = estimateDollars(span.low)
  const high = estimateDollars(span.high)
  return low === high ? low : `${low}–${high}`
}

/** "2008–2012", "2020–present", or one year. */
function yearSpan(from: number, to: number | null): string {
  return to === from ? `${from}` : `${from}–${to ?? "present"}`
}

/** "2025 and 2026" or "2025, 2026 and 2027": years in a sentence. */
function yearWords(years: number[]): string {
  return years.length < 2 ? String(years[0] ?? "") : `${years.slice(0, -1).join(", ")} and ${years.at(-1)}`
}

/**
 * Every US generation of the car the catalog covers, newest first, each with its model years, photo and
 * what those years cost to insure for the page's example driver (one row per model year).
 */
function Generations({ generations, carName }: { generations: CarGeneration[]; carName: string }) {
  const newestFirst = [...generations].reverse()
  const oldest = generations[0]
  // "Where our data starts" only when the oldest generation began before the catalog does.
  const catalogStart = oldest.firstListed > oldest.from ? oldest.firstListed : null
  const borrowed = generations.flatMap((g) => g.years.filter((row) => row.borrowed).map((row) => row.year))
  return (
    <>
      <h2 id="generations">{carName} by generation</h2>
      <p data-shared="">
        {catalogStart
          ? `Each generation sold in the US since ${catalogStart}, where our data starts, and what its model years cost to insure.`
          : "Each generation sold in the US, and what its model years cost to insure."}{" "}
        It&apos;s the same driver as above: a 45-year-old with a clean record and full coverage, at the national typical price. Each model
        year uses the HLDI report that covers it. {OLDER_REPORTS}
      </p>
      <ol className="grid gap-5" data-testid="car-generations">
        {newestFirst.map((g) => {
          const years = yearSpan(g.from, g.to)
          const label = `${years} ${carName}${g.name ? `, ${g.name.charAt(0).toLowerCase()}${g.name.slice(1)}` : ""}`
          return (
            <li key={g.id} className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-x-4 gap-y-1 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <GenerationPhoto photo={g.photo} alt={label} />
              <div className="grid gap-1">
                <h3 className="!mt-0 grid text-base font-semibold">
                  <span>
                    {years} {carName}
                  </span>
                  {g.name ? <span className="text-sm font-normal text-muted-foreground">{g.name}</span> : null}
                </h3>
                <p className="text-sm">
                  {g.adult && g.teen ? (
                    <>
                      About <span className="money font-semibold">{spanDollars(g.adult)}</span> a year; adding a 16-year-old,{" "}
                      <span className="money font-semibold">{spanDollars(g.teen)}</span> more.
                    </>
                  ) : null}
                  {g.firstListed > g.from ? (
                    <span className="text-muted-foreground"> Our data starts with the {g.firstListed} model year.</span>
                  ) : null}
                  {g.missing.length > 0 ? (
                    <span className="text-muted-foreground">
                      {" "}
                      HLDI has no results of its own for the {yearWords(g.missing)} {carName}, so we don&apos;t price{" "}
                      {g.missing.length === 1 ? "it" : "them"} here.
                    </span>
                  ) : null}
                </p>
              </div>
              {g.years.length > 0 ? (
                <details className="col-span-2 text-sm sm:col-span-1 sm:col-start-2">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Each model year</summary>
                  <table className="mt-2 w-full max-w-sm border-collapse text-left">
                    <thead data-shared="">
                      <tr className="border-b border-border text-muted-foreground">
                        <th scope="col" className="py-1.5 pr-3 font-medium">
                          Model year
                        </th>
                        <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                          A year
                        </th>
                        <th scope="col" className="py-1.5 text-right font-medium">
                          Adding a teen
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.years.map((row) => (
                        <tr key={row.year} className="border-b border-border/60 last:border-b-0">
                          <th scope="row" className="py-1.5 pr-3 font-normal">
                            {row.year} {carName}
                            {row.borrowed ? " *" : ""}
                          </th>
                          <td className="money py-1.5 pr-3 text-right">{estimateDollars(row.adult)}</td>
                          <td className="money py-1.5 text-right">+{estimateDollars(row.teen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ) : null}
            </li>
          )
        })}
      </ol>
      <p className="text-sm text-muted-foreground">
        {borrowed.length > 0
          ? `* HLDI hasn't published results for the ${yearWords(borrowed)} ${carName} yet, so ${borrowed.length === 1 ? "that year uses" : "those years use"} its newest results for this car. `
          : ""}
        <span data-shared="">
          Generations and their US model years are from Wikipedia. <Link href="/photo-credits">Photo credits</Link>.
        </span>
      </p>
    </>
  )
}

function SimilarList({
  cars,
  thisPhoto,
}: {
  cars: readonly { slug: string | null; name: string; price: string }[]
  thisPhoto: ReturnType<typeof carPhoto>
}) {
  return (
    <ul className="divide-y divide-border/70 border-y border-border/70">
      {cars.map((car) =>
        car.slug ? (
          <li key={car.slug}>
            <Link
              href={`/cars/${car.slug}`}
              className="plain flex min-h-11 flex-wrap items-center justify-between gap-x-4 py-2 hover:text-primary"
            >
              <span className="flex items-center gap-3">
                <CarThumb photo={similarPhoto(car.slug)} className="w-14" />
                <span className="link">{car.name}</span>
              </span>
              <span className="money text-sm text-muted-foreground">{car.price}</span>
            </Link>
          </li>
        ) : (
          <li
            key="this-car"
            aria-current="page"
            className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 py-2 font-semibold"
          >
            <span className="flex items-center gap-3">
              <CarThumb photo={thisPhoto} className="w-14" />
              <span>{car.name}</span>
            </span>
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
  const photo = carPhoto(page.slug, page.pick.year)
  const generations = carGenerations(SERVER_CATALOG, f)
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
      <JsonLdScript
        data={webPageJsonLd({
          title: c.title,
          description: c.description,
          path: `/cars/${page.slug}`,
          dateModified: CAR_PAGES_UPDATED,
        })}
      />
      <div className="grid gap-1 rounded-2xl bg-card p-5 ring-1 ring-border" data-testid="car-estimate">
        <p className="text-sm font-medium text-muted-foreground">{c.estimateLabel}</p>
        <p>
          <span className="money text-3xl font-semibold">{c.estimate}</span> <span className="text-muted-foreground">{c.monthly}</span>
        </p>
        <p className="money text-sm text-muted-foreground">{c.range}</p>
        <p className="text-sm text-muted-foreground">{c.averageLine}</p>
      </div>
      {photo ? <CarHeroPhoto photo={photo} carName={page.shortName} /> : null}
      <p className="text-sm text-muted-foreground">
        {c.about} <span data-shared="">{c.driverNote}</span> <Link href="/states">{c.stateLine}</Link>
      </p>

      <h2 id="why">{c.whyHeading}</h2>
      {c.hldi ? (
        <>
          <h3 data-shared="">{c.hldi.heading}</h3>
          <p>{c.hldi.intro}</p>
          <ul className="grid gap-0 rounded-2xl bg-card px-5 py-2 text-sm ring-1 ring-border" data-testid="car-hldi">
            {c.hldi.rows.map((row) => (
              <li
                key={row.name}
                className="grid gap-x-4 gap-y-0.5 border-b border-border/70 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <span className="min-w-0">
                  <span className="font-medium" data-shared="">
                    {row.name}
                  </span>
                  <span className="block text-xs text-muted-foreground" data-shared="">
                    {row.helper}
                  </span>
                </span>
                <span className="grid content-start justify-items-start gap-0.5 sm:justify-items-end sm:text-right">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:justify-end">
                    <HldiChip level={row.rating} />
                    <span className="text-xs text-muted-foreground">{row.percent}</span>
                  </span>
                  {row.peers ? <span className="block text-xs text-muted-foreground">{row.peers}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <div data-shared="" className="grid gap-1">
            <HldiLegend />
            <p className="text-xs text-muted-foreground" data-testid="average-band-note">
              {averageBandNote()}
            </p>
          </div>
          {c.hldi.missing ? <p className="text-sm text-muted-foreground">{c.hldi.missing}</p> : null}
          <p className="text-sm text-muted-foreground" data-shared="">
            {c.hldi.factors}
          </p>
          <p className="text-sm text-muted-foreground" data-shared="">
            {c.hldi.url ? (
              <a href={c.hldi.url} rel="noreferrer">
                {c.hldi.source}
              </a>
            ) : (
              c.hldi.source
            )}
            .
          </p>
        </>
      ) : null}
      {c.price ? (
        <>
          <h3 data-shared="">{c.price.heading}</h3>
          <p data-testid="car-price-meaning">
            <span data-shared="">{c.price.shared}</span> {c.price.text}
          </p>
          <p className="text-sm" data-shared="">
            <Link href="/methodology#why-percentages-differ">How the math works</Link>
          </p>
        </>
      ) : null}
      <p>{c.kind}</p>
      {c.notes.length > 0 ? (
        <ul className="bullets">
          {c.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted-foreground">{c.source}</p>

      {c.years.length > 1 ? <h2 id="years">{c.yearsHeading}</h2> : null}
      {c.years.length > 1 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="py-2 text-left text-sm text-muted-foreground" data-shared="">
              {c.yearsCaption}
            </caption>
            <thead data-shared="">
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
                    <span className="flex items-center gap-3">
                      <CarThumb photo={carPhoto(page.slug, Number(row.year))} />
                      <span>
                        {row.year} {row.trim} <span className="text-muted-foreground">({row.age})</span>
                      </span>
                    </span>
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
      {c.years.length > 1 ? (
        <p className="text-sm text-muted-foreground">
          {c.yearsNote}{" "}
          <span data-shared="">
            {OLDER_REPORTS} Each photo shows that year&apos;s generation of the car. <Link href="/photo-credits">Photo credits</Link>.
          </span>
        </p>
      ) : null}
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

      {generations.length > 0 ? <Generations generations={generations} carName={page.shortName} /> : null}

      <h2 id="teen">{c.teenHeading}</h2>
      <p>{c.teen}</p>
      <p>{c.teenRank}</p>
      <p className="text-sm text-muted-foreground" data-shared="">
        {c.teenNote} <Link href="/guides/cheapest-cars-to-insure-for-teens">Cheapest cars to insure for a teen</Link>.
      </p>

      {c.similar.length > 1 ? (
        <>
          <h2 id="similar">{c.similarHeading}</h2>
          {c.groupRank ? <p>{c.groupRank}</p> : null}
          <SimilarList cars={c.similar} thisPhoto={photo} />
          <PhotoCreditsNote />
        </>
      ) : null}

      <h2 id="by-state">{c.statesHeading}</h2>
      <p>{c.statesSummary}</p>
      <ul className="divide-y divide-border/70 border-y border-border/70 text-sm">
        {c.states.map((row) => (
          <li key={row.path} className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 py-1.5">
            <span>
              <Link href={row.path}>{row.name}</Link>
            </span>
            <span className="money text-muted-foreground tabular-nums">
              {row.adult}/yr · {row.teen} teen
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground" data-shared="">
        <Link href="/states">All 50 states and DC</Link> · Updated <time dateTime={CAR_PAGES_UPDATED}>{longDate(CAR_PAGES_UPDATED)}</time>.
      </p>

      <div className="flex flex-wrap gap-3 pt-2" data-shared="">
        <a href={whatIfHref} className="btn btn-primary plain">
          What if you bought this car? <ArrowRight className="size-4" aria-hidden="true" />
        </a>
        <a href={compareHref} className="btn plain">
          Add it to a comparison
        </a>
      </div>
      <p className="text-sm text-muted-foreground" data-shared="">
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
      <p data-shared="">
        <VehicleFixLink carName={page.name} shown={vehicleMatchWords(page.relativity)} />
      </p>
    </TrustArticle>
  )
}
