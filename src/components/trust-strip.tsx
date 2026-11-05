import { PUBLISHER } from "@/lib/copy"
import { cn } from "cn"
import { ChevronDown } from "lucide-react"
import Link from "next/link"

/**
 * The site's promises, stated plainly, right under the hero. Every line has
 * to stay literally true (see /privacy and /about): we count page views, so
 * we never say "we collect nothing".
 */
export const PROMISES: readonly { title: string; line: string; href: string }[] = [
  {
    title: "No ads.",
    line: "No ads, affiliate links, paid rankings or lead sales. No insurer or agent pays to be here.",
    href: "/about#promises",
  },
  {
    title: "Nothing you type is sent to us.",
    line: "The calculator runs in your browser. No account, no name, no ZIP code, no phone number. A VIN lookup goes straight to NHTSA.",
    href: "/privacy",
  },
  {
    title: "We don't sell your data.",
    line: "We don't sell data or share it with advertisers or insurers. We count page visits without recording what you type.",
    href: "/privacy#what-we-count",
  },
  {
    title: "See where the numbers come from.",
    line: "We link our sources and clearly label our own assumptions.",
    href: "/sources",
  },
]

function PromiseList({ details }: { details: boolean }) {
  return (
    <ul className={cn("grid gap-x-5 gap-y-3", details ? "sm:grid-cols-2 lg:grid-cols-4" : "")}>
      {PROMISES.map((promise) => (
        <li key={promise.title} className="grid content-start gap-0.5">
          <Link href={promise.href} className="plain text-sm leading-snug font-semibold text-foreground hover:underline sm:text-base">
            {promise.title}
          </Link>
          <p className="text-sm leading-snug text-muted-foreground">{promise.line}</p>
        </li>
      ))}
    </ul>
  )
}

function Kicker() {
  return (
    <p className="mt-3 border-t border-border pt-3 text-sm leading-snug text-muted-foreground">
      A non-commercial public tool from {PUBLISHER}. Not an insurance company, and no insurance partners. Built by a parent
      who wanted a straight answer.{" "}
      <Link href="/about" className="link whitespace-nowrap">
        Who made this →
      </Link>
    </p>
  )
}

/**
 * A compact, high-contrast band: one row on wide screens. On phones it's one
 * line that opens to the full promises, so the estimate stays near the top.
 */
export function TrustStrip() {
  return (
    <section aria-labelledby="promises-heading" className="no-print mt-5 sm:mt-6" data-testid="trust-band">
      <h2 id="promises-heading" className="sr-only">
        Our promises
      </h2>
      <details className="group rounded-2xl border border-foreground/15 bg-card px-4 py-3 sm:hidden" data-testid="trust-band-phone">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm leading-snug [&::-webkit-details-marker]:hidden">
          <span className="flex-1">
            <span className="font-semibold">Our promises:</span> no ads, nothing you type is sent to us…
          </span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
          <span className="sr-only">Show all</span>
        </summary>
        <div className="pt-3">
          <PromiseList details={false} />
          <Kicker />
        </div>
      </details>
      <div className="hidden rounded-2xl border border-foreground/15 bg-card px-5 py-4 sm:block">
        <PromiseList details />
        <Kicker />
      </div>
    </section>
  )
}
