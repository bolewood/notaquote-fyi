"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

const MAIN = [
  { href: "/", label: "What if" },
  { href: "/compare", label: "Compare cars" },
]

const HELP = [
  { href: "/methodology", label: "How it works" },
  { href: "/sources", label: "Sources" },
  { href: "/privacy", label: "Privacy" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="border-b border-border bg-background/85">
      <a
        href="#content"
        className="bg-background text-foreground border-border focus-visible:ring-ring absolute top-3 left-3 z-50 -translate-y-24 rounded-md border px-3 py-2 text-sm focus-visible:translate-y-0 focus-visible:ring-3"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 lg:px-6">
        <Link href="/" aria-label="NotAQuote.FYI home" className="flex items-center gap-2 rounded-sm py-1 text-base font-semibold tracking-tight focus-visible:ring-3 focus-visible:ring-ring">
          <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-foreground text-sm font-bold text-background">
            N
          </span>
          <span className="hidden min-[400px]:inline">NotAQuote<span className="text-muted-foreground">.FYI</span></span>
        </Link>
        <nav aria-label="Main" className="flex gap-1">
          {MAIN.map((link) => {
            const current = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring",
                  current ? "bg-foreground text-background" : "text-foreground hover:bg-muted",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
        <nav aria-label="Help" className="ml-auto hidden flex-wrap gap-x-4 gap-y-1 sm:flex">
          {HELP.map((link) => {
            const current = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-sm text-sm focus-visible:ring-3 focus-visible:ring-ring",
                  current ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
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
