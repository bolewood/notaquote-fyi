import type { Metadata } from "next"
import Link from "next/link"
import { FactorTables } from "@/components/factor-tables"
import { RecordTrustView } from "@/components/record-trust-view"
import { TrustArticle } from "@/components/trust-article"
import { DATA_UPDATED, MODEL_VERSION, SOURCE_COUNT } from "@/lib/copy"
import { estimate, FACTOR_BUNDLE, formatDollars, typicalStart } from "@/lib/factor-engine"
import { DEFAULT_SCENARIO, stateName } from "@/lib/scenario"
import { suggestFixUrl } from "@/lib/suggest-fix"
import { ChevronDown } from "lucide-react"

export const metadata: Metadata = {
  title: "How it works",
  description: "Here's how we got the numbers: a starting price, a few adjustments, and a range. Every piece has a public source, or says it doesn't.",
}

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
  const state = stateName(DEFAULT_SCENARIO.state)

  return (
    <TrustArticle
      title="Here's how we got this"
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
            {example ? `${formatDollars(example.low)}–${formatDollars(example.high)}` : "a range"}
          </span>
          <span className="text-sm text-muted-foreground">
            {example ? `our best guess: ${formatDollars(example.likely)}` : "with a best guess"}
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
        We treat that average as the price for a middle-aged driver with a clean record, living in the suburbs, with an
        average car and a $1,000 deductible (the part of a repair bill you pay yourself). Then we adjust from there.
        Because it&apos;s an average across everyone, starting from it makes the range wider.{" "}
        <Link href="/sources#state-baselines">See the starting price for every state</Link>.
      </p>

      <h2>2. A few adjustments</h2>
      <p>
        Each thing that matters moves the price up or down by a percentage. A 16–18-year-old on their own policy, for
        example, costs almost three times what a 40–64-year-old does. One at-fault accident adds about half.
      </p>
      <p>
        Most of these come from state insurance departments that publish real prices from many companies for the same
        sample drivers, changing one thing at a time. That&apos;s the best public evidence there is, and it&apos;s sitting
        in PDFs and web tools that few people ever open.
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
        &ldquo;Why&rdquo; you see next to each car on the Compare page.
      </p>

      <h2>3. A range, not a price</h2>
      <p>
        Two companies can quote the same driver very different prices. So every estimate is a range, roughly where most
        companies would land, with our best guess marked in the middle. The more we had to estimate ourselves, the wider it
        gets. Real quotes can still land outside it.
      </p>

      <h2>What&apos;s sourced, and what&apos;s our estimate</h2>
      <p>We label every adjustment one of three ways, right next to the number:</p>
      <ul className="bullets">
        <li>
          <strong>From public prices or rules</strong> ({counts.sourced} adjustments). Taken from a state&apos;s published
          price survey or rules, with the source linked.
        </li>
        <li>
          <strong>From public data, roughly</strong> ({counts.indicative}). Worked out from public data, but less directly,
          so the range is a little wider.
        </li>
        <li>
          <strong>Our estimate, help wanted</strong> ({counts.assumed}). We couldn&apos;t find a public source yet, so we
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
          <strong>We don&apos;t sell anything.</strong> No leads, no ads, and nothing you type leaves your browser.
        </li>
      </ul>

      <h2>How you can help</h2>
      <p>
        {counts.assumed} of our adjustments are still our own estimates. If your state&apos;s insurance department publishes
        sample prices (many do, often as a PDF called a &ldquo;rate comparison guide&rdquo;), that could turn a guess into a
        sourced number for everyone.
      </p>
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
        Here&apos;s the full list, with how sure we are about each one. The worked details are in the{" "}
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

      <h2>Saving and sharing</h2>
      <p>
        Your choices are kept in this browser, so the pages remember them. Nothing is sent to us. A share link carries your
        choices, never prices, after the &ldquo;#&rdquo; in the address, which browsers don&apos;t send to any server. What
        you pay goes in only if you tick the box. Whoever opens the link gets the numbers worked out fresh.{" "}
        <Link href="/privacy">More about privacy</Link>.
      </p>

      <p className="text-sm text-muted-foreground">
        Data updated {DATA_UPDATED}. Math version {MODEL_VERSION}. <Link href="/model-version">What&apos;s changed</Link>
      </p>
    </TrustArticle>
  )
}
