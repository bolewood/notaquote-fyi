import type { Metadata } from "next"
import { TrustArticle } from "@/components/trust-article"
import { Button } from "@/components/ui/button"
import {
  CONTRIBUTING_URL,
  ISSUES_URL,
  suggestFixUrl,
  type FixKind,
} from "@/lib/suggest-fix"

export const metadata: Metadata = {
  title: "Help make this better",
}

const REPORT_TYPES: { kind: FixKind; heading: string; body: string; action: string }[] = [
  {
    kind: "factor",
    heading: "A number looks wrong",
    body: "An adjustment seems too big or too small, looks out of date, or needs a better source.",
    action: "Report a number",
  },
  {
    kind: "state-rule",
    heading: "A state rule is missing or wrong",
    body: "Your state's minimum coverage isn't listed yet, or what we show doesn't match the law.",
    action: "Report a state rule",
  },
  {
    kind: "vehicle",
    heading: "A car is missing or in the wrong group",
    body: "You can't find a car, or it's labeled as the wrong type, like an SUV listed as a sedan.",
    action: "Report a vehicle",
  },
  {
    kind: "bug",
    heading: "Something's broken",
    body: "A page won't load, a button doesn't work, or something looks off on screen.",
    action: "Report a problem",
  },
]

const linkClass = "underline underline-offset-4"

export default function CorrectionsPage() {
  return (
    <TrustArticle title="Help make this better">
      <p>
        NotAQuote.FYI is built in the open. We want every number to come from
        a public source that anyone can check, and we&apos;re not all the way
        there yet. If something looks off, tell us, and you can watch the fix
        happen.
      </p>

      <h2 className="mt-2 text-lg font-semibold tracking-tight">Spot something wrong? Tell us</h2>
      <p>
        Pick the kind of problem below. Each button opens a short form on
        GitHub, where the project lives. You&apos;ll need a free GitHub account
        to send it.
      </p>
      <ul className="grid gap-3" aria-label="Kinds of problems">
        {REPORT_TYPES.map((type) => (
          <li
            key={type.kind}
            className="grid gap-2 rounded-lg border border-border p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
          >
            <div>
              <h3 className="font-medium">{type.heading}</h3>
              <p className="text-muted-foreground">{type.body}</p>
            </div>
            <Button asChild variant="outline" className="justify-self-start">
              <a href={suggestFixUrl({ kind: type.kind })} rel="noreferrer">
                {type.action}
              </a>
            </Button>
          </li>
        ))}
      </ul>
      <p>
        <strong className="font-medium">Your report is public.</strong> Please
        leave out your premium, your VIN, your policy number, and anything else
        about you. We never add those to the form for you.
      </p>

      <h2 className="mt-2 text-lg font-semibold tracking-tight">What makes a report really helpful</h2>
      <p>
        A link. The best sources are ones anyone can open: your state insurance
        department&apos;s website, the law itself, or a government dataset. Tell
        us the date you looked at it, too, since rules and rates change.
      </p>
      <p>
        No link? Tell us anyway. Someone else may be able to find one.
      </p>

      <h2 className="mt-2 text-lg font-semibold tracking-tight">Want to fix it yourself?</h2>
      <p>
        The code is free to use under the MIT license, and the data we put
        together is free to reuse under CC BY 4.0. If you&apos;re comfortable
        with GitHub, you can send the change directly.{" "}
        <a href={CONTRIBUTING_URL} rel="noreferrer" className={linkClass}>
          Here&apos;s how to get started
        </a>
        . You can also{" "}
        <a href={ISSUES_URL} rel="noreferrer" className={linkClass}>
          see what others have reported
        </a>
        .
      </p>
    </TrustArticle>
  )
}
