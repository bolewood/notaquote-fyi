import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { JsonLdScript } from "@/components/json-ld"
import { StateNoteBody } from "@/components/state-rules-table"
import { TrustArticle } from "@/components/trust-article"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { carPageFor } from "@/lib/car-pages"
import { differenceWords, dollars, estimateDollars, longDate, monthlyDollars, signedDollars } from "@/lib/format"
import { faqJsonLd, pageMetadata } from "@/lib/site-meta"
import {
  faqHeading,
  faultText,
  featuredCarsHeading,
  featuredCarsSummary,
  leadText,
  liabilityOnlyText,
  minimumsHeading,
  minimumsOverviewText,
  moveWords,
  neighborsHeading,
  neighborsSummary,
  ownPolicyParagraph,
  priceParagraph,
  SAME_ORDER_NOTE,
  shortName,
  stateDescription,
  stateFaqs,
  stateHeading,
  stateTitle,
  teenCallout,
  teenCarsSummary,
  teenHeading,
  typicalAttributionText,
  typicalPriceHeading,
} from "@/lib/state-content"
import { inSentence, STATE_SLUGS, stateBySlug, stateFigures, statePath, TEEN_TOP } from "@/lib/state-pages"
import { STATE_BASELINE_SOURCES } from "@/lib/state-baselines"
import { flagCell, noFaultCell, type StateRule } from "@/lib/state-rules"
import type { StateSurveySection } from "@/lib/state-surveys"
import { TEEN_LIST_YEAR } from "@/lib/teen-cars"

/** Only the 50 states and DC; anything else is a 404. */
export const dynamicParams = false

export function generateStaticParams() {
  return STATE_SLUGS.map((item) => ({ state: item.slug }))
}

function figuresFor(slug: string) {
  const code = stateBySlug(slug)
  return code ? stateFigures(SERVER_CATALOG, code) : null
}

export async function generateMetadata({ params }: PageProps<"/states/[state]">): Promise<Metadata> {
  const f = figuresFor((await params).state)
  if (!f) return {}
  return pageMetadata({ title: stateTitle(f), description: stateDescription(f), path: statePath(f.code), image: null })
}

function limits(rule: StateRule): string {
  if (rule.sourceUrl === null) return "Not checked yet"
  if (rule.biPerPerson === null && rule.biPerAccident === null && rule.pd === null) {
    return rule.combinedSingleLimit === null ? "None set" : `${dollars(rule.combinedSingleLimit)} combined`
  }
  const one = (amount: number | null) => (amount === null ? "none" : dollars(amount))
  return `${one(rule.biPerPerson)} / ${one(rule.biPerAccident)} / ${one(rule.pd)}`
}

const NAIC = STATE_BASELINE_SOURCES.find((source) => source.id === "naic-auto-db-2022-2023")

