import type { Metadata } from "next"
import Link from "next/link"
import { JsonLdScript } from "@/components/json-ld"
import { CompareStateRules, RatingRulesTable } from "@/components/rating-rules-table"
import { RecordTrustView } from "@/components/record-trust-view"
import { TrustArticle } from "@/components/trust-article"
import { UnaskedFactorsChart } from "@/components/unasked-factors-chart"
import { nationalTypicalStart } from "@/lib/factor-engine"
import {
  FACTOR_NAMES,
  fromSummary,
  RATING_RULES_CHECKED_ON,
  ratingGroup,
  ratingRule,
  reviewProgressLine,
  TABLE_FACTORS,
  type RatingFactor,
  type RatingGroup,
} from "@/lib/rating-rules"
import { DEFAULT_SCENARIO, STATES } from "@/lib/scenario"
import { articleJsonLd, pageMetadata, WHAT_WE_DONT_ASK_UPDATED } from "@/lib/site-meta"
import { formatVerifiedDate } from "@/lib/state-rules"
import { suggestFixUrl } from "@/lib/suggest-fix"
import { chartAxis, stateInsurerSpreads, unaskedFactors } from "@/lib/unasked-factors"

const TITLE = "What we don't ask, and why it matters"
const DESCRIPTION =
  "Your real quote can differ from our estimate. Here's how much credit, tickets, and your choice of insurer can move a price, and what each state allows."
const PATH = "/what-we-dont-ask"

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH })

/** What each factor is and why states disagree about it, in plain words. */
const FACTOR_TEXT: Record<RatingFactor, string> = {
  credit:
    "Many insurers use a credit-based insurance score, because people with lower scores tend to file more claims. Critics say it charges people more for being poor, not for driving badly. States have landed everywhere from banning it to allowing it with limits, like not letting it be the only reason for a higher price.",
  gender:
    "Young men crash more often than young women, so where it's allowed, insurers price it, mostly for teens and young adults. Several states ban it as unfair. It's a good example of states changing their minds in both directions.",
  age:
    "Age is one of the biggest factors in most states: teens pay the most, and prices fall through your twenties. A few states ban age outright and price on driving experience or your record instead.",
  maritalStatus:
    "Married drivers usually pay a little less where it's allowed. Some states ban it, saying it isn't about how you drive.",
  educationOccupation:
    "Some insurers have charged less for certain jobs or degrees. A few states ban this or limit it, saying it isn't about how you drive.",
  territory:
    "Where you live and park matters in almost every state, because crashes, theft, and repair costs differ by area. A few states limit how small an area can be used.",
  priorInsurance:
    "Going without insurance for a while can raise your price when you start again. Some states limit how much that can count.",
}

/** A state's name, with "(from a summary)" when its answer for this factor rests on one. */
function stateLabel(code: string, factor: RatingFactor): string {
  const name = STATES.find((item) => item.code === code)?.name ?? code
  return fromSummary(ratingRule(code, factor)) ? `${name} (from a summary)` : name
}

