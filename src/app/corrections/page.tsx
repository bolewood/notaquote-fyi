import type { Metadata } from "next"
import { HelpWantedList } from "@/components/help-wanted-list"
import { TrustArticle } from "@/components/trust-article"
import { CONTRIBUTING_URL, ISSUES_URL, suggestFixUrl, type FixKind } from "@/lib/suggest-fix"
import { ArrowUpRight, Bug, Car, Landmark, Percent } from "lucide-react"

export const metadata: Metadata = {
  title: "Help make this better",
  description: "Spot a number that looks wrong, or know a better source? Here's how to tell us, with or without code.",
}

const REPORT_TYPES: { kind: FixKind; heading: string; body: string; action: string; icon: typeof Car }[] = [
  {
    kind: "factor",
    heading: "A number looks wrong",
    body: "An adjustment seems too big or too small, looks out of date, or you know a better source, like your state's rate guide.",
    action: "Report a number",
    icon: Percent,
  },
  {
    kind: "state-rule",
    heading: "A state rule is missing or wrong",
    body: "What we show for your state's minimum coverage doesn't match the law.",
    action: "Report a state rule",
    icon: Landmark,
  },
  {
    kind: "vehicle",
    heading: "A car is missing or in the wrong group",
    body: "You can't find a car, or it's labeled as the wrong kind, like an SUV listed as a sedan.",
    action: "Report a car",
    icon: Car,
  },
  {
    kind: "bug",
    heading: "Something's broken",
    body: "A page won't load, a button doesn't work, or something looks off on your screen.",
    action: "Report a problem",
    icon: Bug,
  },
]

export default function CorrectionsPage() {
  return (
    <TrustArticle
      title="Help make this better"
      lead="NotAQuote.FYI is built in the open. We want every number to come from a public source anyone can check, and we're not all the way there yet. If something looks off, tell us, and you can watch the fix happen."
    >
      <h2>Spot something wrong? Tell us</h2>
      <p>
        Pick the kind of problem. Each button opens a short form on GitHub, where the project lives. You&apos;ll need a free
        GitHub account to send it.
      </p>
      <ul className="grid gap-3" aria-label="Kinds of problems">
        {REPORT_TYPES.map((type) => {
          const Icon = type.icon
          return (
            <li key={type.kind}>
              <a
                href={suggestFixUrl({ kind: type.kind })}
                rel="noreferrer"
                className="plain card group grid grid-cols-[auto_1fr_auto] items-start gap-4 p-5 transition-colors hover:border-primary/50"
              >
                <span className="grid size-10 place-items-center rounded-full bg-sun-soft text-sun-ink" aria-hidden="true">
                  <Icon className="size-5" />
                </span>
                <span className="grid gap-1">
                  <span className="font-semibold">{type.heading}</span>
                  <span className="text-sm leading-relaxed text-muted-foreground">{type.body}</span>
                  <span className="mt-1 text-sm font-medium text-primary group-hover:underline">{type.action}</span>
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </a>
            </li>
          )
        })}
      </ul>
      <p className="rounded-2xl bg-muted/70 p-4 text-sm">
        <strong>Your report is public.</strong> Please leave out what you pay, your VIN, your policy number, and anything
        else about you. We never add those to the form for you.
      </p>

      <h2>Five numbers that need a source</h2>
      <p>
        Four are our best guesses; the fifth rests on one state&apos;s prices. Many state insurance departments publish a &ldquo;rate comparison guide&rdquo;
        with sample prices from many companies. If yours shows one of these, a link turns a guess into a sourced number for
        everyone.
      </p>
      <HelpWantedList />

      <h2>What helps most</h2>
      <p>
        A link. The best sources are ones anyone can open: your state insurance department&apos;s website, the law itself, or
        a government dataset. Tell us the date you looked, too, since rules and rates change.
      </p>
      <p>No link? Tell us anyway. Someone else may be able to find one.</p>

      <h2>Want to fix it yourself?</h2>
      <p>
        The code is free under the MIT license, and the data we put together is free to reuse under CC BY 4.0. If
        you&apos;re comfortable with GitHub, you can send the change directly.{" "}
        <a href={CONTRIBUTING_URL} rel="noreferrer">
          Here&apos;s how to get started
        </a>
        . You can also{" "}
        <a href={ISSUES_URL} rel="noreferrer">
          see what others have reported
        </a>
        .
      </p>
    </TrustArticle>
  )
}
