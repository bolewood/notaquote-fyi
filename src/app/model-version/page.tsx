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

type Day = { date: string; items: { title: string; body: React.ReactNode }[] }

export default function ModelVersionPage() {
  const days: Day[] = [
    {
      date: longDate(STATE_RULES_CHECKED_ON),
      items: [
        {
          title: "One set of math, what-ifs, and comparing cars",
          body: (
            <p>
              The made-up sample figures are gone. Every dollar on the site now comes from one set of math, starting from
              what you pay (if you tell us) or a typical price for your state. The home page answers &ldquo;what if I
              changed one thing?&rdquo;, and the new Compare page prices up to 15 cars for the same driver, with sorting,
              stars, a spreadsheet, and share links that never carry prices.
            </p>
          ),
        },
        {
          title: "Every state's minimums, and a typical price for each state",
          body: (
            <p>
              All 50 states and DC now have their legal minimum coverage, each with at least one source link and its own
              check date ({fullySourcedStateRules().length} of {sourcedStateRules().length} with all three dollar limits).
              Where we couldn&apos;t confirm something, the row says so instead of guessing. We also added a typical yearly
              price for each state, from the National Association of Insurance Commissioners&apos; 2023 figures, used with
              credit. The math starts from it when you don&apos;t enter what you pay.
            </p>
          ),
        },
      ],
    },
    {
      date: longDate(CATALOG_RETRIEVED_ON),
      items: [
        {
          title: "The first version of the math",
          body: (
            <p>
              At first it only worked from a premium you entered; the typical state prices came the next day. Share links
              remember which version of the math made them, never a price. If you open a link made with older math, the
              page says so and works the numbers out with today&apos;s.
            </p>
          ),
        },
        {
          title: "The list of cars",
          body: (
            <p>
              A list of cars from two government datasets, covering model years {CATALOG_YEAR_MIN} through{" "}
              {CATALOG_YEAR_MAX}. An optional VIN is looked up by your browser and not kept.
            </p>
          ),
        },
      ],
    },
  ]
  return (
    <TrustArticle
      title="What's changed"
      lead={`Every change to the math or the data gets an entry here, newest first. The data was last updated ${DATA_UPDATED}, and the math is version ${MODEL_VERSION}.`}
    >
      <RecordTrustView />
      <ol className="grid gap-0 border-l-2 border-border pl-6">
        {days.map((day) => (
          <li key={day.date} className="relative grid gap-4 pb-10 last:pb-0">
            <span className="absolute top-2 -left-[1.95rem] size-3 rounded-full bg-sun ring-4 ring-background" aria-hidden="true" />
            <h2 className="!mt-0 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{day.date}</h2>
            {day.items.map((item) => (
              <section key={item.title} className="grid gap-1">
                <h3 className="!mt-0 text-lg">{item.title}</h3>
                {item.body}
              </section>
            ))}
          </li>
        ))}
      </ol>
      <p>
        Spot a change that isn&apos;t here? <Link href="/corrections">Tell us</Link>.
      </p>
    </TrustArticle>
  )
}
