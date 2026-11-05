import { PUBLISHER } from "@/lib/copy"
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

/** A compact, high-contrast band: one row on wide screens, two short rows on phones. */
export function TrustStrip() {
  return (
    <section aria-labelledby="promises-heading" className="no-print mt-6 rounded-2xl border border-foreground/15 bg-card px-4 py-4 sm:px-5" data-testid="trust-band">
      <h2 id="promises-heading" className="sr-only">
        Our promises
      </h2>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-3 lg:grid-cols-4">
        {PROMISES.map((promise) => (
          <li key={promise.title} className="grid content-start gap-0.5">
            <Link href={promise.href} className="plain text-sm leading-snug font-semibold text-foreground hover:underline sm:text-base">
              {promise.title}
            </Link>
            <p className="hidden text-sm leading-snug text-muted-foreground sm:block">{promise.line}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-border pt-3 text-sm leading-snug text-muted-foreground">
        A non-commercial public tool from {PUBLISHER}. Not an insurance company, and no insurance partners. Built by a
        parent who wanted a straight answer.{" "}
        <Link href="/about" className="link whitespace-nowrap">
          Who made this →
        </Link>
      </p>
    </section>
  )
}
