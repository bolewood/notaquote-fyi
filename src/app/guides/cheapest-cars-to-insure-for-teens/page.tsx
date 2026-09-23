import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { JsonLdScript } from "@/components/json-ld"
import { TrustArticle } from "@/components/trust-article"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { claimsPhrase } from "@/lib/car-content"
import { carFigures, carPageFor, MODELS_ENABLED } from "@/lib/car-pages"
import { differenceWords, estimateDollars, signedDollars } from "@/lib/format"
import { nationalTeenCars, modelsWords, TEEN_CARS_GUIDE, TEEN_COST_GUIDE, teenCarsByGroup, teenCarsHref, teenCarsLead } from "@/lib/guides"
import { articleJsonLd, ENGINE_UPDATED, GUIDES_IMAGE, pageMetadata } from "@/lib/site-meta"
import { rankWords, SAME_ORDER_NOTE, tiedAtTop } from "@/lib/state-content"
import { stateFigures, statePath } from "@/lib/state-pages"
import { TEEN_LIST_YEAR, type TeenPriced } from "@/lib/teen-cars"

const GUIDE = TEEN_CARS_GUIDE

export const metadata: Metadata = pageMetadata({ title: GUIDE.title, description: GUIDE.description, path: GUIDE.path, type: "article", image: GUIDES_IMAGE })

