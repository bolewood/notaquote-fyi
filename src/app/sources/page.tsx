import type { Metadata } from "next"
import Link from "next/link"
import { JsonLdScript } from "@/components/json-ld"
import { pageMetadata, stateDatasetJsonLd } from "@/lib/site-meta"
import { RecordTrustView } from "@/components/record-trust-view"
import { StateBaselinesTable } from "@/components/state-baselines-table"
import { StateRulesTable } from "@/components/state-rules-table"
import { TrustArticle } from "@/components/trust-article"
import { NHTSA_CATALOG_URL, FUEL_ECONOMY_CATALOG_URL, CATALOG_RETRIEVED_ON } from "@/lib/catalog-meta"
import { longDate, SOURCE_COUNT } from "@/lib/copy"
import { FACTOR_BUNDLE } from "@/lib/factor-engine"
import { formatVerifiedDate, fullySourcedStateRules, sourcedStateRules, STATE_RULES, STATE_RULES_CHECKED_ON } from "@/lib/state-rules"
import { CONTRIBUTING_URL, GITHUB_REPO_URL, suggestFixUrl } from "@/lib/suggest-fix"
import { StatePicker } from "@/components/state-picker"
import { ChevronDown, HandHeart } from "lucide-react"

export const metadata: Metadata = pageMetadata({
  title: "Sources: where every number comes from",
  description: "Every public source behind the numbers, what we use it for, and when we last checked it, plus each state's typical price and minimum coverage.",
  path: "/sources",
})

type Listed = { id: string; publisher: string; title: string; url: string; checked: string; usedFor: string }

/** What each source is used for, in plain words. */
const USED_FOR: Record<string, string> = {
  "ca-2026": "How age, driving record, miles, bundling, and city or country change a price.",
  "tx-2025": "How age, driving record, miles, city or country, and liability limits change a price.",
  "ok-2026": "How age and city or country change a price.",
  "dc-2024": "How a driver's age changes a price.",
  "nd-2026": "How city or country changes a price.",
  "co-2023": "How city or country changes a price.",
  "nc-sdip-2026": "How an at-fault accident raises a price.",
  "hldi-2022-24": "How each model's insurance claims compare with the average car. This is the “Why” you see when you tap a car.",
  "iso-symbols-2004": "Why a car's crash record only partly moves the liability part of the bill.",
  "sp-global-vio-2023": "How old the average car is, which sets the car's age we start from.",
  "naic-auto-db-2022-2023": "The typical price for each state, and how a full-coverage bill splits.",
  "bls-cpi-sete": "How much car insurance prices have risen since 2023.",
  "iso-via-iii-2024": "How a full-coverage bill splits between liability and fixing your own car.",
}

const SECTIONS: { heading: string; intro: string; ids: string[] }[] = [
  {
    heading: "Real prices, from state insurance departments",
    intro:
      "Several states publish what many companies charge the same sample drivers, changing one thing at a time. That's the best public evidence there is for how a price moves.",
    ids: ["ca-2026", "tx-2025", "ok-2026", "dc-2024", "nd-2026", "co-2023", "nc-sdip-2026"],
  },
  {
    heading: "Cars",
    intro: "Which car you drive changes what it costs to fix and how often it's in a claim.",
    ids: ["hldi-2022-24", "iso-symbols-2004", "sp-global-vio-2023", "nhtsa-vpic", "fueleconomy"],
  },
  {
    heading: "Starting prices",
    intro: "When you don't tell us what you pay, we start from what drivers in your state pay on average.",
    ids: ["naic-auto-db-2022-2023", "bls-cpi-sete", "iso-via-iii-2024"],
  },
]

function listed(): Map<string, Listed> {
  const map = new Map<string, Listed>()
  for (const source of FACTOR_BUNDLE.sources) {
    map.set(source.id, {
      id: source.id,
      publisher: source.publisher,
      title: source.title,
      url: source.url,
      checked: longDate(source.checkedOn),
      usedFor: USED_FOR[source.id] ?? "",
    })
  }
  const catalogDate = longDate(CATALOG_RETRIEVED_ON)
  map.set("nhtsa-vpic", {
    id: "nhtsa-vpic",
    publisher: "National Highway Traffic Safety Administration",
    title: "vPIC vehicle listing",
    url: NHTSA_CATALOG_URL,
    checked: catalogDate,
    usedFor: "The list of cars you can pick, by model year. If you look up a VIN, your browser asks NHTSA directly.",
  })
  map.set("fueleconomy", {
    id: "fueleconomy",
    publisher: "FuelEconomy.gov (U.S. Department of Energy and EPA)",
    title: "Vehicle data file",
    url: FUEL_ECONOMY_CATALOG_URL,
    checked: catalogDate,
    usedFor: "Each car's versions, its size class, and whether it's gas, hybrid, or electric.",
  })
  return map
}

