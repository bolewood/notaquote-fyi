import type { Metadata } from "next"
import { MODELS_ENABLED } from "@/lib/car-page-links"
import { pageMetadata } from "@/lib/site-meta"
import Link from "next/link"
import { FactorTables } from "@/components/factor-tables"
import { RecordTrustView } from "@/components/record-trust-view"
import { TrustArticle } from "@/components/trust-article"
import { DATA_UPDATED, MODEL_VERSION, SOURCE_COUNT } from "@/lib/copy"
import { estimate, FACTOR_BUNDLE, formatDollars, typicalStart } from "@/lib/factor-engine"
import { estimateDollars, rangeDollars } from "@/lib/format"
import { HelpWantedList } from "@/components/help-wanted-list"
import { DEFAULT_SCENARIO, stateName } from "@/lib/scenario"
import { suggestFixUrl } from "@/lib/suggest-fix"
import { ChevronDown } from "lucide-react"

export const metadata: Metadata = pageMetadata({
  title: "How we work out the numbers",
  description: "Here's how we got the numbers: a starting price, a few adjustments, and a range. Every piece has a public source, or says it doesn't.",
  path: "/methodology",
})

/** How many of the adjustments come from a public source, and how many are our own estimate. */
function basisCounts() {
  const counts = { sourced: 0, indicative: 0, assumed: 0 }
  for (const [id, group] of Object.entries(FACTOR_BUNDLE.groups)) {
    if (id === "range" || id === "premium-split") continue
    for (const cell of Object.values(group.cells)) {
      if (cell.basis !== "reference") counts[cell.basis] += 1
    }
  }
  return counts
}

