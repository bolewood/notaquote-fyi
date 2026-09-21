"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

const LINKS = [
  { href: "/methodology", label: "Methodology" },
  { href: "/sources", label: "Sources" },
  { href: "/privacy", label: "Privacy" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="border-b border-border">
      <a
        href="#content"
        className="bg-background text-foreground border-border focus-visible:ring-ring absolute top-3 left-3 z-50 -translate-y-24 rounded-md border px-3 py-2 text-sm focus-visible:translate-y-0 focus-visible:ring-3"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-6">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight focus-visible:ring-ring rounded-sm focus-visible:ring-3"
        >
          NotAQuote.FYI
        </Link>
        <Link
          href="/disclaimer"
          className="text-foreground focus-visible:ring-ring rounded-sm text-sm font-medium focus-visible:ring-3"
        >
          Not a quote
        </Link>
        <nav aria-label="Trust pages" className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.map((link) => {
            const current = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring rounded-sm text-sm focus-visible:ring-3",
                  current ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