export default function SourcesPage() {
  const sources = listed()
  const rulesCount = sourcedStateRules().length
  return (
    <TrustArticle
      title="Sources"
      lead={`Every number here either comes from a public source you can open, or says it's our best guess. Here are all ${SOURCE_COUNT} sources, what we use each one for, and when we last checked it.`}
      wide
    >
      <RecordTrustView />
      <JsonLdScript data={stateDatasetJsonLd()} />
      <div className="max-w-2xl space-y-4">
        <p>
          Where we couldn&apos;t find a source, we say so right next to the number and widen the range. Further down, pick
          your state to see its typical price and the least insurance its law asks for.
        </p>
        <nav aria-label="On this page" className="flex flex-wrap gap-2 text-sm">
          <a href="#where-numbers-come-from" className="chip plain">
            Where the numbers come from
          </a>
          <a href="#state-baselines" className="chip plain">
            Your state
          </a>
          <a href="#all-states" className="chip plain">
            All states
          </a>
        </nav>
      </div>

      <h2 id="where-numbers-come-from">Where the numbers come from</h2>
      {SECTIONS.map((section) => (
        <section key={section.heading} className="mt-8 max-w-2xl" aria-label={section.heading}>
          <h3>{section.heading}</h3>
          <p className="mt-1 text-muted-foreground">{section.intro}</p>
          <ul className="mt-3 divide-y divide-border/70 border-y border-border/70">
            {section.ids.map((id) => {
              const source = sources.get(id)
              if (!source) return null
              return (
                <li key={id} id={`source-${id}`} className="grid gap-1 py-4" data-testid="source-row">
                  <p className="text-sm font-medium text-muted-foreground">{source.publisher}</p>
                  <p className="font-semibold">
                    <a href={source.url} rel="noreferrer" className="break-words">
                      {source.title}
                    </a>
                  </p>
                  <p>{source.usedFor}</p>
                  <p className="text-sm text-muted-foreground">Checked {source.checked}</p>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <section className="mt-8 max-w-2xl" aria-label="State laws">
        <h3>State laws</h3>
        <p className="mt-1">
          Each state&apos;s minimum coverage comes from its own statute or insurance department. All 50 states and DC link to
          theirs. <a href="#state-baselines">See your state</a>.
        </p>
      </section>

      <aside className="mt-12 grid max-w-2xl gap-3 rounded-3xl bg-sun-soft p-6 sm:grid-cols-[auto_1fr] sm:gap-4" aria-labelledby="help-heading">
        <span className="grid size-10 place-items-center rounded-full bg-card text-sun-ink" aria-hidden="true">
          <HandHeart className="size-5" />
        </span>
        <div className="grid gap-2">
          <p id="help-heading" className="text-lg font-semibold">
            Know your state&apos;s rate guide? Here&apos;s how to add it.
          </p>
          <p>
            Many state insurance departments publish a &ldquo;rate comparison guide&rdquo;: sample prices from many companies
            for the same drivers. Only a few are in here so far. Send us the link and the date you looked at it, and
            we&apos;ll work it in, in the open, where you can watch.
          </p>
          <p className="flex flex-wrap gap-3 pt-1">
            <a href={suggestFixUrl({ kind: "factor" })} rel="noreferrer" className="btn btn-primary plain">
              Send a source
            </a>
            <a href={CONTRIBUTING_URL} rel="noreferrer" className="btn plain">
              How to add it yourself
            </a>
          </p>
        </div>
      </aside>

      <h2 id="state-baselines">Your state</h2>
      <p id="state-rules" className="max-w-2xl">
        The typical price is what an average driver paid for one car in 2023. The minimums are the least insurance the law
        asks you to carry: not a price, and not advice about how much to buy. Each state also has{" "}
        <Link href="/states">its own page</Link>, with what a new teen driver adds there.
      </p>
      <div className="max-w-2xl">
        <StatePicker />
      </div>

      <h2 id="all-states">All states</h2>
      <p className="max-w-2xl">
        {rulesCount === STATE_RULES.length ? "All 50 states and DC link" : `${rulesCount} of ${STATE_RULES.length} rows link`}{" "}
        to a statute or government page, and {fullySourcedStateRules().length} have all three dollar limits. The newest check
        was {formatVerifiedDate(STATE_RULES_CHECKED_ON)}. Where we couldn&apos;t confirm something, it says &ldquo;Not
        confirmed yet&rdquo; and the state&apos;s notes say why.
      </p>
      <details className="disclosure">
        <summary>
          Typical price for every state
          <ChevronDown className="size-4" aria-hidden="true" />
        </summary>
        <div className="pb-4">
          <StateBaselinesTable />
        </div>
      </details>
      <details className="disclosure">
        <summary>
          Minimums and notes for every state
          <ChevronDown className="size-4" aria-hidden="true" />
        </summary>
        <div className="pb-4">
          <StateRulesTable />
        </div>
      </details>

      <p className="max-w-2xl text-sm text-muted-foreground">
        Want the full detail on each source (who owns it, the terms, and exactly which fields we took)? It&apos;s in the{" "}
        <a href={`${GITHUB_REPO_URL}/blob/main/src/data/source-manifest.json`} rel="noreferrer">
          source list on GitHub
        </a>
        .
      </p>
    </TrustArticle>
  )
}
