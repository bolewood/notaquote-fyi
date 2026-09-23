import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { JsonLdScript } from "@/components/json-ld"
import { TrustArticle } from "@/components/trust-article"
import { differenceWords, estimateDollars, monthlyDollars, rangeDollars, rangeWords, signedDollars } from "@/lib/format"
import { addTeenHref, guideModified, nationalTeenCost, shareWords, TEEN_CARS_GUIDE, TEEN_COST_GUIDE, teenCostByState } from "@/lib/guides"
import { HELP_WANTED, helpWantedUrl } from "@/lib/help-wanted"
import { articleJsonLd, GUIDES_IMAGE, pageMetadata } from "@/lib/site-meta"
import { statePath } from "@/lib/state-pages"

const GUIDE = TEEN_COST_GUIDE

export const metadata: Metadata = pageMetadata({ title: GUIDE.title, description: GUIDE.description, path: GUIDE.path, type: "article", image: GUIDES_IMAGE })

export default function TeenCostGuide() {
  const national = nationalTeenCost()
  const rows = teenCostByState()
  const sorted = [...rows].sort((left, right) => left.added - right.added)
  const cheapest = sorted[0]
  const priciest = sorted.at(-1)!
  const teenHelp = HELP_WANTED.find((item) => item.id === "teen-added")

  return (
    <TrustArticle
      title={GUIDE.title}
      lead={`Adding a new 16-year-old to a typical policy costs about ${differenceWords(national.added.increase)} nationally, ${shareWords(national.share)} than before. Here's why, what it looks like in your state, and what changes it.`}
      breadcrumbs={
        <Breadcrumbs
          crumbs={[
            { name: "Home", path: "/" },
            { name: "Guides", path: "/guides" },
            { name: "Adding a teen driver", path: GUIDE.path },
          ]}
        />
      }
    >
      <JsonLdScript
        data={articleJsonLd({ title: GUIDE.title, description: GUIDE.description, path: GUIDE.path, dateModified: guideModified(GUIDE), datePublished: GUIDE.published })}
      />

      <div className="grid gap-1 rounded-2xl bg-sun-soft p-5">
        <p className="text-sm font-medium text-sun-ink">Adding a 16-year-old to a typical policy, nationally</p>
        <p>
          <span className="money text-3xl font-semibold">about {differenceWords(national.added.increase)}</span>{" "}
          <span className="text-muted-foreground">(about {monthlyDollars(national.added.increase)} a month)</span>
        </p>
        <p className="text-sm">
          The whole policy: about {estimateDollars(national.added.before.likely)} a year before, and{" "}
          {rangeWords(national.added.after.low, national.added.after.high)} with the teen.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        A typical policy here is one average car with full coverage, for a 40–64-year-old with a clean record, at the
        national typical price. {national.start.attribution}
      </p>

      <h2 id="how">How adding a teen works</h2>
      <p>
        When a new driver joins your policy, the insurer reprices the whole household. The best public evidence we have is
        California&apos;s published prices, which compare families with and without a 17-year-old: the whole bill goes up
        {` ${shareWords(national.share)}`}. That&apos;s the figure we use everywhere, so outside California it&apos;s a rough guide and
        the range is wide.
      </p>
      <p>
        On a policy of their own, a new 16-year-old pays far more: about {estimateDollars(national.own.likely)} a year for the
        same kind of car ({rangeWords(national.own.low, national.own.high)}). That&apos;s why many families add a new driver
        to the policy they already have.
      </p>

      <h2 id="what-changes-it">What changes it</h2>
      <ul className="bullets">
        <li>
          <strong>Where you live.</strong> Every figure scales with your state&apos;s typical price. It&apos;s about{" "}
          {differenceWords(cheapest.added)} in {cheapest.name} and about {differenceWords(priciest.added)} in {priciest.name}.
        </li>
        <li>
          <strong>The car they drive.</strong> Cars with cheaper repairs and fewer claims cost less to add a teen with.{" "}
          <Link href={TEEN_CARS_GUIDE.path}>Cheapest cars to insure for a teen driver</Link>.
        </li>
        <li>
          <strong>Good grades and driver training.</strong> Many insurers give discounts for both. Discounts can bring it
          down noticeably; we don&apos;t have a public figure yet.
        </li>
        <li>
          <strong>Your coverage.</strong> A higher deductible (the part of a repair bill you pay yourself) lowers the
          yearly bill, and means paying more yourself after a crash. Try it on the What-if page.
        </li>
      </ul>

      <h2 id="by-state">By state</h2>
      <p>
        Adding a 16-year-old to a typical policy in each state, and the same teen on their own policy. Pick a state for its
        minimum coverage, its neighbors, and the cars that cost least to insure there.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="py-2 text-left text-sm text-muted-foreground">
            A new 16-year-old, one average car, full coverage, each state&apos;s typical price brought up to today.
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                State
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Adding them
              </th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-medium sm:table-cell">
                Whole policy with them
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Their own policy
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-b border-border/60">
                <th scope="row" className="py-2 pr-3 font-normal">
                  <Link href={statePath(row.code)}>{row.name}</Link>
                </th>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{signedDollars(row.added)}</td>
                <td className="hidden py-2 pr-3 text-right whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                  {rangeDollars(row.afterLow, row.afterHigh)}
                </td>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{estimateDollars(row.own)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="help">Help us make this better</h2>
      <p>
        What adding a teen costs outside California is one of the numbers we most need a public source for. If your
        state&apos;s insurance department publishes sample prices for a family before and after adding a 16- or
        17-year-old, it would sharpen every figure on this page.{" "}
        {teenHelp ? (
          <a href={helpWantedUrl(teenHelp)} rel="noreferrer">
            Send us the link
          </a>
        ) : null}
        .
      </p>

      <div className="flex flex-wrap gap-3 pt-2">
        <a href={addTeenHref()} className="btn btn-primary plain">
          Try it with your own numbers <ArrowRight className="size-4" aria-hidden="true" />
        </a>
        <Link href="/states" className="btn plain">
          Pick your state
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        The What-if page adds a new 16-year-old to your own situation. Tell it what you pay now for the closest estimate.{" "}
        <Link href="/methodology">Here&apos;s how we got these numbers</Link>.
      </p>
    </TrustArticle>
  )
}