function SurveySection({ survey }: { survey: StateSurveySection }) {
  if (survey.kind === "rate-survey") {
    return (
      <>
        <h2 id="state-survey">{survey.heading}</h2>
        <p>{survey.intro}</p>
        {survey.profiles.map((profile) => (
          <div key={profile.profileId} className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="py-2 text-left text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{profile.shortLabel}:</span> {profile.profileDescription}
              </caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Location
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Companies
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Median yearly rate
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Lowest–highest company
                  </th>
                </tr>
              </thead>
              <tbody>
                {profile.places.map((row) => (
                  <tr key={row.territory} className="border-b border-border/60">
                    <th scope="row" className="py-2 pr-3 font-normal">
                      {row.place}
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums">{row.carrierCount}</td>
                    <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap tabular-nums">
                      {dollars(row.median)}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                      {dollars(row.low)}–{dollars(row.high)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          {survey.caveat} Source:{" "}
          <a href={survey.url} rel="noreferrer">
            {survey.publisher}, {survey.title}
          </a>{" "}
          ({survey.effectiveNote}; checked {longDate(survey.checkedOn)}).
        </p>
      </>
    )
  }

  return (
    <>
      <h2 id="state-survey">{survey.heading}</h2>
      <p>{survey.intro}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="py-2 text-left text-sm text-muted-foreground">
            Statutory insurance points and 3-year rate surcharges under the North Carolina Safe Driver Incentive Plan.
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                Points
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Rate increase
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Examples of convictions and at-fault crashes
              </th>
            </tr>
          </thead>
          <tbody>
            {survey.rows.map((row) => (
              <tr key={row.points} className="border-b border-border/60 align-top">
                <th scope="row" className="py-2 pr-3 font-semibold whitespace-nowrap tabular-nums">
                  {row.points} {row.points === 1 ? "point" : "points"}
                </th>
                <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap tabular-nums">
                  +{row.surchargePercent}%
                </td>
                <td className="py-2 pr-3">{row.whatCounts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        {survey.caveat} Source:{" "}
        <a href={survey.url} rel="noreferrer">
          {survey.publisher}, {survey.title}
        </a>{" "}
        (checked {longDate(survey.checkedOn)}).
      </p>
    </>
  )
}

export default async function StatePage({ params }: PageProps<"/states/[state]">) {
  const f = figuresFor((await params).state)
  if (!f) notFound()
  const name = inSentence(f.code)
  const short = shortName(f.code)
  const top = f.teenCars.slice(0, TEEN_TOP)
  const fault = faultText(f)
  const faqs = stateFaqs(f)

  return (
    <TrustArticle
      title={stateHeading(f)}
      lead={leadText(f)}
      breadcrumbs={
        <Breadcrumbs
          crumbs={[
            { name: "Home", path: "/" },
            { name: "States", path: "/states" },
            { name: f.name, path: statePath(f.code) },
          ]}
        />
      }
    >
      <JsonLdScript data={faqJsonLd(faqs)} />

      <nav aria-label="On this page" className="flex flex-wrap gap-2 text-sm">
        <a href="#typical-price" className="chip plain">
          {short} average
        </a>
        {f.survey ? (
          <a href="#state-survey" className="chip plain">
            {f.survey.kind === "rate-survey" ? `${short} sample rates` : `${short} insurance points`}
          </a>
        ) : null}
        <a href="#neighbors" className="chip plain">
          Neighboring states
        </a>
        <a href="#minimums" className="chip plain">
          {short} minimums
        </a>
        <a href="#teen" className="chip plain">
          Teen drivers in {short}
        </a>
        <a href="#faq" className="chip plain">
          {short} FAQ
        </a>
      </nav>

      <h2 id="typical-price">{typicalPriceHeading(f)}</h2>
      <div className="grid gap-1 rounded-2xl bg-card p-5 ring-1 ring-border" data-testid="state-typical">
        <p className="text-sm font-medium text-muted-foreground">Typical {short} full-coverage price today</p>
        <p>
          <span className="money text-3xl font-semibold">about {estimateDollars(f.start.annual)}</span>{" "}
          <span className="text-muted-foreground">a year in {short} (about {monthlyDollars(f.start.annual)} a month)</span>
        </p>
        <p className="text-sm text-muted-foreground">{typicalAttributionText(f)}</p>
      </div>
      <p>{priceParagraph(f)}</p>

      {f.survey ? <SurveySection survey={f.survey} /> : null}

      <h2 id="neighbors">{neighborsHeading(f)}</h2>
      <p>{neighborsSummary(f)}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="py-2 text-left text-sm text-muted-foreground">
            {f.baseline.dataYear} NAIC full-coverage average in {name} and bordering states, plus the estimated change when moving a sample 2020 Camry policy to {short}.
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                State
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                {f.baseline.dataYear} average
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Moving to {short} from there
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/60">
              <th scope="row" className="py-2 pr-3 font-semibold">
                {f.name}
              </th>
              <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap tabular-nums">{dollars(f.baseline.annual)}</td>
              <td className="py-2 pr-3 text-right text-muted-foreground"><span aria-hidden="true">·</span><span className="sr-only">Current state ({short})</span></td>
            </tr>
            {f.neighbors.map((row) => (
              <tr key={row.code} className="border-b border-border/60">
                <th scope="row" className="py-2 pr-3 font-normal">
                  <Link href={statePath(row.code)}>{row.name}</Link>
                </th>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{dollars(row.baseline.annual)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{moveWords(row.move.delta, row.move.current.likely)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-2 pr-3 font-normal text-muted-foreground">
                US average
              </th>
              <td className="py-2 pr-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">{dollars(f.national.annual)}</td>
              <td className="py-2 pr-3 text-right text-muted-foreground"><span aria-hidden="true">·</span><span className="sr-only">US benchmark</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      {f.similarPriceStates.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          States with similar {f.baseline.dataYear} full-coverage averages:{" "}
          {f.similarPriceStates.map((row, idx) => (
            <span key={row.code}>
              {idx > 0 ? (idx === f.similarPriceStates.length - 1 ? ", and " : ", ") : ""}
              <Link href={statePath(row.code)}>{row.name}</Link> ({dollars(row.baseline.annual)} in {f.baseline.dataYear}, about{" "}
              {estimateDollars(row.startAnnual)} today)
            </span>
          ))}
          .
        </p>
      ) : null}

      <h2 id="minimums">{minimumsHeading(f)}</h2>
      {f.rule ? (
        <>
          <dl className="grid gap-x-6 gap-y-1 rounded-2xl bg-card p-5 text-sm ring-1 ring-border sm:grid-cols-[auto_1fr]">
            <dt className="font-medium">{short} liability (per person / per crash / property)</dt>
            <dd className="money">{limits(f.rule)}</dd>
            <dt className="font-medium">Personal injury protection (PIP) in {short}</dt>
            <dd>{flagCell(f.rule.pipRequired)}</dd>
            <dt className="font-medium">Medical payments in {short}</dt>
            <dd>{flagCell(f.rule.medPayRequired)}</dd>
            <dt className="font-medium">No-fault system in {short}</dt>
            <dd>{noFaultCell(f.rule.noFault)}</dd>
            <dt className="font-medium">Uninsured motorist in {short}</dt>
            <dd>{flagCell(f.rule.umRequired)}</dd>
            <dt className="font-medium">Underinsured motorist in {short}</dt>
            <dd>{flagCell(f.rule.uimRequired)}</dd>
          </dl>
          <p>{minimumsOverviewText(f)}</p>
          {fault ? <p>{fault}</p> : null}
          <p>{liabilityOnlyText(f)}</p>
          <StateNoteBody rule={f.rule} />
        </>
      ) : (
        <p>We haven&rsquo;t checked this state&apos;s minimums yet.</p>
      )}

      <h2 id="teen">{teenHeading(f)}</h2>
      <div className="grid gap-1 rounded-2xl bg-sun-soft p-5" data-testid="state-teen">
        <p className="text-sm font-medium text-sun-ink">Adding a 16-year-old to a {short} policy</p>
        <p>
          <span className="money text-3xl font-semibold">about {differenceWords(f.teen.added.increase)}</span>
        </p>
        <p className="text-sm">{teenCallout(f)}</p>
      </div>
      <p>{ownPolicyParagraph(f)}</p>
      <p className="text-sm text-muted-foreground">
        Our teen-driver multipliers come from California&apos;s published age-rating filings scaled to {name}&apos;s baseline.{" "}
        <Link href="/guides/adding-a-teen-driver">How adding a teen driver works</Link>.
      </p>

      <div className="flex flex-wrap gap-3 pt-1">
        <a href={f.compareHref} className="btn btn-primary plain">
          Compare teen cars in {short} <ArrowRight className="size-4" aria-hidden="true" />
        </a>
        <a href={f.whatIfHref} className="btn plain">
          Price your own car in {short}
        </a>
      </div>

      <h3 id="teen-cars">Cheapest cars to add a teen with in {name}</h3>
      <p>{teenCarsSummary(f)}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="py-2 text-left text-sm text-muted-foreground">
            The {TEEN_TOP} lowest-cost {TEEN_LIST_YEAR} models for adding a 16-year-old in {name}.
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                {TEEN_LIST_YEAR} model
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Added to a {short} policy
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Own {short} policy
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((item) => {
              const page = carPageFor(SERVER_CATALOG, item.car.pick.make, item.car.pick.model)
              return (
                <tr key={item.car.label} className="border-b border-border/60">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    {item.car.pick.year}{" "}
                    {page ? <Link href={`/cars/${page.slug}`}>{page.shortName}</Link> : item.car.model}
                  </th>
                  <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{signedDollars(item.added.increase)} in {short}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{estimateDollars(item.own.likely)} in {short}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        {SAME_ORDER_NOTE} <Link href="/guides/cheapest-cars-to-insure-for-teens">See all 33 teen cars and how we rank them</Link>.
      </p>

      {f.featuredCars.length > 0 ? (
        <>
          <h2 id="popular-cars">{featuredCarsHeading(f)}</h2>
          <p>{featuredCarsSummary(f)}</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="py-2 text-left text-sm text-muted-foreground">
                Estimated yearly full-coverage cost in {name} for a 45-year-old driver and for adding a 16-year-old teen.
              </caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Car
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    45-year-old in {short}
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Adding a teen in {short}
                  </th>
                </tr>
              </thead>
              <tbody>
                {f.featuredCars.map((car) => (
                  <tr key={car.slug} className="border-b border-border/60">
                    <th scope="row" className="py-2 pr-3 font-normal">
                      <Link href={`/cars/${car.slug}`}>{car.name}</Link>
                    </th>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                      about {estimateDollars(car.adultLikely)} a year
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                      {signedDollars(car.teenIncrease)} a year
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href="/cars">See all 121 popular cars, SUVs, pickups, and EVs</Link>.
          </p>
        </>
      ) : null}

      <h2 id="faq">{faqHeading(f)}</h2>
      <dl className="grid gap-5">
        {faqs.map((item) => (
          <div key={item.question} className="grid gap-1.5">
            <dt className="font-semibold text-foreground">{item.question}</dt>
            <dd className="text-muted-foreground">{item.answer}</dd>
          </div>
        ))}
      </dl>

      <h2 id="sources">Sources for {name}</h2>
      <ul className="bullets">
        <li>
          {short} average premiums ({dollars(f.baseline.annual)} full coverage, {dollars(f.baseline.liabilityOnly)} liability-only,{" "}
          {dollars(f.baseline.averageExpenditure)} average expenditure):{" "}
          {NAIC ? (
            <a href={NAIC.url} rel="noreferrer">
              {NAIC.publisher}, {NAIC.name}
            </a>
          ) : (
            "NAIC"
          )}{" "}
          ({f.baseline.dataYear} data, trended to today with the BLS CPI motor-vehicle insurance series).
        </li>
        {f.survey ? (
          <li>
            {short} {f.survey.kind === "rate-survey" ? "sample rate survey" : "SDIP surcharge schedule"}:{" "}
            <a href={f.survey.url} rel="noreferrer">
              {f.survey.publisher}, {f.survey.title}
            </a>{" "}
            (checked {longDate(f.survey.checkedOn)}).
          </li>
        ) : null}
        {f.rule ? (
          <li>
            {short} minimum coverage statutes ({f.rule.sources.map((s) => s.label).join("; ")}), checked{" "}
            {f.rule.checkedOn ? longDate(f.rule.checkedOn) : "recently"}. See <Link href="/methodology">methodology</Link> and{" "}
            <Link href="/sources">all sources</Link>.
          </li>
        ) : null}
      </ul>
    </TrustArticle>
  )
}