function CarTable({ cars, caption }: { cars: readonly TeenPriced[]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="py-2 text-left text-sm text-muted-foreground">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">
              Car
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Added to your policy
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              On their own policy
            </th>
          </tr>
        </thead>
        <tbody>
          {cars.map((item) => {
            const page = carPageFor(SERVER_CATALOG, item.car.pick.make, item.car.pick.model)
            return (
              <tr key={item.car.label} className="border-b border-border/60">
                <th scope="row" className="py-2 pr-3 font-normal">
                  {item.car.pick.year} {page ? <Link href={`/cars/${page.slug}`}>{page.shortName}</Link> : item.car.model}
                </th>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{signedDollars(item.added.increase)} a year</td>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{estimateDollars(item.own.likely)} a year</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function TeenCarsGuide() {
  const all = nationalTeenCars(SERVER_CATALOG)
  const groups = teenCarsByGroup(SERVER_CATALOG)
  const tied = tiedAtTop(all) >= 3
  const cheapest = all[0]
  const priciest = all.at(-1)!
  const cheapestPage = carPageFor(SERVER_CATALOG, cheapest.car.pick.make, cheapest.car.pick.model)
  const priciestPage = carPageFor(SERVER_CATALOG, priciest.car.pick.make, priciest.car.pick.model)
  const cheapFigures = !tied && cheapestPage ? carFigures(SERVER_CATALOG, cheapestPage.slug) : null
  const priceyFigures = !tied && priciestPage ? carFigures(SERVER_CATALOG, priciestPage.slug) : null
  const low = stateFigures(SERVER_CATALOG, "OH")
  const high = stateFigures(SERVER_CATALOG, "FL")
  const top5 = all.slice(0, 5)

  return (
    <TrustArticle
      title={GUIDE.title}
      lead={teenCarsLead(SERVER_CATALOG)}
      breadcrumbs={
        <Breadcrumbs
          crumbs={[
            { name: "Home", path: "/" },
            { name: "Guides", path: "/guides" },
            { name: "Cheapest cars for a teen", path: GUIDE.path },
          ]}
        />
      }
    >
      <JsonLdScript
        data={articleJsonLd({ title: GUIDE.title, description: GUIDE.description, path: GUIDE.path, dateModified: ENGINE_UPDATED, datePublished: GUIDE.published })}
      />

      <p>
        These are {TEEN_LIST_YEAR} models, about the age of a typical first car, from the site&apos;s lists of popular first
        cars, SUVs, and trucks, for a new 16-year-old joining a 40–64-year-old parent&apos;s policy with full coverage, at the
        national typical price. Your state moves every figure up or down by the same share.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href={teenCarsHref(top5)} className="btn btn-primary plain">
          Compare the five cheapest for your teen <ArrowRight className="size-4" aria-hidden="true" />
        </a>
        <Link href="/states" className="btn plain">
          Pick your state
        </Link>
      </div>

      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`list-${group.id}`}>
          <h2 id={`list-${group.id}`}>{group.label}</h2>
          <CarTable cars={group.cars} caption={`${group.label}, cheapest to add a teen with first. National figures.`} />
        </section>
      ))}
      <p className="text-sm text-muted-foreground">
        &ldquo;Added to your policy&rdquo; is how much the household&apos;s bill goes up a year with the teen driving that
        car. &ldquo;On their own policy&rdquo; is the teen&apos;s whole bill if they had one.
      </p>

      <h2 id="why">Why some cars cost less</h2>
      <p>
        Insurers pay out more for some cars than others. The Highway Loss Data Institute publishes how each model&apos;s
        claims compare with the average car&apos;s: what it costs to fix the car after a crash, and how often its drivers
        damage other cars or hurt someone.
      </p>
      {cheapFigures && priceyFigures ? (
        <>
          <ul className="bullets">
            <li>
              <strong>
                <Link href={`/cars/${cheapFigures.page.slug}`}>{cheapFigures.page.shortName}</Link>
              </strong>
              : repairs after a crash {claimsPhrase(cheapFigures.claims.repairs)}; damage its drivers do to other cars{" "}
              {claimsPhrase(cheapFigures.claims.damageToOthers)}; injuries they cause {claimsPhrase(cheapFigures.claims.injuriesToOthers)}.
            </li>
            <li>
              <strong>
                <Link href={`/cars/${priceyFigures.page.slug}`}>{priceyFigures.page.shortName}</Link>
              </strong>
              : repairs after a crash {claimsPhrase(priceyFigures.claims.repairs)}; damage its drivers do to other cars{" "}
              {claimsPhrase(priceyFigures.claims.damageToOthers)}; injuries they cause {claimsPhrase(priceyFigures.claims.injuriesToOthers)}.
            </li>
          </ul>
          <p>
            On these lists, {modelsWords(all.slice(0, 3))} cost the least to add a teen with, and {modelsWords(all.slice(-3))}{" "}
            the most. A newer car also costs more to replace, so an older version of the same model usually costs less.
          </p>
        </>
      ) : (
        <p>
          We don&apos;t have claims results for each model right now, so every car here is priced as an average car of its
          kind (small SUV, midsize car, and so on), and cars of the same kind tie. A newer car still costs more to replace
          than an older one.
        </p>
      )}

      <h2 id="every-state">The same order in every state</h2>
      <p className="font-medium">{SAME_ORDER_NOTE}</p>
      <p>
        With {tied ? "the cheapest cars" : `the ${cheapest.car.label}`}, adding a teen costs about {differenceWords(low.teenCars[0].added.increase)} in{" "}
        <Link href={statePath("OH")}>Ohio</Link>, one of the cheaper states, and about{" "}
        {differenceWords(high.teenCars[0].added.increase)} in <Link href={statePath("FL")}>Florida</Link>, {rankWords(high)}.{" "}
        <Link href="/states">Your state&apos;s page</Link> has its own figures, its minimum coverage, and its neighbors.
      </p>

      <h2 id="added-or-own">Added to your policy, or their own?</h2>
      <p>
        Many families add a new driver to the policy they already have. The household&apos;s bill goes up, but by much less
        than the teen would pay alone: with the {cheapest.car.model}, about {differenceWords(cheapest.added.increase)}{" "}
        added, against about {estimateDollars(cheapest.own.likely)} a year on their own policy.{" "}
        <Link href={TEEN_COST_GUIDE.path}>What adding a teen driver costs, state by state</Link>.
      </p>

      <h2 id="not-covered">What this doesn&apos;t cover</h2>
      <ul className="bullets">
        <li>
          <strong>Safety.</strong> A cheap car to insure isn&apos;t automatically a safe one. For crash tests and safety
          features, see the{" "}
          <a href="https://www.iihs.org/ratings" rel="noreferrer">
            Insurance Institute for Highway Safety&apos;s ratings
          </a>{" "}
          and{" "}
          <a href="https://www.nhtsa.gov/ratings" rel="noreferrer">
            NHTSA&apos;s 5-star ratings
          </a>
          . IIHS also publishes a list of safer used cars for teens.
        </li>
        <li>
          <strong>The car&apos;s price, reliability, and fuel.</strong> Insurance is one cost of owning a car, not the only
          one.
        </li>
        <li>
          <strong>Your family.</strong> Your record, your address, your insurer, and discounts like good grades change real
          prices. Our figure for adding a teen comes from one state&apos;s published prices, so its range is wide.
        </li>
      </ul>

      <div className="flex flex-wrap gap-3 pt-2">
        <a href={teenCarsHref(top5)} className="btn btn-primary plain">
          Compare the five cheapest for your teen <ArrowRight className="size-4" aria-hidden="true" />
        </a>
        {MODELS_ENABLED ? (
          <Link href="/cars" className="btn plain">
            Look up another car
          </Link>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Compare shows them for a new 16-year-old in your own state; nothing on your list changes until you choose.{" "}
        <Link href="/methodology#car-pages">Here&apos;s how we got these numbers</Link>.
      </p>
    </TrustArticle>
  )
}
