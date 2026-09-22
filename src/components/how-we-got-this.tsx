import type { Estimate, StartKind } from "@/lib/factor-engine"
import { basisLabel, sourceLinks } from "@/lib/pricing"
import { suggestFixUrl } from "@/lib/suggest-fix"
import { cn } from "cn"
import Link from "next/link"

/** The engine's own words, then each change with where it came from. */
export function HowWeGotThis({
  estimate,
  startKind,
  startNote,
  state,
}: {
  estimate: Estimate
  startKind: StartKind
  /** One plain line about where the numbers start (see startLine). */
  startNote?: string
  /** The state being priced, to say when a number comes from another state's prices. */
  state: string
}) {
  return (
    <div className="grid gap-3 text-sm leading-relaxed">
      <p data-testid="estimate-summary">{estimate.summary}</p>
      {estimate.steps.length > 0 ? (
        <ul className="grid divide-y divide-border/70 border-y border-border/70">
          {estimate.steps.map((step) => {
            const sources = sourceLinks(step.sources)
            const ours = step.basis === "assumed"
            return (
              <li key={`${step.group}-${step.title}`} className="grid gap-0.5 py-2.5">
                <p>
                  <span className="font-semibold">{step.title}:</span> {step.from} <span aria-hidden="true">→</span>
                  <span className="sr-only">to</span> {step.to}
                </p>
                <p className="text-muted-foreground">
                  <span className={cn(ours && "font-medium text-sun-ink")}>{basisLabel(step.basis, step.sources, state)}</span>
                  {ours ? (
                    <>
                      {" · "}
                      <Link href="/corrections" className="link">
                        Know a source?
                      </Link>
                    </>
                  ) : null}
                  {sources.length > 0 ? " · " : ""}
                  {sources.map((source, index) => (
                    <span key={source.id}>
                      {index > 0 ? ", " : ""}
                      <a href={source.url} className="link" rel="noreferrer" target="_blank">
                        {source.publisher}
                      </a>
                    </span>
                  ))}
                </p>
              </li>
            )
          })}
        </ul>
      ) : null}
      <p className="text-muted-foreground" data-testid="range-note">
        {estimate.rangeNote}
      </p>
      {startNote ? (
        <p className="text-muted-foreground">
          {startNote}{" "}
          {startKind === "typical" ? (
            <Link href="/sources#state-baselines" className="link">
              See every state
            </Link>
          ) : null}
        </p>
      ) : null}
      <p>
        <Link href="/methodology" className="link">
          Here&apos;s how the whole thing works
        </Link>
      </p>
    </div>
  )
}

/**
 * "Does this look wrong for your car? Tell us." Opens a prefilled GitHub
 * issue with the site's own labels only: the car's name and the factors we
 * used, never anything the visitor typed or what they pay.
 */
export function VehicleFixLink({ carName, shown }: { carName: string; shown: string }) {
  const href = suggestFixUrl({
    kind: "vehicle",
    title: carName,
    fields: { vehicle: carName, shown },
  })
  return (
    <a href={href} className="link text-sm" rel="noreferrer" target="_blank" data-testid="vehicle-fix-link">
      Does this look wrong for this car? Tell us
    </a>
  )
}
