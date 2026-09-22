import type { Metadata } from "next"
import Link from "next/link"
import { RecordTrustView } from "@/components/record-trust-view"
import { TrustArticle } from "@/components/trust-article"
import { DATA_UPDATED, longDate, MODEL_VERSION } from "@/lib/copy"
import { CATALOG_RETRIEVED_ON, CATALOG_YEAR_MAX, CATALOG_YEAR_MIN } from "@/lib/catalog-meta"
import { fullySourcedStateRules, sourcedStateRules, STATE_RULES_CHECKED_ON } from "@/lib/state-rules"

export const metadata: Metadata = {
  title: "What's changed",
  description: "Every change to the math or the data, in plain words.",
}

type Entry = { date: string; title: string; body: React.ReactNode }

export default function ModelVersionPage() {
  const entries: Entry[] = [
    {
      date: "September 22, 2026",
      title: "One set of math, what-ifs, and comparing cars",
      body: (
        <p>
          The made-up sample figures are gone. Every dollar on the site now comes from one set of math, starting from what
          you pay (if you tell us) or a typical price for your state. The home page answers &ldquo;what if I changed one
          thing?&rdquo;, and the new Compare page prices up to 15 cars for the same driver, with sorting, stars, a
          spreadsheet, and share links that never carry prices.
        </p>
      ),
    },
    {
      date: longDate(STATE_RULES_CHECKED_ON),
      title: "Every state's minimums, and a typical price for each state",
      body: (
        <>
          <p>
            Every state and DC now has its legal minimum coverage, each with at least one source link and its own check date
            ({sourcedStateRules().length} states; {fullySourcedStateRules().length} with all three dollar limits). Where we
            couldn&apos;t confirm something, the row says so instead of guessing. Changes already passed into law are listed
            with their start dates.
          </p>
          <p>
            We added a typical yearly price for each state, from NAIC&apos;s 2023 figures, used with credit. The calculator
            starts from it when you don&apos;t enter what you pay.
          </p>
        </>
      ),
    },
    {
      date: "September 21, 2026",
      title: "The first version of the math",
      body: (
        <p>
          The first version of the math every number now comes from. At first it only worked from a premium you entered;
          the typical state prices came the next day.
        </p>
      ),
    },
    {
      date: "September 21, 2026",
      title: "Share links and saving",
      body: (
        <p>
          Share links remember which version of the math and data made them, never a price. If you open a link made with
          older math, the page says so and works the numbers out with today&apos;s.
        </p>
      ),
    },
    {
      date: longDate(CATALOG_RETRIEVED_ON),
      title: "The list of cars",
      body: (
        <p>
          A list of cars from NHTSA and FuelEconomy.gov, covering model years {CATALOG_YEAR_MIN} through {CATALOG_YEAR_MAX}.
          An optional VIN is looked up by your browser with NHTSA and not kept.
        </p>
      ),
    },
    {
      date: "September 21, 2026",
      title: "A first prototype",
      body: <p>A first try with made-up sample numbers, before any sourced data. It&apos;s gone; nothing on the site uses it.</p>,
    },
  ]
  return (
    <TrustArticle
      title="What's changed"
      lead={`Every change to the math or the data gets an entry here, newest first. The data was last updated ${DATA_UPDATED}, and the math is version ${MODEL_VERSION}.`}
    >
      <RecordTrustView />
      <ol className="grid gap-0 border-l-2 border-border pl-6">
        {entries.map((entry) => (
          <li key={entry.title} className="relative grid gap-2 pb-8 last:pb-0">
            <span className="absolute top-2 -left-[1.95rem] size-3 rounded-full bg-sun ring-4 ring-background" aria-hidden="true" />
            <p className="text-sm font-medium text-muted-foreground">{entry.date}</p>
            <h2 className="!mt-0 text-lg">{entry.title}</h2>
            {entry.body}
          </li>
        ))}
      </ol>
      <p>
        Spot a change that isn&apos;t here? <Link href="/corrections">Tell us</Link>.
      </p>
    </TrustArticle>
  )
}