function listStates(codes: string[], factor: RatingFactor): string {
  const names = codes.map((code) => stateLabel(code, factor))
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

function statesWith(factor: RatingFactor, group: RatingGroup): string[] {
  return STATES.map((item) => item.code).filter((code) => {
    const rule = ratingRule(code, factor)
    return rule !== undefined && ratingGroup(rule) === group
  })
}

export default function WhatWeDontAskPage() {
  const factors = unaskedFactors()
  const start = nationalTypicalStart(DEFAULT_SCENARIO)
  const examplePrice = Math.round(start.annual / 10) * 10
  const spreads = Object.fromEntries(
    Object.entries(stateInsurerSpreads()).map(([code, spread]) => [
      code,
      { ...spread, stateName: STATES.find((item) => item.code === code)?.name ?? code },
    ]),
  )
  const insurer = factors.find((factor) => factor.id === "insurer")

  return (
    <TrustArticle
      wide
      title={TITLE}
      lead="Our estimates leave out some things insurers use: your credit, your choice of company, tickets, and more. Here's how much each one can move a price, and where the law allows it."
    >
      <JsonLdScript
        data={articleJsonLd({
          title: TITLE,
          description: DESCRIPTION,
          path: PATH,
          dateModified: WHAT_WE_DONT_ASK_UPDATED,
          datePublished: "2026-11-15",
        })}
      />
      <RecordTrustView />

      <div className="grid gap-1 rounded-2xl bg-sun-soft p-5" data-testid="rating-rules-disclaimer" role="note">
        <p className="font-semibold">A plain-language guide, not legal advice</p>
        <p>
          Laws change, and some answers below come from a summary of the law rather than the law itself. Those are marked
          &ldquo;from a summary&rdquo;. Before a big decision, check with your state&apos;s insurance department.
        </p>
      </div>

      <p>
        We keep the calculator short on purpose, and we never ask for anything personal. That means a real quote can come
        out higher or lower than ours. This page shows the biggest reasons why, with a source for every number, or a plain
        note when no public number exists.
      </p>

      <h2 id="what-moves-the-price">What moves the price</h2>
      <UnaskedFactorsChart factors={factors} examplePrice={examplePrice} spreads={spreads} axis={chartAxis()} />

      {insurer && insurer.low !== null && insurer.high !== null ? (
        <>
          <h3 id="why-insurers-disagree">Why insurers disagree so much</h3>
          <p>
            It surprises most people: companies don&apos;t come out close to each other. Each one builds its own price
            from its own claims history, its own list of factors, and its own weights. Companies also want different
            customers, so the same driver can be an ideal customer for one and someone another prices high. They can
            bring in about the same money overall and still disagree a lot about any one person.
          </p>
          <p>
            Across the five states&apos; surveys we use, for the same driver, car, and place, the middle half of companies ranged from
            about {Math.round((1 - insurer.low) * 100)}% below the middle company to about{" "}
            {Math.round((insurer.high - 1) * 100)}% above it. <strong>Of everything on this page, getting quotes from
            three or four companies is usually the biggest thing you control.</strong>
          </p>
        </>
      ) : null}

      <h2 id="state-by-state">The rules, state by state</h2>
      <p>
        Each state decides what car insurers may use to set a price. Some ban a factor outright, some allow it with
        limits, and most allow the common ones. The rules can be very different next door, so if you&apos;re thinking about
        a move, it&apos;s worth a look.
      </p>
      <p className="text-sm text-muted-foreground">
        Every answer below links to its source, and each state&apos;s line in the sections below shows that source&apos;s
        own words. Most come straight from the law; a few come from a summary of it, such as the state insurance
        department&apos;s guide, and say so. We&apos;re reviewing states a few at a time; one we haven&apos;t
        reviewed yet says so, which never means anything goes. Last checked {formatVerifiedDate(RATING_RULES_CHECKED_ON)}.
      </p>
      <p className="text-sm text-muted-foreground">
        {reviewProgressLine(STATES.map((item) => item.code))}.
      </p>

      {TABLE_FACTORS.map((factor) => {
        const banned = statesWith(factor, "banned")
        const limited = statesWith(factor, "limited")
        const allowed = statesWith(factor, "allowed")
        const notOnList = statesWith(factor, "not-on-list")
        return (
          <section key={factor} aria-labelledby={`rules-${factor}`}>
            <h3 id={`rules-${factor}`} className="scroll-mt-4">
              {FACTOR_NAMES[factor]}
            </h3>
            <p>{FACTOR_TEXT[factor]}</p>
            {banned.length > 0 ? (
              <p>
                <strong>Not allowed for car insurance in:</strong> {listStates(banned, factor)}.
              </p>
            ) : null}
            {limited.length > 0 ? (
              <p>
                <strong>Allowed with limits in:</strong> {listStates(limited, factor)}.
              </p>
            ) : null}
            {allowed.length > 0 ? (
              <p>
                <strong>Allowed in:</strong> {listStates(allowed, factor)}.
              </p>
            ) : null}
            {notOnList.length > 0 ? (
              <p>
                <strong>No ban in the state&apos;s rating law:</strong> {listStates(notOnList, factor)}.
              </p>
            ) : null}
            {banned.length + limited.length + allowed.length + notOnList.length > 0 ? (
              <ul className="bullets">
                {[...banned, ...limited, ...allowed, ...notOnList].map((code) => {
                  const rule = ratingRule(code, factor)
                  if (!rule) return null
                  const name = STATES.find((item) => item.code === code)?.name ?? code
                  const summaryBased = fromSummary(rule)
                  return (
                    <li key={code}>
                      <strong>
                        {name}
                        {summaryBased ? " (from a summary)" : ""}:
                      </strong>{" "}
                      {rule.summary}{" "}
                      <a href={rule.source.url} rel="noreferrer">
                        {rule.source.label}
                      </a>
                      <details className="text-sm text-muted-foreground">
                        <summary className="cursor-pointer">
                          {summaryBased ? "What the summary says" : "What the law says"}
                        </summary>
                        <blockquote className="mt-1 border-l-2 border-border pl-3">&ldquo;{rule.quote}&rdquo;</blockquote>
                        {(rule.moreSources ?? []).map((more) => (
                          <div key={more.url + more.label} className="mt-2">
                            <a href={more.url} rel="noreferrer">
                              {more.label}
                            </a>
                            <blockquote className="mt-1 border-l-2 border-border pl-3">&ldquo;{more.quote}&rdquo;</blockquote>
                          </div>
                        ))}
                      </details>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </section>
        )
      })}

      <h3 id="compare-two-states">Compare two states</h3>
      <p>Moving, or just curious? Pick two states to see what changes.</p>
      <CompareStateRules />

      <h3 id="all-states">Every state</h3>
      <RatingRulesTable />

      <h2 id="fix">See something wrong?</h2>
      <p>
        Laws change, and we&apos;re reviewing states a few at a time. If you know a rule we&apos;ve missed or gotten wrong,
        please tell us, with a link to the law.
      </p>
      <p>
        <a href={suggestFixUrl({ kind: "state-rule", title: "Rating rules: " })} rel="noreferrer" className="btn btn-primary plain">
          Suggest a fix
        </a>
      </p>
      <p className="text-sm text-muted-foreground">
        For how the estimate itself works, see <Link href="/methodology">How the math works</Link> and{" "}
        <Link href="/sources">Where the numbers come from</Link>.
      </p>
    </TrustArticle>
  )
}
