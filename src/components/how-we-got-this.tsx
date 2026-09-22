import type { Estimate, StartKind } from "@/lib/factor-engine"
import { basisWords, sourceLinks } from "@/lib/pricing"
import { suggestFixUrl } from "@/lib/suggest-fix"
import Link from "next/link"

/** The engine's own words, then each change with where it came from. */
export function HowWeGotThis({
  estimate,
  startKind,
  startNote,
}: {
  estimate: Estimate
  startKind: StartKind
  /** One plain line about where the numbers start (see startLine). */
  startNote?: string
}) {
  return (
    <div className="grid gap-3 text-sm leading-relaxed">
      <p data-testid="estimate-summary">{estimate.summary}</p>
      <p className="text-muted-foreground" data-testid="range-note">
        {estimate.rangeNote}
      </p>
      {estimate.steps.length > 0 ? (
        <ul className="grid gap-2">
          {estimate.steps.map((step) => {
            const sources = sourceLinks(step.sources)
            return (
              <li key={`${step.group}-${step.title}`} className="rounded-lg bg-muted/70 px-3 py-2">
                <p>
                  <span className="font-medium">{step.title}:</span> {step.from} → {step.to}
                </p>
                <p className="text-xs text-muted-foreground">
                  {basisWords(step.basis)}
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
      {startNote ? (
        <p className="text-xs text-muted-foreground">
          {startNote}{" "}
          {startKind === "typical" ? (
            <Link href="/sources#state-baselines" className="link">
              See every state
            </Link>
          ) : null}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
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
      Does this look wrong for your car? Tell us
    </a>
  )
}
