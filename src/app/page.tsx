import type { Metadata } from "next"
import Link from "next/link"
import { Calculator } from "@/components/calculator"
import { JsonLdScript } from "@/components/json-ld"
import { TrustStrip } from "@/components/trust-strip"
import { OpenBlender } from "@/components/charts/open-blender"
import { SOURCE_COUNT } from "@/lib/copy"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { carPages } from "@/lib/car-pages"
import { GUIDES } from "@/lib/guides"
import { STATES } from "@/lib/scenario"
import { homeJsonLd, pageMetadata } from "@/lib/site-meta"
import { statePath } from "@/lib/state-pages"

const DESCRIPTION = `What would a new car, a teen driver, or a move do to your car insurance? An estimate from ${SOURCE_COUNT} public sources. No ads, no account. Not a quote.`

export const metadata: Metadata = pageMetadata({
  title: "NotAQuote.FYI: car insurance what-ifs for families",
  absoluteTitle: true,
  description: DESCRIPTION,
  path: "/",
  image: null,
})

/**
 * A static page: share links keep their data after the "#", which never
 * reaches a server, and the page reads it in the browser. The words at the
 * top don't depend on anything saved, so they're in the page from the start.
 */
export default function HomePage() {
  const popularCars = carPages(SERVER_CATALOG).slice(0, 12)
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 lg:px-6">
      <JsonLdScript data={homeJsonLd(DESCRIPTION)} />
      <section className="grid items-start gap-8 pt-8 sm:pt-12 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="max-w-3xl">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-[2.6rem]">
            What would a new car, a teen driver, or a move do to your car insurance?
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
            Change one thing and see roughly what it does to your bill, worked out from {SOURCE_COUNT} public sources. No
            account, no ads, and nothing you type is sent to us.
          </p>
        </div>
        {/* Wide screens only: the method in one picture, in the space beside the question. */}
        <OpenBlender variant="compact" className="no-print hidden xl:grid" />
      </section>
      <TrustStrip />
      <Calculator />
      {/* Phones and tablets: a small link below the tool, so it never pushes the estimate down. */}
      <OpenBlender variant="thumbnail" className="no-print mt-8 xl:hidden" />
      <section aria-labelledby="browse-heading" className="mt-12 grid gap-8 border-t border-border/70 pt-8 text-sm">
        <div className="grid gap-2">
          <h2 id="browse-heading" className="text-lg font-semibold">
            Guides for families
          </h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {GUIDES.map((guide) => (
              <li key={guide.path}>
                <Link href={guide.path} className="font-medium">
                  {guide.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/guides" className="text-muted-foreground">
                All guides
              </Link>
            </li>
          </ul>
        </div>
        {popularCars.length > 0 ? (
          <div className="grid gap-2">
            <h2 className="text-lg font-semibold">
              <Link href="/cars" className="plain hover:underline">
                What popular cars cost to insure
              </Link>
            </h2>
            <p className="text-muted-foreground">
              Estimates from the Highway Loss Data Institute&apos;s insurance loss results, with model-year tables and teen-driver costs:
            </p>
            <ul className="flex flex-wrap gap-2">
              {popularCars.map((car) => (
                <li key={car.slug}>
                  <Link href={`/cars/${car.slug}`} className="chip plain">
                    {car.shortName}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/cars" className="chip plain font-medium">
                  All {carPages(SERVER_CATALOG).length} cars
                </Link>
              </li>
            </ul>
          </div>
        ) : null}
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold">
            <Link href="/states" className="plain hover:underline">
              Car insurance by state
            </Link>
          </h2>
          <p className="text-muted-foreground">
            Average full-coverage and liability-only prices (NAIC), minimum liability limits, and teen-driver estimates for
            all 50 states and DC:
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {STATES.map((state) => (
              <li key={state.code}>
                <Link href={statePath(state.code)}>{state.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
