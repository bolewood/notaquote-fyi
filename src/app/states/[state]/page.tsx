import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { StateNoteBody } from "@/components/state-rules-table"
import { TrustArticle } from "@/components/trust-article"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { carPageFor } from "@/lib/car-pages"
import { differenceWords, dollars, estimateDollars, monthlyDollars, rangeWords, signedDollars } from "@/lib/format"
import { pageMetadata } from "@/lib/site-meta"
import {
  faultText,
  leadText,
  liabilityParagraph,
  moveWords,
  neighborsSummary,
  ownPolicyParagraph,
  priceParagraph,
  SAME_ORDER_NOTE,
  stateDescription,
  stateTitle,
  teenCarsSummary,
  teenParagraph,
} from "@/lib/state-content"
import { inSentence, STATE_SLUGS, stateBySlug, stateFigures, statePath, TEEN_TOP } from "@/lib/state-pages"
import { STATE_BASELINE_SOURCES } from "@/lib/state-baselines"
import { flagCell, noFaultCell, type StateRule } from "@/lib/state-rules"
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
  return pageMetadata({ title: stateTitle(f), description: stateDescription(f), path: statePath(f.code) })
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

export default async function StatePage({ params }: PageProps<"/states/[state]">) {
  const f = figuresFor((await params).state)
  if (!f) notFound()
  const name = inSentence(f.code)
  const top = f.teenCars.slice(0, TEEN_TOP)
  const fault = faultText(f)
  const neighborWord = f.bordering ? "neighbors" : "a nearby state"

  return (
    <TrustArticle
      title={`Car insurance in ${name}`}
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
      <nav aria-label="On this page" className="flex flex-wrap gap-2 text-sm">
        <a href="#typical-price" className="chip plain">
          Typical price
        </a>
        <a href="#neighbors" className="chip plain">
          Next door
        </a>
        <a href="#minimums" className="chip plain">
          The law
        </a>
        <a href="#teen" className="chip plain">
          A new teen driver
        </a>
        <a href="#teen-cars" className="chip plain">
          Cars for a teen
        </a>
      </nav>

      <h2 id="typical-price">What people pay in {name}</h2>
      <div className="grid gap-1 rounded-2xl bg-card p-5 ring-1 ring-border" data-testid="state-typical">
        <p className="text-sm font-medium text-muted-foreground">A typical yearly price today</p>
        <p>
          <span className="money text-3xl font-semibold">about {estimateDollars(f.start.annual)}</span>{" "}
          <span className="text-muted-foreground">a year (about {monthlyDollars(f.start.annual)} a month)</span>
        </p>
        <p className="text-sm text-muted-foreground">{f.start.attribution}</p>
      </div>
      <p>{priceParagraph(f)}</p>
      <p>{liabilityParagraph(f)}</p>
      <p className="text-muted-foreground">
        It&apos;s an average across every kind of driver and car, not your price. Your car, your driving record, and how
        much coverage you carry move it up or down.
      </p>

      <h2 id="neighbors">{name} next to its {neighborWord}</h2>
      <p>{neighborsSummary(f)}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="py-2 text-left text-sm text-muted-foreground">
            Typical full-coverage price in 2023 (NAIC), and what moving to {name} from there might do today.
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                State
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Typical price, 2023
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Moving to {f.code === "DC" ? "DC" : f.name} from there
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/60">
              <th scope="row" className="py-2 pr-3 font-semibold">
                {f.name}
              </th>
              <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap tabular-nums">{dollars(f.baseline.annual)}</td>
              <td className="py-2 pr-3 text-right text-muted-foreground"><span aria-hidden="true">·</span><span className="sr-only">Not a move</span></td>
            </tr>
            {f.neighbors.map((row) => (
              <tr key={row.code} className="border-b border-border/60">
                <th scope="row" className="py-2 pr-3 font-normal">
                  <Link href={statePath(row.code)}>{row.name}</Link>
                </th>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{dollars(row.baseline.annual)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{moveWords(row.move.delta)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-2 pr-3 font-normal text-muted-foreground">
                National average
              </th>
              <td className="py-2 pr-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">{dollars(f.national.annual)}</td>
              <td className="py-2 pr-3 text-right text-muted-foreground"><span aria-hidden="true">·</span><span className="sr-only">Not a move</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        The move is the What-if page&apos;s starting example: a 40–64-year-old with a clean record and a 2020 Toyota Camry,
        full coverage, in the suburbs, with nothing else changed. Only the two states&apos; typical prices make the
        difference, so a real move can come out differently.
      </p>

      <h2 id="minimums">The least insurance {name}&apos;s law asks for</h2>
      {f.rule ? (
        <>
          <dl className="grid gap-x-6 gap-y-1 rounded-2xl bg-card p-5 text-sm ring-1 ring-border sm:grid-cols-[auto_1fr]">
            <dt className="font-medium">Liability (per person / per crash / property)</dt>
            <dd className="money">{limits(f.rule)}</dd>
            <dt className="font-medium">Personal injury protection (PIP)</dt>
            <dd>{flagCell(f.rule.pipRequired)}</dd>
            <dt className="font-medium">Medical payments</dt>
            <dd>{flagCell(f.rule.medPayRequired)}</dd>
            <dt className="font-medium">No-fault</dt>
            <dd>{noFaultCell(f.rule.noFault)}</dd>
            <dt className="font-medium">Uninsured motorist</dt>
            <dd>{flagCell(f.rule.umRequired)}</dd>
            <dt className="font-medium">Underinsured motorist</dt>
            <dd>{flagCell(f.rule.uimRequired)}</dd>
          </dl>
          <p className="text-muted-foreground">
            Liability pays for injuries and damage you cause to others, up to these limits. A minimum is the least the law
            allows, not a recommendation, and it doesn&apos;t pay to fix your own car.
          </p>
          {fault ? <p>{fault}</p> : null}
          <StateNoteBody rule={f.rule} />
        </>
      ) : (
        <p>We haven&apos;t checked this state&apos;s minimums yet.</p>
      )}

      <h2 id="teen">Adding a new teen driver in {name}</h2>
      <div className="grid gap-1 rounded-2xl bg-sun-soft p-5" data-testid="state-teen">
        <p className="text-sm font-medium text-sun-ink">Adding a 16-year-old to a typical policy</p>
        <p>
          <span className="money text-3xl font-semibold">about {differenceWords(f.teen.added.increase)}</span>
        </p>
        <p className="text-sm">Whole policy with the teen: {rangeWords(f.teen.added.after.low, f.teen.added.after.high)} a year.</p>
      </div>
      <p>{teenParagraph(f)}</p>
      <p>{ownPolicyParagraph(f)}</p>
      <p className="text-sm text-muted-foreground">
        What adding a teen costs comes from California&apos;s published prices, comparing families with and without a teen,
        so the range is wide{f.code === "CA" ? "" : `, and ${name} may differ`}. Many insurers also give discounts for
        good grades and a driver-training course.{" "}
        <Link href="/guides/adding-a-teen-driver">How adding a teen driver works</Link>.
      </p>

      <h2 id="teen-cars">Cars that cost the least to insure for a teen in {name}</h2>
      <p>{teenCarsSummary(f)}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="py-2 text-left text-sm text-muted-foreground">
            The {TEEN_TOP} cheapest of the site&apos;s popular first cars, SUVs, and trucks for a new 16-year-old in {name},{" "}
            {TEEN_LIST_YEAR} models.
          </caption>
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
            {top.map((item) => {
              const page = carPageFor(SERVER_CATALOG, item.car.pick.make, item.car.pick.model)
              return (
                <tr key={item.car.label} className="border-b border-border/60">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    {item.car.pick.year}{" "}
                    {page ? <Link href={`/cars/${page.slug}`}>{item.car.model}</Link> : item.car.model}
                  </th>
                  <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{signedDollars(item.added.increase)} a year</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{estimateDollars(item.own.likely)} a year</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="font-medium">{SAME_ORDER_NOTE}</p>
      <p className="text-sm text-muted-foreground">
        &ldquo;Added to your policy&rdquo; is what adding the teen costs the household a year with that car. &ldquo;On their
        own policy&rdquo; is the teen&apos;s whole bill if they had one. Insurance cost is one thing to weigh: for crash
        safety, see the <a href="https://www.iihs.org/ratings" rel="noreferrer">IIHS ratings</a> and{" "}
        <a href="https://www.nhtsa.gov/ratings" rel="noreferrer">NHTSA&apos;s 5-star ratings</a>.{" "}
        <Link href="/guides/cheapest-cars-to-insure-for-teens">The national guide to cars for a new driver</Link>.
      </p>

      <div className="flex flex-wrap gap-3 pt-2">
        <a href={f.compareHref} className="btn btn-primary plain">
          Compare cars for your teen <ArrowRight className="size-4" aria-hidden="true" />
        </a>
        <a href={f.whatIfHref} className="btn plain">
          Try it with your own numbers
        </a>
      </div>
      <p className="text-sm text-muted-foreground">
        Compare opens these {TEEN_TOP} cars for a 16-year-old in {name}, and you can add up to 15. The What-if page opens
        a family in {name} adding a 16-year-old, starting from a 2020 Toyota Camry; put in your own car and what you pay.
      </p>

      <h2 id="sources">Where these numbers come from</h2>
      <ul className="bullets">
        <li>
          Typical prices:{" "}
          {NAIC ? (
            <a href={NAIC.url} rel="noreferrer">
              {NAIC.publisher}, {NAIC.name}
            </a>
          ) : (
            "NAIC"
          )}
          , 2023 data, brought up to today with the government&apos;s price index for car insurance.
        </li>
        <li>The law: {name}&apos;s own statute or insurance department, listed above with the date we checked it.</li>
        <li>
          Teen drivers and cars: the same math as the rest of the site. <Link href="/methodology">Here&apos;s how we got these</Link>,
          and <Link href="/sources">every source</Link>.
        </li>
      </ul>
    </TrustArticle>
  )
}
