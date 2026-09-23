import Link from "next/link"
import { DATA_UPDATED, PUBLISHER } from "@/lib/copy"
import { GITHUB_REPO_URL } from "@/lib/suggest-fix"

const GROUPS: { heading: string; links: { href: string; label: string; external?: boolean; plain?: boolean }[] }[] = [
  {
    heading: "Use it",
    links: [
      { href: "/", label: "What-if" },
      { href: "/compare", label: "Compare cars" },
    ],
  },
  {
    heading: "How we know",
    links: [
      { href: "/methodology", label: "How it works" },
      { href: "/sources", label: "Sources" },
      { href: "/model-version", label: "What's changed" },
      { href: "/llms.txt", label: "For AI assistants", plain: true },
    ],
  },
  {
    heading: "The fine print",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/disclaimer", label: "Not a quote" },
      { href: "/data-licenses", label: "Data licenses" },
    ],
  },
  {
    heading: "Pitch in",
    links: [
      { href: "/corrections", label: "Suggest a fix" },
      { href: GITHUB_REPO_URL, label: "Source code on GitHub", external: true },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/40">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:px-6">
        <div className="grid content-start gap-2">
          <p className="text-base font-semibold tracking-tight">
            NotAQuote<span className="text-muted-foreground">.FYI</span>
          </p>
          <p className="max-w-xs leading-relaxed text-muted-foreground">
            Free and open source, from {PUBLISHER}. Not an insurance company, and nothing to sell.
          </p>
          <p className="text-muted-foreground">Data updated {DATA_UPDATED}.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {GROUPS.map((group) => (
            <div key={group.heading} className="grid content-start gap-2">
              <p className="font-semibold">{group.heading}</p>
              <ul className="grid gap-1.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    {link.external || link.plain ? (
                      <a href={link.href} rel={link.external ? "noreferrer" : undefined} className="rounded-sm text-muted-foreground hover:text-foreground hover:underline">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="rounded-sm text-muted-foreground hover:text-foreground hover:underline">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  )
}