export default function MethodologyPage() {
  // A worked example, from the same math the site runs: the page's default situation.
  const start = typicalStart(DEFAULT_SCENARIO)
  const example = start ? estimate(start, DEFAULT_SCENARIO) : null
  const counts = basisCounts()
  const total = counts.sourced + counts.indicative + counts.assumed
  const state = stateName(DEFAULT_SCENARIO.state)

  return (
    <TrustArticle
      title="How we work out the numbers"
      lead="Every number on this site comes from one small piece of math that runs in your browser. It's simple on purpose, so anyone can check it."
    >
      <RecordTrustView />

      <h2>The whole idea, in one line</h2>
      <div className="grid gap-2 rounded-2xl bg-card p-5 shadow-[0_1px_2px_oklch(0.24_0.025_255/0.05)] ring-1 ring-border sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center sm:gap-3">
        <div className="grid gap-0.5">
          <span className="text-sm text-muted-foreground">Your starting price</span>
          <span className="money text-xl font-semibold">{start ? `about ${formatDollars(Math.round(start.annual / 10) * 10)}` : "Your price"}</span>
          <span className="text-sm text-muted-foreground">what you pay, or typical for your state</span>
        </div>
        <span className="text-2xl font-light text-muted-foreground sm:text-center" aria-label="times">
          ×
        </span>
        <div className="grid gap-0.5">
          <span className="text-sm text-muted-foreground">A few adjustments</span>
          <span className="text-xl font-semibold">driver, car, place, coverage</span>
          <span className="text-sm text-muted-foreground">each one a percentage up or down</span>
        </div>
        <span className="text-2xl font-light text-muted-foreground sm:text-center" aria-label="equals">
          =
        </span>
        <div className="grid gap-0.5">
          <span className="text-sm text-muted-foreground">A range</span>
          <span className="money text-xl font-semibold">
            {example ? rangeDollars(example.low, example.high) : "a range"}
          </span>
          <span className="text-sm text-muted-foreground">
            {example ? `our best guess: ${estimateDollars(example.likely)}` : "with a best guess"}
          </span>
        </div>
      </div>
      {example ? (
        <p className="text-sm text-muted-foreground">
          That example is the page&apos;s starting situation: a 40–64-year-old in the {state} suburbs with a 2020 Toyota Camry
          and full coverage.
        </p>
      ) : null}

      <h2>1. A starting price</h2>
      <p>
        If you tell us what you pay now, we start from your real number. It stays on your device, and it&apos;s the most
        accurate starting point there is.
      </p>
      <p>
        If you don&apos;t, we start from what drivers in your state paid on average in 2023 for <strong>full coverage</strong>:
        liability (which pays for damage you cause to others) plus collision and comprehensive (which fix or replace your
        own car). That figure comes from the National Association of Insurance Commissioners (NAIC). Prices have gone up
        since 2023, so we bring it up to today with the government&apos;s price index for car insurance.
      </p>
      <p>
        We treat that average as the price for a middle-aged driver with no at-fault accidents, living in the suburbs, with an
        average car and a $1,000 deductible (the part of a repair bill you pay yourself). Then we adjust from there.
        Because it&apos;s an average across everyone, starting from it makes the range wider.{" "}
        <Link href="/sources#state-baselines">See the starting price for every state</Link>.
      </p>

      <h2>2. A few adjustments</h2>
      <p>
        Each thing that matters moves the price up or down by a percentage. A 16–18-year-old on their own policy, for
        example, costs almost three times what a 40–64-year-old does. One at-fault accident adds about half (+52%).
      </p>
      <p>
        The best evidence comes from state insurance departments that publish real prices from many companies for the
        same sample drivers, changing one thing at a time. It&apos;s sitting in PDFs and web tools that few people ever
        open. Of our {total} adjustments, {counts.sourced} come straight from those published prices, {counts.indicative}{" "}
        are worked out from public data less directly, and {counts.assumed} are still our best guess.
      </p>
      <p>
        Some adjustments only touch part of the bill. About half of a full-coverage bill is liability; the rest fixes your
        own car. So the deductible, the car&apos;s age, and a loan only move the second part, and liability limits only move
        the first.
      </p>

      <h3>The car</h3>
      <p>
        The Highway Loss Data Institute (HLDI) publishes how each model&apos;s insurance claims compare with the average car.
        A car that costs more to repair raises the part of the bill that fixes your own car. A car whose drivers cause more
        crashes raises the liability part, though only partly, because insurers do the same. When we don&apos;t have a model,
        we use the average for its kind of car (small SUV, midsize car, and so on) and widen the range. That&apos;s the
        &ldquo;Why&rdquo; you see when you tap a car on the Compare page.
      </p>

      <h2>3. A range, not a price</h2>
      <p>
        Two companies can quote the same driver very different prices. So every estimate is a range, roughly where most
        companies would land, with our best guess marked in the middle. The more we had to estimate ourselves, the wider it
        gets. Real quotes can still land outside it.
      </p>

      <h2 id="car-pages">The car and state pages</h2>
      <p>
        The pages for {MODELS_ENABLED ? <Link href="/cars">each car</Link> : "each car"} and <Link href="/states">each state</Link> use this same math,
        worked out when the site is built, for one typical driver: a 45-year-old (our 40–64 group) with a clean record,
        7,500–15,000 miles a year, in the suburbs, with full coverage and a $1,000 deductible.
      </p>
      <ul className="bullets">
        <li>
          Car pages start from the national typical price: NAIC&apos;s 2023 average for full coverage across the country,
          brought up to today with the government&apos;s price index for car insurance, which is only a rough guide.
        </li>
        <li>
          Each state moves every car&apos;s price by the same share, so a car&apos;s place against other cars is the same
          everywhere. State pages use that state&apos;s typical price.
        </li>
        <li>
          We haven&apos;t found a public source for how a car&apos;s age changes the price, so that part is our estimate.
          The typical price stands for a car about 8 to 12 years old; a newer one costs more to replace.
        </li>
        <li>
          Companies&apos; prices differ a lot, even for the same driver and car, so real quotes can land well above or
          below any range here.
        </li>
        <li>
          Teen cars are 2022 models, about the age of a typical first car. What adding a teen costs comes from
          California&apos;s published prices, so its range is wide everywhere.
        </li>
      </ul>

      <h2>What&apos;s sourced, and what&apos;s our estimate</h2>
      <p>We label every adjustment one of three ways, right next to the number:</p>
      <ul className="bullets">
        <li>
          <strong>From published prices</strong> ({counts.sourced} of {total}). Taken from a state&apos;s published price
          survey or rules, with the source linked. When those prices come from another state, we say which one, since
          yours may differ.
        </li>
        <li>
          <strong>Worked out from public data</strong> ({counts.indicative} of {total}). Less direct, so the range is a
          little wider.
        </li>
        <li>
          <strong>Our best guess</strong> ({counts.assumed} of {total}). We couldn&apos;t find a public source yet, so we
          made a careful guess and widened the range. These are the best places to help.
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul className="bullets">
        <li>
          <strong>We don&apos;t ask about credit.</strong> Many insurers use it where the law allows, so your real quote
          could move up or down because of it.
        </li>
        <li>
          <strong>We don&apos;t use gender or marital status.</strong> Where a survey gives both, we average them.
        </li>
        <li>
          <strong>We don&apos;t know your address or your history with an insurer.</strong> Only your state, and whether the
          car is kept in a city, the suburbs, or a small town.
        </li>
        <li>
          <strong>We can&apos;t see every discount</strong>, like safe-driving apps or paying in full.
        </li>
        <li>
          <strong>We don&apos;t sell anything.</strong> No leads and no ads.
        </li>
      </ul>

      <h2>How you can help</h2>
      <p>
        {counts.assumed} of our adjustments are still our best guess. If your state&apos;s insurance department publishes
        sample prices (many do, often as a PDF called a &ldquo;rate comparison guide&rdquo;), it could turn a guess into a
        sourced number for everyone. These five would help the most. Four are our best guesses; the fifth rests on one
        state&apos;s prices.
      </p>
      <div className="rounded-2xl bg-sun-soft p-5">
        <HelpWantedList compact />
      </div>
      <p className="flex flex-wrap gap-3">
        <a href={suggestFixUrl({ kind: "factor" })} rel="noreferrer" className="btn btn-primary plain">
          Suggest a better number
        </a>
        <Link href="/corrections" className="btn plain">
          Other ways to help
        </Link>
      </p>

      <h2>Every number the math uses</h2>
      <p>
        Here&apos;s the full list, with how sure we are about each one. Each change is measured from the row marked
        &ldquo;Measured from here&rdquo;. The worked details are in the{" "}
        <a href="https://github.com/bolewood/notaquote-fyi/blob/main/data/factors/README.md" rel="noreferrer">
          factors notes on GitHub
        </a>
        , and all {SOURCE_COUNT} sources are on the <Link href="/sources">Sources</Link> page.
      </p>
      <details className="disclosure">
        <summary>
          Show every adjustment
          <ChevronDown className="size-4" aria-hidden="true" />
        </summary>
        <div className="pb-4">
          <FactorTables />
        </div>
      </details>

      <h2 id="ai-assistants">For AI assistants</h2>
      <p>
        Using an AI assistant to help, say to pick a few cars for a new driver? Ask it to read{" "}
        <a href="/llms.txt">notaquote.fyi/llms.txt</a> first. That page shows it how to get the same numbers you see here, from
        the same math, and asks it to show ranges, not single prices.
      </p>
      <p>
        The assistant only sends a state, a few choices like an age band or a coverage level, and car names. There&apos;s no
        place to send a premium, a VIN, a ZIP code, or a name, and we turn away requests that plainly include one.{" "}
        <Link href="/privacy">More about privacy</Link>.
      </p>

      <h2>Saving and sharing</h2>
      <p>
        Your choices are kept in this browser, so the pages remember them. The link carries your choices, not our
        estimates. It includes what you pay only if you check the box. It all sits after the &ldquo;#&rdquo; in the
        address, which browsers don&apos;t send to any server, and whoever opens the link gets the numbers worked out
        fresh.{" "}
        <Link href="/privacy">More about privacy</Link>.
      </p>

      <p className="text-sm text-muted-foreground">
        Data updated {DATA_UPDATED}. Math version {MODEL_VERSION}. <Link href="/model-version">What&apos;s changed</Link>
      </p>
    </TrustArticle>
  )
}
